-- =====================================================================
-- ShiftMaster Pro — Migration 008
-- Audit Logging: compliance-grade immutable history of every staff
-- record mutation (CREATE/UPDATE/DELETE) and messaging activity.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit action enum
-- ---------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'staff_created',
        'staff_updated',
        'staff_deleted',
        'message_sent',
        'message_read',
        'filter_preset_saved',
        'filter_preset_deleted',
        'login_success',
        'login_failure',
        'clock_in',
        'clock_out',
        'permission_changed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- 2. audit_logs — append-only, never-updated rows (no UPDATE trigger)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action          audit_action NOT NULL,
    actor_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,   -- who performed the action
    target_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,   -- target user (for staff ops / messages)
    target_thread_id UUID REFERENCES public.message_threads(id) ON DELETE SET NULL,
    department_id   UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    details         JSONB NOT NULL DEFAULT '{}'::JSONB,                     -- field-level diffs, PIN-changed flag, permissions-snapshot, etc
    client_ip       TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS audit_action_idx       ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_actor_idx        ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_target_idx       ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS audit_created_idx      ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_dept_idx         ON public.audit_logs(department_id) WHERE department_id IS NOT NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_managers_only ON public.audit_logs;
CREATE POLICY audit_managers_only ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid()
         AND u.role IN ('super_admin', 'restaurant_admin', 'manager')
    )
  );

-- ---------------------------------------------------------------------
-- 3. append_audit_log SECURITY DEFINER RPC
--    Returns the inserted row id (UUID).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION append_audit_log(
    p_action          audit_action,
    p_actor_user_id   UUID DEFAULT NULL,
    p_target_user_id  UUID DEFAULT NULL,
    p_target_thread_id UUID DEFAULT NULL,
    p_department_id   UUID DEFAULT NULL,
    p_details         JSONB DEFAULT '{}'::JSONB,
    p_client_ip       TEXT DEFAULT NULL,
    p_user_agent      TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        action, actor_user_id, target_user_id, target_thread_id,
        department_id, details, client_ip, user_agent
    ) VALUES (
        p_action, p_actor_user_id, p_target_user_id, p_target_thread_id,
        p_department_id, COALESCE(p_details, '{}'::JSONB), p_client_ip, p_user_agent
    ) RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION append_audit_log(audit_action,UUID,UUID,UUID,UUID,JSONB,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_audit_log(audit_action,UUID,UUID,UUID,UUID,JSONB,TEXT,TEXT) TO service_role;
