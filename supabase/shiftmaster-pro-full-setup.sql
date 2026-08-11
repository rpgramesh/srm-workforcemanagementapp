-- =====================================================================
--  ShiftMaster Pro — COMPLETE SUPABASE SETUP SCRIPT
-- =====================================================================
--
--  HOW TO USE:
--    1. Go to https://supabase.com/dashboard → your project → SQL Editor
--    2. Click "New query"
--    3. Paste THIS ENTIRE FILE into the editor
--    4. Click "Run" (▶) — it is fully idempotent and safe to re-run
--
--  WHAT IT CREATES:
--    • Extensions: pgcrypto, pg_trgm
--    • Core tables: users, departments, locations, roster_periods, shifts,
--                   attendance_sessions, shift_swap_requests, payroll_periods,
--                   terminals, message_threads, thread_participants, messages,
--                   message_read_receipts, audit_logs, filter_presets
--    • Custom enums: app_role, thread_kind, audit_action
--    • ~20 SECURITY DEFINER RPCs for auth, staff CRUD, messaging, presets, audit
--    • RLS policies on every table (service_role bypasses them by default)
--    • Performance indexes (trigram, B-tree, partial)
--    • Seed data: 8 staff members, 4 depts, 7 locations, roster week,
--                  ~40 shifts, 6 live clock-ins, 2 swap requests
--    • Demo SQL views: v_today_active_shifts, v_live_floor
--
--  TEST ACCOUNTS (Australian mobile — 4-digit PIN — role):
--    +61425071500   5087   restaurant_admin   (Ganga)
--    +61481904384   4384   manager            (Ramesh)
--    +61450006509   6509   supervisor         (Siddi)
--    +61435064041   4041   employee           (Anmol)
--    +61410111222   1234   employee           (Marco — Chef)
--    +61410111223   1235   employee           (Sarah — Server)
--    +61410111224   1236   employee           (Leo — Bartender)
--    +61410111225   1237   employee           (Priya — Host)
--
--  YOUR .env.local MUST contain these (copy from Supabase → Project Settings → API):
--    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
--    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi... (anon public)
--    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (service_role, SECRET — never expose client-side)
--    DATABASE_URL=postgresql://postgres:PASS@xxxx.supabase.co:5432/postgres
--
-- =====================================================================

-- =====================================================================
--  PHASE 0 — EXTENSIONS
-- =====================================================================

DROP EXTENSION IF EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- =====================================================================
--  PHASE 1 — UTILITY FUNCTIONS & ENUMS
-- =====================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM (
    'super_admin', 'restaurant_admin', 'manager', 'supervisor', 'employee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE thread_kind AS ENUM ('direct', 'department', 'group');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'staff_created', 'staff_updated', 'staff_deleted',
    'message_sent', 'message_read',
    'filter_preset_saved', 'filter_preset_deleted',
    'login_success', 'login_failure',
    'clock_in', 'clock_out', 'permission_changed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
--  PHASE 2 — USERS + PIN AUTH
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name             TEXT NOT NULL,
  last_name              TEXT NOT NULL,
  mobile                 TEXT NOT NULL
                         CONSTRAINT users_mobile_format
                         CHECK (mobile ~ '^\+614\d{8}$'),
  role                   app_role NOT NULL DEFAULT 'employee',
  pin_hash               TEXT NOT NULL,
  employee_id            TEXT UNIQUE,
  job_title              TEXT,
  hourly_rate            NUMERIC(10, 2),
  avatar_url             TEXT,
  color                  TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,

  email                  TEXT,
  employment_date        DATE,
  address                TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes                  TEXT,
  permissions            JSONB NOT NULL DEFAULT '{}'::JSONB,
  department_id          UUID,   -- FK added after departments table

  created_at             TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE UNIQUE INDEX IF NOT EXISTS users_mobile_unique
  ON public.users (mobile) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_unique
  ON public.users (employee_id);
CREATE INDEX IF NOT EXISTS users_role_idx              ON public.users (role);
CREATE INDEX IF NOT EXISTS users_active_idx            ON public.users (is_active);
CREATE INDEX IF NOT EXISTS users_department_idx        ON public.users (department_id);
CREATE INDEX IF NOT EXISTS users_employment_date_idx   ON public.users (employment_date);
CREATE INDEX IF NOT EXISTS users_email_idx             ON public.users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_first_name_trgm_idx
  ON public.users USING gin (first_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_last_name_trgm_idx
  ON public.users USING gin (last_name  extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_full_name_idx
  ON public.users ((first_name || ' ' || last_name));

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Email-format CHECK (idempotent via DO block)
DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_email_format
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------
--  2a. verify_user_pin (mobile + PIN — admin login)
-- ------------------------------
CREATE OR REPLACE FUNCTION verify_user_pin(user_mobile TEXT, pin_input TEXT)
RETURNS TABLE (
  matched        BOOLEAN,
  user_id        UUID,
  first_name     TEXT,
  last_name      TEXT,
  role           app_role,
  employee_id    TEXT,
  is_active_user BOOLEAN
) AS $$
DECLARE rec RECORD;
BEGIN
  SELECT u.id, u.first_name, u.last_name, u.role, u.employee_id,
         u.pin_hash, u.is_active
    INTO rec
    FROM public.users u
   WHERE u.mobile = user_mobile AND u.is_active = TRUE
   LIMIT 1;

  IF rec IS NULL THEN
    matched := FALSE; user_id := NULL; first_name := NULL; last_name := NULL;
    role := NULL; employee_id := NULL; is_active_user := NULL;
    RETURN NEXT; RETURN;
  END IF;

  matched := (rec.pin_hash = extensions.crypt(pin_input, rec.pin_hash));
  IF matched THEN
    user_id := rec.id; first_name := rec.first_name; last_name := rec.last_name;
    role := rec.role; employee_id := rec.employee_id; is_active_user := rec.is_active;
  ELSE
    user_id := NULL; first_name := NULL; last_name := NULL;
    role := NULL; employee_id := NULL; is_active_user := NULL;
  END IF;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION verify_user_pin(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_user_pin(TEXT, TEXT) TO service_role;

-- ------------------------------
--  2b. verify_clock_in_pin (PIN-only — shift terminal)
-- ------------------------------
CREATE OR REPLACE FUNCTION verify_clock_in_pin(pin_input TEXT)
RETURNS TABLE (
  matched        BOOLEAN,
  user_id        UUID,
  first_name     TEXT,
  last_name      TEXT,
  role           app_role,
  employee_id    TEXT,
  color          TEXT,
  is_active_user BOOLEAN
) AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT u.id, u.first_name, u.last_name, u.role, u.employee_id,
           u.color, u.pin_hash, u.is_active
      FROM public.users u WHERE u.is_active = TRUE
  LOOP
    IF r.pin_hash = extensions.crypt(pin_input, r.pin_hash) THEN
      matched := TRUE; user_id := r.id; first_name := r.first_name;
      last_name := r.last_name; role := r.role; employee_id := r.employee_id;
      color := r.color; is_active_user := r.is_active;
      RETURN NEXT; RETURN;
    END IF;
  END LOOP;
  matched := FALSE; user_id := NULL; first_name := NULL; last_name := NULL;
  role := NULL; employee_id := NULL; color := NULL; is_active_user := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION verify_clock_in_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_clock_in_pin(TEXT) TO service_role;

-- ------------------------------
--  2c. RLS on users (restrictive; service_role bypasses)
-- ------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_and_managers ON public.users;
CREATE POLICY users_read_own_and_managers ON public.users FOR SELECT USING (
  (auth.uid() = id) OR
  (role IN ('restaurant_admin', 'manager', 'supervisor'))
);

DROP POLICY IF EXISTS users_insert_admins ON public.users;
CREATE POLICY users_insert_admins ON public.users FOR INSERT WITH CHECK (
  role IN ('restaurant_admin', 'manager')
);

DROP POLICY IF EXISTS users_update_admins ON public.users;
CREATE POLICY users_update_admins ON public.users FOR UPDATE
  USING   (role IN ('restaurant_admin', 'manager'))
  WITH CHECK (role IN ('restaurant_admin', 'manager', 'supervisor', 'employee'));

-- =====================================================================
--  PHASE 3 — OPERATIONAL SCHEMA (departments → users FK, shifts, attendance, etc.)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(16) NOT NULL UNIQUE,
  name          VARCHAR(64) NOT NULL UNIQUE,
  short_label   VARCHAR(16) NOT NULL,
  accent_class  VARCHAR(48) NOT NULL DEFAULT 'bg-emerald-300/70',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(16) NOT NULL UNIQUE,
  name        VARCHAR(64) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--  attach users.department_id FK now that departments exists
DO $$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.roster_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start    DATE NOT NULL,
  week_end      DATE NOT NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','locked','archived')),
  published_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  published_at  TIMESTAMPTZ,
  budget_amount NUMERIC(12,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start, week_end)
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_period_id UUID REFERENCES public.roster_periods(id) ON DELETE SET NULL,
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department_id    UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  location_id      UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  shift_date       DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  break_minutes    INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  status           VARCHAR(16) NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','cancelled','completed','open','swapped')),
  station_label    VARCHAR(64),
  hourly_rate      NUMERIC(10,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON public.shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_period    ON public.shifts(roster_period_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date      ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_dept      ON public.shifts(department_id);

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

--  set_updated_at triggers for every table
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments','locations','roster_periods','shifts','attendance_sessions',
    'payroll_periods','terminals'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$I_set_updated_at ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER %1$I_set_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

--  RLS on operational tables (restrictive; service_role exempt)
ALTER TABLE public.departments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminals           ENABLE ROW LEVEL SECURITY;

-- =====================================================================
--  PHASE 4 — STAFF CRUD RPCs (SECURITY DEFINER)
-- =====================================================================

--  4a. create_staff_user
CREATE OR REPLACE FUNCTION create_staff_user(
  p_first_name            TEXT,
  p_last_name             TEXT,
  p_mobile                TEXT,
  p_role                  app_role,
  p_pin                   TEXT,
  p_employee_id           TEXT DEFAULT NULL,
  p_job_title             TEXT DEFAULT NULL,
  p_hourly_rate           NUMERIC(10,2) DEFAULT NULL,
  p_avatar_url            TEXT DEFAULT NULL,
  p_color                 TEXT DEFAULT NULL,
  p_department_id         UUID DEFAULT NULL,
  p_email                 TEXT DEFAULT NULL,
  p_employment_date       DATE DEFAULT NULL,
  p_address               TEXT DEFAULT NULL,
  p_emergency_contact_name  TEXT DEFAULT NULL,
  p_emergency_contact_phone TEXT DEFAULT NULL,
  p_notes                 TEXT DEFAULT NULL,
  p_permissions           JSONB DEFAULT '{}'::JSONB,
  p_is_active             BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
  new_id          UUID;
  existing_mobile INTEGER;
  existing_empid  INTEGER;
  r               RECORD;
  matched         BOOLEAN := FALSE;
BEGIN
  IF p_mobile !~ '^\+614\d{8}$' THEN
    RAISE EXCEPTION 'Invalid mobile format — must be canonical Australian +614XXXXXXXX'; END IF;
  IF p_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits'; END IF;
  IF p_first_name IS NULL OR length(trim(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'first_name is required'; END IF;
  IF p_last_name  IS NULL OR length(trim(p_last_name))  = 0 THEN
    RAISE EXCEPTION 'last_name is required'; END IF;

  SELECT COUNT(*) INTO existing_mobile FROM public.users u
   WHERE u.mobile = p_mobile AND u.is_active = TRUE;
  IF existing_mobile > 0 THEN
    RAISE EXCEPTION 'An active user with that mobile number already exists'; END IF;

  IF p_employee_id IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_empid FROM public.users u
     WHERE u.employee_id = p_employee_id;
    IF existing_empid > 0 THEN
      RAISE EXCEPTION 'Employee ID % is already in use', p_employee_id; END IF;
  END IF;

  FOR r IN SELECT u.pin_hash FROM public.users u WHERE u.is_active = TRUE LOOP
    IF r.pin_hash = extensions.crypt(p_pin, r.pin_hash) THEN
      matched := TRUE; EXIT; END IF;
  END LOOP;
  IF matched THEN
    RAISE EXCEPTION 'That 4-digit PIN is already assigned to another staff member'; END IF;

  INSERT INTO public.users (
    first_name, last_name, mobile, role, pin_hash, employee_id,
    job_title, hourly_rate, avatar_url, color, department_id, email,
    employment_date, address, emergency_contact_name,
    emergency_contact_phone, notes, permissions, is_active
  ) VALUES (
    btrim(p_first_name), btrim(p_last_name), p_mobile, p_role,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    NULLIF(btrim(p_employee_id), ''), NULLIF(btrim(p_job_title), ''),
    p_hourly_rate, NULLIF(btrim(p_avatar_url), ''), NULLIF(btrim(p_color), ''),
    p_department_id, NULLIF(btrim(p_email), ''), p_employment_date,
    NULLIF(btrim(p_address), ''), NULLIF(btrim(p_emergency_contact_name), ''),
    NULLIF(btrim(p_emergency_contact_phone), ''), NULLIF(btrim(p_notes), ''),
    COALESCE(p_permissions, '{}'::JSONB), COALESCE(p_is_active, TRUE)
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION create_staff_user(TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION create_staff_user(TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;

--  4b. update_staff_user
CREATE OR REPLACE FUNCTION update_staff_user(
  p_user_id             UUID,
  p_first_name          TEXT DEFAULT NULL,
  p_last_name           TEXT DEFAULT NULL,
  p_mobile              TEXT DEFAULT NULL,
  p_role                app_role DEFAULT NULL,
  p_pin                 TEXT DEFAULT NULL,
  p_employee_id         TEXT DEFAULT NULL,
  p_job_title           TEXT DEFAULT NULL,
  p_hourly_rate         NUMERIC(10,2) DEFAULT NULL,
  p_avatar_url          TEXT DEFAULT NULL,
  p_color               TEXT DEFAULT NULL,
  p_department_id       UUID DEFAULT NULL,
  p_email               TEXT DEFAULT NULL,
  p_employment_date     DATE DEFAULT NULL,
  p_address             TEXT DEFAULT NULL,
  p_emergency_contact_name  TEXT DEFAULT NULL,
  p_emergency_contact_phone TEXT DEFAULT NULL,
  p_notes               TEXT DEFAULT NULL,
  p_permissions         JSONB DEFAULT NULL,
  p_is_active           BOOLEAN DEFAULT NULL
) RETURNS VOID AS $$
DECLARE rows_affected INTEGER;
        r             RECORD;
        matched       BOOLEAN := FALSE;
BEGIN
  IF p_mobile IS NOT NULL AND p_mobile !~ '^\+614\d{8}$' THEN
    RAISE EXCEPTION 'Invalid mobile format — must be canonical Australian +614XXXXXXXX'; END IF;
  IF p_pin IS NOT NULL AND p_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits'; END IF;

  IF p_pin IS NOT NULL THEN
    FOR r IN SELECT u.pin_hash FROM public.users u
            WHERE u.is_active = TRUE AND u.id <> p_user_id LOOP
      IF r.pin_hash = extensions.crypt(p_pin, r.pin_hash) THEN
        matched := TRUE; EXIT; END IF;
    END LOOP;
    IF matched THEN
      RAISE EXCEPTION 'That 4-digit PIN is already assigned to another staff member'; END IF;
  END IF;

  IF p_mobile IS NOT NULL THEN
    PERFORM 1 FROM public.users u
     WHERE u.mobile = p_mobile AND u.is_active = TRUE AND u.id <> p_user_id;
    IF FOUND THEN
      RAISE EXCEPTION 'An active user with that mobile number already exists'; END IF;
  END IF;

  IF p_employee_id IS NOT NULL AND length(btrim(p_employee_id)) > 0 THEN
    PERFORM 1 FROM public.users u
     WHERE u.employee_id = btrim(p_employee_id) AND u.id <> p_user_id;
    IF FOUND THEN
      RAISE EXCEPTION 'Employee ID % is already in use', btrim(p_employee_id); END IF;
  END IF;

  UPDATE public.users u SET
    first_name                = COALESCE(NULLIF(btrim(p_first_name), ''),          u.first_name),
    last_name                 = COALESCE(NULLIF(btrim(p_last_name),  ''),          u.last_name),
    mobile                    = COALESCE(p_mobile,                                  u.mobile),
    role                      = COALESCE(p_role,                                    u.role),
    pin_hash                  = CASE WHEN p_pin IS NOT NULL
                                     THEN extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
                                     ELSE u.pin_hash END,
    employee_id               = CASE WHEN p_employee_id IS NOT NULL
                                     THEN NULLIF(btrim(p_employee_id), '') ELSE u.employee_id END,
    job_title                 = CASE WHEN p_job_title IS NOT NULL
                                     THEN NULLIF(btrim(p_job_title), '') ELSE u.job_title END,
    hourly_rate               = CASE WHEN p_hourly_rate IS NOT NULL
                                     THEN p_hourly_rate ELSE u.hourly_rate END,
    avatar_url                = CASE WHEN p_avatar_url IS NOT NULL
                                     THEN NULLIF(btrim(p_avatar_url), '') ELSE u.avatar_url END,
    color                     = CASE WHEN p_color IS NOT NULL
                                     THEN NULLIF(btrim(p_color), '') ELSE u.color END,
    department_id             = CASE WHEN p_department_id IS NOT NULL
                                     THEN p_department_id ELSE u.department_id END,
    email                     = CASE WHEN p_email IS NOT NULL
                                     THEN NULLIF(btrim(p_email), '') ELSE u.email END,
    employment_date           = CASE WHEN p_employment_date IS NOT NULL
                                     THEN p_employment_date ELSE u.employment_date END,
    address                   = CASE WHEN p_address IS NOT NULL
                                     THEN NULLIF(btrim(p_address), '') ELSE u.address END,
    emergency_contact_name    = CASE WHEN p_emergency_contact_name IS NOT NULL
                                     THEN NULLIF(btrim(p_emergency_contact_name), '')
                                     ELSE u.emergency_contact_name END,
    emergency_contact_phone   = CASE WHEN p_emergency_contact_phone IS NOT NULL
                                     THEN NULLIF(btrim(p_emergency_contact_phone), '')
                                     ELSE u.emergency_contact_phone END,
    notes                     = CASE WHEN p_notes IS NOT NULL
                                     THEN NULLIF(btrim(p_notes), '') ELSE u.notes END,
    permissions               = COALESCE(p_permissions,                         u.permissions),
    is_active                 = CASE WHEN p_is_active IS NOT NULL
                                     THEN p_is_active ELSE u.is_active END
  WHERE u.id = p_user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN RAISE EXCEPTION 'User not found'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION update_staff_user(UUID,TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION update_staff_user(UUID,TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;

--  4c. soft_delete_staff_user (is_active = FALSE, never hard-delete)
CREATE OR REPLACE FUNCTION soft_delete_staff_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE rows_affected INTEGER;
BEGIN
  UPDATE public.users u SET is_active = FALSE WHERE u.id = p_user_id;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN RAISE EXCEPTION 'User not found'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION soft_delete_staff_user(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION soft_delete_staff_user(UUID) TO service_role;

-- =====================================================================
--  PHASE 5 — MESSAGING SYSTEM
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.message_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            thread_kind NOT NULL DEFAULT 'direct',
  title           TEXT,
  department_id   UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS msg_threads_kind_idx     ON public.message_threads(kind);
CREATE INDEX IF NOT EXISTS msg_threads_dept_idx     ON public.message_threads(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS msg_threads_last_msg_idx ON public.message_threads(last_message_at DESC);

DROP TRIGGER IF EXISTS msg_threads_set_updated_at ON public.message_threads;
CREATE TRIGGER msg_threads_set_updated_at BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.thread_participants (
  thread_id  UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  added_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS tp_user_idx ON public.thread_participants(user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CONSTRAINT messages_body_min CHECK (length(btrim(body)) > 0),
  metadata   JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS msg_thread_created_idx ON public.messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS msg_sender_idx         ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS msg_created_desc_idx   ON public.messages(created_at DESC);

DROP TRIGGER IF EXISTS messages_set_updated_at ON public.messages;
CREATE TRIGGER messages_set_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS mrr_user_idx ON public.message_read_receipts(user_id);

--  trigger: bump thread.last_message_at on new message
CREATE OR REPLACE FUNCTION bump_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.message_threads t
     SET last_message_at = NOW() AT TIME ZONE 'UTC'
   WHERE t.id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS msg_bump_thread ON public.messages;
CREATE TRIGGER msg_bump_thread
AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION bump_thread_last_message_at();

--  RLS on messaging tables
ALTER TABLE public.message_threads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS threads_visible_scope ON public.message_threads;
CREATE POLICY threads_visible_scope ON public.message_threads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.thread_participants tp
           WHERE tp.thread_id = message_threads.id AND tp.user_id = auth.uid())
  OR (kind = 'department' AND EXISTS (
      SELECT 1 FROM public.users u
       WHERE u.id = auth.uid() AND u.department_id = message_threads.department_id))
);

DROP POLICY IF EXISTS tp_own_rows ON public.thread_participants;
CREATE POLICY tp_own_rows ON public.thread_participants FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS messages_visible_thread ON public.messages;
CREATE POLICY messages_visible_thread ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.message_threads t
     WHERE t.id = messages.thread_id AND (
       EXISTS (SELECT 1 FROM public.thread_participants tp
                WHERE tp.thread_id = t.id AND tp.user_id = auth.uid())
       OR (t.kind = 'department' AND EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.department_id = t.department_id))
     ))
);

DROP POLICY IF EXISTS mrr_scope ON public.message_read_receipts;
CREATE POLICY mrr_scope ON public.message_read_receipts FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.messages m
      JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
     WHERE m.id = message_read_receipts.message_id AND tp.user_id = auth.uid())
);

--  5a. ensure_direct_thread (idempotent — returns existing or creates new)
CREATE OR REPLACE FUNCTION ensure_direct_thread(p_user_a UUID, p_user_b UUID)
RETURNS UUID AS $$
DECLARE existing UUID; new_id UUID;
BEGIN
  IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
    RAISE EXCEPTION 'Both participant IDs must exist and must differ'; END IF;
  SELECT t.id INTO existing FROM public.message_threads t
    JOIN public.thread_participants a ON a.thread_id = t.id AND a.user_id = p_user_a
    JOIN public.thread_participants b ON b.thread_id = t.id AND b.user_id = p_user_b
   WHERE t.kind = 'direct' LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.message_threads (kind, created_by)
    VALUES ('direct', p_user_a) RETURNING id INTO new_id;
  INSERT INTO public.thread_participants (thread_id, user_id, added_by) VALUES
    (new_id, p_user_a, p_user_a), (new_id, p_user_b, p_user_a);
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION ensure_direct_thread(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION ensure_direct_thread(UUID, UUID) TO service_role;

--  5b. ensure_department_thread
CREATE OR REPLACE FUNCTION ensure_department_thread(p_department_id UUID, p_title TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE existing UUID; new_id UUID;
BEGIN
  IF p_department_id IS NULL THEN RAISE EXCEPTION 'department_id is required'; END IF;
  SELECT id INTO existing FROM public.message_threads t
   WHERE t.kind = 'department' AND t.department_id = p_department_id LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.message_threads (kind, department_id, title)
    VALUES ('department', p_department_id, COALESCE(NULLIF(btrim(p_title), ''),
      (SELECT '#' || d.name FROM public.departments d WHERE d.id = p_department_id)))
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION ensure_department_thread(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION ensure_department_thread(UUID, TEXT) TO service_role;

--  5c. send_message
CREATE OR REPLACE FUNCTION send_message(
  p_thread_id UUID, p_sender_id UUID, p_body TEXT
) RETURNS UUID AS $$
DECLARE new_id     UUID;
        clean_body TEXT := btrim(p_body);
BEGIN
  IF clean_body IS NULL OR length(clean_body) = 0 THEN
    RAISE EXCEPTION 'Message body cannot be empty'; END IF;
  IF p_thread_id IS NULL THEN RAISE EXCEPTION 'thread_id is required'; END IF;
  IF p_sender_id IS NULL THEN RAISE EXCEPTION 'sender_id is required'; END IF;

  PERFORM 1 FROM public.message_threads t
   WHERE t.id = p_thread_id AND (
     EXISTS (SELECT 1 FROM public.thread_participants tp
              WHERE tp.thread_id = t.id AND tp.user_id = p_sender_id)
     OR (t.kind = 'department' AND EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = p_sender_id AND u.department_id = t.department_id))
   );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender is not a participant of this thread'; END IF;

  INSERT INTO public.messages (thread_id, sender_id, body)
    VALUES (p_thread_id, p_sender_id, clean_body) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION send_message(UUID, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION send_message(UUID, UUID, TEXT) TO service_role;

--  5d. mark_thread_read_until
CREATE OR REPLACE FUNCTION mark_thread_read_until(
  p_thread_id UUID, p_user_id UUID, p_message_id UUID
) RETURNS INTEGER AS $$
DECLARE inserted INTEGER;
BEGIN
  INSERT INTO public.message_read_receipts (message_id, user_id)
    SELECT m.id, p_user_id FROM public.messages m
     WHERE m.thread_id = p_thread_id
       AND m.id <= p_message_id
       AND m.created_at <= (SELECT created_at FROM public.messages WHERE id = p_message_id)
    ON CONFLICT (message_id, user_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION mark_thread_read_until(UUID, UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION mark_thread_read_until(UUID, UUID, UUID) TO service_role;

--  5e. poll_new_messages (used by polling clients as lightweight Realtime fallback)
CREATE OR REPLACE FUNCTION poll_new_messages(p_user_id UUID, p_since TIMESTAMPTZ)
RETURNS TABLE (
  message_id  UUID, thread_id UUID, sender_id UUID,
  sender_name TEXT, body      TEXT, created_at TIMESTAMPTZ
) AS $$
BEGIN RETURN QUERY
  SELECT m.id, m.thread_id, m.sender_id,
         COALESCE(u.first_name || ' ' || u.last_name, 'Unknown')::TEXT,
         m.body, m.created_at
    FROM public.messages m
    JOIN public.message_threads t ON t.id = m.thread_id
    LEFT JOIN public.users u       ON u.id = m.sender_id
   WHERE m.created_at > COALESCE(p_since, '-infinity'::TIMESTAMPTZ)
     AND (
       EXISTS (SELECT 1 FROM public.thread_participants tp
                WHERE tp.thread_id = t.id AND tp.user_id = p_user_id)
       OR (t.kind = 'department' AND EXISTS (
            SELECT 1 FROM public.users u2
             WHERE u2.id = p_user_id AND u2.department_id = t.department_id))
     )
   ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION poll_new_messages(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION poll_new_messages(UUID, TIMESTAMPTZ) TO service_role;

--  5f. list_thread_summaries (inbox / sidebar)
CREATE OR REPLACE FUNCTION list_thread_summaries(p_user_id UUID)
RETURNS TABLE (
  thread_id       UUID, kind            thread_kind, title         TEXT,
  last_preview    TEXT, last_created_at TIMESTAMPTZ, unread_count  BIGINT,
  last_sender_id  UUID, department_id   UUID
) AS $$
BEGIN RETURN QUERY
  SELECT t.id, t.kind,
         COALESCE(NULLIF(btrim(t.title), ''), CASE
             WHEN t.kind = 'direct' THEN (
               SELECT u.first_name || ' ' || u.last_name
                 FROM public.thread_participants tp2
                 JOIN public.users u ON u.id = tp2.user_id
                WHERE tp2.thread_id = t.id AND tp2.user_id <> p_user_id LIMIT 1)
             WHEN t.kind = 'department' THEN (
               SELECT '#' || d.name FROM public.departments d WHERE d.id = t.department_id)
             ELSE NULL END)::TEXT,
         (SELECT left(btrim(m2.body), 140)
            FROM public.messages m2
           WHERE m2.thread_id = t.id ORDER BY m2.created_at DESC LIMIT 1),
         t.last_message_at,
         (SELECT COUNT(*) FROM public.messages m3
             LEFT JOIN public.message_read_receipts r
                    ON r.message_id = m3.id AND r.user_id = p_user_id
            WHERE m3.thread_id = t.id
              AND r.message_id IS NULL
              AND m3.sender_id IS DISTINCT FROM p_user_id),
         (SELECT m4.sender_id
            FROM public.messages m4
           WHERE m4.thread_id = t.id ORDER BY m4.created_at DESC LIMIT 1),
         t.department_id
    FROM public.message_threads t
   WHERE (
       EXISTS (SELECT 1 FROM public.thread_participants tp
                WHERE tp.thread_id = t.id AND tp.user_id = p_user_id)
       OR (t.kind = 'department' AND EXISTS (
            SELECT 1 FROM public.users u2
             WHERE u2.id = p_user_id AND u2.department_id = t.department_id))
     )
   ORDER BY t.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION list_thread_summaries(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION list_thread_summaries(UUID) TO service_role;

-- =====================================================================
--  PHASE 6 — AUDIT LOGS (append-only compliance record)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action           audit_action NOT NULL,
  actor_user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_thread_id UUID REFERENCES public.message_threads(id) ON DELETE SET NULL,
  department_id    UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  details          JSONB NOT NULL DEFAULT '{}'::JSONB,
  client_ip        TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS audit_action_idx   ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_actor_idx    ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_target_idx   ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS audit_created_idx  ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_dept_idx     ON public.audit_logs(department_id) WHERE department_id IS NOT NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_managers_only ON public.audit_logs;
CREATE POLICY audit_managers_only ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u
           WHERE u.id = auth.uid()
             AND u.role IN ('super_admin', 'restaurant_admin', 'manager'))
);

CREATE OR REPLACE FUNCTION append_audit_log(
  p_action          audit_action,
  p_actor_user_id   UUID DEFAULT NULL,
  p_target_user_id  UUID DEFAULT NULL,
  p_target_thread_id UUID DEFAULT NULL,
  p_department_id   UUID DEFAULT NULL,
  p_details         JSONB DEFAULT '{}'::JSONB,
  p_client_ip       TEXT DEFAULT NULL,
  p_user_agent      TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE new_id UUID;
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
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION append_audit_log(audit_action,UUID,UUID,UUID,UUID,JSONB,TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION append_audit_log(audit_action,UUID,UUID,UUID,UUID,JSONB,TEXT,TEXT) TO service_role;

-- =====================================================================
--  PHASE 7 — FILTER PRESETS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.filter_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module      TEXT NOT NULL DEFAULT 'staff_directory',
  name        TEXT NOT NULL,
  filters     JSONB NOT NULL DEFAULT '{}'::JSONB,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  UNIQUE (user_id, module, name)
);
CREATE INDEX IF NOT EXISTS fp_user_module_idx ON public.filter_presets(user_id, module);

ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS fp_set_updated_at ON public.filter_presets;
CREATE TRIGGER fp_set_updated_at BEFORE UPDATE ON public.filter_presets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP POLICY IF EXISTS fp_own_rows ON public.filter_presets;
CREATE POLICY fp_own_rows ON public.filter_presets FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION upsert_filter_preset(
  p_user_id    UUID,
  p_module     TEXT,
  p_name       TEXT,
  p_filters    JSONB DEFAULT '{}'::JSONB,
  p_is_default BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE clean_name TEXT := btrim(p_name);
        new_id     UUID;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id is required'; END IF;
  IF clean_name IS NULL OR length(clean_name) = 0 THEN
    RAISE EXCEPTION 'preset name is required'; END IF;
  IF p_is_default THEN
    UPDATE public.filter_presets SET is_default = FALSE
     WHERE user_id = p_user_id AND module = p_module;
  END IF;
  INSERT INTO public.filter_presets (user_id, module, name, filters, is_default)
    VALUES (p_user_id, p_module, clean_name, COALESCE(p_filters, '{}'::JSONB), COALESCE(p_is_default, FALSE))
    ON CONFLICT (user_id, module, name) DO UPDATE SET
      filters = EXCLUDED.filters, is_default = EXCLUDED.is_default
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION upsert_filter_preset(UUID,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION upsert_filter_preset(UUID,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION delete_filter_preset(
  p_user_id UUID, p_module TEXT, p_preset_id UUID
) RETURNS VOID AS $$
DECLARE rows_deleted INTEGER;
BEGIN
  DELETE FROM public.filter_presets
   WHERE id = p_preset_id AND user_id = p_user_id AND module = p_module;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  IF rows_deleted = 0 THEN
    RAISE EXCEPTION 'Preset not found or belongs to another user'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION delete_filter_preset(UUID,TEXT,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION delete_filter_preset(UUID,TEXT,UUID) TO service_role;

-- =====================================================================
--  PHASE 8 — HELPER VIEWS (used by dashboard aggregations)
-- =====================================================================

CREATE OR REPLACE VIEW public.v_today_active_shifts AS
SELECT s.id            AS shift_id,
       s.user_id, s.department_id, s.location_id,
       s.shift_date, s.start_time, s.end_time, s.break_minutes,
       s.status        AS shift_status,
       s.station_label, s.hourly_rate,
       d.name          AS department_name,
       d.short_label   AS department_short,
       d.accent_class  AS department_accent,
       l.name          AS location_name,
       u.first_name, u.last_name,
       (u.first_name || ' ' || u.last_name) AS full_name,
       u.employee_id, u.color AS user_color, u.avatar_url, u.job_title
  FROM public.shifts s
  JOIN public.users u            ON u.id = s.user_id
  JOIN public.departments d      ON d.id = s.department_id
  LEFT JOIN public.locations l   ON l.id = s.location_id
 WHERE s.shift_date = CURRENT_DATE
   AND u.is_active = TRUE
   AND s.status NOT IN ('cancelled');

CREATE OR REPLACE VIEW public.v_live_floor AS
SELECT a.id               AS attendance_id,
       a.user_id, a.shift_id, a.clocked_in_at,
       a.status           AS attendance_status,
       u.first_name || ' ' || u.last_name AS full_name,
       u.job_title, u.color AS user_color, u.avatar_url,
       d.name             AS department_name,
       l.name             AS station_location,
       EXTRACT(EPOCH FROM (NOW() - a.clocked_in_at))::INT AS seconds_on_shift
  FROM public.attendance_sessions a
  JOIN public.users u              ON u.id = a.user_id
  LEFT JOIN public.shifts s        ON s.id = a.shift_id
  LEFT JOIN public.departments d   ON d.id = s.department_id
  LEFT JOIN public.locations l     ON l.id = s.location_id
 WHERE a.status IN ('clocked_in','on_break')
   AND u.is_active = TRUE
 ORDER BY a.clocked_in_at DESC;

-- =====================================================================
--  PHASE 9 — SEED DATA
-- =====================================================================

--  9a. Departments
INSERT INTO public.departments (code, name, short_label, accent_class, sort_order) VALUES
  ('FOH', 'Front of House', 'FRONT',   'bg-emerald-300/70', 1),
  ('KIT', 'Kitchen',       'KITCHEN', 'bg-sky-300/70',       2),
  ('BAR', 'Bar',           'BAR',     'bg-amber-300/70',     3),
  ('MGT', 'Management',    'MGMT',    'bg-rose-300/70',      4)
ON CONFLICT (code) DO NOTHING;

--  9b. Locations / Stations
INSERT INTO public.locations (code, name, sort_order) VALUES
  ('FL1',  'Floor 1',       1),
  ('FL2',  'Floor 2',       2),
  ('LNG',  'Lounge',        3),
  ('BAR',  'Main Bar',      4),
  ('OFF',  'Office',        5),
  ('KIT',  'Kitchen Line',  6),
  ('PREP', 'Prep Area',     7)
ON CONFLICT (code) DO NOTHING;

--  9c. Core 4 staff (Ganga, Ramesh, Siddi, Anmol)
INSERT INTO public.users
  (first_name, last_name, mobile, role, employee_id, job_title, hourly_rate,
   department_id, color, is_active, pin_hash)
VALUES
  ('Ganga',  '', '+61425071500', 'restaurant_admin', 'EMP-1001',
    'Restaurant Director', 55.00,
    (SELECT id FROM public.departments WHERE code='MGT'),
    '#60A5FA', TRUE, extensions.crypt('5087', extensions.gen_salt('bf',10))),
  ('Ramesh', '', '+61481904384', 'manager',  'EMP-1002',
    'Floor Manager', 42.00,
    (SELECT id FROM public.departments WHERE code='MGT'),
    '#34D399', TRUE, extensions.crypt('4384', extensions.gen_salt('bf',10))),
  ('Siddi',  '', '+61450006509', 'supervisor', 'EMP-1003',
    'Shift Supervisor', 34.50,
    (SELECT id FROM public.departments WHERE code='FOH'),
    '#F472B6', TRUE, extensions.crypt('6509', extensions.gen_salt('bf',10))),
  ('Anmol',  '', '+61435064041', 'employee',   'EMP-1004',
    'Senior Waiter', 28.75,
    (SELECT id FROM public.departments WHERE code='KIT'),
    '#FBBF24', TRUE, extensions.crypt('4041', extensions.gen_salt('bf',10)))
ON CONFLICT (mobile) DO NOTHING;

--  Re-link departments & correct titles / rates for the core 4 (idempotent)
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='MGT'), job_title='Restaurant Owner',  hourly_rate=60.00 WHERE mobile='+61425071500';
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='MGT'), job_title='Restaurant Manager', hourly_rate=45.00 WHERE mobile='+61481904384';
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='FOH'), job_title='Floor Supervisor',   hourly_rate=35.00 WHERE mobile='+61450006509';
UPDATE public.users SET department_id = (SELECT id FROM public.departments WHERE code='KIT'), job_title='Line Cook',        hourly_rate=27.00 WHERE mobile='+61435064041';

--  9d. 4 additional fictional employees (Marco/Sarah/Leo/Priya)
INSERT INTO public.users
  (first_name, last_name, mobile, role, employee_id, job_title, hourly_rate,
   department_id, color, is_active, pin_hash)
VALUES
  ('Marco', 'Rossi', '+61410111222', 'employee', 'EMP-0101', 'Head Chef',   32.50,
    (SELECT id FROM public.departments WHERE code='KIT'),
    '#06B6D4', TRUE, extensions.crypt('1234', extensions.gen_salt('bf',10))),
  ('Sarah', 'Chen',  '+61410111223', 'employee', 'EMP-0102', 'Lead Server', 28.75,
    (SELECT id FROM public.departments WHERE code='FOH'),
    '#34D399', TRUE, extensions.crypt('1235', extensions.gen_salt('bf',10))),
  ('Leo',   'Mendez','+61410111224', 'employee', 'EMP-0103', 'Bartender',   26.00,
    (SELECT id FROM public.departments WHERE code='BAR'),
    '#FBBF24', TRUE, extensions.crypt('1236', extensions.gen_salt('bf',10))),
  ('Priya', 'Shah',  '+61410111225', 'employee', 'EMP-0104', 'Host',        25.00,
    (SELECT id FROM public.departments WHERE code='FOH'),
    '#F472B6', TRUE, extensions.crypt('1237', extensions.gen_salt('bf',10)))
ON CONFLICT (mobile) DO NOTHING;

--  9e. Roster period — this week (Mon→Sun)
INSERT INTO public.roster_periods (week_start, week_end, status, budget_amount)
VALUES (
  DATE_TRUNC('week', CURRENT_DATE)::DATE,
  DATE_TRUNC('week', CURRENT_DATE)::DATE + 6,
  'published', 20000.00
) ON CONFLICT (week_start, week_end) DO NOTHING;

--  9f. Payroll period
INSERT INTO public.payroll_periods (period_start, period_end, status)
VALUES (
  DATE_TRUNC('week', CURRENT_DATE)::DATE,
  DATE_TRUNC('week', CURRENT_DATE)::DATE + 13,
  'open'
) ON CONFLICT (period_start, period_end) DO NOTHING;

--  9g. Terminals
INSERT INTO public.terminals (terminal_code, display_name, location_id, sync_status, last_sync_at)
VALUES
 ('TERM-8821-B', 'POS Terminal #1', (SELECT id FROM public.locations WHERE code='FL1'), 'active', NOW()),
 ('TERM-1090-A', 'Kitchen KDS',     (SELECT id FROM public.locations WHERE code='KIT'), 'active', NOW())
ON CONFLICT (terminal_code) DO NOTHING;

--  9h. ~40 seeded shifts for the current roster week
INSERT INTO public.shifts
  (roster_period_id, user_id, department_id, location_id,
   shift_date, start_time, end_time, break_minutes, status, station_label, hourly_rate)
SELECT
    rp.id, u.id, d.id, loc.id,
    shift_date_val::DATE, seed.start_time::TIME, seed.end_time::TIME,
    seed.br, 'scheduled', seed.station, seed.hr::NUMERIC
FROM public.roster_periods rp
CROSS JOIN LATERAL (VALUES
  ('+61410111222','KIT','KIT','Kitchen Line',    0,'08:00','16:00',30,32.50),
  ('+61410111222','KIT','KIT','Kitchen Line',    1,'08:00','16:00',30,32.50),
  ('+61410111222','KIT','KIT','Kitchen Line',    3,'08:00','16:00',30,32.50),
  ('+61410111222','KIT','KIT','Kitchen Line',    4,'08:00','16:00',30,32.50),
  ('+61410111222','KIT','KIT','Saturday Cook',   5,'08:00','14:00',30,32.50),
  ('+61410111223','FOH','FL1','Lead Server',     1,'16:00','00:00',60,28.75),
  ('+61410111223','FOH','FL1','Lead Server',     2,'16:00','00:00',60,28.75),
  ('+61410111223','FOH','LNG','Floor 2 Hostess', 3,'12:00','20:00',60,28.75),
  ('+61410111223','FOH','FL1','Lead Server',     4,'17:00','01:00',60,28.75),
  ('+61410111223','FOH','LNG','Lounge Server',   6,'16:00','22:00',60,28.75),
  ('+61410111224','BAR','BAR','Evening Bartender',0,'18:00','02:00',60,26.00),
  ('+61410111224','BAR','BAR','Evening Bartender',1,'18:00','02:00',60,26.00),
  ('+61410111224','BAR','BAR','Friday Night Bar', 4,'19:00','03:00',60,26.00),
  ('+61410111224','BAR','BAR','Saturday Day Bar', 5,'11:00','17:00',30,26.00),
  ('+61410111225','FOH','LNG','Lunch Host',      0,'11:00','19:00',30,25.00),
  ('+61410111225','FOH','LNG','Lunch Host',      1,'11:00','19:00',30,25.00),
  ('+61410111225','FOH','LNG','Lunch Host',      2,'11:00','19:00',30,25.00),
  ('+61410111225','FOH','LNG','Lunch Host',      3,'11:00','19:00',30,25.00),
  ('+61410111225','FOH','LNG','Dinner Host',     4,'16:00','22:00',30,25.00),
  ('+61410111225','FOH','FL1','Floor 1 Host',    5,'16:00','22:00',30,25.00),
  ('+61410111225','FOH','LNG','Brunch Host',     6,'10:00','16:00',30,25.00),
  ('+61435064041','KIT','KIT','Line Cook',       0,'10:00','18:00',30,27.00),
  ('+61435064041','KIT','KIT','Line Cook',       1,'10:00','18:00',30,27.00),
  ('+61435064041','KIT','KIT','Line Cook',       2,'10:00','18:00',30,27.00),
  ('+61435064041','KIT','KIT','Line Cook',       3,'12:00','20:00',30,27.00),
  ('+61435064041','KIT','KIT','Line Cook',       4,'12:00','20:00',30,27.00),
  ('+61435064041','KIT','KIT','Saturday Cook',   5,'10:00','18:00',30,27.00),
  ('+61450006509','FOH','FL1','Floor Supervisor',0,'12:00','20:00',45,35.00),
  ('+61450006509','FOH','FL1','Floor Supervisor',1,'12:00','20:00',45,35.00),
  ('+61450006509','FOH','LNG','Lounge Supervisor',2,'15:00','23:00',45,35.00),
  ('+61450006509','FOH','FL1','Floor Supervisor',4,'14:00','22:00',45,35.00),
  ('+61450006509','FOH','LNG','Sat Supervisor',  5,'14:00','22:00',45,35.00),
  ('+61481904384','MGT','OFF','Daily Manager',   0,'09:00','17:00',60,45.00),
  ('+61481904384','MGT','OFF','Daily Manager',   1,'09:00','17:00',60,45.00),
  ('+61481904384','MGT','OFF','Daily Manager',   2,'09:00','17:00',60,45.00),
  ('+61481904384','MGT','OFF','Daily Manager',   3,'09:00','17:00',60,45.00),
  ('+61481904384','MGT','OFF','Daily Manager',   4,'09:00','17:00',60,45.00),
  ('+61425071500','MGT','OFF','Owner Oversight', 0,'10:00','15:00',30,60.00),
  ('+61425071500','MGT','OFF','Owner Oversight', 2,'10:00','15:00',30,60.00),
  ('+61425071500','MGT','OFF','Owner Oversight', 4,'10:00','15:00',30,60.00)
) AS seed(mobile, dept_code, loc_code, station, offset_days, start_time, end_time, br, hr)
JOIN public.users u         ON u.mobile = seed.mobile
JOIN public.departments d   ON d.code = seed.dept_code
JOIN public.locations loc   ON loc.code = seed.loc_code
CROSS JOIN LATERAL (SELECT rp.week_start + seed.offset_days AS shift_date_val) AS d2
WHERE rp.status = 'published'
  AND NOT EXISTS (
      SELECT 1 FROM public.shifts s
       WHERE s.user_id = u.id
         AND s.shift_date = shift_date_val::DATE
         AND s.start_time = seed.start_time::TIME
         AND s.end_time   = seed.end_time::TIME
  );

--  9i. Active clock-ins for 6 staff (live floor strip on dashboard)
INSERT INTO public.attendance_sessions
  (user_id, shift_id, terminal_id, clocked_in_at, status, in_gps_lat, in_gps_lng)
SELECT
    u.id,
    (SELECT s.id FROM public.shifts s
        WHERE s.user_id = u.id AND s.shift_date = CURRENT_DATE
        ORDER BY s.start_time ASC LIMIT 1),
    'TERM-8821-B',
    NOW() - interval_offset.minutes * INTERVAL '1 minute',
    'clocked_in',
    -33.87 + offset_geo.lat, 151.21 + offset_geo.lng
FROM (VALUES
  ('+61410111222', 372, 0.002,  0.001),
  ('+61481904384', 285, 0.003, -0.001),
  ('+61450006509', 130, 0.001,  0.002),
  ('+61410111224', 485, 0.004,  0.003),
  ('+61435064041', 320, 0.000,  0.000),
  ('+61410111223',  60, 0.002,  0.001)
) AS src(mobile, minutes, lat, lng)
JOIN public.users u ON u.mobile = src.mobile
CROSS JOIN LATERAL (SELECT src.minutes AS minutes) AS interval_offset
CROSS JOIN LATERAL (SELECT src.lat AS lat, src.lng AS lng) AS offset_geo
WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_sessions a
     WHERE a.user_id = u.id AND a.status IN ('clocked_in','on_break')
);

--  9j. 2 example shift-swap requests
INSERT INTO public.shift_swap_requests
  (requester_user_id, shift_id, offered_to_user_id, status, reason)
SELECT
    requester.id,
    (SELECT s.id FROM public.shifts s
      WHERE s.user_id = requester.id ORDER BY shift_date DESC LIMIT 1),
    offered.id,
    'pending',
    'Family commitment — can you take my Sat evening shift?'
FROM public.users requester, public.users offered
WHERE requester.mobile = '+61410111223'
  AND offered.mobile   = '+61410111225'
  AND NOT EXISTS (SELECT 1 FROM public.shift_swap_requests WHERE requester_user_id = requester.id);

INSERT INTO public.shift_swap_requests
  (requester_user_id, shift_id, offered_to_user_id, status, reason)
SELECT
    requester.id,
    (SELECT s.id FROM public.shifts s
      WHERE s.user_id = requester.id ORDER BY shift_date DESC LIMIT 1),
    offered.id,
    'approved',
    'Covering study exam — thank you!'
FROM public.users requester, public.users offered
WHERE requester.mobile = '+61410111225'
  AND offered.mobile   = '+61410111223'
  AND NOT EXISTS (SELECT 1 FROM public.shift_swap_requests
                  WHERE requester_user_id = requester.id AND status = 'approved');

-- =====================================================================
--  DONE
-- =====================================================================
--
--  Verify everything is in place with these quick checks (optional — you can paste them separately):
--
--    SELECT count(*) AS users_count     FROM public.users;           -- expect 8
--    SELECT count(*) AS shifts_count    FROM public.shifts;          -- expect ~40
--    SELECT count(*) AS dept_count      FROM public.departments;     -- expect 4
--    SELECT count(*) AS attendance_now  FROM public.attendance_sessions
--     WHERE status IN ('clocked_in','on_break');                     -- expect 6
--
--  If all counts match, move to Phase 3 of the app setup:
--  paste Supabase API keys into .env.local and run:
--
--    npm run dev   → then open /login
