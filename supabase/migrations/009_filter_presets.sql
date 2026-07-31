-- =====================================================================
-- ShiftMaster Pro — Migration 009
-- Filter Presets: save / load / rename / delete named filter combos
-- (department, role, status, name search, employee_id, sort) per user
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.filter_presets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    module      TEXT NOT NULL DEFAULT 'staff_directory',   -- 'staff_directory', 'roster', 'payroll'
    name        TEXT NOT NULL,
    filters     JSONB NOT NULL DEFAULT '{}'::JSONB,        -- {departmentId, role, status, search, sortBy, sortDir}
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    UNIQUE (user_id, module, name)
);

CREATE INDEX IF NOT EXISTS fp_user_module_idx ON public.filter_presets(user_id, module);

ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS fp_set_updated_at ON public.filter_presets;
CREATE TRIGGER fp_set_updated_at
BEFORE UPDATE ON public.filter_presets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Users manage only their own presets
DROP POLICY IF EXISTS fp_own_rows ON public.filter_presets;
CREATE POLICY fp_own_rows ON public.filter_presets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- upsert_filter_preset SECURITY DEFINER RPC
--    If same (user, module, name) exists → update filters / is_default
--    Otherwise insert. Returns the preset id.
--    When p_is_default=TRUE, clears the default flag of other presets.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION upsert_filter_preset(
    p_user_id    UUID,
    p_module     TEXT,
    p_name       TEXT,
    p_filters    JSONB DEFAULT '{}'::JSONB,
    p_is_default BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    clean_name TEXT := btrim(p_name);
    new_id     UUID;
BEGIN
    IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id is required'; END IF;
    IF clean_name IS NULL OR length(clean_name) = 0 THEN RAISE EXCEPTION 'preset name is required'; END IF;

    IF p_is_default THEN
        UPDATE public.filter_presets
           SET is_default = FALSE
         WHERE user_id = p_user_id AND module = p_module;
    END IF;

    INSERT INTO public.filter_presets (user_id, module, name, filters, is_default)
    VALUES (p_user_id, p_module, clean_name, COALESCE(p_filters, '{}'::JSONB), COALESCE(p_is_default, FALSE))
    ON CONFLICT (user_id, module, name) DO UPDATE SET
        filters = EXCLUDED.filters,
        is_default = EXCLUDED.is_default
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION upsert_filter_preset(UUID,TEXT,TEXT,JSONB,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_filter_preset(UUID,TEXT,TEXT,JSONB,BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------
-- delete_filter_preset SECURITY DEFINER RPC
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_filter_preset(p_user_id UUID, p_module TEXT, p_preset_id UUID)
RETURNS VOID AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM public.filter_presets
     WHERE id = p_preset_id AND user_id = p_user_id AND module = p_module;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    IF rows_deleted = 0 THEN
        RAISE EXCEPTION 'Preset not found or belongs to another user';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE
   SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION delete_filter_preset(UUID,TEXT,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_filter_preset(UUID,TEXT,UUID) TO service_role;
