"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // Load environment variables before other imports
const express_1 = __importDefault(require("express"));
const bot_sdk_1 = require("@line/bot-sdk");
const lineHandler_1 = require("./lineHandler");
const followUpCron_1 = require("./cron/followUpCron");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Start background cron jobs
(0, followUpCron_1.startCronJobs)();
// LINE configuration
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};
// Error handling middleware for LINE signature validation
const lineMiddleware = (0, bot_sdk_1.middleware)(lineConfig);
// 1. รับ POST /webhook จาก LINE
// 2. ตรวจสอบ signature ด้วย LINE_CHANNEL_SECRET ทุกครั้ง (จัดการโดย @line/bot-sdk middleware)
app.post('/webhook', lineMiddleware, async (req, res) => {
    try {
        const events = req.body.events;
        // Process all events
        await Promise.all(events.map(async (event) => {
            try {
                await (0, lineHandler_1.handleLineEvent)(event);
            }
            catch (err) {
                console.error(`[LINE] Error handling event:`, err);
            }
        }));
        res.status(200).json({ status: 'success' });
    }
    catch (error) {
        console.error(`[Webhook] Error processing webhook:`, error);
        res.status(500).json({ status: 'error' });
    }
});
const fbHandler_1 = require("./fbHandler");
// Facebook Webhook routes
app.get('/webhook/facebook', fbHandler_1.handleFbVerify);
app.post('/webhook/facebook', express_1.default.json(), fbHandler_1.handleFbEvent);
// 3. จัดการ error กรณี LINE signature ไม่ผ่าน หรือ error อื่นๆ ใน express
app.use((err, req, res, next) => {
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
