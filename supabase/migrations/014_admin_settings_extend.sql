-- Add security settings and application preferences to admin_settings table
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS session_timeout_seconds integer NOT NULL DEFAULT 43200,
ADD COLUMN IF NOT EXISTS require_mfa boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS password_policy_min_length integer NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS ip_whitelisting text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS failed_login_limit integer NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS default_theme text NOT NULL DEFAULT 'dark',
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'AUD',
ADD COLUMN IF NOT EXISTS enable_email_notifications boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_push_notifications boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_sms_notifications boolean NOT NULL DEFAULT true;

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role app_role PRIMARY KEY,
    can_clock_in boolean NOT NULL DEFAULT true,
    can_view_roster boolean NOT NULL DEFAULT true,
    can_swap_shifts boolean NOT NULL DEFAULT true,
    can_manage_staff boolean NOT NULL DEFAULT false,
    can_manage_roster boolean NOT NULL DEFAULT false,
    can_manage_payroll boolean NOT NULL DEFAULT false,
    can_send_messages boolean NOT NULL DEFAULT true,
    can_view_reports boolean NOT NULL DEFAULT false,
    can_access_admin_dashboard boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view role permissions" ON role_permissions;
CREATE POLICY "Admins can view role permissions" ON role_permissions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'restaurant_admin')
        )
    );

DROP POLICY IF EXISTS "Admins can update role permissions" ON role_permissions;
CREATE POLICY "Admins can update role permissions" ON role_permissions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'restaurant_admin')
        )
    );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS set_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER set_role_permissions_updated_at
    BEFORE UPDATE ON role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Populate with defaults
INSERT INTO role_permissions (role, can_clock_in, can_view_roster, can_swap_shifts, can_manage_staff, can_manage_roster, can_manage_payroll, can_send_messages, can_view_reports, can_access_admin_dashboard)
VALUES 
  ('super_admin', true, true, true, true, true, true, true, true, true),
  ('restaurant_admin', true, true, true, true, true, true, true, true, true),
  ('manager', true, true, true, true, true, false, true, true, true),
  ('supervisor', true, true, true, false, false, false, true, false, false),
  ('employee', true, true, true, false, false, false, true, false, false)
ON CONFLICT (role) DO UPDATE SET
  can_clock_in = EXCLUDED.can_clock_in,
  can_view_roster = EXCLUDED.can_view_roster,
  can_swap_shifts = EXCLUDED.can_swap_shifts,
  can_manage_staff = EXCLUDED.can_manage_staff,
  can_manage_roster = EXCLUDED.can_manage_roster,
  can_manage_payroll = EXCLUDED.can_manage_payroll,
  can_send_messages = EXCLUDED.can_send_messages,
  can_view_reports = EXCLUDED.can_view_reports,
  can_access_admin_dashboard = EXCLUDED.can_access_admin_dashboard;
