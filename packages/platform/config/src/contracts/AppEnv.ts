import { z } from "zod";

const optionalString = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().optional(),
  );

const optionalUrl = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().url().optional(),
  );

export const AppEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().default("FieldPulse"),
  APP_URL: optionalUrl(),
  SUPABASE_URL: optionalUrl(),
  SUPABASE_ANON_KEY: optionalString(),
  SUPABASE_SERVICE_ROLE_KEY: optionalString(),
  OPEN_METEO_API_KEY: optionalString(),
  SENTINEL_HUB_CLIENT_ID: optionalString(),
  SENTINEL_HUB_CLIENT_SECRET: optionalString(),
  PLANET_API_KEY: optionalString(),
  PLANET_ORDERS_PRODUCT_BUNDLES: optionalString(),
  DATABASE_URL: optionalString(),
  DEV_ACTOR_USER_ID: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().uuid().optional(),
  ),
  DEV_WORKSPACE_ID: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().uuid().optional(),
  ),
  R2_ACCOUNT_ID: optionalString(),
  CLOUDFLARE_ACCOUNT_ID: optionalString(),
  R2_ACCESS_KEY_ID: optionalString(),
  R2_SECRET_ACCESS_KEY: optionalString(),
  R2_BUCKET: optionalString(),
  R2_BUCKET_NAME: optionalString(),
  R2_ENDPOINT: optionalUrl(),
  SENTRY_DSN: optionalString(),
  /** MapTiler API key – used by MapLibre GL JS for base map tiles & terrain. */
  NEXT_PUBLIC_MAPTILER_KEY: optionalString(),
  /** Resend API key for custom transactional emails. */
  RESEND_API_KEY: optionalString(),
  /** Sender address for auth emails, e.g. "NocPulse <auth@nocpulse.com>". */
  EMAIL_FROM: optionalString(),
  /** Internal recipient for request-access notifications. */
  REQUEST_ACCESS_NOTIFY_EMAIL: optionalString(),
  /** Explicit workspace binding for request-access review links. */
  REQUEST_ACCESS_REVIEW_WORKSPACE_ID: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().uuid().optional(),
  ),
  /** Explicit granting user binding for request-access review links. */
  REQUEST_ACCESS_REVIEW_GRANTED_BY_USER_ID: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().uuid().optional(),
  ),
});

export type AppEnv = z.infer<typeof AppEnvSchema>;
