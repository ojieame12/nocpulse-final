import type { ImageryProviderDiagnostics } from "../contracts/ImageryProviderDiagnostics";
import type { ImageryProviderClient } from "../contracts/ImageryProviderClient";

export async function diagnoseImageryProviders(
  clients: readonly ImageryProviderClient[],
): Promise<readonly ImageryProviderDiagnostics[]> {
  return Promise.all(clients.map((client) => client.diagnose()));
}
