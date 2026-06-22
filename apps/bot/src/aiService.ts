import Anthropic from '@anthropic-ai/sdk';
import { getSystemPrompt } from './systemPrompt';
import { supabaseAdmin, getSystemSetting } from './supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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
        contextStr += `Q: ${f.question}\nA: ${f.answer}\n\n`;
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

export async function getReplyFromClaude(messages: {role: 'user' | 'assistant', content: string}[]): Promise<string> {
  const envClinicName = process.env.CLINIC_NAME || 'คลินิกเสริมความงาม';
  const clinicName = await getSystemSetting<string>('clinic_name', envClinicName);
  const baseSystemPrompt = getSystemPrompt(clinicName);

  // ดึงคลังความรู้จาก Database
  console.log(`[AI] Fetching knowledge base from database...`);
  const knowledgeBase = await getKnowledgeBaseContext();
  
  const finalSystemPrompt = `${baseSystemPrompt}\n\n${knowledgeBase}`;

  try {
    console.log(`[AI] Sending message to Claude...`);
    const response = await anthropic.messages.create(
      {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', // ดึงจาก .env หรือใช้ claude-sonnet-4-6 ตามที่คุณต้องการ
        max_tokens: 1024,
        system: finalSystemPrompt,
        messages: messages,
      },
      {
        timeout: 10000, // 10 seconds timeout
      }
    );

    console.log(`[AI] Received response from Claude.`);
    if (response.content.length > 0 && response.content[0].type === 'text') {
      return response.content[0].text;
    }
    
    return 'ขออภัยค่ะ ระบบไม่สามารถตอบกลับได้ในขณะนี้';
  } catch (error) {
    console.error(`[AI] Error communicating with Claude:`, error);
    
    // จัดการ error กรณี Claude API timeout
    if (error instanceof Anthropic.APIError && error.status === 408) {
       return 'ขออภัยค่ะ ระบบตอบกลับล่าช้า กรุณาลองใหม่อีกครั้งนะคะ';
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
       return 'ขออภัยค่ะ การเชื่อมต่อกับระบบล่าช้ากว่าปกติ กรุณาลองใหม่อีกครั้งนะคะ';
    }
    
    return 'ขออภัยค่ะ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งในภายหลังค่ะ';
  }
}
