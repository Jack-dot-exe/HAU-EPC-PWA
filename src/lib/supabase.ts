import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableDefaultKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined;

export const isSupabaseEnabled = Boolean(supabaseUrl && supabasePublishableDefaultKey);

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl!, supabasePublishableDefaultKey!, {
      auth: {
        persistSession: true,
      },
    })
  : null;
