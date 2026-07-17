import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. Database features will not work.');
}

// สร้าง client โดยใช้ service role key เพื่อให้ฝั่งเซิร์ฟเวอร์สามารถข้าม RLS (Row Level Security) ได้
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder_key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// การตั้งค่าระบบ (system_settings) แทบไม่เปลี่ยนระหว่างข้อความแชท จึง cache ไว้ในหน่วยความจำ
// เพื่อลดจำนวนรอบการเรียก Supabase ต่อข้อความหนึ่งครั้ง
const SETTINGS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 นาที
const settingsCache = new Map<string, { value: unknown; expiresAt: number }>();

export async function getSystemSetting<T>(key: string, defaultValue: T): Promise<T> {
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data || data.value === null) {
      return defaultValue;
    }

    let result: T = data.value as T;

    // Empty strings are often stored as "" in JSONB, handle them gracefully if they map to strings
    if (typeof defaultValue === 'string' && data.value === '') {
      result = defaultValue;
    }

    // Handle cases where a boolean was accidentally stored as a string "true" or "false"
    if (typeof defaultValue === 'boolean' && typeof data.value === 'string') {
      if (data.value === 'false') result = false as unknown as T;
      if (data.value === 'true') result = true as unknown as T;
    }

    settingsCache.set(key, { value: result, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.error(`[DB] Error fetching setting ${key}:`, err);
    return defaultValue;
  }
}

// ล้าง cache ทั้งหมด (เผื่อต้องเรียกใช้หลัง admin แก้ไขค่าและต้องการให้มีผลทันที)
export function clearSystemSettingsCache(): void {
  settingsCache.clear();
}
