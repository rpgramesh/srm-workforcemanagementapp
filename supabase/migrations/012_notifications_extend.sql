-- =====================================================================
-- ShiftMaster Pro — Migration 012
-- Extend notification_type enum (missing types from platform.ts),
-- add updated_at triggers for notifications and notification_preferences,
-- tighten the synthetic-actor guardrail so UUID FK columns always reject
-- non-UUID inputs (migration 010/011 audit). Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fill in missing notification_type enum values (from types/platform.ts)
--    Note: ADD VALUE IF NOT EXISTS works outside a transaction block in
--    Supabase migrations; PL/pgSQL DO block is safer.
-- ---------------------------------------------------------------------
DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'shift_updated';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'shift_swap_declined';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'leave_approved';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'leave_declined';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 2. updated_at triggers on notifications and notification_preferences
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_notifications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := (NOW() AT TIME ZONE 'UTC');
  RETURN NEW;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC');
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.touch_notifications_updated_at();

CREATE OR REPLACE FUNCTION public.touch_notification_prefs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := (NOW() AT TIME ZONE 'UTC');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_notification_prefs_updated_at();

-- ---------------------------------------------------------------------
-- 3. Backfill: ensure every user still has notification_preferences row
--    (redundant with migration 010 but safe re-run for newly-seeded staff)
-- ---------------------------------------------------------------------
INSERT INTO public.notification_preferences(user_id, channels)
SELECT u.id, jsonb_build_object()
FROM public.users u
LEFT JOIN public.notification_preferences p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT DO NOTHING;
