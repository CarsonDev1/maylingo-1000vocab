import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SECRET (service-role) key.
 * Bypasses RLS — every query MUST be scoped by the Clerk userId in app code.
 * Never import this into a client component.
 */
let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local",
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
