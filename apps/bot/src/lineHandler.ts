import { supabaseAdmin, getSystemSetting } from './supabase';
import { WebhookEvent, MessageEvent, TextEventMessage, messagingApi } from '@line/bot-sdk';
import { getReplyFromAI } from './aiService';
import { logSystem } from './logger';

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

export async function notifyAdmin(reason: string, details: string) {
  const adminId = await getSystemSetting<string>('admin_line_user_id', process.env.ADMIN_LINE_USER_ID || '');
  if (!adminId || adminId.trim() === '') {
    logSystem('warn', 'LINE', 'ADMIN_LINE_USER_ID is missing or empty.');
    return;
  }

  const message = `🚨 แจ้งเตือน Handoff\nเหตุผล: ${reason}\nรายละเอียด: ${details}`;
  
  try {
    await lineClient.pushMessage({
      to: adminId,
      messages: [{ type: 'text', text: message }]
    });
    logSystem('info', 'LINE', 'Admin notified successfully.');
  } catch (error: any) {
    logSystem('error', 'LINE', `Error notifying admin: ${error.message}`);
  }
}

async function getCustomerName(userId?: string): Promise<string> {
  if (!userId) return 'ไม่ทราบชื่อ (Unknown)';
  try {
    const profile = await lineClient.getProfile(userId);
    return profile.displayName;
  } catch (err) {
    logSystem('error', 'LINE', `Error fetching profile: ${err}`);
    return `UserID: ${userId}`;
  }
}

export async function handleLineEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message') {
    logSystem('info', 'LINE', `Ignored event type: ${event.type}`);
    return;
  }

  const messageEvent = event as MessageEvent;
  const replyToken = messageEvent.replyToken;
  const userId = messageEvent.source?.userId;

  if (messageEvent.source.type === 'user' && messageEvent.source.userId === process.env.LINE_BOT_USER_ID) {
    return;
  }

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
    logSystem('info', 'LINE', `Ignored message type: ${messageEvent.message.type}`);
    return;
  }

  const userMessage = (messageEvent.message as TextEventMessage).text;

  // Secret command to easily get Group ID or User ID
  if (userMessage.trim() === '/getid') {
    let idToReport = messageEvent.source.userId;
    if (messageEvent.source.type === 'group') {
      idToReport = messageEvent.source.groupId;
    } else if (messageEvent.source.type === 'room') {
      idToReport = messageEvent.source.roomId;
    }
    await lineClient.replyMessage({
      replyToken: replyToken,
      messages: [{ type: 'text', text: `Your ID is:\n${idToReport}` }]
    });
    return;
  }

  // 3.1 Fetch Session state
  let chatHistory: { role: 'user' | 'assistant', content: string }[] = [];
  let isPaused = false;
  let isHumanOnly = false;
  const takeoverMinutes = await getSystemSetting<number>('takeover_duration_minutes', 120);
  
  if (userId) {
    try {
      const { data } = await supabaseAdmin.from('chat_sessions').select('history, is_paused, human_only, last_interaction_at').eq('user_id', userId).single();
      if (data) {
        if (data.history) chatHistory = data.history;
        if (data.human_only) {
          isHumanOnly = true;
          isPaused = true; // human_only patients are always paused
        } else if (data.is_paused) {
          const lastInteraction = new Date(data.last_interaction_at).getTime();
          const now = new Date().getTime();
          const timeoutMs = takeoverMinutes * 60 * 1000;
          if (now - lastInteraction > timeoutMs) {
            isPaused = false; // Auto resume
            logSystem('info', 'LINE', `Auto-resuming session for ${userId} after ${takeoverMinutes} minutes.`);
          } else {
            isPaused = true;
          }
        }
      }
    } catch (err) {
      // Ignored
    }
  }

  // 3.2 If paused or human_only, just update interaction time and stop
  if (isPaused) {
    if (userId) {
      // update without wiping other fields
      await supabaseAdmin.from('chat_sessions').update({
        last_message: userMessage,
        customer_name: customerName,
        last_interaction_at: new Date().toISOString()
      }).eq('user_id', userId);
    }
    logSystem('info', 'LINE', `User ${userId} is ${isHumanOnly ? 'human_only' : 'paused'}. Ignoring message.`);
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

  // Check global AI status before calling AI
  const aiStatusLine = await getSystemSetting<boolean>('ai_status_line', true);
  if (!aiStatusLine) {
    logSystem('info', 'LINE', 'Global AI is OFF for LINE. Skipping AI reply.');
    return;
  }

  // เพิ่มข้อความใหม่ของ user
  chatHistory.push({ role: 'user', content: userMessage });

  // จำกัดประวัติให้เหลือแค่ 10 ข้อความล่าสุด
  if (chatHistory.length > 10) {
    chatHistory = chatHistory.slice(chatHistory.length - 10);
  }

  logSystem('info', 'LINE', `Received text message: "${userMessage}"`);

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
    } catch (err: any) {
      logSystem('error', 'LINE', `Error saving chat session: ${err.message}`);
    }
  }

  // 5. Reply กลับหา user ด้วย LINE reply token
  try {
    logSystem('info', 'LINE', `Sending reply to user...`);
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
    logSystem('info', 'LINE', `Reply sent successfully.`);
  } catch (error: any) {
    logSystem('error', 'LINE', `Error sending reply: ${error.message}`);
  }
}
