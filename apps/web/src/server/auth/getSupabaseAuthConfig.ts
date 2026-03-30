import { readAppEnv } from "@fieldpulse/platform-config";

export function getSupabaseAuthConfig() {
  const env = readAppEnv(process.env);

  if (!env.supabase.url || !env.supabase.anonKey) {
    throw new Error(
      "[auth] Supabase auth config requires SUPABASE_URL and SUPABASE_ANON_KEY.",
    );
  }

  return {
    nodeEnv: env.nodeEnv,
    url: env.supabase.url,
    anonKey: env.supabase.anonKey,
    projectRef: env.supabase.projectRef,
  };
}
