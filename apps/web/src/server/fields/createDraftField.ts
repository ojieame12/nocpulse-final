import type { FieldBoundary } from "@fieldpulse/module-fields";
import { ensureWorkspaceField, createSupabaseFieldRepository } from "@fieldpulse/module-fields";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";

type DraftFieldRuntime = {
  env: {
    supabase: {
      url?: string | null;
      serviceRoleKey?: string | null;
    };
  };
  services: {
    fieldCropContext: {
      upsertFieldContext(input: {
        workspaceId: string;
        fieldId: string;
        seasonYear: number;
        cropType: string;
        sourceKey: string;
        metadata?: any;
      }): Promise<any>;
    };
    fieldOnboarding: {
      dispatchInitialPlan(input: {
        workspaceId: string;
        fieldId: string;
        dryRun?: boolean;
      }): Promise<readonly unknown[]>;
      dispatchRefreshPlan(input: {
        workspaceId: string;
        fieldId: string;
        dryRun?: boolean;
      }): Promise<readonly unknown[]>;
    };
  };
};

type DraftFieldActor = {
  userId: string;
  workspaceId: string;
};

type DraftFieldOnboardingReceipt = {
  result: {
    id: string;
    key?: string;
    status?: string;
  };
};

export type CreateDraftFieldInput = {
  runtime: DraftFieldRuntime;
  actor: DraftFieldActor;
  name: string;
  boundary: FieldBoundary;
  areaHa: number;
  legalLandDescription?: string | null;
  cropType?: string | null;
  variety?: string | null;
  seedingDate?: string | null;
  sourceKey: string;
  metadata?: Record<string, unknown>;
  dispatchOnboarding?: boolean;
};

function resolveSeasonYear(seedingDate: string | null | undefined) {
  if (seedingDate && /^\d{4}-\d{2}-\d{2}$/.test(seedingDate)) {
    return Number(seedingDate.slice(0, 4));
  }

  return new Date().getUTCFullYear();
}

export async function createDraftField(input: CreateDraftFieldInput) {
  const client = createSupabaseDatabaseClient({
    url: input.runtime.env.supabase.url!,
    serviceKey: input.runtime.env.supabase.serviceRoleKey!,
  });
  const fields = createSupabaseFieldRepository(client);
  const legalLandDescription = input.legalLandDescription?.trim() ?? null;
  const ensured = await ensureWorkspaceField({
    repository: fields,
    actorUserId: input.actor.userId,
    field: {
      workspaceId: input.actor.workspaceId,
      name: input.name,
      areaHa: input.areaHa,
      legalLandDescription,
      boundary: input.boundary,
    },
  });

  const field =
    legalLandDescription != null &&
    ensured.field.legalLandDescription !== legalLandDescription
      ? await fields.setLegalLandDescription(
          input.actor.workspaceId,
          ensured.field.id,
          legalLandDescription,
        )
      : ensured.field;

  const cropContext = input.cropType
    ? await input.runtime.services.fieldCropContext.upsertFieldContext({
        workspaceId: input.actor.workspaceId,
        fieldId: field.id,
        seasonYear: resolveSeasonYear(input.seedingDate),
        cropType: input.cropType,
        sourceKey: input.sourceKey,
        metadata: {
          source: "add-field-panel",
          variety: input.variety ?? null,
          seedingDate: input.seedingDate ?? null,
          ...input.metadata,
        },
      })
    : null;

  const receipts =
    input.dispatchOnboarding
      ? ensured.action === "created"
        ? await input.runtime.services.fieldOnboarding.dispatchInitialPlan({
            workspaceId: input.actor.workspaceId,
            fieldId: field.id,
            dryRun: false,
          })
        : await input.runtime.services.fieldOnboarding.dispatchRefreshPlan({
            workspaceId: input.actor.workspaceId,
            fieldId: field.id,
            dryRun: false,
          })
      : [];

  const onboardingDispatches =
    receipts.length > 0
      ? [
          {
            fieldId: field.id,
            action: ensured.action,
            receipts: receipts as DraftFieldOnboardingReceipt[],
          },
        ]
      : [];

  return {
    action: ensured.action,
    field,
    cropContext,
    onboardingDispatches,
  };
}
