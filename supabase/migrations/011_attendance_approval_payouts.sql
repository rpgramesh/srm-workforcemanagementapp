-- 011_attendance_approval_payouts.sql
-- Attendance approval status + payout tracking + gross_pay recomputation helper

DO $$ BEGIN
    CREATE TYPE public.attendance_approval_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.attendance_sessions
    ADD COLUMN IF NOT EXISTS approval_status  public.attendance_approval_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS note             TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_approval_status
    ON public.attendance_sessions(approval_status);

CREATE INDEX IF NOT EXISTS idx_attendance_payroll_window
    ON public.attendance_sessions(user_id, clocked_in_at DESC)
    INCLUDE (work_minutes, gross_pay, approval_status, status);

CREATE OR REPLACE FUNCTION public.calc_attendance_gross_pay(
    p_work_minutes   INTEGER,
    p_hourly_rate    NUMERIC
) RETURNS NUMERIC(12,2)
    LANGUAGE plpgsql IMMUTABLE STRICT
AS $$
DECLARE
    v_hours   NUMERIC(14,6);
    v_gross   NUMERIC(14,6);
BEGIN
    IF p_work_minutes IS NULL OR p_hourly_rate IS NULL THEN
        RETURN NULL;
    END IF;
    IF p_work_minutes < 0 THEN
        RAISE EXCEPTION 'p_work_minutes cannot be negative';
    END IF;
    IF p_hourly_rate < 0 THEN
        RAISE EXCEPTION 'p_hourly_rate cannot be negative';
    END IF;
    v_hours := ROUND((p_work_minutes::NUMERIC / 60.0), 6);
    v_gross := v_hours * p_hourly_rate;
    RETURN ROUND(v_gross, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.calc_attendance_gross_pay(INTEGER,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_attendance_gross_pay(INTEGER,NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.set_attendance_gross_pay_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_rate NUMERIC(12,2);
BEGIN
    IF NEW.work_minutes IS NULL OR NEW.status IN ('clocked_in','on_break') THEN
        NEW.gross_pay := NULL;
        RETURN NEW;
    END IF;

    SELECT u.hourly_rate
      INTO v_rate
      FROM public.users u
     WHERE u.id = NEW.user_id;

    IF v_rate IS NOT NULL THEN
        NEW.gross_pay := public.calc_attendance_gross_pay(NEW.work_minutes, v_rate);
    ELSE
        NEW.gross_pay := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_set_gross_pay ON public.attendance_sessions;
CREATE TRIGGER attendance_set_gross_pay
BEFORE INSERT OR UPDATE OF work_minutes, status, user_id ON public.attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_attendance_gross_pay_trigger();

CREATE TABLE IF NOT EXISTS public.staff_payouts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
    user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    total_minutes     INTEGER NOT NULL DEFAULT 0,
    total_hours       NUMERIC(12,4) GENERATED ALWAYS AS (ROUND((total_minutes::NUMERIC / 60.0), 4)) STORED,
    hourly_rate       NUMERIC(12,2) NOT NULL,
    gross_amount      NUMERIC(12,2) NOT NULL,
    status            VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','processing','paid','void')),
    paid_at           TIMESTAMPTZ,
    paid_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reference         VARCHAR(64),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payout_user_period
    ON public.staff_payouts(user_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_payout_period
    ON public.staff_payouts(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payout_status
    ON public.staff_payouts(status);
ALTER TABLE public.staff_payouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS %1$I_set_updated_at ON public.%1$I', 'staff_payouts');
    EXECUTE format('CREATE TRIGGER %1$I_set_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', 'staff_payouts');
END $$;

CREATE TABLE IF NOT EXISTS public.attendance_payout_links (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id        UUID NOT NULL REFERENCES public.staff_payouts(id) ON DELETE CASCADE,
    attendance_id    UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    UNIQUE (payout_id, attendance_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_payout_link_att
    ON public.attendance_payout_links(attendance_id);
ALTER TABLE public.attendance_payout_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.calc_period_payout_preview(
    p_user_id       UUID,
    p_period_start  DATE,
    p_period_end    DATE
)
RETURNS TABLE (
    total_minutes   INTEGER,
    total_hours     NUMERIC(12,4),
    hourly_rate     NUMERIC(12,2),
    gross_amount    NUMERIC(12,2),
    session_count   INTEGER,
    approved_count  INTEGER
)
    LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_rate NUMERIC(12,2);
BEGIN
    SELECT u.hourly_rate INTO v_rate FROM public.users u WHERE u.id = p_user_id;

    RETURN QUERY
    SELECT
        COALESCE(SUM(a.work_minutes) FILTER (WHERE a.work_minutes IS NOT NULL AND a.approval_status = 'approved' AND a.status NOT IN ('clocked_in','on_break')), 0)::INTEGER
            AS total_minutes,
        NULL::NUMERIC(12,4) AS total_hours,
        v_rate              AS hourly_rate,
        NULL::NUMERIC(12,2) AS gross_amount,
        (SELECT COUNT(*)::INTEGER
           FROM public.attendance_sessions s
          WHERE s.user_id = p_user_id
            AND s.clocked_in_at::DATE BETWEEN p_period_start AND p_period_end)::INTEGER
            AS session_count,
        (SELECT COUNT(*)::INTEGER
           FROM public.attendance_sessions s
          WHERE s.user_id = p_user_id
            AND s.clocked_in_at::DATE BETWEEN p_period_start AND p_period_end
            AND s.approval_status = 'approved')::INTEGER
            AS approved_count;
END;
$$;

REVOKE ALL ON FUNCTION public.calc_period_payout_preview(UUID,DATE,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_period_payout_preview(UUID,DATE,DATE) TO service_role;

CREATE TABLE IF NOT EXISTS public.attendance_edits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id    UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    edited_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
    field_name       TEXT NOT NULL,
    old_value        TEXT,
    new_value        TEXT,
    reason           TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_edits_att ON public.attendance_edits(attendance_id);
ALTER TABLE public.attendance_edits ENABLE ROW LEVEL SECURITY;
