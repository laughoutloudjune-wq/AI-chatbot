-- Add human_only flag for old patients who should never get AI responses
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS human_only BOOLEAN DEFAULT FALSE;
