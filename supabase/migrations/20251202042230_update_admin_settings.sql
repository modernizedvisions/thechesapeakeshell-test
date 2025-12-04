/*
  # Update admin_settings table

  ## Changes
  This migration updates the admin_settings table to remove the password_hash column
  since authentication is now handled via environment variables for better security
  and portability.

  ## Modified Tables

  ### `admin_settings`
  - Removes `password_hash` column (moved to ADMIN_PASSWORD_HASH environment variable)
  - Keeps `artist_email` for order notifications
  - Keeps `artist_sms_email` for SMS notifications

  ## Security
  - Password hash is now stored securely in environment variables
  - Admin settings table now only contains non-secret configuration
  - RLS policies remain unchanged as they only affect data visibility

  ## Migration Notes
  - This is a non-destructive change if password_hash doesn't exist
  - Existing artist email settings are preserved
  - To set admin password, configure ADMIN_PASSWORD_HASH in Supabase Edge Functions secrets
*/

-- Remove password_hash column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE admin_settings DROP COLUMN password_hash;
  END IF;
END $$;