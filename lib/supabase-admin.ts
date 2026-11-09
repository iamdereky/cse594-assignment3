import "server-only";
import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient<any>> | null = null;

export function getDatabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!client) {
    client = createClient<any>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "X-Client-Info": "emotion-labeling-study/1.0" } }
    });
  }

  return client;
}
