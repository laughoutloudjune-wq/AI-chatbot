# Project Context — Beauty Clinic LINE Chatbot System

> วางไฟล์นี้ที่ root ของ project ในชื่อ CLAUDE.md หรือ .cursorrules
> IDE AI (Cursor / Windsurf / Claude Code) จะอ่านอัตโนมัติทุก session

---

## Purpose ของระบบ

ระบบแชทบอทอัจฉริยะบน LINE Official Account สำหรับคลินิกเสริมความงาม
เป้าหมายหลักคือให้บอททำหน้าที่เป็น "ที่ปรึกษาด้านผิวพรรณ" ไม่ใช่เซลล์
และจัดการนัดหมายได้อัตโนมัติโดยไม่ต้องมีพนักงานคอยตอบตลอดเวลา

---

## Tech Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Runtime            | Node.js 20+                             |
| Language           | TypeScript (strict mode, ห้ามใช้ `any`) |
| API Server         | Express.js                              |
| Frontend/Dashboard | Next.js 14 (App Router)                 |
| Backend-as-a-Service | Supabase                              |
| Database           | PostgreSQL (ผ่าน Supabase)              |
| Auth               | Supabase Auth (Dashboard login)         |
| Realtime           | Supabase Realtime (แจ้งเตือน admin)    |
| Storage            | Supabase Storage (รูปภาพผิว)           |
| LINE Integration   | @line/bot-sdk v9                        |
| AI Engine          | Anthropic Claude API (claude-sonnet-4-6)|
| Hosting (bot)      | Railway                                 |
| Hosting (dashboard)| Vercel                                  |

**หมายเหตุ:** ไม่ใช้ Prisma — ใช้ Supabase client (`@supabase/supabase-js`) โดยตรงทั้งหมด

---

## Supabase Project

- **Project ref:** wwfcbqlebnakvorcdequ
- **Region:** ap-southeast-1 (Singapore)
- **URL pattern:** `https://wwfcbqlebnakvorcdequ.supabase.co`

Environment variables ที่ต้องใช้:
```
SUPABASE_URL=https://wwfcbqlebnakvorcdequ.supabase.co
SUPABASE_ANON_KEY=        ← ใช้ใน client-side / LINE bot (read-only)
SUPABASE_SERVICE_ROLE_KEY= ← ใช้ใน server-side เท่านั้น (full access) ห้าม expose
```

---

## โครงสร้าง Monorepo

```
clinic-system/
├── apps/
│   ├── bot/                   ← LINE Webhook Server (Express)
│   │   └── src/
│   │       ├── index.ts       ← Entry point
│   │       ├── lineHandler.ts ← รับ Event จาก LINE
│   │       ├── aiService.ts   ← เรียก Claude API
│   │       ├── systemPrompt.ts← บุคลิกและกฎของบอท
│   │       └── supabase.ts    ← Supabase client instance
│   └── dashboard/             ← Admin + Doctor Dashboard (Next.js)
│       └── src/app/
│           ├── (admin)/       ← หน้า Admin
│           └── (doctor)/      ← หน้า Doctor
├── packages/
│   ├── types/                 ← TypeScript types ที่ใช้ทั้งระบบ
│   └── ai/                    ← AI service + prompt logic
├── supabase/
│   └── migrations/            ← SQL migration files
├── .env.example
└── package.json               ← Turborepo workspace root
```

---

## Database Schema

Migration ทั้งหมดอยู่ใน `supabase/migrations/` และ apply ผ่าน Supabase CLI

```sql
-- ลูกค้าจาก LINE
customers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  text UNIQUE NOT NULL,
  display_name  text,
  skin_concerns text[],          -- ปัญหาผิวที่เคยพูดถึง
  visit_count   int DEFAULT 0,
  is_human_mode boolean DEFAULT false,  -- true = บอทหยุด รอพนักงาน
  created_at    timestamptz DEFAULT now()
)

-- แต่ละ session การสนทนา
conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  started_at  timestamptz DEFAULT now(),
  ended_at    timestamptz
)

-- ข้อความแต่ละบรรทัด
messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  role            text CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  created_at      timestamptz DEFAULT now()
)

-- แพทย์ในคลินิก
doctors (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  specialty text,
  user_id   uuid REFERENCES auth.users(id)  -- login เข้า dashboard
)

-- ตารางเวลาว่างของแพทย์
schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid REFERENCES doctors(id),
  available_at timestamptz NOT NULL,
  is_booked   boolean DEFAULT false
)

-- การนัดหมายที่ยืนยันแล้ว
appointments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid REFERENCES customers(id),
  doctor_id    uuid REFERENCES doctors(id),
  schedule_id  uuid REFERENCES schedules(id),
  service_type text,
  confirmed_at timestamptz DEFAULT now(),
  reminded_at  timestamptz              -- ส่ง reminder แล้วหรือยัง
)
```

**Row Level Security (RLS):**
- เปิด RLS ทุก table
- `service_role_key` ใช้ใน bot server (bypass RLS ได้)
- `anon_key` ใช้ใน dashboard client (ต้องผ่าน Auth)

---

## Business Logic หลัก

### 1. Bot Persona
- บุคลิกเป็นที่ปรึกษา ไม่ใช่เซลล์ (Zero Hard Sale)
- ถามเพิ่ม 1 คำถามก่อนแนะนำบริการเสมอ
- ตอบสั้น กระชับ อ่านง่ายบน mobile ไม่เกิน 4-5 ประโยค

### 2. Intent Classification — 3 กลุ่ม
```
CONSULT  → ลูกค้าบอกปัญหา / ขอข้อมูล  → AI ให้คำปรึกษา
BOOKING  → ลูกค้าพร้อมจอง              → ดึงตาราง → ยืนยันนัด
HANDOFF  → แพ้ / เจ็บ / ขอคุยคน       → บอทหยุด → แจ้ง admin
```

### 3. Human Handoff Triggers
คำที่ทำให้ set `is_human_mode = true` ทันที:
- อาการ: "แพ้", "บวม", "เจ็บ", "ผื่น", "แสบ"
- ขอคน: "ขอคุยกับคน", "ขอพนักงาน"
- ไม่พอใจ: "ไม่พอใจ", "แย่มาก", "ผิดนัด"
- บอทตอบผิดซ้ำ: user พิมพ์ "?" หรือ "ไม่เข้าใจ" 2 ครั้งติดกัน

เมื่อ Handoff:
1. set `customers.is_human_mode = true`
2. แจ้ง admin ผ่าน Supabase Realtime → Dashboard แสดง alert ทันที
3. บอทตอบว่า "รอสักครู่นะคะ กำลังโอนให้เจ้าหน้าที่ค่ะ" แล้วหยุด

### 4. Appointment Flow
```
ลูกค้าขอจอง
→ bot ถามบริการที่ต้องการ
→ query schedules WHERE is_booked = false ORDER BY available_at
→ แสดงเป็น LINE Flex Message ให้เลือก (max 5 slot)
→ ลูกค้าเลือก → update schedules.is_booked = true
→ insert appointments
→ Supabase pg_cron ส่ง reminder LINE 24 ชั่วโมงก่อนนัด
```

### 5. Conversation Memory
ทุก request ไป Claude API ต้องแนบ:
1. System Prompt (บุคลิก + กฎ)
2. ดึง 10 messages ล่าสุดจาก Supabase ของ conversation นั้น
3. Customer profile สั้นๆ (`skin_concerns`, `visit_count`)

---

## การ Develop แบบ Phase

```
Phase 1 → Webhook + Claude ตอบได้ + ยังไม่มี DB (in-memory)
Phase 2 → เชื่อม Supabase: บันทึก customers + messages
Phase 3 → Human Handoff + Realtime alert ใน Dashboard
Phase 4 → Appointment system + Doctor schedule
Phase 5 → Dashboard สมบูรณ์ (Next.js + Supabase Auth)
```

เมื่อเขียน code ใน Phase ใด ให้ออกแบบให้รองรับ Phase ถัดไปได้
แต่ยังไม่ต้อง implement ส่วนที่ยังไม่ถึง

---

## Coding Standards

- ห้ามใช้ `any` — ใช้ `unknown` แล้ว narrow type แทน
- ทุก Supabase query ต้องเช็ค `error` ก่อนใช้ `data` เสมอ
- ใช้ `supabaseAdmin` (service_role) เฉพาะใน bot server เท่านั้น
- ทุก async function ต้องมี try/catch และ log error ชัดเจน
- ตั้งชื่อตัวแปรเป็นภาษาอังกฤษ ความหมายชัด เช่น `customerId` ไม่ใช่ `id`
- ทุก environment variable ต้องมีใน `.env.example` พร้อม comment ภาษาไทย
- ห้าม hardcode ค่าใดๆ ที่ควรอยู่ใน `.env`
- ห้าม expose `SUPABASE_SERVICE_ROLE_KEY` ใน client-side ไม่ว่ากรณีใด
