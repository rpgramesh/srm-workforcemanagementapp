-- Create admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
    id integer PRIMARY KEY CHECK (id = 1),
    site_name text NOT NULL DEFAULT 'ShiftMaster Pro',
    open_hours_start time NOT NULL DEFAULT '07:00',
    open_hours_end time NOT NULL DEFAULT '23:00',
    default_timezone text NOT NULL DEFAULT 'Australia/Sydney',
    au_mobile_format boolean NOT NULL DEFAULT true,
    require_https boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admin and restaurant_admin can select and update
CREATE POLICY "Admins can view settings" ON admin_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'restaurant_admin')
        )
    );

CREATE POLICY "Admins can update settings" ON admin_settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'restaurant_admin')
        )
    );

-- Add updated_at trigger
CREATE TRIGGER set_admin_settings_updated_at
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Seed initial row
INSERT INTO admin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
