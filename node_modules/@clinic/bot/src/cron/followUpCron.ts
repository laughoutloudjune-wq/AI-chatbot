import cron from 'node-cron';
import { supabaseAdmin } from '../supabase';
import { messagingApi } from '@line/bot-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { getSystemPrompt } from '../systemPrompt';
import { sendFbMessage } from '../fbHandler';

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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

        const baseSystemPrompt = getSystemPrompt(process.env.CLINIC_NAME || 'คลินิก');

        const response = await anthropic.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
          max_tokens: 500,
          system: baseSystemPrompt,
          messages: [{ role: 'user', content: prompt }]
        });

        if (response.content.length > 0 && response.content[0].type === 'text') {
          const followUpMsg = response.content[0].text;

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
