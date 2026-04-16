
-- Allow users to delete their own activity data
CREATE POLICY "Users can delete their own activity"
ON public.activity_data
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);
