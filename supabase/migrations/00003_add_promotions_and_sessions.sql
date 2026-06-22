-- 1. Add image_url to clinic_services
ALTER TABLE clinic_services ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create chat_sessions table for Follow-up feature
CREATE TABLE IF NOT EXISTS chat_sessions (
  user_id TEXT PRIMARY KEY,
  last_message TEXT,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  follow_up_sent BOOLEAN DEFAULT FALSE,
  topic TEXT
);

-- 3. Create Storage Bucket for promotional artworks
-- We use SQL to insert into the storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Setup Storage Policies
-- Allow public read access to promotions bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'promotions' );

-- Allow authenticated/service role inserts to promotions bucket
CREATE POLICY "Admin Upload Access" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'promotions' );

-- Allow authenticated/service role updates to promotions bucket
CREATE POLICY "Admin Update Access" 
ON storage.objects FOR UPDATE 
WITH CHECK ( bucket_id = 'promotions' );

-- Allow authenticated/service role deletes to promotions bucket
CREATE POLICY "Admin Delete Access" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'promotions' );
