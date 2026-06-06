-- Restrict logo bucket reads to authenticated users (asset is bundled in app, no anon read needed)
DROP POLICY IF EXISTS "Read-only logo bucket" ON storage.objects;
CREATE POLICY "Authenticated can read logo bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'logo');

-- Restrict avatar policies to authenticated role only (remove anon access)
DROP POLICY IF EXISTS "Users can view their own avatar" ON storage.objects;
CREATE POLICY "Users can view their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);