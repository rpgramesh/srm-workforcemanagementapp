-- ShiftMaster Pro — Migration 004
-- Operational schema: departments, locations, roster periods, shifts, attendance, swap requests, payroll periods, terminals
-- Postgres only. Service_role bypasses RLS for Server Actions; ANON users get nothing.

-- ------------------------------------------------------------------
-- 1. Departments + Locations (1:many shifts. users linked via user_departments)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.departments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(16) NOT NULL UNIQUE,
    name          VARCHAR(64) NOT NULL UNIQUE,
    short_label   VARCHAR(16) NOT NULL,      -- KITCHEN / FRONT / BAR
    accent_class  VARCHAR(48) NOT NULL DEFAULT 'bg-emerald-300/70',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(16) NOT NULL UNIQUE,
    name        VARCHAR(64) NOT NULL,        -- "Floor 1", "Lounge", "Main Bar", "Office"
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- 2. roster_periods — weekly containers for publishing
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roster_periods (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start    DATE NOT NULL,
    week_end      DATE NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','locked','archived')),
    published_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    published_at  TIMESTAMPTZ,
    budget_amount NUMERIC(12,2),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (week_start, week_end)
);

-- ------------------------------------------------------------------
-- 3. shifts — every assigned shift slot for a user on a given date
--    (one row = one assigned employee × one day × one timespan)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shifts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roster_period_id UUID REFERENCES public.roster_periods(id) ON DELETE SET NULL,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    department_id   UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    location_id     UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    shift_date      DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    break_minutes   INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
    status          VARCHAR(16) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','cancelled','completed','open','swapped')),
    station_label   VARCHAR(64),              -- "Opening Lead", "Evening Support" etc
    hourly_rate     NUMERIC(10,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON public.shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_period    ON public.shifts(roster_period_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date      ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_dept      ON public.shifts(department_id);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- 4. attendance_sessions — one row per "clock-in → clock-out" pair
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shift_id         UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    terminal_id      VARCHAR(32),
    clocked_in_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clocked_out_at   TIMESTAMPTZ,
    in_gps_lat       DOUBLE PRECISION,
    in_gps_lng       DOUBLE PRECISION,
    out_gps_lat      DOUBLE PRECISION,
    out_gps_lng      DOUBLE PRECISION,
    status           VARCHAR(16) NOT NULL DEFAULT 'clocked_in'
        CHECK (status IN ('clocked_in','clocked_out','on_break','auto_closed','abandoned')),
    work_minutes     INTEGER GENERATED ALWAYS AS (
        CASE WHEN clocked_out_at IS NULL THEN NULL ELSE
            GREATEST(0, EXTRACT(EPOCH FROM clocked_out_at - clocked_in_at) / 60.0)::INTEGER
        END
    ) STORED,
    gross_pay        NUMERIC(12,2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_time ON public.attendance_sessions(user_id, clocked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status    ON public.attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_attendance_shift     ON public.attendance_sessions(shift_id);

-- ------------------------------------------------------------------
-- 5. shift_swap_requests
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shift_id            UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    offered_to_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','completed','withdrawn')),
    reason              TEXT,
    reviewer_user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_swap_shift   ON public.shift_swap_requests(shift_id);
CREATE INDEX IF NOT EXISTS idx_swap_status  ON public.shift_swap_requests(status);

-- ------------------------------------------------------------------
-- 6. payroll_periods
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    status       VARCHAR(16) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','processing','closed')),
    total_hours  NUMERIC(10,2) DEFAULT 0,
    total_gross  NUMERIC(12,2) DEFAULT 0,
    overtime_cost NUMERIC(12,2) DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (period_start, period_end)
);

-- ------------------------------------------------------------------
-- 7. terminals (clock-in devices)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.terminals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_code   VARCHAR(32) NOT NULL UNIQUE,
    display_name    VARCHAR(64),
    location_id     UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    sync_status     VARCHAR(16) NOT NULL DEFAULT 'active'
        CHECK (sync_status IN ('active','connecting','offline')),
    last_sync_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------
-- 8. set_updated_at triggers for every *_updated_at column
-- ------------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'departments','locations','roster_periods','shifts',
        'attendance_sessions','payroll_periods','terminals'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %1$I_set_updated_at ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER %1$I_set_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
END $$;

-- ------------------------------------------------------------------
-- 9. Enable RLS restrictive (service_role is exempt)
-- ------------------------------------------------------------------

ALTER TABLE public.departments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_periods        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swap_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals             ENABLE ROW LEVEL SECURITY;

-- 10. Dependencies / helper SQL views used by server-side aggregates
CREATE OR REPLACE VIEW public.v_today_active_shifts AS
SELECT s.id        AS shift_id,
       s.user_id,
       s.department_id,
       s.location_id,
       s.shift_date,
       s.start_time,
       s.end_time,
       s.break_minutes,
       s.status        AS shift_status,
       s.station_label,
       s.hourly_rate,
       d.name          AS department_name,
       d.short_label   AS department_short,
       d.accent_class  AS department_accent,
       l.name          AS location_name,
       u.first_name,
       u.last_name,
       (u.first_name || ' ' || u.last_name) AS full_name,
       u.employee_id,
       u.color         AS user_color,
       u.avatar_url,
       u.job_title
FROM public.shifts s
JOIN public.users u ON u.id = s.user_id
JOIN public.departments d ON d.id = s.department_id
LEFT JOIN public.locations l ON l.id = s.location_id
WHERE s.shift_date = CURRENT_DATE
  AND u.is_active = TRUE
  AND s.status NOT IN ('cancelled');

CREATE OR REPLACE VIEW public.v_live_floor AS
SELECT a.id              AS attendance_id,
       a.user_id,
       a.shift_id,
       a.clocked_in_at,
       a.status          AS attendance_status,
       u.first_name || ' ' || u.last_name AS full_name,
       u.job_title,
       u.color           AS user_color,
       u.avatar_url,
       d.name            AS department_name,
       l.name            AS station_location,
       EXTRACT(EPOCH FROM (NOW() - a.clocked_in_at))::INT AS seconds_on_shift
FROM public.attendance_sessions a
JOIN public.users u       ON u.id = a.user_id
LEFT JOIN public.shifts s ON s.id = a.shift_id
LEFT JOIN public.departments d ON d.id = s.department_id
LEFT JOIN public.locations l   ON l.id = s.location_id
WHERE a.status IN ('clocked_in','on_break')
  AND u.is_active = TRUE
ORDER BY a.clocked_in_at DESC;
