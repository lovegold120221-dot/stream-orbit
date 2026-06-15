-- Translation history table (idempotent migration)
-- Captures finalized translation entries for the History page

CREATE TABLE IF NOT EXISTS public.translation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT '',
  room_name TEXT NOT NULL DEFAULT '',
  source_identity TEXT NOT NULL DEFAULT '',
  speaker_name TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  translated_text TEXT NOT NULL DEFAULT '',
  source_lang TEXT NOT NULL DEFAULT '',
  target_lang TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow all authenticated/anonymous users to read their own history
DROP POLICY IF EXISTS select_own_history ON public.translation_history;
CREATE POLICY select_own_history ON public.translation_history
  FOR SELECT
  USING (user_id = current_setting('app.user_id', true) OR user_id = '');

-- Allow insert for any user_id (both auth and anonymous)
DROP POLICY IF EXISTS insert_translation_history ON public.translation_history;
CREATE POLICY insert_translation_history ON public.translation_history
  FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
DROP INDEX IF EXISTS idx_translation_history_user_id;
CREATE INDEX IF NOT EXISTS idx_translation_history_user_id ON public.translation_history (user_id);

DROP INDEX IF EXISTS idx_translation_history_created_at;
CREATE INDEX IF NOT EXISTS idx_translation_history_created_at ON public.translation_history (created_at DESC);
