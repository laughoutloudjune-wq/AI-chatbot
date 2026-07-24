import { supabaseAdmin, clearSystemSettingsCache } from './supabase';
import { clearKnowledgeBaseCache } from './aiService';
import { logSystem } from './logger';

// ฟัง Supabase Realtime เพื่อล้าง in-memory cache ทันทีเมื่อแอดมินแก้ไขราคา/บริการ/FAQ/system prompt
// แทนที่จะปล่อยให้ลูกค้าได้รับข้อมูลเก่าจนกว่า cache TTL (3 นาที) จะหมดอายุเอง
export function startKnowledgeBaseCacheInvalidation(): void {
  supabaseAdmin
    .channel('kb-cache-invalidation')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_services' }, () => {
      clearKnowledgeBaseCache();
      logSystem('info', 'Cache', 'clinic_services changed -- knowledge base cache cleared.');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_faqs' }, () => {
      clearKnowledgeBaseCache();
      logSystem('info', 'Cache', 'clinic_faqs changed -- knowledge base cache cleared.');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
      clearSystemSettingsCache();
      logSystem('info', 'Cache', 'system_settings changed -- settings cache cleared.');
    })
    .subscribe((status) => {
      logSystem('info', 'Cache', `Realtime cache-invalidation channel status: ${status}`);
    });
}
