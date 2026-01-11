import { createClient } from '@supabase/supabase-js';

// Fallback demo keys to ensure the app works out-of-the-box without env setup.
const DEMO_URL = 'https://lzcmsmixorgzttrsxmyt.supabase.co';
const DEMO_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Y21zbWl4b3JnenR0cnN4bXl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMyNTE4OSwiZXhwIjoyMDgyOTAxMTg5fQ.Lwlkl0f9nbs0HYFXmMptyg-knqYI8lj1GVf5aVNvbHM';

// Try to get keys from environment (Vite injection), otherwise use demo keys.
const SUPABASE_URL = process.env.SUPABASE_URL || DEMO_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || DEMO_KEY;

// Additional safety check
if (!SUPABASE_URL) {
    console.error("Supabase URL is missing. The app may not function correctly.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);