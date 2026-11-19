// Node tests exercise the edge-function fallback without changing its Deno import.
declare module "npm:@supabase/supabase-js@2.118.0" {
  export type SupabaseClient = import("@supabase/supabase-js").SupabaseClient;
}
