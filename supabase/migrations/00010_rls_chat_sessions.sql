-- Enable RLS for chat_sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated dashboard users to read/update chat_sessions
CREATE POLICY "Allow authenticated read chat_sessions" ON chat_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update chat_sessions" ON chat_sessions FOR UPDATE TO authenticated USING (true);
