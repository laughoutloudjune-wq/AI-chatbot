"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
exports.getSystemSetting = getSystemSetting;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. Database features will not work.');
}
// สร้าง client โดยใช้ service role key เพื่อให้ฝั่งเซิร์ฟเวอร์สามารถข้าม RLS (Row Level Security) ได้
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceRoleKey || 'placeholder_key', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
async function getSystemSetting(key, defaultValue) {
    try {
        const { data, error } = await exports.supabaseAdmin
            .from('system_settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error || !data || data.value === null) {
            return defaultValue;
        }
        // Empty strings are often stored as "" in JSONB, handle them gracefully if they map to strings
        if (typeof defaultValue === 'string' && data.value === '') {
            return defaultValue;
        }
        return data.value;
    }
    catch (err) {
        console.error(`[DB] Error fetching setting ${key}:`, err);
        return defaultValue;
    }
}
