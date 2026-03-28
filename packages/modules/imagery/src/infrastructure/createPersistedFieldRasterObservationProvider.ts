import type { FieldRasterObservationProvider } from "./FieldRasterObservationProvider";
import type { FieldRasterObservationRepository } from "./FieldRasterObservationRepository";

type CreatePersistedFieldRasterObservationProviderOptions = {
  repository: FieldRasterObservationRepository;
};

export function createPersistedFieldRasterObservationProvider({
  repository,
}: CreatePersistedFieldRasterObservationProviderOptions): FieldRasterObservationProvider {
  return {
    async observeFieldRaster(input) {
      const observation = await repository.getLatestByField(
        input.workspaceId,
        input.fieldId,
        input.observedAt,
      );

      if (!observation) {
        return null;
      }

      return {
        sourceKey: observation.sourceKey,
        cells: observation.cells,
      };
    },
  };
}
