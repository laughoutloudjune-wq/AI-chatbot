import { supabaseAdmin } from './supabase';

export async function logSystem(level: 'info' | 'error' | 'warn', source: 'LINE' | 'FB' | 'AI' | 'System', message: string) {
  // Always log to console for standard Render server logs
  if (level === 'error') {
    console.error(`[${source}] ${message}`);
  } else if (level === 'warn') {
    console.warn(`[${source}] ${message}`);
  } else {
    console.log(`[${source}] ${message}`);
  }

  // Insert into Supabase so it shows up in the Dashboard Logs page
  try {
    // Fire and forget (don't await) to prevent slowing down the webhook response
    supabaseAdmin.from('system_logs').insert({ level, source, message }).then(({ error }) => {
      if (error) {
        console.error('[System] Failed to insert log to DB:', error.message);
      }
    });
  } catch (err) {
    console.error('[System] Unexpected error inserting log:', err);
  }
}
