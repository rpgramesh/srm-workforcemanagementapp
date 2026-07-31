-- =====================================================================
-- ShiftMaster Pro — Migration 006
-- Staff Management: Extended users schema + CRUD RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Add new columns to users table (only if they don't already exist)
-- ---------------------------------------------------------------------

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS employment_date DATE,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Re-add department_id FK just in case it's missing (migration 004 adds it, but safe)
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS department_id UUID
    REFERENCES public.departments(id) ON DELETE SET NULL;

-- Add CHECK constraint for email if present (valid-format regex, per RFC 5322 simplified)
DO $$ BEGIN
    ALTER TABLE public.users
        ADD CONSTRAINT users_email_format
        CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS users_department_idx     ON public.users(department_id);
CREATE INDEX IF NOT EXISTS users_employment_date_idx ON public.users(employment_date);
CREATE INDEX IF NOT EXISTS users_email_idx          ON public.users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_first_name_trgm_idx ON public.users USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_last_name_trgm_idx  ON public.users USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_full_name_idx       ON public.users((first_name || ' ' || last_name));

-- Re-attach updated_at trigger just in case (001 already does, idempotent)
DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 2. create_staff_user SECURITY DEFINER RPC
--    Creates a user with bcrypt PIN, enforces unique mobile & employee_id
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_staff_user(
    p_first_name          TEXT,
    p_last_name           TEXT,
    p_mobile              TEXT,
    p_role                app_role,
    p_pin                 TEXT,
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
    p_permissions         JSONB DEFAULT '{}'::JSONB,
    p_is_active           BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    existing_mobile INTEGER;
    existing_empid INTEGER;
BEGIN
    -- Validate Australian mobile format + canonical +614
    IF p_mobile !~ '^\+614\d{8}$' THEN
        RAISE EXCEPTION 'Invalid mobile format — must be canonical Australian +614XXXXXXXX';
    END IF;

    -- Validate PIN length
    IF p_pin !~ '^\d{4}$' THEN
        RAISE EXCEPTION 'PIN must be exactly 4 digits';
    END IF;

    -- Validate required fields
    IF p_first_name IS NULL OR length(trim(p_first_name)) = 0 THEN
        RAISE EXCEPTION 'first_name is required';
    END IF;
    IF p_last_name IS NULL OR length(trim(p_last_name)) = 0 THEN
        RAISE EXCEPTION 'last_name is required';
    END IF;

    -- Unique mobile check (active users only — matches existing index)
    SELECT COUNT(*) INTO existing_mobile
      FROM public.users u
     WHERE u.mobile = p_mobile AND u.is_active = TRUE;
    IF existing_mobile > 0 THEN
        RAISE EXCEPTION 'An active user with that mobile number already exists';
    END IF;

    -- Unique employee_id check
    IF p_employee_id IS NOT NULL THEN
        SELECT COUNT(*) INTO existing_empid
          FROM public.users u
         WHERE u.employee_id = p_employee_id;
        IF existing_empid > 0 THEN
            RAISE EXCEPTION 'Employee ID % is already in use', p_employee_id;
        END IF;
    END IF;

    -- PIN uniqueness check (required for verify_clock_in_pin() to stay deterministic)
    DECLARE
        r RECORD;
        matched BOOLEAN := FALSE;
    BEGIN
        FOR r IN SELECT u.pin_hash FROM public.users u WHERE u.is_active = TRUE LOOP
            IF r.pin_hash = crypt(p_pin, r.pin_hash) THEN
                matched := TRUE;
                EXIT;
            END IF;
        END LOOP;
        IF matched THEN
            RAISE EXCEPTION 'That 4-digit PIN is already assigned to another staff member';
        END IF;
    END;

    INSERT INTO public.users (
        first_name, last_name, mobile, role, pin_hash,
        employee_id, job_title, hourly_rate, avatar_url, color,
        department_id, email, employment_date, address,
        emergency_contact_name, emergency_contact_phone,
        notes, permissions, is_active
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
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION create_staff_user(TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_staff_user(TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------
-- 3. update_staff_user SECURITY DEFINER RPC
--    Allowed to change every mutable field. PIN re-locked with bcrypt when given.
-- ---------------------------------------------------------------------

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
)
RETURNS VOID AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    -- Validate mobile if provided
    IF p_mobile IS NOT NULL AND p_mobile !~ '^\+614\d{8}$' THEN
        RAISE EXCEPTION 'Invalid mobile format — must be canonical Australian +614XXXXXXXX';
    END IF;

    -- Validate PIN if provided
    IF p_pin IS NOT NULL AND p_pin !~ '^\d{4}$' THEN
        RAISE EXCEPTION 'PIN must be exactly 4 digits';
    END IF;

    -- PIN uniqueness when changing PIN
    IF p_pin IS NOT NULL THEN
        DECLARE
            r RECORD;
            matched BOOLEAN := FALSE;
        BEGIN
            FOR r IN
                SELECT u.pin_hash
                  FROM public.users u
                 WHERE u.is_active = TRUE
                   AND u.id <> p_user_id
            LOOP
                IF r.pin_hash = crypt(p_pin, r.pin_hash) THEN
                    matched := TRUE;
                    EXIT;
                END IF;
            END LOOP;
            IF matched THEN
                RAISE EXCEPTION 'That 4-digit PIN is already assigned to another staff member';
            END IF;
        END;
    END IF;

    -- Unique mobile check on mobile change
    IF p_mobile IS NOT NULL THEN
        PERFORM 1
          FROM public.users u
         WHERE u.mobile = p_mobile
           AND u.is_active = TRUE
           AND u.id <> p_user_id;
        IF FOUND THEN
            RAISE EXCEPTION 'An active user with that mobile number already exists';
        END IF;
    END IF;

    -- Unique employee_id check on change
    IF p_employee_id IS NOT NULL AND length(btrim(p_employee_id)) > 0 THEN
        PERFORM 1
          FROM public.users u
         WHERE u.employee_id = btrim(p_employee_id)
           AND u.id <> p_user_id;
        IF FOUND THEN
            RAISE EXCEPTION 'Employee ID % is already in use', btrim(p_employee_id);
        END IF;
    END IF;

    UPDATE public.users u SET
        first_name                = COALESCE(NULLIF(btrim(p_first_name), ''),        u.first_name),
        last_name                 = COALESCE(NULLIF(btrim(p_last_name), ''),         u.last_name),
        mobile                    = COALESCE(p_mobile,                                 u.mobile),
        role                      = COALESCE(p_role,                                   u.role),
        pin_hash                  = CASE WHEN p_pin IS NOT NULL
                                         THEN extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
                                         ELSE u.pin_hash END,
        employee_id               = CASE WHEN p_employee_id IS NOT NULL
                                         THEN NULLIF(btrim(p_employee_id), '')
                                         ELSE u.employee_id END,
        job_title                 = CASE WHEN p_job_title IS NOT NULL
                                         THEN NULLIF(btrim(p_job_title), '')
                                         ELSE u.job_title END,
        hourly_rate               = CASE WHEN p_hourly_rate IS NOT NULL
                                         THEN p_hourly_rate ELSE u.hourly_rate END,
        avatar_url                = CASE WHEN p_avatar_url IS NOT NULL
                                         THEN NULLIF(btrim(p_avatar_url), '')
                                         ELSE u.avatar_url END,
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
    IF rows_affected = 0 THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION update_staff_user(UUID,TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_staff_user(UUID,TEXT,TEXT,TEXT,app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------
-- 4. soft_delete_staff_user SECURITY DEFINER RPC (sets is_active=FALSE)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION soft_delete_staff_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    UPDATE public.users u
       SET is_active = FALSE
     WHERE u.id = p_user_id;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected = 0 THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION soft_delete_staff_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_staff_user(UUID) TO service_role;
