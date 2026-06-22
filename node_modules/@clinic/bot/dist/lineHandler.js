"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAdmin = notifyAdmin;
exports.handleLineEvent = handleLineEvent;
const supabase_1 = require("./supabase");
const bot_sdk_1 = require("@line/bot-sdk");
const aiService_1 = require("./aiService");
const lineClient = new bot_sdk_1.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});
async function notifyAdmin(reason, details) {
    const adminId = await (0, supabase_1.getSystemSetting)('admin_line_user_id', process.env.ADMIN_LINE_USER_ID || '');
    if (!adminId || adminId.trim() === '') {
        console.error('[LINE] ADMIN_LINE_USER_ID is missing or empty.');
        return;
    }
    const message = `🚨 แจ้งเตือน Handoff\nเหตุผล: ${reason}\nรายละเอียด: ${details}`;
    try {
        await lineClient.pushMessage({
            to: adminId,
            messages: [{ type: 'text', text: message }]
        });
        console.log(`[LINE] Admin notified successfully.`);
    }
    catch (error) {
        console.error(`[LINE] Error notifying admin:`, error);
    }
}
async function getCustomerName(userId) {
    if (!userId)
        return 'ไม่ทราบชื่อ (Unknown)';
    try {
        const profile = await lineClient.getProfile(userId);
        return profile.displayName;
    }
    catch (err) {
        console.error('[LINE] Error fetching profile:', err);
        return `UserID: ${userId}`;
    }
}
async function handleLineEvent(event) {
    if (event.type !== 'message') {
        return;
    }
    const messageEvent = event;
    const replyToken = messageEvent.replyToken;
    const userId = messageEvent.source?.userId;
    // 3. จัดการกรณีลูกค้าส่งรูปภาพ (มักจะให้หมอประเมิน) -> Handoff ทันที
    if (messageEvent.message.type === 'image') {
        await lineClient.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'แอดมินได้รับรูปแล้วค่ะ รบกวนรอสักครู่นะคะ เดี๋ยวให้คุณหมอประเมินให้นะคะ 🙏🏻' }],
        });
        const customerName = await getCustomerName(userId);
        await notifyAdmin('ลูกค้าส่งรูปภาพ', `ชื่อลูกค้า: ${customerName}`);
        return;
    }
    if (messageEvent.message.type !== 'text') {
        console.log(`[LINE] Ignored message type: ${messageEvent.message.type}`);
        return;
    }
    const message = messageEvent.message;
    const userMessage = message.text;
    // 3.1 Keyword-based Handoff
    const defaultKeywords = ['รีวิว', 'influencer', 'ร่วมงาน', 'ติดต่อเรื่อง', 'marketing', 'อยู่ไกล', 'แพงไป', 'แพงจัง', 'คุยกับคน', 'ขอสายแอดมิน'];
    const handoffKeywords = await (0, supabase_1.getSystemSetting)('handoff_keywords', defaultKeywords);
    const shouldHandoff = handoffKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    if (shouldHandoff) {
        await lineClient.replyMessage({
            replyToken: replyToken,
            messages: [{ type: 'text', text: 'แอดมินรับทราบค่ะ รบกวนรอสักครู่นะคะ เดี๋ยวให้เจ้าหน้าที่ฝ่ายที่เกี่ยวข้องมาดูแลต่อนะคะ 🙏🏻' }],
        });
        const customerName = await getCustomerName(userId);
        await notifyAdmin('พบข้อความที่ต้องโอนสาย (Handoff)', `ชื่อลูกค้า: ${customerName}\nข้อความ: "${userMessage}"`);
        return;
    }
    // 3.2 บันทึก Session และดึงประวัติเพื่อส่งให้ AI
    let chatHistory = [];
    if (userId) {
        try {
            // ดึงประวัติเดิม
            const { data } = await supabase_1.supabaseAdmin.from('chat_sessions').select('history').eq('user_id', userId).single();
            if (data && data.history) {
                chatHistory = data.history;
            }
        }
        catch (err) {
            console.error('[LINE] Error fetching chat session:', err);
        }
    }
    // เพิ่มข้อความใหม่ของ user
    chatHistory.push({ role: 'user', content: userMessage });
    // จำกัดประวัติให้เหลือแค่ 10 ข้อความล่าสุด เพื่อไม่ให้เปลือง Token
    if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(chatHistory.length - 10);
    }
    console.log(`[LINE] Received text message: "${userMessage}"`);
    // 4. ส่งประวัติทั้งหมดไปให้ Claude พร้อม system prompt
    const replyText = await (0, aiService_1.getReplyFromClaude)(chatHistory);
    // เพิ่มข้อความที่ Claude ตอบกลับไปในประวัติ
    chatHistory.push({ role: 'assistant', content: replyText });
    // บันทึกกลับลง Database
    if (userId) {
        try {
            await supabase_1.supabaseAdmin.from('chat_sessions').upsert({
                user_id: userId,
                last_message: userMessage,
                history: chatHistory,
                last_interaction_at: new Date().toISOString(),
                follow_up_sent: false
            });
        }
        catch (err) {
            console.error('[LINE] Error saving chat session:', err);
        }
    }
    // Parse [IMAGE: url] จากคำตอบของ AI
    const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/g;
    let imageUrl = null;
    const matches = [...replyText.matchAll(imageRegex)];
    if (matches.length > 0) {
        imageUrl = matches[0][1];
    }
    const cleanReplyText = replyText.replace(imageRegex, '').trim();
    // 5. Reply กลับหา user ด้วย LINE reply token
    try {
        console.log(`[LINE] Sending reply to user...`);
        const messagesToSend = [{ type: 'text', text: cleanReplyText }];
        if (imageUrl) {
            messagesToSend.push({
                type: 'image',
                originalContentUrl: imageUrl,
                previewImageUrl: imageUrl
            });
        }
        await lineClient.replyMessage({
            replyToken: replyToken,
            messages: messagesToSend,
        });
        console.log(`[LINE] Reply sent successfully.`);
    }
    catch (error) {
        console.error(`[LINE] Error sending reply message:`, error);
    }
}
