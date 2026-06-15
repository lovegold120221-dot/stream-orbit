-- Add glossary column to profiles (idempotent migration)
-- Allows users to define custom glossary terms for real-time translation

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS glossary JSONB DEFAULT '[]'::jsonb;
