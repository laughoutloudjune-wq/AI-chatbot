import { GoogleGenerativeAI } from '@google/generative-ai';

import { supabaseAdmin, getSystemSetting } from './supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// clinic_services/clinic_faqs แทบไม่เปลี่ยนระหว่างข้อความแชท จึง cache ข้อมูลดิบไว้
// เพื่อลดการ query ตารางทั้งสองซ้ำทุกครั้งที่มีข้อความเข้ามา (การประกอบเป็นข้อความจริง
// ทำสดทุกครั้งเพราะขึ้นกับว่าลูกค้าถามราคาแล้วหรือยัง ดูฟังก์ชัน buildKnowledgeBaseContext)
const KNOWLEDGE_BASE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 นาที
let knowledgeBaseDataCache: { services: any[]; faqs: any[]; expiresAt: number } | null = null;

async function fetchKnowledgeBaseData(): Promise<{ services: any[]; faqs: any[] } | null> {
  if (knowledgeBaseDataCache && knowledgeBaseDataCache.expiresAt > Date.now()) {
    return knowledgeBaseDataCache;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const { data: services, error: servicesError } = await supabaseAdmin
    .from('clinic_services')
    .select('*')
    .eq('is_active', true);
  if (servicesError) throw servicesError;

  const { data: faqs, error: faqsError } = await supabaseAdmin
    .from('clinic_faqs')
    .select('*')
    .eq('is_active', true);
  if (faqsError) throw faqsError;

  const result = { services: services || [], faqs: faqs || [], expiresAt: Date.now() + KNOWLEDGE_BASE_CACHE_TTL_MS };
  knowledgeBaseDataCache = result;
  return result;
}

// คำที่บ่งบอกว่าลูกค้ากำลังถามเรื่องราคา/โปรโมชั่นอย่างชัดเจน ใช้ตรวจทั้งบทสนทนา
// (ไม่ใช่แค่ข้อความล่าสุด) เพราะเมื่อถามราคาไปแล้วครั้งหนึ่ง ก็ไม่ควรปิดบังราคาอีกในเทิร์นถัดๆ ไป
const PRICE_INTENT_KEYWORDS = [
  'ราคา', 'กี่บาท', 'เท่าไหร่', 'เท่าไร', 'โปรโมชั่น', 'โปรโมชัน', 'มีโปร', 'ขอโปร',
  'ค่าใช้จ่าย', 'ค่าบริการ', 'ขอราคา', 'แพงไหม', 'แพงมั้ย', 'price', 'cost', 'promotion'
];

function containsPriceIntent(messages: { role: 'user' | 'assistant', content: string }[]): boolean {
  return messages
    .filter((m) => m.role === 'user')
    .some((m) => {
      const text = m.content.toLowerCase();
      return PRICE_INTENT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
    });
}

// ข้อความ/คำตอบที่มีตัวเลขราคาฝังอยู่ (เช่น "2,690.-" หรือ "50u") ใช้กรอง FAQ ที่เปิดเผยราคา
// ออกจากคลังความรู้ตอนที่ลูกค้ายังไม่ได้ถามราคา เพื่อไม่ให้ AI หยิบราคามาบอกเองก่อนถูกถาม
const PRICE_PATTERN = /\d[\d,]*\s*(บาท|\.-|u\b)/i;

// แผนที่คำที่ลูกค้ามักพิมพ์ -> หมวดหมู่ (category ใน clinic_services / topic ใน clinic_faqs)
// ใช้กรองคลังความรู้ให้เหลือเฉพาะเรื่องที่ลูกค้ากำลังคุยอยู่ แทนที่จะยัดทุกบริการ (~50+ รายการ)
// เข้าไปให้ AI ทุกครั้ง ซึ่งทำให้โมเดลสับสนและหยิบบริการที่ไม่เกี่ยวข้องมาตอบ
// หมายเหตุ: เวลาเพิ่มหมวดหมู่ใหม่ในคลังความรู้ที่ลูกค้ามักเรียกด้วยคำเฉพาะตัว ควรเพิ่ม keyword ที่นี่ด้วย
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Botox': ['โบท็อก', 'โบท็อกซ์', 'botox', 'ลดกราม'],
  'Filler': ['ฟิลเลอร์', 'filler', 'เติมเต็ม', 'ร่องแก้ม', 'ปากกระจับ'],
  'Surgery': ['จมูก', 'เสริมจมูก', 'แก้จมูก', 'ศัลยกรรม', 'ไฝ', 'ปีกจมูก'],
  'Weight Loss': ['ลดน้ำหนัก', 'มันจาโร่', 'mounjaro', 'ปากกาลดน้ำหนัก'],
  'IV Drip': ['ไอวี', 'iv drip', 'ดริปวิตามิน', 'ผิวขาว', 'ผิวใส', 'ออร่า'],
  'Skin Tightening': ['ยกกระชับ', 'กระชับ', 'หย่อนคล้อย', 'ลิฟติ้ง', 'ลิฟท์', 'lifting', 'ultraformer', 'เหนียง'],
  'Skin Booster': ['สกินบูสเตอร์', 'บำรุงผิว', 'ผิวชุ่มชื้น', 'juvelook', 'rejuran'],
  'Mesotherapy': ['เมโส', 'mesotherapy', 'ฉีดวิตามินหน้า'],
  'Laser': ['เลเซอร์', 'กำจัดขน', 'laser'],
  'Biostimulator': ['profhilo', 'กระตุ้นคอลลาเจน'],
};

// หัวข้อ FAQ ที่ไม่ผูกกับบริการใดบริการหนึ่ง (นโยบาย/พฤติกรรมบอท) ต้องแสดงเสมอไม่ว่าลูกค้าจะคุยเรื่องอะไรอยู่
const ALWAYS_SHOW_FAQ_TOPICS = ['General', 'Booking', 'Payment', 'Aftercare', 'Scenario', 'Review'];

function detectRelevantCategories(combinedUserText: string): string[] {
  return Object.entries(CATEGORY_KEYWORDS)
    .filter(([, keywords]) => keywords.some((kw) => combinedUserText.includes(kw.toLowerCase())))
    .map(([category]) => category);
}

// นอกจากจับคู่ด้วยหมวดหมู่ ให้จับคู่ด้วยชื่อบริการโดยตรงด้วย (เช่นลูกค้าพิมพ์ชื่อแบรนด์ตรงๆ อย่าง
// "juvelook" หรือ "ultraformer") วิธีนี้ไม่ต้องแก้โค้ดทุกครั้งที่แอดมินเพิ่มบริการ/แบรนด์ใหม่ในคลังความรู้
function isServiceRelevant(service: any, combinedUserText: string, relevantCategories: string[]): boolean {
  if (relevantCategories.includes(service.category)) return true;
  const name = (service.name || '').toLowerCase();
  if (name && combinedUserText.includes(name)) return true;
  const nameWords = name.split(/[^a-zก-๙0-9]+/i).filter((w: string) => w.length >= 4);
  return nameWords.some((w: string) => combinedUserText.includes(w));
}

async function buildKnowledgeBaseContext(
  messages: { role: 'user' | 'assistant', content: string }[],
  allowPrices: boolean
): Promise<string> {
  let data: { services: any[]; faqs: any[] } | null;
  try {
    data = await fetchKnowledgeBaseData();
  } catch (error) {
    console.error('[Supabase] Error fetching knowledge base:', error);
    return 'เกิดข้อผิดพลาดในการดึงข้อมูลคลังความรู้';
  }

  if (!data) {
    return 'ไม่มีข้อมูลคลังความรู้เพิ่มเติม (Database not connected)';
  }

  const combinedUserText = messages.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase()).join(' ');
  const relevantCategories = detectRelevantCategories(combinedUserText);

  // ถ้าจับหัวข้อไม่ได้เลย (เช่นทักทายกว้างๆ) ให้แสดงทั้งหมดเหมือนเดิม เพื่อไม่ให้ตกหล่นข้อมูล
  const filteredServices = relevantCategories.length === 0
    ? data.services
    : data.services.filter((s: any) => isServiceRelevant(s, combinedUserText, relevantCategories));
  const visibleServices = filteredServices.length > 0 ? filteredServices : data.services;

  let contextStr = '--- ข้อมูลบริการของคลินิก (อ้างอิงราคาและบริการตามนี้เท่านั้น) ---\n';

  if (visibleServices.length > 0) {
    visibleServices.forEach((s: any) => {
      const priceText = allowPrices
        ? (s.base_price ? s.base_price + ' บาท' : 'ไม่ระบุ')
        : 'ลูกค้ายังไม่ได้ถามราคา (ห้ามบอกราคาจนกว่าจะถูกถามตรงๆ)';
      let line = `- หมวดหมู่: ${s.category} | บริการ: ${s.name} | จุดเด่น: ${s.description || '-'} | เหมาะกับ: ${s.target_audience || '-'} | ข้อควรระวัง: ${s.cautions || '-'} | ราคาเริ่มต้น: ${priceText}`;
      if (allowPrices && s.image_url) {
        line += ` | รูปภาพแนบ: [IMAGE: ${s.image_url}]`;
      }
      contextStr += line + '\n';
    });
  } else {
    contextStr += 'ไม่มีข้อมูลบริการ\n';
  }

  contextStr += '\n--- ข้อมูลคำถามที่พบบ่อย (FAQs) ---\n';

  const visibleFaqs = data.faqs.filter((f: any) => {
    if (!allowPrices && PRICE_PATTERN.test(f.answer || '')) return false;
    if (relevantCategories.length === 0) return true;
    if (ALWAYS_SHOW_FAQ_TOPICS.includes(f.topic)) return true;
    return relevantCategories.includes(f.topic);
  });

  if (visibleFaqs.length > 0) {
    visibleFaqs.forEach((f: any) => {
      let line = `Q: ${f.question}\nA: ${f.answer}\n`;
      if (allowPrices && f.image_urls && Array.isArray(f.image_urls)) {
        f.image_urls.forEach((url: string) => {
          line += `รูปภาพแนบ: [IMAGE: ${url}]\n`;
        });
      }
      contextStr += line + '\n';
    });
  } else {
    contextStr += 'ไม่มีข้อมูล FAQs\n';
  }

  if (!allowPrices) {
    contextStr += '\n(หมายเหตุ: ราคาถูกซ่อนไว้เพราะลูกค้ายังไม่ได้ถามเรื่องราคา/โปรโมชั่น หากลูกค้าถามราคาในข้อความนี้ ให้บอกว่าขอสอบถามเพิ่มเติมนิดนึงก่อนแนะนำราคาที่ตรงจุด แล้วรอให้ระบบส่งข้อมูลราคาให้ในข้อความถัดไป)\n';
  }

  return contextStr;
}

// เรียกจากฝั่ง admin dashboard (หรือ webhook) หลังแก้ไข clinic_services/clinic_faqs
// เพื่อให้บอทดึงข้อมูลล่าสุดในข้อความถัดไปทันที แทนที่จะรอ TTL หมดอายุ
export function clearKnowledgeBaseCache(): void {
  knowledgeBaseDataCache = null;
}

export async function getReplyFromAI(messages: {role: 'user' | 'assistant', content: string}[]): Promise<string> {
  const envClinicName = process.env.CLINIC_NAME || 'คลินิกเสริมความงาม';
  const clinicName = await getSystemSetting<string>('clinic_name', envClinicName);
  const defaultPrompt = 'คุณคือแอดมินผู้ช่วยให้คำปรึกษาด้านความงามของ {{clinic_name}} มีบุคลิกสุภาพ เป็นมิตร อบอุ่น และใส่ใจลูกค้าเหมือนเพื่อนที่เชี่ยวชาญ\n\nสไตล์การสนทนา (Persona):\n- แทนตัวเองว่า "แอดมิน" เสมอ และเรียกผู้สนทนาว่า "คุณลูกค้า"\n- ใช้หางเสียง "ค่ะ" หรือ "คะ" ทุกครั้ง หลีกเลี่ยงคำตอบที่สั้นหรือดูห้วนเกินไป ให้ตอบแบบขยายความเสมอ\n- ตอบด้วยความสุภาพ อ่อนน้อม แต่ไม่ดูเป็นทางการหรือแข็งกระด้างจนเกินไป (Polite but informal)\n- ใช้ Emoji เพื่อความอบอุ่น เช่น 😊, 💕, 🙏🏻, ❤️\n\nกฎสำคัญ:\n- ตอบเป็นภาษาไทย กระชับ อ่านง่ายบนมือถือ ไม่เกิน 4–5 ประโยคต่อข้อความ\n- ห้ามใช้ Markdown formatting ในข้อความเด็ดขาด\n- เน้นการให้คำปรึกษา ห้ามเสนอขายโปรโมชั่น ห้ามบอกราคา และห้ามส่งรูปภาพแนบเด็ดขาด จนกว่าลูกค้าจะ "สอบถามเรื่องราคา" อย่างชัดเจน\n- ให้อ้างอิงราคาและบริการจาก "ข้อมูลคลังความรู้" เท่านั้น\n- ถ้าลูกค้าพูดถึงอาการแพ้ บวม เจ็บ บ่นเรื่องรอคิว หรือขอคุยกับคน ให้คุณตอบกลับพร้อมแนบคำว่า [HANDOFF] ไว้ท้ายข้อความ\n- ห้ามแนะนำยาหรือวินิจฉัยโรคใดๆ';
  const rawSystemPrompt = await getSystemSetting<string>('system_prompt', defaultPrompt);
  const baseSystemPrompt = rawSystemPrompt.replace(/\{\{clinic_name\}\}/g, clinicName);

  // ดึงคลังความรู้จาก Database -- ซ่อนราคาไว้จนกว่าลูกค้าจะถามราคา/โปรโมชั่นจริงๆ ในบทสนทนา
  // (กันไม่ให้ AI หยิบราคาที่เห็นในคลังความรู้มาบอกเองก่อนถูกถาม)
  console.log(`[AI] Fetching knowledge base from database...`);
  const allowPrices = containsPriceIntent(messages);
  const knowledgeBase = await buildKnowledgeBaseContext(messages, allowPrices);

  const finalSystemPrompt = `${baseSystemPrompt}\n\n${knowledgeBase}`;

  try {
    console.log(`[AI] Sending message to Gemini...`);

    const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
        systemInstruction: finalSystemPrompt,
        generationConfig: {
          // บังคับความสั้นระดับ API ไม่พึ่งแค่คำสั่งใน prompt เพราะโมเดล lite
          // มักไม่ทำตามกฎความยาวได้แม่นยำนักเมื่อ context ยาว
          maxOutputTokens: 150,
          temperature: 0.6
        }
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
