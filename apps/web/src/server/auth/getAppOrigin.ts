import { readAppEnv } from "@fieldpulse/platform-config";

export function getAppOrigin(request?: Request) {
  const env = readAppEnv(process.env);

  if (env.appUrl) {
    return new URL(env.appUrl).origin;
  }

  if (request) {
    return new URL(request.url).origin;
  }

  throw new Error(
    "[auth] APP_URL is required when a request origin is not available.",
  );
}
