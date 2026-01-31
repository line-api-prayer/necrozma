import { createClient } from "@supabase/supabase-js";
import { env } from "~/env.js";

const dbUrl = env.SUPABASE_URL;
const dbKey = env.SUPABASE_ANON_KEY;

export async function supabaseClient() {
  return createClient(dbUrl, dbKey);
}
