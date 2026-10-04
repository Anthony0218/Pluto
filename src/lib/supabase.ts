import { createClient } from "@supabase/supabase-js";
import { createSessionRefreshFetch } from "./sessionRefreshFetch";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  { global: { fetch: createSessionRefreshFetch(supabaseUrl) } },
);
if (import.meta.env.DEV) {
  (window as Window & { supabase?: typeof supabase }).supabase = supabase;
}
