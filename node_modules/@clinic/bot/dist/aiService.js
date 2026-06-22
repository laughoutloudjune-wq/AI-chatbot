"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReplyFromClaude = getReplyFromClaude;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const systemPrompt_1 = require("./systemPrompt");
const supabase_1 = require("./supabase");
const anthropic = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});
async function getKnowledgeBaseContext() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return 'ไม่มีข้อมูลคลังความรู้เพิ่มเติม (Database not connected)';
    }
    try {
        let contextStr = '--- ข้อมูลบริการของคลินิก (อ้างอิงราคาและบริการตามนี้เท่านั้น) ---\n';
        // ดึงข้อมูลบริการ
        const { data: services, error: servicesError } = await supabase_1.supabaseAdmin
            .from('clinic_services')
            .select('*')
            .eq('is_active', true);
        if (servicesError)
            throw servicesError;
        if (services && services.length > 0) {
            services.forEach((s) => {
                let line = `- หมวดหมู่: ${s.category} | บริการ: ${s.name} | จุดเด่น: ${s.description || '-'} | เหมาะกับ: ${s.target_audience || '-'} | ข้อควรระวัง: ${s.cautions || '-'} | ราคาเริ่มต้น: ${s.base_price ? s.base_price + ' บาท' : 'ไม่ระบุ'}`;
                if (s.image_url) {
                    line += ` | รูปภาพแนบ: [IMAGE: ${s.image_url}]`;
                }
                contextStr += line + '\n';
            });
        }
        else {
            contextStr += 'ไม่มีข้อมูลบริการ\n';
        }
        contextStr += '\n--- ข้อมูลคำถามที่พบบ่อย (FAQs) ---\n';
        // ดึงข้อมูล FAQ
        const { data: faqs, error: faqsError } = await supabase_1.supabaseAdmin
            .from('clinic_faqs')
            .select('*')
            .eq('is_active', true);
        if (faqsError)
            throw faqsError;
        if (faqs && faqs.length > 0) {
            faqs.forEach((f) => {
                contextStr += `Q: ${f.question}\nA: ${f.answer}\n\n`;
            });
        }
        else {
            contextStr += 'ไม่มีข้อมูล FAQs\n';
        }
        return contextStr;
    }
    catch (error) {
        console.error('[Supabase] Error fetching knowledge base:', error);
        return 'เกิดข้อผิดพลาดในการดึงข้อมูลคลังความรู้';
    }
}
async function getReplyFromClaude(messages) {
    const envClinicName = process.env.CLINIC_NAME || 'คลินิกเสริมความงาม';
    const clinicName = await (0, supabase_1.getSystemSetting)('clinic_name', envClinicName);
    const baseSystemPrompt = (0, systemPrompt_1.getSystemPrompt)(clinicName);
    // ดึงคลังความรู้จาก Database
    console.log(`[AI] Fetching knowledge base from database...`);
    const knowledgeBase = await getKnowledgeBaseContext();
    const finalSystemPrompt = `${baseSystemPrompt}\n\n${knowledgeBase}`;
    try {
        console.log(`[AI] Sending message to Claude...`);
        const response = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', // ดึงจาก .env หรือใช้ claude-sonnet-4-6 ตามที่คุณต้องการ
            max_tokens: 1024,
            system: finalSystemPrompt,
            messages: messages,
        }, {
            timeout: 10000, // 10 seconds timeout
        });
        console.log(`[AI] Received response from Claude.`);
        if (response.content.length > 0 && response.content[0].type === 'text') {
            return response.content[0].text;
        }
        return 'ขออภัยค่ะ ระบบไม่สามารถตอบกลับได้ในขณะนี้';
    }
    catch (error) {
        console.error(`[AI] Error communicating with Claude:`, error);
        // จัดการ error กรณี Claude API timeout
        if (error instanceof sdk_1.default.APIError && error.status === 408) {
            return 'ขออภัยค่ะ ระบบตอบกลับล่าช้า กรุณาลองใหม่อีกครั้งนะคะ';
        }
        if (error instanceof sdk_1.default.APIConnectionTimeoutError) {
            return 'ขออภัยค่ะ การเชื่อมต่อกับระบบล่าช้ากว่าปกติ กรุณาลองใหม่อีกครั้งนะคะ';
        }
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งในภายหลังค่ะ';
    }
}
