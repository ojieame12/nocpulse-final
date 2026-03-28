import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldMoistureCellSnapshot,
  ReplaceFieldMoistureCellSnapshotsInput,
} from "../contracts/FieldMoistureCellSnapshot";
import type {
  FieldMoistureCellDerivationStrategy,
  MoistureCellFieldBoundary,
} from "../contracts/FieldMoistureCellDerivationStrategy";
import type { FieldMoistureSnapshot } from "../contracts/FieldMoistureSnapshot";

type RebuildFieldMoistureCellSnapshotsRepository = {
  replaceSnapshotCells(
    input: ReplaceFieldMoistureCellSnapshotsInput,
  ): Promise<readonly FieldMoistureCellSnapshot[]>;
};

export type RebuildFieldMoistureCellSnapshotsInput = {
  repository: RebuildFieldMoistureCellSnapshotsRepository;
  derivationStrategy: FieldMoistureCellDerivationStrategy;
  field: {
    workspaceId: WorkspaceId;
    fieldId: EntityId;
    boundary: MoistureCellFieldBoundary;
  };
  snapshot: FieldMoistureSnapshot;
};

export type RebuildFieldMoistureCellSnapshotsResult = {
  cells: readonly FieldMoistureCellSnapshot[];
  action: "replaced";
  strategyKey: string;
};

export async function rebuildFieldMoistureCellSnapshots(
  input: RebuildFieldMoistureCellSnapshotsInput,
): Promise<RebuildFieldMoistureCellSnapshotsResult> {
  const derived = await input.derivationStrategy.deriveCells({
    workspaceId: input.field.workspaceId,
    fieldId: input.field.fieldId,
    boundary: input.field.boundary,
    snapshot: input.snapshot,
  });

  return {
    action: "replaced",
    strategyKey: derived.strategyKey,
    cells: await input.repository.replaceSnapshotCells({
      workspaceId: input.field.workspaceId,
      fieldId: input.field.fieldId,
      snapshotId: input.snapshot.id,
      observedAt: input.snapshot.observedAt,
      sourceKey: derived.strategyKey,
      confidence: input.snapshot.confidence,
      cells: derived.cells,
    }),
  };
}
