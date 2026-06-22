-- ลูกค้าจาก LINE
CREATE TABLE IF NOT EXISTS customers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  text UNIQUE NOT NULL,
  display_name  text,
  skin_concerns text[],          -- ปัญหาผิวที่เคยพูดถึง
  visit_count   int DEFAULT 0,
  is_human_mode boolean DEFAULT false,  -- true = บอทหยุด รอพนักงาน
  created_at    timestamptz DEFAULT now()
);

-- แต่ละ session การสนทนา
CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  started_at  timestamptz DEFAULT now(),
  ended_at    timestamptz
);

-- ข้อความแต่ละบรรทัด
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  role            text CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- แพทย์ในคลินิก
CREATE TABLE IF NOT EXISTS doctors (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  specialty text,
  user_id   uuid REFERENCES auth.users(id)  -- login เข้า dashboard
);

-- ตารางเวลาว่างของแพทย์
CREATE TABLE IF NOT EXISTS schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid REFERENCES doctors(id),
  available_at timestamptz NOT NULL,
  is_booked   boolean DEFAULT false
);

-- การนัดหมายที่ยืนยันแล้ว
CREATE TABLE IF NOT EXISTS appointments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid REFERENCES customers(id),
  doctor_id    uuid REFERENCES doctors(id),
  schedule_id  uuid REFERENCES schedules(id),
  service_type text,
  confirmed_at timestamptz DEFAULT now(),
  reminded_at  timestamptz              -- ส่ง reminder แล้วหรือยัง
);

-- ตารางบริการของคลินิก (Knowledge Base)
CREATE TABLE IF NOT EXISTS clinic_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL,
  name            text NOT NULL,
  description     text,
  target_audience text,
  cautions        text,
  base_price      numeric,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ตารางคำถามที่พบบ่อย (Knowledge Base)
CREATE TABLE IF NOT EXISTS clinic_faqs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       text NOT NULL,
  question    text NOT NULL,
  answer      text NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_faqs ENABLE ROW LEVEL SECURITY;

-- Policies สำหรับตาราง Knowledge Base ให้อ่านได้สาธารณะ (ผ่าน anon_key)
CREATE POLICY "Allow public read access to clinic_services" ON clinic_services FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read access to clinic_faqs" ON clinic_faqs FOR SELECT USING (is_active = true);
