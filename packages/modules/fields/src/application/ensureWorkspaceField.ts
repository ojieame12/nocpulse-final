import type { UserId } from "@fieldpulse/platform-db";
import type { CreateFieldInput } from "../contracts/CreateFieldInput";
import type { FieldDetail } from "../contracts/FieldDetail";
import type { FieldOverview } from "../contracts/FieldOverview";

type EnsureWorkspaceFieldRepository = {
  create(input: CreateFieldInput, actorUserId: UserId): Promise<FieldDetail>;
  getById(workspaceId: string, fieldId: string): Promise<FieldDetail | null>;
  listOverviewByWorkspace(workspaceId: string): Promise<readonly FieldOverview[]>;
  setLegalLandDescription?(
    workspaceId: string,
    fieldId: string,
    legalLandDescription: string | null,
  ): Promise<FieldDetail>;
};

export type EnsureWorkspaceFieldInput = {
  repository: EnsureWorkspaceFieldRepository;
  actorUserId: UserId;
  field: CreateFieldInput;
};

export type EnsureWorkspaceFieldResult = {
  field: FieldDetail;
  action: "created" | "reused";
};

export async function ensureWorkspaceField(
  input: EnsureWorkspaceFieldInput,
): Promise<EnsureWorkspaceFieldResult> {
  const existingField = (await input.repository.listOverviewByWorkspace(
    input.field.workspaceId,
  )).find((field) => field.name === input.field.name);

  if (existingField) {
    const detail = await input.repository.getById(
      input.field.workspaceId,
      existingField.id,
    );

    if (!detail) {
      throw new Error(
        `[fields] could not load detail for existing field ${existingField.id}`,
      );
    }

    return {
      field: detail,
      action: "reused",
    };
  }

  return {
    field: await input.repository.create(input.field, input.actorUserId),
    action: "created",
  };
}
