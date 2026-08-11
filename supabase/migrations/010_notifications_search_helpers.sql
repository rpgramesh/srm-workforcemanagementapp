-- =====================================================================
-- ShiftMaster Pro — Migration 010
-- Notifications, in-app preferences, search helpers, new audit actions.
-- Idempotent (CREATE … IF NOT EXISTS, DO $$ BEGIN blocks for enums).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend audit_action with logout + pin_changed (append, idempotent)
-- ---------------------------------------------------------------------
DO $$ BEGIN
    ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'logout';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pin_changed';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 2. Notification types + channel enums
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE notification_priority AS ENUM ('info', 'success', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('in_app', 'push', 'email', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'shift_assigned',
        'shift_changed',
        'shift_cancelled',
        'shift_swap_requested',
        'shift_swap_approved',
        'roster_published',
        'clock_in_reminder',
        'clock_in_missed',
        'message_received',
        'staff_added',
        'staff_role_changed',
        'audit_alert',
        'system_maintenance',
        'payroll_ready'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 3. notifications — append-only per-user delivery ledger
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    channel         notification_channel NOT NULL DEFAULT 'in_app',
    priority        notification_priority NOT NULL DEFAULT 'info',
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    action_href     TEXT,
    actor_name      TEXT,
    seen_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    dismissed_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS notif_user_idx           ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notif_unread_idx         ON public.notifications(user_id, read_at NULLS FIRST, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notif_seen_idx           ON public.notifications(user_id, seen_at NULLS FIRST, created_at DESC) WHERE seen_at IS NULL;
CREATE INDEX IF NOT EXISTS notif_created_idx        ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notif_priority_idx       ON public.notifications(user_id, priority, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_self_only ON public.notifications;
CREATE POLICY notif_self_only ON public.notifications
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'restaurant_admin', 'manager')
    )
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'restaurant_admin', 'manager')
    )
  );

-- ---------------------------------------------------------------------
-- 4. notification_preferences — per-user delivery matrix
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    channels        JSONB NOT NULL DEFAULT '{}'::JSONB,   -- key: notification_type → value: array of notification_channel
    dnd_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    dnd_from        TEXT,                                  -- HH:mm local
    dnd_to          TEXT,
    quiet_weekends  BOOLEAN NOT NULL DEFAULT FALSE,
    summary_daily   BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_pref_self_or_manager ON public.notification_preferences;
CREATE POLICY notif_pref_self_or_manager ON public.notification_preferences
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'restaurant_admin')
    )
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'restaurant_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.notification_preferences(user_id, channels)
  VALUES (NEW.id, jsonb_build_object())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_create_notif_prefs ON public.users;
CREATE TRIGGER trg_create_notif_prefs
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_notification_preferences();

-- Backfill: create rows for any users missing prefs
INSERT INTO public.notification_preferences(user_id, channels)
SELECT u.id, jsonb_build_object()
FROM public.users u
LEFT JOIN public.notification_preferences p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. append_notification RPC — managers/supabase-callers emit events
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_notification(
    p_user_id       UUID,
    p_type          TEXT,
    p_title         TEXT,
    p_body          TEXT,
    p_channel       TEXT DEFAULT 'in_app',
    p_priority      TEXT DEFAULT 'info',
    p_action_href   TEXT DEFAULT NULL,
    p_actor_name    TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications(user_id, type, channel, priority, title, body, action_href, actor_name)
    VALUES (p_user_id, p_type::notification_type, p_channel::notification_channel,
            p_priority::notification_priority, p_title, p_body, p_action_href, p_actor_name)
    RETURNING id INTO v_id;
    RETURN v_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.append_notification FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_notification TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.append_notification TO authenticated;

-- ---------------------------------------------------------------------
-- 6. mark_seen / mark_read helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_seen(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.notifications SET seen_at = NOW()
    WHERE id = p_id AND user_id = p_user_id AND seen_at IS NULL;
    RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.notifications SET read_at = NOW(), seen_at = COALESCE(seen_at, NOW())
    WHERE id = p_id AND user_id = p_user_id AND read_at IS NULL;
    RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_cnt INT;
BEGIN
    UPDATE public.notifications SET read_at = NOW(), seen_at = COALESCE(seen_at, NOW())
    WHERE user_id = p_user_id AND read_at IS NULL;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    RETURN v_cnt;
END $$;

REVOKE ALL ON FUNCTION public.mark_notification_seen FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_read FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_seen,
             FUNCTION public.mark_notification_read,
             FUNCTION public.mark_all_notifications_read
          TO postgres, service_role, authenticated;

-- ---------------------------------------------------------------------
-- 7. Search helpers — IMMUTABLE trigram-aware unaccent (best-effort)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.user_search_vector(u public.users)
RETURNS tsvector LANGUAGE sql IMMUTABLE AS $$
    SELECT to_tsvector('simple',
        COALESCE(u.first_name, '')  || ' ' ||
        COALESCE(u.last_name, '')   || ' ' ||
        COALESCE(u.full_name, '')   || ' ' ||
        COALESCE(u.mobile, '')      || ' ' ||
        COALESCE(u.email, '')       || ' ' ||
        COALESCE(u.employee_id, '') || ' ' ||
        COALESCE(u.job_title, '')
    );
$$;

CREATE INDEX IF NOT EXISTS users_search_trgm_idx
  ON public.users
  USING GIN ((
      COALESCE(first_name, '') || ' ' ||
      COALESCE(last_name, '')  || ' ' ||
      COALESCE(full_name, '')  || ' ' ||
      COALESCE(mobile, '')     || ' ' ||
      COALESCE(COALESCE(email, ''), '') || ' ' ||
      COALESCE(employee_id, '')
  ) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 8. append_audit_log — ensure logout / pin_changed are valid at SQL layer
-- ---------------------------------------------------------------------
DO $$ BEGIN
    ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'logout';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'pin_changed';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
