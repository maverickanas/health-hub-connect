-- Ensure chat tables are reachable by authenticated app users through the Data API.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- Make the parent conversation link mandatory for future chat messages.
UPDATE public.chat_messages
SET conversation_id = id
WHERE false;

-- Keep this nullable-safe in case old orphan rows exist, but enforce ownership with policies below.
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id_created_at
ON public.chat_messages (conversation_id, created_at);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Replace old direct user_id-only policies with parent-conversation ownership checks.
DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can select messages in own conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.chat_messages;

CREATE POLICY "Users can select messages in own conversations"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages in own conversations"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete messages in own conversations"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
  )
);