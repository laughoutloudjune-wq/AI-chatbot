import 'dotenv/config'; // Load environment variables before other imports
import express, { Request, Response, NextFunction } from 'express';
import { middleware, WebhookEvent } from '@line/bot-sdk';
import { handleLineEvent } from './lineHandler';
import { startCronJobs } from './cron/followUpCron';

const app = express();
const port = process.env.PORT || 3000;

// Start background cron jobs
startCronJobs();

// LINE configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// Error handling middleware for LINE signature validation
const lineMiddleware = middleware(lineConfig);

// 1. รับ POST /webhook จาก LINE
// 2. ตรวจสอบ signature ด้วย LINE_CHANNEL_SECRET ทุกครั้ง (จัดการโดย @line/bot-sdk middleware)
app.post('/webhook', lineMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const events: WebhookEvent[] = req.body.events;
    
    // Process all events
    await Promise.all(
      events.map(async (event: WebhookEvent) => {
        try {
          await handleLineEvent(event);
        } catch (err) {
          console.error(`[LINE] Error handling event:`, err);
        }
      })
    );

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error(`[Webhook] Error processing webhook:`, error);
    res.status(500).json({ status: 'error' });
  }
});

import { handleFbVerify, handleFbEvent } from './fbHandler';

// Facebook Webhook routes
app.get('/webhook/facebook', handleFbVerify);
app.post('/webhook/facebook', express.json(), handleFbEvent);

// 3. จัดการ error กรณี LINE signature ไม่ผ่าน หรือ error อื่นๆ ใน express
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error && err.message.includes('signature validation failed')) {
    console.error('[LINE] Signature validation failed:', err.message);
    res.status(401).send('Signature validation failed');
    return;
  }
  
  console.error('[Express] Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`[Server] Listening on port ${port}`);
});
