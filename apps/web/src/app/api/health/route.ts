import { jsonOk } from "../../../server/http/json";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = getWebServerRuntime();

  return jsonOk({
    status: "ok",
    service: "web",
    runtimeMode: runtime.mode,
    timestamp: new Date().toISOString(),
  });
}
