-- ==========================================
-- SECURE ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- 1. Policies for clinic_faqs
CREATE POLICY "Allow authenticated read all clinic_faqs" ON clinic_faqs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert clinic_faqs" ON clinic_faqs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update clinic_faqs" ON clinic_faqs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete clinic_faqs" ON clinic_faqs FOR DELETE TO authenticated USING (true);

-- 2. Policies for clinic_services
CREATE POLICY "Allow authenticated read all clinic_services" ON clinic_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert clinic_services" ON clinic_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update clinic_services" ON clinic_services FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete clinic_services" ON clinic_services FOR DELETE TO authenticated USING (true);

-- 3. Policies for system_settings
CREATE POLICY "Allow authenticated full access to system_settings" ON system_settings FOR ALL TO authenticated USING (true);

-- 4. Secure Storage Policies (Drop public upload, require authentication)
DROP POLICY IF EXISTS "Allow public insert for clinic_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update for clinic_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete for clinic_images" ON storage.objects;

CREATE POLICY "Allow authenticated insert for clinic_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clinic_images');
CREATE POLICY "Allow authenticated update for clinic_images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'clinic_images');
CREATE POLICY "Allow authenticated delete for clinic_images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'clinic_images');
