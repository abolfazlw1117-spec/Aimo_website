import { createClient } from '@supabase/supabase-js';

// Only the PUBLIC anon/publishable key is ever used in the browser. All protection is enforced
// by Row Level Security in Postgres (see supabase/migrations). Never put a service_role/secret key here.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);

export const sb = configured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    })
  : null;
