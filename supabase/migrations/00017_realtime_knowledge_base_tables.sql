-- เปิด Realtime สำหรับตารางคลังความรู้และการตั้งค่าระบบ เพื่อให้บอทสามารถ subscribe
-- และล้าง in-memory cache ทันทีเมื่อแอดมินแก้ไขราคา/บริการ/FAQ/system prompt
-- แทนที่จะรอ cache TTL (3 นาที) หมดอายุเอง
ALTER PUBLICATION supabase_realtime ADD TABLE clinic_services;
ALTER PUBLICATION supabase_realtime ADD TABLE clinic_faqs;
ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
