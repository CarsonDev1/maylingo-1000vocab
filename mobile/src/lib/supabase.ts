import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_SERVICE_KEY in .env",
  );
}

/**
 * Mirrors the web app's `getSupabaseAdmin()` client: uses the service-role
 * (secret) key, so it bypasses RLS. Per-user isolation is enforced in app code
 * by scoping every query with `.eq("user_id", userId)` (the Clerk user id),
 * exactly like the web app does. No Supabase Auth session is used.
 */
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
