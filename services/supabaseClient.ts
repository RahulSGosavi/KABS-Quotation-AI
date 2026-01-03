import { createClient } from '@supabase/supabase-js';

// Credentials provided by user
const SUPABASE_URL = 'https://lzcmsmixorgzttrsxmyt.supabase.co';
// Using Service Role Key to ensure Admin capabilities (INSERT/UPDATE) work without RLS blocking mock-admin user
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Y21zbWl4b3JnenR0cnN4bXl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMyNTE4OSwiZXhwIjoyMDgyOTAxMTg5fQ.Lwlkl0f9nbs0HYFXmMptyg-knqYI8lj1GVf5aVNvbHM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);