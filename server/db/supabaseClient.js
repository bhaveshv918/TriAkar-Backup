import { createClient } from '@supabase/supabase-js';

const CLIENT_OPTS = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

// Shared service-role client — used for ALL data and admin operations.
// IMPORTANT: never call signInWithPassword/setSession on this client. Doing so
// replaces its in-memory session with a user token, which silently downgrades
// every subsequent .from() query from service_role to that user (triggering RLS).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  CLIENT_OPTS,
);

// Dedicated throwaway client for user sign-in. Keeps the shared `supabase`
// client clean so service-role privileges (RLS bypass) are never lost.
export function createSignInClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLIENT_OPTS,
  );
}

export default supabase;
