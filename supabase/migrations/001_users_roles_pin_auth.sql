-- =====================================================================
-- ShiftMaster Pro — Migration 001
-- Users, RBAC roles, PIN-based authentication, RLS, and seed data
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions & helpers
-- ---------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ---------------------------------------------------------------------
-- 2. Role enum — must stay in sync with types/app.ts appRoles[]
-- ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM (
    'super_admin',
    'restaurant_admin',
    'manager',
    'supervisor',
    'employee'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- 3. Users table
--    mobile  – canonical Australian format: +614XXXXXXXX (unique, not null)
--    pin     – bcrypt via pgcrypto, never stored in plaintext
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  mobile      TEXT NOT NULL
              CONSTRAINT users_mobile_format
              CHECK (mobile ~ '^\+614\d{8}$'),
  role        app_role NOT NULL DEFAULT 'employee',
  pin_hash    TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  job_title   TEXT,
  hourly_rate NUMERIC(10, 2),
  avatar_url  TEXT,
  color       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE UNIQUE INDEX IF NOT EXISTS users_mobile_unique
  ON public.users (mobile)
  WHERE is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_unique
  ON public.users (employee_id);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);
CREATE INDEX IF NOT EXISTS users_active_idx ON public.users (is_active);

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 4. PIN verification SECURITY DEFINER function
--    Runs with owner privileges so RLS does not block password lookups.
--    Never returns the hash — only a boolean match + optional user row.
-- ---------------------------------------------------------------------

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
DECLARE
  rec RECORD;
BEGIN
  SELECT u.id, u.first_name, u.last_name, u.role, u.employee_id,
         u.pin_hash, u.is_active
    INTO rec
    FROM public.users u
   WHERE u.mobile = user_mobile
     AND u.is_active = TRUE
   LIMIT 1;

  IF rec IS NULL THEN
    matched := FALSE;
    user_id := NULL;
    first_name := NULL;
    last_name := NULL;
    role := NULL;
    employee_id := NULL;
    is_active_user := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  matched := (rec.pin_hash = crypt(pin_input, rec.pin_hash));

  IF matched THEN
    user_id        := rec.id;
    first_name     := rec.first_name;
    last_name      := rec.last_name;
    role           := rec.role;
    employee_id    := rec.employee_id;
    is_active_user := rec.is_active;
  ELSE
    user_id        := NULL;
    first_name     := NULL;
    last_name      := NULL;
    role           := NULL;
    employee_id    := NULL;
    is_active_user := NULL;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION verify_user_pin(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_user_pin(TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 5. Same as above but clock-in variant: PIN-only lookup (unique per user)
--    NOTE: With bcrypt random-salting, we cannot index plain PINs.
--    The app layer MUST enforce unique PINs at INSERT/UPDATE time.
--    We iterate rows here which is fine for a restaurant-scale staff list.
-- ---------------------------------------------------------------------

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
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id, u.first_name, u.last_name, u.role, u.employee_id,
           u.color, u.pin_hash, u.is_active
      FROM public.users u
     WHERE u.is_active = TRUE
  LOOP
    IF r.pin_hash = crypt(pin_input, r.pin_hash) THEN
      matched        := TRUE;
      user_id        := r.id;
      first_name     := r.first_name;
      last_name      := r.last_name;
      role           := r.role;
      employee_id    := r.employee_id;
      color          := r.color;
      is_active_user := r.is_active;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  matched        := FALSE;
  user_id        := NULL;
  first_name     := NULL;
  last_name      := NULL;
  role           := NULL;
  employee_id    := NULL;
  color          := NULL;
  is_active_user := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION verify_clock_in_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_clock_in_pin(TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 6. Row Level Security — on by default; service_role bypasses it natively
-- ---------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own_and_managers ON public.users;
CREATE POLICY users_read_own_and_managers ON public.users
  FOR SELECT
  USING (
    (auth.uid() = id)
    OR (role IN ('restaurant_admin', 'manager', 'supervisor'))
  );

DROP POLICY IF EXISTS users_insert_admins ON public.users;
CREATE POLICY users_insert_admins ON public.users
  FOR INSERT
  WITH CHECK (
    role IN ('restaurant_admin', 'manager')
  );

DROP POLICY IF EXISTS users_update_admins ON public.users;
CREATE POLICY users_update_admins ON public.users
  FOR UPDATE
  USING (
    role IN ('restaurant_admin', 'manager')
  )
  WITH CHECK (
    role IN ('restaurant_admin', 'manager', 'supervisor', 'employee')
  );

-- =====================================================================
-- 7. Seed — example restaurant staff
--    PINs are bcrypt-hashed at migration time using crypt(gen_salt('bf', 10))
--
--    Test accounts (mobile — PIN — role):
--      +61420111001  2001  restaurant_admin   (Amelia Carter)
--      +61420111002  3002  manager            (Liam O'Brien)
--      +61420111003  4003  supervisor         (Sophie Nguyen)
--      +61420111004  1004  employee           (Jack Patel)
--      +61420111005  1005  employee           (Zara Ali)
--      +61420111006  1006  employee           (Noah Williams)
--      +61420111007  1007  employee           (Mia Chen)
--      +61420111008  1008  employee           (Ethan Rossi)
-- =====================================================================

INSERT INTO public.users
  (first_name, last_name, mobile, role, employee_id, job_title, hourly_rate, color, pin_hash, is_active)
VALUES
  ('Ganga', '', '+61425071500', 'restaurant_admin', 'EMP-1001', 'Restaurant Director', 55.00, '#60A5FA', crypt('2001', gen_salt('bf', 10)), TRUE),
  ('Ramesh','', '+61481904384', 'manager',          'EMP-1002', 'Floor Manager',       42.00, '#34D399', crypt('3002', gen_salt('bf', 10)), TRUE),
  ('Siddi', '',  '+61450006509', 'supervisor',       'EMP-1003', 'Shift Supervisor',    34.50, '#F472B6', crypt('4003', gen_salt('bf', 10)), TRUE),
  ('Anmol', '',    '+61435064041', 'employee',         'EMP-1004', 'Senior Waiter',       28.75, '#FBBF24', crypt('1004', gen_salt('bf', 10)), TRUE)
ON CONFLICT (mobile) DO NOTHING;
