-- Add is_paused column to chat_sessions to handle AI muting during human handoff
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
