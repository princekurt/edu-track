import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./server";

/**
 * Service-role client. Server only. Used exclusively for administrator
 * operations such as provisioning accounts, which the anon client cannot do.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Administrator account management requires the service-role key.",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
