
-- 1. Drop overly permissive storage policies (bucket_id <> 'logo' allowed anyone to write to avatars)
DROP POLICY IF EXISTS "No insert on logo bucket" ON storage.objects;
DROP POLICY IF EXISTS "No update on logo bucket" ON storage.objects;
DROP POLICY IF EXISTS "No delete on logo bucket" ON storage.objects;

-- 2. Restrict avatars SELECT to owner only (fix public bucket listing)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Users can view their own avatar"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Make avatars bucket private since we now require auth to read
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- 3. Realtime channel authorization: only allow users to subscribe to their own user_id topic
CREATE POLICY "Users can subscribe to their own realtime channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('user:' || (SELECT auth.uid())::text))
);

CREATE POLICY "Users can send to their own realtime channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() = ('user:' || (SELECT auth.uid())::text))
);
