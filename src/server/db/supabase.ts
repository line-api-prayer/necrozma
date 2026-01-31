import { createClient } from "@supabase/supabase-js";
import { env } from "~/env.js";

const dbUrl = env.SUPABASE_URL;
const dbKey = env.SUPABASE_SERVICE_ROLE_KEY;

export async function supabaseClient() {
  return createClient(dbUrl, dbKey);
}
