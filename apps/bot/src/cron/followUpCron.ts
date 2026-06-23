import cron from 'node-cron';
import { supabaseAdmin } from '../supabase';
import { messagingApi } from '@line/bot-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSystemSetting } from '../supabase';
import { sendFbMessage } from '../fbHandler';

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export function startCronJobs() {
  console.log('[Cron] Initializing cron jobs...');
  // รันทุกๆ 1 นาที
  cron.schedule('* * * * *', async () => {
    try {
      // หาลูกค้าที่ไม่ได้คุยมาเกิน 10 นาที แต่ไม่เกิน 24 ชั่วโมง
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: sessions, error } = await supabaseAdmin
        .from('chat_sessions')
        .select('*')
        .eq('follow_up_sent', false)
        .lt('last_interaction_at', tenMinutesAgo)
        .gt('last_interaction_at', twentyFourHoursAgo);

      if (error) throw error;

      for (const session of sessions || []) {
        console.log(`[Cron] Triggering follow-up for user ${session.user_id}`);
        
        // ให้ AI ช่วยแต่งประโยค Follow-up
        const prompt = `ลูกค้าคนนี้ได้พิมพ์ข้อความล่าสุดทิ้งไว้ว่า "${session.last_message}" และหายไปเกิน 10 นาทีแล้ว
กรุณาแต่งประโยคสั้นๆ 1-2 ประโยค เพื่อทักไปถามไถ่ (Follow-up) อย่างสุภาพและเป็นกันเอง ตามสไตล์ของแอดมินคลินิก
เช่น ถ้าลูกค้าถามเรื่องลดน้ำหนัก ให้ถามเป้าหมายน้ำหนักของเขาเพิ่มเติม`;

        const clinicName = process.env.CLINIC_NAME || 'คลินิก';
        const defaultPrompt = 'คุณคือแอดมินผู้ช่วยให้คำปรึกษาด้านความงามของ {{clinic_name}} มีบุคลิกสุภาพ เป็นมิตร อบอุ่น และใส่ใจลูกค้าเหมือนเพื่อนที่เชี่ยวชาญ\n\nสไตล์การสนทนา (Persona):\n- แทนตัวเองว่า "แอดมิน" เสมอ และเรียกผู้สนทนาว่า "คุณลูกค้า"\n- ใช้หางเสียง "ค่ะ" หรือ "คะ" ทุกครั้ง หลีกเลี่ยงคำตอบที่สั้นหรือดูห้วนเกินไป ให้ตอบแบบขยายความเสมอ\n- ตอบด้วยความสุภาพ อ่อนน้อม แต่ไม่ดูเป็นทางการหรือแข็งกระด้างจนเกินไป (Polite but informal)\n- ใช้ Emoji เพื่อความอบอุ่น เช่น 😊, 💕, 🙏🏻, ❤️\n\nกฎสำคัญ:\n- ตอบเป็นภาษาไทย กระชับ อ่านง่ายบนมือถือ ไม่เกิน 4–5 ประโยคต่อข้อความ\n- ห้ามใช้ Markdown formatting ในข้อความเด็ดขาด\n- เน้นการให้คำปรึกษา ห้ามเสนอขายโปรโมชั่น ห้ามบอกราคา และห้ามส่งรูปภาพแนบเด็ดขาด จนกว่าลูกค้าจะ "สอบถามเรื่องราคา" อย่างชัดเจน\n- ให้อ้างอิงราคาและบริการจาก "ข้อมูลคลังความรู้" เท่านั้น\n- ถ้าลูกค้าพูดถึงอาการแพ้ บวม เจ็บ บ่นเรื่องรอคิว หรือขอคุยกับคน ให้คุณตอบกลับพร้อมแนบคำว่า [HANDOFF] ไว้ท้ายข้อความ\n- ห้ามแนะนำยาหรือวินิจฉัยโรคใดๆ';
        const rawSystemPrompt = await getSystemSetting<string>('system_prompt', defaultPrompt);
        const baseSystemPrompt = rawSystemPrompt.replace(/\{\{clinic_name\}\}/g, clinicName);

        const model = genAI.getGenerativeModel({ 
          model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
          systemInstruction: baseSystemPrompt
        });

        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const followUpMsg = response.response.text();
        if (followUpMsg && followUpMsg.trim().length > 0) {

          const isFb = session.user_id.startsWith('fb_');

          if (isFb) {
            const senderId = session.user_id.replace('fb_', '');
            await sendFbMessage(senderId, followUpMsg);
          } else {
            // ส่งหาลูกค้าผ่าน Push Message
            await lineClient.pushMessage({
              to: session.user_id,
              messages: [{ type: 'text', text: followUpMsg }]
            });
          }

          // อัปเดตสถานะว่า follow up ไปแล้ว
          await supabaseAdmin
            .from('chat_sessions')
            .update({ follow_up_sent: true })
            .eq('user_id', session.user_id);
            
          console.log(`[Cron] Follow-up sent to ${session.user_id}`);
        }
      }
    } catch (err) {
      console.error('[Cron] Error running follow-up job:', err);
    }
  });
}
