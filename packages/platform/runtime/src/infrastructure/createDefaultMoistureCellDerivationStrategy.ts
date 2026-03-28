import {
  createPersistedFieldRasterObservationProvider,
  createRasterBackedFieldMoistureCellObservationSource,
  createSyntheticImageryFieldMoistureCellObservationSource,
  createSyntheticRasterFieldObservationProvider,
  type FieldRasterObservationRepository,
} from "@fieldpulse/module-imagery";
import {
  createFallbackFieldMoistureCellObservationSource,
  createSourceBackedFieldMoistureCellDerivationStrategy,
  createSyntheticFieldMoistureCellDerivationStrategy,
  type FieldMoistureCellDerivationStrategy,
} from "@fieldpulse/module-moisture";

type CreateDefaultMoistureCellDerivationStrategyOptions = {
  imageryRasterObservations?: FieldRasterObservationRepository;
};

export function createDefaultMoistureCellDerivationStrategy({
  imageryRasterObservations,
}: CreateDefaultMoistureCellDerivationStrategyOptions = {}): FieldMoistureCellDerivationStrategy {
  const fallbackStrategy = createSyntheticFieldMoistureCellDerivationStrategy();
  const persistedRasterObservationSource = imageryRasterObservations
    ? createRasterBackedFieldMoistureCellObservationSource({
        provider: createPersistedFieldRasterObservationProvider({
          repository: imageryRasterObservations,
        }),
        sourceKey: "imagery-persisted-raster-observation-v1",
      })
    : null;
  const syntheticRasterObservationSource =
    createRasterBackedFieldMoistureCellObservationSource({
      provider: createSyntheticRasterFieldObservationProvider(),
      sourceKey: "imagery-synthetic-raster-observation-v1",
    });
  const imageryFallbackObservationSource =
    createSyntheticImageryFieldMoistureCellObservationSource();
  const observationSource = persistedRasterObservationSource
    ? createFallbackFieldMoistureCellObservationSource({
        primary: persistedRasterObservationSource,
        fallback: createFallbackFieldMoistureCellObservationSource({
          primary: syntheticRasterObservationSource,
          fallback: imageryFallbackObservationSource,
        }),
      })
    : createFallbackFieldMoistureCellObservationSource({
        primary: syntheticRasterObservationSource,
        fallback: imageryFallbackObservationSource,
      });

  return createSourceBackedFieldMoistureCellDerivationStrategy({
    source: observationSource,
    fallbackStrategy,
  });
}
