import { supabaseAdmin, getSystemSetting } from './supabase';
import { WebhookEvent, MessageEvent, TextEventMessage, messagingApi } from '@line/bot-sdk';
import { getReplyFromAI } from './aiService';

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

export async function notifyAdmin(reason: string, details: string) {
  const adminId = await getSystemSetting<string>('admin_line_user_id', process.env.ADMIN_LINE_USER_ID || '');
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
  } catch (error) {
    console.error(`[LINE] Error notifying admin:`, error);
  }
}

async function getCustomerName(userId?: string): Promise<string> {
  if (!userId) return 'ไม่ทราบชื่อ (Unknown)';
  try {
    const profile = await lineClient.getProfile(userId);
    return profile.displayName;
  } catch (err) {
    console.error('[LINE] Error fetching profile:', err);
    return `UserID: ${userId}`;
  }
}

export async function handleLineEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message') {
    return;
  }

  const messageEvent = event as MessageEvent;
  const replyToken = messageEvent.replyToken;
  const userId = messageEvent.source?.userId;

  const customerName = await getCustomerName(userId);

  // 3. จัดการกรณีลูกค้าส่งรูปภาพ (มักจะให้หมอประเมิน) -> Handoff ทันที
  if (messageEvent.message.type === 'image') {
    await lineClient.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: 'แอดมินได้รับรูปแล้วค่ะ รบกวนรอสักครู่นะคะ เดี๋ยวให้คุณหมอประเมินให้นะคะ 🙏🏻' }],
    });
    await notifyAdmin('ลูกค้าส่งรูปภาพ', `ชื่อลูกค้า: ${customerName}`);
    
    if (userId) {
      await supabaseAdmin.from('chat_sessions').upsert({
        user_id: userId,
        customer_name: customerName,
        last_message: '[IMAGE]',
        last_interaction_at: new Date().toISOString(),
        is_paused: true,
        follow_up_sent: false
      });
    }
    return;
  }

  if (messageEvent.message.type !== 'text') {
    console.log(`[LINE] Ignored message type: ${messageEvent.message.type}`);
    return;
  }

  const message = messageEvent.message as TextEventMessage;
  const userMessage = message.text;

  // 3.1 Fetch Session state
  let chatHistory: { role: 'user' | 'assistant', content: string }[] = [];
  let isPaused = false;
  
  if (userId) {
    try {
      const { data } = await supabaseAdmin.from('chat_sessions').select('history, is_paused, last_interaction_at').eq('user_id', userId).single();
      if (data) {
        if (data.history) chatHistory = data.history;
        if (data.is_paused) {
          const lastInteraction = new Date(data.last_interaction_at).getTime();
          const now = new Date().getTime();
          const twoHours = 2 * 60 * 60 * 1000;
          if (now - lastInteraction > twoHours) {
            isPaused = false; // Auto resume
            console.log(`[LINE] Auto-resuming session for ${userId} after 2 hours.`);
          } else {
            isPaused = true;
          }
        }
      }
    } catch (err) {
      // Ignored
    }
  }

  // 3.2 If paused, just update interaction time and stop
  if (isPaused) {
    if (userId) {
      // update without wiping other fields
      await supabaseAdmin.from('chat_sessions').update({
        last_message: userMessage,
        customer_name: customerName,
        last_interaction_at: new Date().toISOString()
      }).eq('user_id', userId);
    }
    console.log(`[LINE] User ${userId} is paused. Ignoring message.`);
    return;
  }

  // 3.3 Keyword-based Handoff
  const defaultKeywords = ['รีวิว', 'influencer', 'ร่วมงาน', 'ติดต่อเรื่อง', 'marketing', 'อยู่ไกล', 'แพงไป', 'แพงจัง', 'คุยกับคน', 'ขอสายแอดมิน'];
  const handoffKeywords = await getSystemSetting<string[]>('handoff_keywords', defaultKeywords);
  const shouldHandoff = handoffKeywords.some(kw => userMessage.toLowerCase().includes(kw));

  if (shouldHandoff) {
    await lineClient.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: 'แอดมินรับทราบค่ะ รบกวนรอสักครู่นะคะ เดี๋ยวให้เจ้าหน้าที่ฝ่ายที่เกี่ยวข้องมาดูแลต่อนะคะ 🙏🏻' }],
    });
    await notifyAdmin('พบข้อความที่ต้องโอนสาย (Handoff)', `ชื่อลูกค้า: ${customerName}\nข้อความ: "${userMessage}"`);
    
    // Pause user
    if (userId) {
      chatHistory.push({ role: 'user', content: userMessage });
      await supabaseAdmin.from('chat_sessions').upsert({
        user_id: userId,
        customer_name: customerName,
        last_message: userMessage,
        history: chatHistory.slice(-10),
        last_interaction_at: new Date().toISOString(),
        is_paused: true,
        follow_up_sent: false
      });
    }
    return;
  }

  // เพิ่มข้อความใหม่ของ user
  chatHistory.push({ role: 'user', content: userMessage });

  // จำกัดประวัติให้เหลือแค่ 10 ข้อความล่าสุด
  if (chatHistory.length > 10) {
    chatHistory = chatHistory.slice(chatHistory.length - 10);
  }

  console.log(`[LINE] Received text message: "${userMessage}"`);

  // 4. ส่งประวัติทั้งหมดไปให้ Gemini พร้อม system prompt
  const replyText = await getReplyFromAI(chatHistory);

  // เพิ่มข้อความที่ Claude ตอบกลับไปในประวัติ
  chatHistory.push({ role: 'assistant', content: replyText });



  // Parse [IMAGE: url] จากคำตอบของ AI
  const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/g;
  const matches = [...replyText.matchAll(imageRegex)];
  const imageUrls: string[] = [];
  
  for (const match of matches) {
    if (imageUrls.length < 4) { // LINE allows max 5 bubbles per reply (1 text + up to 4 images)
      imageUrls.push(match[1]);
    }
  }
  let cleanReplyText = replyText.replace(imageRegex, '').trim();
  let isHandoff = false;

  // Detect if AI decided to handoff
  if (cleanReplyText.toUpperCase().includes('[HANDOFF]')) {
    isHandoff = true;
    cleanReplyText = cleanReplyText.replace(/\[HANDOFF\]/gi, '').trim();
  }

  if (isHandoff) {
    const customerName = await getCustomerName(userId);
    await notifyAdmin('AI ตัดสินใจโอนสาย (Handoff)', `ชื่อลูกค้า: ${customerName}\nข้อความล่าสุด: "${userMessage}"\n(AI ประเมินว่าเคสนี้ต้องการคนดูแล)`);
  }

  // บันทึกกลับลง Database
  if (userId) {
    try {
      await supabaseAdmin.from('chat_sessions').upsert({
        user_id: userId,
        customer_name: customerName,
        last_message: userMessage,
        history: chatHistory,
        last_interaction_at: new Date().toISOString(),
        is_paused: isHandoff,
        follow_up_sent: false
      });
    } catch (err) {
      console.error('[LINE] Error saving chat session:', err);
    }
  }

  // 5. Reply กลับหา user ด้วย LINE reply token
  try {
    console.log(`[LINE] Sending reply to user...`);
    const messagesToSend: any[] = [{ type: 'text', text: cleanReplyText }];
    
    if (imageUrls.length > 0) {
      imageUrls.forEach(url => {
        messagesToSend.push({
          type: 'image',
          originalContentUrl: url,
          previewImageUrl: url
        });
      });
    }

    await lineClient.replyMessage({
      replyToken: replyToken,
      messages: messagesToSend,
    });
    console.log(`[LINE] Reply sent successfully.`);
  } catch (error) {
    console.error(`[LINE] Error sending reply message:`, error);
  }
}
