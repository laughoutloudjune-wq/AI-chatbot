import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Querying chat_sessions...');
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('user_id, last_message, last_interaction_at, is_paused')
    .gte('last_interaction_at', yesterday.toISOString())
    .order('last_interaction_at', { ascending: false });
    
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('DATA:', data);
  }
}

check();
