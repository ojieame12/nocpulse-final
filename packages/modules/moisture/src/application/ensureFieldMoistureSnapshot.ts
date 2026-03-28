import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldMoistureSnapshot } from "../contracts/FieldMoistureSnapshot";
import type { UpsertFieldMoistureSnapshotInput } from "../contracts/UpsertFieldMoistureSnapshotInput";

type EnsureFieldMoistureSnapshotRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldMoistureSnapshot | null>;
  upsertSnapshot(input: UpsertFieldMoistureSnapshotInput): Promise<FieldMoistureSnapshot>;
};

export type EnsureFieldMoistureSnapshotInput = {
  repository: EnsureFieldMoistureSnapshotRepository;
  snapshot: UpsertFieldMoistureSnapshotInput;
};

export type EnsureFieldMoistureSnapshotResult = {
  snapshot: FieldMoistureSnapshot;
  action: "created" | "reused";
};

function sameInputs(
  left: FieldMoistureSnapshot["inputs"],
  right: UpsertFieldMoistureSnapshotInput["inputs"],
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function ensureFieldMoistureSnapshot(
  input: EnsureFieldMoistureSnapshotInput,
): Promise<EnsureFieldMoistureSnapshotResult> {
  const existingSnapshot = await input.repository.getLatestByField(
    input.snapshot.workspaceId,
    input.snapshot.fieldId,
  );

  if (existingSnapshot) {
    const isExactMatch =
      existingSnapshot.observedAt === input.snapshot.observedAt &&
      existingSnapshot.sourceKey === input.snapshot.sourceKey &&
      existingSnapshot.rootZonePct === input.snapshot.rootZonePct &&
      existingSnapshot.surfacePct === input.snapshot.surfacePct &&
      existingSnapshot.confidence === input.snapshot.confidence &&
      sameInputs(existingSnapshot.inputs, input.snapshot.inputs);

    if (!isExactMatch) {
      return {
        snapshot: await input.repository.upsertSnapshot(input.snapshot),
        action: "created",
      };
    }

    return {
      snapshot: existingSnapshot,
      action: "reused",
    };
  }

  return {
    snapshot: await input.repository.upsertSnapshot(input.snapshot),
    action: "created",
  };
}
