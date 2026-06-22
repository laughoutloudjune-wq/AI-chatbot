-- Drop the old column if it exists (in case you ran the previous migration)
ALTER TABLE clinic_faqs DROP COLUMN IF EXISTS image_url;

-- Add image_urls column as an array of text
ALTER TABLE clinic_faqs ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- Create Storage Bucket for clinic images (FAQs and services)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clinic_images', 'clinic_images', true)
ON CONFLICT (id) DO NOTHING;

-- Temporary Storage Policies (Public Access)
-- IMPORTANT: These policies allow anyone to upload files. 
-- We will restrict INSERT/UPDATE/DELETE to authenticated users once the Login system is built.
CREATE POLICY "Allow public read for clinic_images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'clinic_images');

CREATE POLICY "Allow public insert for clinic_images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'clinic_images');

CREATE POLICY "Allow public update for clinic_images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'clinic_images');

CREATE POLICY "Allow public delete for clinic_images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'clinic_images');
