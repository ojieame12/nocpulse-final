function extractProjectRef(supabaseUrl: string | undefined) {
  if (!supabaseUrl) {
    return undefined;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname.split(".")[0];
  } catch {
    return undefined;
  }
}

export function getSupabaseAuthConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[auth] Supabase auth config requires SUPABASE_URL and SUPABASE_ANON_KEY.",
    );
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    url,
    anonKey,
    projectRef: extractProjectRef(url),
  };
}
