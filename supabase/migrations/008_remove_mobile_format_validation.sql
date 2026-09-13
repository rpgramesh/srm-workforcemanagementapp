-- =====================================================================
-- Migration 008: Remove Mobile Format Restriction (+614XXXXXXXX)
-- Allows standard numbers, international numbers, and arbitrary mobile formats
-- across Add Staff, Edit Staff, Settings, and Auth.
-- =====================================================================

-- 1. Drop the check constraint on public.users table if it exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_mobile_format;

-- 2. Update create_staff_user to remove +614 regex validation
CREATE OR REPLACE FUNCTION public.create_staff_user(
    p_first_name          TEXT,
    p_last_name           TEXT,
    p_mobile              TEXT,
    p_role                public.app_role,
    p_pin                 TEXT,
    p_employee_id         TEXT DEFAULT NULL,
    p_job_title           TEXT DEFAULT NULL,
    p_hourly_rate         NUMERIC DEFAULT NULL,
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
    -- Validate required mobile field
    IF p_mobile IS NULL OR length(trim(p_mobile)) = 0 THEN
        RAISE EXCEPTION 'mobile is required';
    END IF;

    -- Validate PIN length
    IF p_pin !~ '^\d{4}$' THEN
        RAISE EXCEPTION 'PIN must be exactly 4 digits';
    END IF;

    -- Validate required name fields
    IF p_first_name IS NULL OR length(trim(p_first_name)) = 0 THEN
        RAISE EXCEPTION 'first_name is required';
    END IF;
    IF p_last_name IS NULL OR length(trim(p_last_name)) = 0 THEN
        RAISE EXCEPTION 'last_name is required';
    END IF;

    -- Unique mobile check (active users only)
    SELECT COUNT(*) INTO existing_mobile
      FROM public.users u
     WHERE u.mobile = trim(p_mobile) AND u.is_active = TRUE;
    IF existing_mobile > 0 THEN
        RAISE EXCEPTION 'An active user with that mobile number already exists';
    END IF;

    -- Unique employee_id check
    IF p_employee_id IS NOT NULL THEN
        SELECT COUNT(*) INTO existing_empid
          FROM public.users u
         WHERE u.employee_id = trim(p_employee_id);
        IF existing_empid > 0 THEN
            RAISE EXCEPTION 'Employee ID % is already in use', p_employee_id;
        END IF;
    END IF;

    -- PIN uniqueness check
    DECLARE
        r RECORD;
        matched BOOLEAN := FALSE;
    BEGIN
        FOR r IN SELECT u.pin_hash FROM public.users u WHERE u.is_active = TRUE LOOP
            IF r.pin_hash = extensions.crypt(p_pin, r.pin_hash) THEN
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
        btrim(p_first_name), btrim(p_last_name), trim(p_mobile), p_role,
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

REVOKE ALL ON FUNCTION public.create_staff_user(TEXT,TEXT,TEXT,public.app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_staff_user(TEXT,TEXT,TEXT,public.app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;

-- 3. Update update_staff_user to remove +614 regex validation
CREATE OR REPLACE FUNCTION public.update_staff_user(
    p_user_id             UUID,
    p_first_name          TEXT DEFAULT NULL,
    p_last_name           TEXT DEFAULT NULL,
    p_mobile              TEXT DEFAULT NULL,
    p_role                public.app_role DEFAULT NULL,
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
    IF p_mobile IS NOT NULL AND length(trim(p_mobile)) = 0 THEN
        RAISE EXCEPTION 'mobile cannot be empty';
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
                IF r.pin_hash = extensions.crypt(p_pin, r.pin_hash) THEN
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
         WHERE u.mobile = trim(p_mobile)
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
        mobile                    = COALESCE(trim(p_mobile),                         u.mobile),
        role                      = COALESCE(p_role,                                 u.role),
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

REVOKE ALL ON FUNCTION public.update_staff_user(UUID,TEXT,TEXT,TEXT,public.app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_staff_user(UUID,TEXT,TEXT,TEXT,public.app_role,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;
