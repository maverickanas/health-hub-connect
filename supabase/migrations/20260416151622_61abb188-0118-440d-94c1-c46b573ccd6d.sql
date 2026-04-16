-- Add read-only RLS policy for the logo storage bucket
CREATE POLICY "Read-only logo bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'logo');

-- Block all writes to logo bucket
CREATE POLICY "No insert on logo bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id != 'logo');

CREATE POLICY "No update on logo bucket" ON storage.objects
  FOR UPDATE USING (bucket_id != 'logo');

CREATE POLICY "No delete on logo bucket" ON storage.objects
  FOR DELETE USING (bucket_id != 'logo');