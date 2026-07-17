-- ตั้งค่าระยะเวลาหน่วง (วินาที) ก่อนบอทจะตอบกลับ เพื่อรวมข้อความที่ลูกค้าพิมพ์ติดกัน
-- หลายข้อความในเวลาสั้นๆ ให้เป็นบริบทเดียวกันก่อนเรียก AI แทนที่จะตอบทีละข้อความ
-- แยกกันจนหลุดประเด็น
INSERT INTO system_settings (key, value, description)
VALUES (
  'ai_reply_debounce_seconds',
  to_jsonb(6),
  'How many seconds the bot waits after a customer message before replying, to batch multiple quick messages into one AI reply'
)
ON CONFLICT (key) DO NOTHING;
