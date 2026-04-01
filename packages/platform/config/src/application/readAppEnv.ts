import { AppEnvSchema, type AppEnv } from "../contracts/AppEnv";

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

export function readAppEnv(source: Partial<Record<keyof AppEnv | string, string | undefined>>) {
  const parsed = AppEnvSchema.parse(source);
  const r2AccountId = parsed.R2_ACCOUNT_ID ?? parsed.CLOUDFLARE_ACCOUNT_ID;
  const r2Bucket = parsed.R2_BUCKET ?? parsed.R2_BUCKET_NAME;
  const supabaseProjectRef = extractProjectRef(parsed.SUPABASE_URL);
  const supabaseEnabled = Boolean(parsed.SUPABASE_URL && parsed.SUPABASE_SERVICE_ROLE_KEY);
  const sentinelHubEnabled = Boolean(
    parsed.SENTINEL_HUB_CLIENT_ID && parsed.SENTINEL_HUB_CLIENT_SECRET,
  );
  const planetEnabled = Boolean(parsed.PLANET_API_KEY);
  const r2Enabled = Boolean(
    r2AccountId &&
      parsed.R2_ACCESS_KEY_ID &&
      parsed.R2_SECRET_ACCESS_KEY &&
      r2Bucket,
  );

  return {
    nodeEnv: parsed.NODE_ENV,
    publicAppName: parsed.NEXT_PUBLIC_APP_NAME,
    appUrl: parsed.APP_URL,
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseProjectRef,
    databaseUrl: parsed.DATABASE_URL,
    sentryDsn: parsed.SENTRY_DSN,
    devActorUserId: parsed.DEV_ACTOR_USER_ID,
    devWorkspaceId: parsed.DEV_WORKSPACE_ID,
    supabase: {
      enabled: supabaseEnabled,
      url: parsed.SUPABASE_URL,
      anonKey: parsed.SUPABASE_ANON_KEY,
      serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
      projectRef: supabaseProjectRef,
    },
    imagery: {
      sentinelHub: {
        enabled: sentinelHubEnabled,
        clientId: parsed.SENTINEL_HUB_CLIENT_ID,
        clientSecret: parsed.SENTINEL_HUB_CLIENT_SECRET,
      },
      planet: {
        enabled: planetEnabled,
        apiKey: parsed.PLANET_API_KEY,
        ordersProductBundles: parsed.PLANET_ORDERS_PRODUCT_BUNDLES
          ? parsed.PLANET_ORDERS_PRODUCT_BUNDLES.split("|").map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      },
    },
    weather: {
      openMeteo: {
        enabled: true,
        apiKey: parsed.OPEN_METEO_API_KEY,
        archiveBaseUrl: parsed.OPEN_METEO_ARCHIVE_BASE_URL ?? "https://archive-api.open-meteo.com",
      },
    },
    email: {
      resendApiKey: parsed.RESEND_API_KEY,
      from: parsed.EMAIL_FROM ?? "NocPulse <noreply@nocpulse.com>",
    },
    requestAccess: {
      notifyEmail: parsed.REQUEST_ACCESS_NOTIFY_EMAIL,
      reviewWorkspaceId: parsed.REQUEST_ACCESS_REVIEW_WORKSPACE_ID,
      reviewGrantedByUserId: parsed.REQUEST_ACCESS_REVIEW_GRANTED_BY_USER_ID,
    },
    r2: {
      enabled: r2Enabled,
      accountId: r2AccountId,
      accessKeyId: parsed.R2_ACCESS_KEY_ID,
      secretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
      bucket: r2Bucket,
      endpoint: parsed.R2_ENDPOINT,
    },
    soil: {
      soilGridsBaseUrl: parsed.SOILGRIDS_BASE_URL ?? "rest.isric.org",
    },
  };
}
