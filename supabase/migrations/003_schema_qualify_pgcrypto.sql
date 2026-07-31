-- =====================================================================
-- ShiftMaster Pro — Migration 003
-- PATCH: schema-qualify pgcrypto so SECURITY DEFINER RPCs can resolve it
-- =====================================================================

-- 1. Ensure pgcrypto lives in the standard 'extensions' schema
DROP EXTENSION IF EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Re-create verify_user_pin using extensions.crypt / extensions.gen_salt
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

  matched := (rec.pin_hash = extensions.crypt(pin_input, rec.pin_hash));

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

-- 3. Re-create verify_clock_in_pin likewise
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
    IF r.pin_hash = extensions.crypt(pin_input, r.pin_hash) THEN
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

-- 4. Re-hash PINs with extensions.gen_salt so extensions.crypt() can verify them
UPDATE public.users SET pin_hash = extensions.crypt('5087', extensions.gen_salt('bf', 10)) WHERE mobile = '+61425071500';
UPDATE public.users SET pin_hash = extensions.crypt('4384', extensions.gen_salt('bf', 10)) WHERE mobile = '+61481904384';
UPDATE public.users SET pin_hash = extensions.crypt('6509', extensions.gen_salt('bf', 10)) WHERE mobile = '+61450006509';
UPDATE public.users SET pin_hash = extensions.crypt('4041', extensions.gen_salt('bf', 10)) WHERE mobile = '+61435064041';
