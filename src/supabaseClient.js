import { createClient } from '@supabase/supabase-js';

// Reads the project URL/anon key from Vite env vars. Copy .env.example
// to .env and set these to enable real, cross-device Supabase Auth for
// the admin dashboard (sign-in + password changes). Without them,
// LoginModal.jsx and AdminDashboard.jsx automatically fall back to the
// existing local/localStorage-based credential check, so the site keeps
// working out of the box.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- Security hardening notes -----------------------------------------
// This client is intentionally initialized with the public anon key only
// — never the service_role key, which must never be shipped to the
// browser. Authorization for any table this project later adds must be
// enforced with Row Level Security (RLS) policies configured in the
// Supabase dashboard/SQL editor, not assumed from the client:
//   * Enable RLS on every table (it is NOT on by default for new tables).
//   * Write/update/delete policies should require `auth.uid()` to match
//     the authenticated admin, never a blanket `true`.
//   * Public read-only tables (e.g. news/matches, if migrated off
//     localStorage in the future) should get an explicit `select`-only
//     policy for the `anon` role rather than allowing anon writes.
// The anon key alone grants no access beyond what RLS policies permit,
// so it is safe to expose in client bundles as long as those policies
// are correctly scoped.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// `supabase` is null when the project isn't configured yet — every
// caller must check `isSupabaseConfigured` (or a truthy `supabase`)
// before using it, and fall back to the local credential flow otherwise.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
