-- =====================================================================
-- ShiftMaster Pro — Migration 002
-- PATCH: enable pgcrypto, re-create PIN-verification SECURITY DEFINER
-- functions, and bcrypt-hash the 4 existing staff PINs you inserted.
-- Run this in Supabase SQL Editor AFTER running 001_users_roles_pin_auth.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enable pgcrypto (the missing extension causing crypt() errors)
-- ---------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. Rebuild verify_user_pin with pgcrypto available
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
    user_id := NULL; first_name := NULL; last_name := NULL;
    role := NULL; employee_id := NULL; is_active_user := NULL;
    RETURN NEXT; RETURN;
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
    user_id := NULL; first_name := NULL; last_name := NULL;
    role := NULL; employee_id := NULL; is_active_user := NULL;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION verify_user_pin(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_user_pin(TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 3. Rebuild verify_clock_in_pin (PIN-only lookups for shift terminals)
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

  matched := FALSE;
  user_id := NULL; first_name := NULL; last_name := NULL;
  role := NULL; employee_id := NULL; color := NULL; is_active_user := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION verify_clock_in_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_clock_in_pin(TEXT) TO service_role;

-- =====================================================================
-- 4. Bcrypt-hash PINs for the 4 existing staff records using pgcrypto.
--
--      Ganga  +61425071500  restaurant_admin  PIN 5087  (matches ADMIN_PIN in .env.local)
--      Ramesh +61481904384  manager           PIN 4384  (last 4 of mobile)
--      Siddi  +61450006509  supervisor        PIN 6509  (last 4 of mobile)
--      Anmol  +61435064041  employee          PIN 4041  (last 4 of mobile)
-- =====================================================================

UPDATE public.users SET pin_hash = crypt('5087', gen_salt('bf', 10)) WHERE mobile = '+61425071500';
UPDATE public.users SET pin_hash = crypt('4384', gen_salt('bf', 10)) WHERE mobile = '+61481904384';
UPDATE public.users SET pin_hash = crypt('6509', gen_salt('bf', 10)) WHERE mobile = '+61450006509';
UPDATE public.users SET pin_hash = crypt('4041', gen_salt('bf', 10)) WHERE mobile = '+61435064041';

-- ---------------------------------------------------------------------
-- 5. Ensure RLS is ENABLED on public.users (restrictive by default;
--    the service_role key used by our Server Actions bypasses it)
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
  WITH CHECK (role IN ('restaurant_admin', 'manager'));

DROP POLICY IF EXISTS users_update_admins ON public.users;
CREATE POLICY users_update_admins ON public.users
  FOR UPDATE
  USING   (role IN ('restaurant_admin', 'manager'))
  WITH CHECK (role IN ('restaurant_admin', 'manager', 'supervisor', 'employee'));
