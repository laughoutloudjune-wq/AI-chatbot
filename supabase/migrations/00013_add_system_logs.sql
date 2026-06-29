CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read (for dashboard)
CREATE POLICY "Allow public select on system_logs" 
ON system_logs FOR SELECT USING (true);

-- Allow anonymous insert (for bot)
CREATE POLICY "Allow public insert on system_logs" 
ON system_logs FOR INSERT WITH CHECK (true);

-- Add default toggle settings
INSERT INTO system_settings (key, value, description)
VALUES 
  ('ai_status_line', 'true', 'Global toggle for AI on LINE (true = on, false = off)'),
  ('ai_status_fb', 'true', 'Global toggle for AI on Facebook (true = on, false = off)')
ON CONFLICT (key) DO NOTHING;

-- Also add to realtime so the logs page auto-updates
ALTER PUBLICATION supabase_realtime ADD TABLE system_logs;
