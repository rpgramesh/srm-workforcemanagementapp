-- ---------------------------------------------------------------------------
-- 010_attendance_columns_and_view_fixes.sql
--
-- Fixes required for clock-in/out flow (shiftmaster-pro):
--   1. Add missing columns to attendance_sessions that the application
--      mapper (mapAttendance) references.  Columns are nullable with safe
--      defaults so existing rows are not broken.
--   2. Recreate v_live_floor WITHOUT aliases that hide columns the mapper
--      expects, and expose GPS + derived columns used elsewhere.
--   3. Recreate v_today_active_shifts with id-alias consistency needed by
--      roster mappers.
--   4. Re-grant SELECT on views to authenticated + service_role since
--      CREATE OR REPLACE VIEW drops the prior GRANTs under SECURITY
--      DEFINER regimes on some Postgres / Supabase builds.
-- ---------------------------------------------------------------------------

BEGIN;

-- ======================================================================
-- 1. Missing columns on attendance_sessions
-- ======================================================================
ALTER TABLE public.attendance_sessions
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (approval_status IN ('pending','approved','rejected','needs_review')),
    ADD COLUMN IF NOT EXISTS approved_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS note              TEXT,
    ADD COLUMN IF NOT EXISTS hourly_rate       NUMERIC(10,4);

CREATE INDEX IF NOT EXISTS idx_attendance_approval
    ON public.attendance_sessions(approval_status);

-- ======================================================================
-- 2. v_live_floor — drop first because columns were previously aliased
--    (attendance_id/attendance_status) and CREATE OR REPLACE VIEW
--    refuses to rename columns.
-- ======================================================================
DROP VIEW IF EXISTS public.v_live_floor CASCADE;

CREATE OR REPLACE VIEW public.v_live_floor AS
SELECT a.id,
       a.user_id,
       a.shift_id,
       a.terminal_id,
       a.clocked_in_at,
       a.clocked_out_at,
       a.status,
       a.work_minutes,
       a.gross_pay,
       a.in_gps_lat,
       a.in_gps_lng,
       a.out_gps_lat,
       a.out_gps_lng,
       a.approval_status,
       a.approved_by,
       a.approved_at,
       a.note,
       a.hourly_rate,
       a.created_at,
       a.updated_at,
       u.first_name,
       u.last_name,
       (u.first_name || ' ' || u.last_name)        AS full_name,
       u.job_title,
       u.color,
       u.hourly_rate                                AS user_hourly_rate,
       u.avatar_url,
       u.employee_id,
       d.name                                       AS department_name,
       l.name                                       AS location_name,
       EXTRACT(EPOCH FROM (NOW() - a.clocked_in_at))::INT AS seconds_on_shift
FROM public.attendance_sessions a
JOIN public.users u              ON u.id = a.user_id
LEFT JOIN public.shifts s        ON s.id = a.shift_id
LEFT JOIN public.departments d   ON d.id = s.department_id
LEFT JOIN public.locations l     ON l.id = s.location_id
WHERE a.status IN ('clocked_in','on_break')
  AND u.is_active = TRUE
ORDER BY a.clocked_in_at DESC;

COMMENT ON VIEW public.v_live_floor IS 'Live clocked-in / on-break sessions joined with user + shift metadata.  Columns mirror the raw attendance_sessions table plus enrichment, matching the TS mapper mapAttendance shape exactly.';

-- ======================================================================
-- 3. v_today_active_shifts — drop to guarantee clean column layout
-- ======================================================================
DROP VIEW IF EXISTS public.v_today_active_shifts CASCADE;

CREATE OR REPLACE VIEW public.v_today_active_shifts AS
SELECT s.id              AS shift_id,
       s.id,
       s.user_id,
       s.roster_period_id,
       s.department_id,
       s.location_id,
       s.shift_date,
       s.start_time,
       s.end_time,
       s.status          AS shift_status,
       s.created_at      AS shift_created_at,
       s.updated_at      AS shift_updated_at,
       u.first_name,
       u.last_name,
       (u.first_name || ' ' || u.last_name) AS full_name,
       u.job_title,
       u.color           AS user_color,
       u.avatar_url,
       u.employee_id,
       d.name            AS department_name,
       l.name            AS location_name,
       s.notes
FROM public.shifts s
JOIN public.users u              ON u.id = s.user_id
LEFT JOIN public.departments d   ON d.id = s.department_id
LEFT JOIN public.locations l     ON l.id = s.location_id
WHERE s.shift_date = CURRENT_DATE
  AND u.is_active = TRUE
ORDER BY s.start_time ASC, d.name, u.last_name;

COMMENT ON VIEW public.v_today_active_shifts IS 'Today''s shifts with user, dept and location enrichment.  Exposes both "shift_id" (original alias) and raw "id" so repository mappers work whether they use id or shift_id.';

-- ======================================================================
-- 4. Re-apply GRANTs (some builds strip them on CREATE OR REPLACE VIEW)
-- ======================================================================
REVOKE ALL ON public.v_live_floor          FROM PUBLIC;
REVOKE ALL ON public.v_today_active_shifts FROM PUBLIC;

GRANT SELECT ON public.v_live_floor          TO authenticated, service_role;
GRANT SELECT ON public.v_today_active_shifts TO authenticated, service_role;

COMMIT;
