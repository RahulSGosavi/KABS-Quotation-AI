import { createClient } from '@supabase/supabase-js';

// Environment variables are loaded via Vite's 'define' config
// We use a fallback to prevent the app from crashing on startup if keys are missing.
// Service calls will fail gracefully (network error) and the app will revert to mock data.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'placeholder-key';

if (SUPABASE_URL === 'https://placeholder.supabase.co') {
    console.warn("Supabase credentials missing. App running in offline/demo mode.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);