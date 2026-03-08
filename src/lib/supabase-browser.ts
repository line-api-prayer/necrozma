import { createClient } from "@supabase/supabase-js";
import { env } from "~/env.js";

// Use a singleton for the Supabase browser client
let supabaseClientInstance: ReturnType<typeof createClient> | null = null;

export const getSupabaseBrowserClient = () => {
  if (supabaseClientInstance) return supabaseClientInstance;

  supabaseClientInstance = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  
  return supabaseClientInstance;
};
