-- Add system theme preference support to profiles.
-- Existing profiles keep their selected light/dark value; new profiles default
-- to following the operating system appearance.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_theme_check;

UPDATE public.profiles
SET theme = 'system'
WHERE theme IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN theme SET DEFAULT 'system';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_check
  CHECK (theme IN ('system', 'light', 'dark'));
