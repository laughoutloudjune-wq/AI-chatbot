-- Add history column to chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;
