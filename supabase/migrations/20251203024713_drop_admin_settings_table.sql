/*
  # Drop admin_settings table

  ## Overview
  This migration removes the admin_settings table since all configuration values
  have been moved to environment variables for better security and Cloudflare Pages compatibility.

  ## Changes Made
  
  ### Dropped Tables
  - `admin_settings` - No longer needed as configuration is stored in environment variables:
    - Admin password hash → ADMIN_PASSWORD_HASH env var
    - Artist email → ARTIST_EMAIL env var
    - Artist SMS email → ARTIST_SMS_EMAIL env var

  ## Security Notes
  - All sensitive configuration values are now stored in Supabase Edge Functions environment
  - No secrets are stored in database tables
  - This improves security by centralizing secret management
  - Configuration is easier to manage across different environments

  ## Migration Safety
  - Uses IF EXISTS to prevent errors if table was already dropped
  - Non-destructive if table doesn't exist
*/

-- Drop admin_settings table if it exists
DROP TABLE IF EXISTS admin_settings;
