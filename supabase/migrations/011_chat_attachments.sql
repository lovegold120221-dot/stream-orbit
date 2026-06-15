-- Chat file attachments (idempotent migration)
-- Adds attachment columns to chat_messages + creates storage bucket

-- 1. Add attachment columns to chat_messages (all nullable for backward compat)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Create the storage bucket for chat files
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT
  'chat-files', 'chat-files', true, false,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
        'application/pdf','text/plain','text/csv',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip','application/x-zip-compressed',
        'audio/mpeg','audio/wav','audio/ogg','audio/mp4','video/mp4']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-files');

-- 3. RLS: allow authenticated/anonymous users to upload to chat-files
DROP POLICY IF EXISTS chat_files_insert ON storage.objects;
CREATE POLICY chat_files_insert ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'chat-files');

DROP POLICY IF EXISTS chat_files_select ON storage.objects;
CREATE POLICY chat_files_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'chat-files');

DROP POLICY IF EXISTS chat_files_delete ON storage.objects;
CREATE POLICY chat_files_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);
