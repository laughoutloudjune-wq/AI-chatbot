import { GoogleGenerativeAI } from '@google/generative-ai';

import { supabaseAdmin, getSystemSetting } from './supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function getKnowledgeBaseContext(): Promise<string> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 'ไม่มีข้อมูลคลังความรู้เพิ่มเติม (Database not connected)';
  }

  try {
    let contextStr = '--- ข้อมูลบริการของคลินิก (อ้างอิงราคาและบริการตามนี้เท่านั้น) ---\n';
    
    // ดึงข้อมูลบริการ
    const { data: services, error: servicesError } = await supabaseAdmin
      .from('clinic_services')
      .select('*')
      .eq('is_active', true);
      
    if (servicesError) throw servicesError;
    
    if (services && services.length > 0) {
      services.forEach((s: any) => {
        let line = `- หมวดหมู่: ${s.category} | บริการ: ${s.name} | จุดเด่น: ${s.description || '-'} | เหมาะกับ: ${s.target_audience || '-'} | ข้อควรระวัง: ${s.cautions || '-'} | ราคาเริ่มต้น: ${s.base_price ? s.base_price + ' บาท' : 'ไม่ระบุ'}`;
        if (s.image_url) {
          line += ` | รูปภาพแนบ: [IMAGE: ${s.image_url}]`;
        }
        contextStr += line + '\n';
      });
    } else {
      contextStr += 'ไม่มีข้อมูลบริการ\n';
    }

    contextStr += '\n--- ข้อมูลคำถามที่พบบ่อย (FAQs) ---\n';
    
    // ดึงข้อมูล FAQ
    const { data: faqs, error: faqsError } = await supabaseAdmin
      .from('clinic_faqs')
      .select('*')
      .eq('is_active', true);
      
    if (faqsError) throw faqsError;
    
    if (faqs && faqs.length > 0) {
      faqs.forEach((f: any) => {
        let line = `Q: ${f.question}\nA: ${f.answer}\n`;
        if (f.image_urls && Array.isArray(f.image_urls)) {
          f.image_urls.forEach((url: string) => {
            line += `รูปภาพแนบ: [IMAGE: ${url}]\n`;
          });
        }
        contextStr += line + '\n';
      });
    } else {
      contextStr += 'ไม่มีข้อมูล FAQs\n';
    }

    return contextStr;
  } catch (error) {
    console.error('[Supabase] Error fetching knowledge base:', error);
    return 'เกิดข้อผิดพลาดในการดึงข้อมูลคลังความรู้';
  }
}

export async function getReplyFromAI(messages: {role: 'user' | 'assistant', content: string}[]): Promise<string> {
  const envClinicName = process.env.CLINIC_NAME || 'คลินิกเสริมความงาม';
  const clinicName = await getSystemSetting<string>('clinic_name', envClinicName);
  const defaultPrompt = 'คุณคือแอดมินผู้ช่วยให้คำปรึกษาด้านความงามของ {{clinic_name}} มีบุคลิกสุภาพ เป็นมิตร อบอุ่น และใส่ใจลูกค้าเหมือนเพื่อนที่เชี่ยวชาญ\n\nสไตล์การสนทนา (Persona):\n- แทนตัวเองว่า "แอดมิน" เสมอ และเรียกผู้สนทนาว่า "คุณลูกค้า"\n- ใช้หางเสียง "ค่ะ" หรือ "คะ" ทุกครั้ง หลีกเลี่ยงคำตอบที่สั้นหรือดูห้วนเกินไป ให้ตอบแบบขยายความเสมอ\n- ตอบด้วยความสุภาพ อ่อนน้อม แต่ไม่ดูเป็นทางการหรือแข็งกระด้างจนเกินไป (Polite but informal)\n- ใช้ Emoji เพื่อความอบอุ่น เช่น 😊, 💕, 🙏🏻, ❤️\n\nกฎสำคัญ:\n- ตอบเป็นภาษาไทย กระชับ อ่านง่ายบนมือถือ ไม่เกิน 4–5 ประโยคต่อข้อความ\n- ห้ามใช้ Markdown formatting ในข้อความเด็ดขาด\n- เน้นการให้คำปรึกษา ห้ามเสนอขายโปรโมชั่น ห้ามบอกราคา และห้ามส่งรูปภาพแนบเด็ดขาด จนกว่าลูกค้าจะ "สอบถามเรื่องราคา" อย่างชัดเจน\n- ให้อ้างอิงราคาและบริการจาก "ข้อมูลคลังความรู้" เท่านั้น\n- ถ้าลูกค้าพูดถึงอาการแพ้ บวม เจ็บ บ่นเรื่องรอคิว หรือขอคุยกับคน ให้คุณตอบกลับพร้อมแนบคำว่า [HANDOFF] ไว้ท้ายข้อความ\n- ห้ามแนะนำยาหรือวินิจฉัยโรคใดๆ';
  const rawSystemPrompt = await getSystemSetting<string>('system_prompt', defaultPrompt);
  const baseSystemPrompt = rawSystemPrompt.replace(/\{\{clinic_name\}\}/g, clinicName);

  // ดึงคลังความรู้จาก Database
  console.log(`[AI] Fetching knowledge base from database...`);
  const knowledgeBase = await getKnowledgeBaseContext();
  
  const finalSystemPrompt = `${baseSystemPrompt}\n\n${knowledgeBase}`;

  try {
    console.log(`[AI] Sending message to Gemini...`);
    
    const model = genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
        systemInstruction: finalSystemPrompt
    });

    const mappedHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    // For safety, remove any empty text parts if they exist
    const validHistory = mappedHistory.filter(m => m.parts[0].text && m.parts[0].text.trim().length > 0);

    const response = await model.generateContent({
        contents: validHistory
    });

    console.log(`[AI] Received response from Gemini.`);
    return response.response.text();
  } catch (error) {
    console.error(`[AI] Error communicating with Gemini:`, error);
    return 'ขออภัยค่ะ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งในภายหลังค่ะ';
  }
}
