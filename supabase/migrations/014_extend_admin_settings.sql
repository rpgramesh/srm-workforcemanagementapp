-- Extend admin settings table with new columns for security settings, application preferences, and user settings
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS session_timeout_mins integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_login_attempts integer NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_password_expiry_days integer NOT NULL DEFAULT 90,
ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark',
ADD COLUMN IF NOT EXISTS allow_notifications boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'AUD',
ADD COLUMN IF NOT EXISTS allow_self_registration boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS default_user_role text NOT NULL DEFAULT 'employee';

-- Add settings_updated to audit_action enum
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'settings_updated';

