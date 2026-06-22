-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow public read access to system_settings" ON public.system_settings FOR SELECT USING (true);

-- Allow all access to service_role (Admin)
CREATE POLICY "Allow service_role full access to system_settings" ON public.system_settings FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert initial values
INSERT INTO public.system_settings (key, value, description) VALUES
('handoff_keywords', '["รีวิว", "influencer", "ร่วมงาน", "ติดต่อเรื่อง", "marketing", "อยู่ไกล", "แพงไป", "แพงจัง", "คุยกับคน", "ขอสายแอดมิน"]'::jsonb, 'Keywords that trigger a handoff to human admin'),
('clinic_name', '"Erika Clinic"'::jsonb, 'Name of the clinic used in AI prompts'),
('admin_line_user_id', '"Ue76402fd1424f9db7a14f92c6d33172c"'::jsonb, 'LINE User ID for the admin receiving handoff alerts'),
('fb_page_access_token', '""'::jsonb, 'Facebook Page Access Token for Messenger integration'),
('fb_verify_token', '"erika2025"'::jsonb, 'Facebook Verify Token for Webhook validation')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT ALL ON TABLE public.system_settings TO anon, authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;
