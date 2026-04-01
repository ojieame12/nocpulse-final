export type { SoilProperties } from "./contracts/SoilProperties";
export type {
  PerDepthSoilProperties,
  SoilPropertiesProvider,
} from "./contracts/SoilPropertiesProvider";
export {
  createSoilGridsClient,
  type SoilGridsClient,
  type SoilGridsClientOptions,
} from "./infrastructure/SoilGridsClient";
export {
  createWebDavSoilGridsProvider,
  type WebDavSoilGridsProviderOptions,
  type BulkSoilQuery,
  type BulkSoilResult,
  type PointSampler,
  /** @deprecated Use PerDepthSoilProperties from contracts instead */
  type PerDepthSoilProperties as WebDavPerDepthSoilProperties,
} from "./infrastructure/createWebDavSoilGridsProvider";
export {
  createWcsSoilGridsProvider,
  type WcsSoilGridsProviderOptions,
} from "./infrastructure/createWcsSoilGridsProvider";
export {
  createSoilPropertiesProvider,
  type SoilPropertiesProviderFactoryOptions,
} from "./infrastructure/createSoilPropertiesProviderFactory";
