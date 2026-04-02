import {
  coerceNumber,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type EntityId,
  type JsonValue,
  type UserId,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type {
  FieldImportBatch,
  FieldImportCandidate,
} from "../contracts/FieldImportBatch";
import type {
  SpreadsheetImportIssue,
  SpreadsheetImportPreview,
} from "../contracts/SpreadsheetImport";
import type {
  CreateSpreadsheetImportBatchInput,
  FieldImportBatchRepository,
} from "../contracts/FieldImportBatchRepository";
import type { FieldBoundary } from "@fieldpulse/module-fields";
import type { LldComponents } from "../contracts/LldComponents";

type FieldImportBatchRow =
  DatabaseSchema["app"]["Functions"]["create_field_import_batch"]["Returns"][number];
type FieldImportCandidateRow =
  DatabaseSchema["app"]["Functions"]["get_field_import_batch_candidates"]["Returns"][number];
type FieldImportCandidateTableRow =
  DatabaseSchema["app"]["Tables"]["field_import_candidates"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSpreadsheetIssues(value: JsonValue): readonly SpreadsheetImportIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("[field-intake] invalid spreadsheet issue payload");
    }

    return {
      rowNumber: coerceJsonNumber(entry.rowNumber, "issues.rowNumber"),
      fieldName: typeof entry.fieldName === "string" ? entry.fieldName : undefined,
      legalLandDescription:
        typeof entry.legalLandDescription === "string"
          ? entry.legalLandDescription
          : undefined,
      message:
        typeof entry.message === "string"
          ? entry.message
          : "[field-intake] issue message missing",
    };
  });
}

function coerceJsonNumber(value: JsonValue, context: string) {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`[field-intake] ${context}: expected numeric value`);
  }

  return coerceNumber(value);
}

function toStringArray(value: JsonValue, context: string) {
  if (!Array.isArray(value)) {
    throw new Error(`[field-intake] ${context}: expected array`);
  }

  return value.map((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`[field-intake] ${context}: expected string values`);
    }

    return entry;
  });
}

function toNumberArray(value: JsonValue, context: string) {
  if (!Array.isArray(value)) {
    throw new Error(`[field-intake] ${context}: expected array`);
  }

  return value.map((entry, index) =>
    coerceJsonNumber(entry, `${context}[${index}]`),
  );
}

function toFieldBoundary(value: JsonValue): FieldBoundary {
  if (!isRecord(value) || value.type !== "MultiPolygon" || !Array.isArray(value.coordinates)) {
    throw new Error("[field-intake] invalid candidate field boundary geojson");
  }

  return value as unknown as FieldBoundary;
}

function toLldComponentsList(value: JsonValue): readonly LldComponents[] {
  if (!Array.isArray(value)) {
    throw new Error("[field-intake] invalid lld components list");
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("[field-intake] invalid lld component entry");
    }

    return {
      quarter: String(entry.quarter) as LldComponents["quarter"],
      section: coerceJsonNumber(entry.section, "lldComponents.section"),
      township: coerceJsonNumber(entry.township, "lldComponents.township"),
      range: coerceJsonNumber(entry.range, "lldComponents.range"),
      meridian: coerceJsonNumber(
        entry.meridian,
        "lldComponents.meridian",
      ) as LldComponents["meridian"],
    };
  });
}

function mapFieldImportBatch(row: FieldImportBatchRow): FieldImportBatch {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceType: row.source_type as "spreadsheet",
    fileName: row.file_name,
    sheetName: row.sheet_name,
    status: row.status,
    rowCount: row.row_count,
    validRowCount: row.valid_row_count,
    fieldCount: row.field_count,
    issueCount: row.issue_count,
    issues: toSpreadsheetIssues(row.issues),
    createdBy: row.created_by,
    committedBy: row.committed_by,
    committedAt: row.committed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFieldImportCandidate(
  row: FieldImportCandidateRow | FieldImportCandidateTableRow,
): FieldImportCandidate {
  const boundaryValue =
    "boundary_geojson" in row ? row.boundary_geojson : row.boundary;

  return {
    id: row.id,
    batchId: row.batch_id,
    workspaceId: row.workspace_id,
    ordinal: row.ordinal,
    draft: {
      name: row.name,
      areaHa: coerceNumber(row.area_ha),
      boundary: toFieldBoundary(boundaryValue),
    },
    cropType: row.crop_type ?? undefined,
      rowCount: row.row_count,
      rowNumbers: toNumberArray(row.row_numbers, "rowNumbers"),
    legalLandDescriptions: toStringArray(
      row.legal_land_descriptions,
      "legalLandDescriptions",
    ),
    splitIndex: row.split_index,
    splitCount: row.split_count,
    lldComponentsList: toLldComponentsList(row.lld_components_list),
    status: row.status,
    committedFieldId: row.committed_field_id,
    commitAction: row.commit_action as "created" | "reused" | null,
    committedAt: row.committed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializePreview(preview: SpreadsheetImportPreview) {
  return {
    rowCount: preview.rowCount,
    validRowCount: preview.validRowCount,
    fieldCount: preview.fieldCount,
    issueCount: preview.issueCount,
        issues: preview.issues,
        candidates: preview.fields.map((field) => ({
          draft: field.draft,
          cropType: field.cropType ?? null,
          rowCount: field.rowCount,
          rowNumbers: field.rowNumbers,
          legalLandDescriptions: field.legalLandDescriptions,
      splitIndex: field.splitIndex,
      splitCount: field.splitCount,
      lldComponentsList: field.lldComponentsList,
    })),
  };
}

export function createSupabaseFieldImportBatchRepository(
  client: DatabaseClient,
): FieldImportBatchRepository {
  const listCandidatesByBatch: FieldImportBatchRepository["listCandidatesByBatch"] =
    async (workspaceId: WorkspaceId, batchId: EntityId) => {
      const result = await client.rpc("get_field_import_batch_candidates", {
        target_workspace_id: workspaceId,
        target_batch_id: batchId,
      });

      return requireSupabaseData(
        result,
        "fieldIntake.listCandidatesByBatch",
      ).map(mapFieldImportCandidate);
    };

  return {
    async createSpreadsheetImportBatch(
      input: CreateSpreadsheetImportBatchInput,
      actorUserId: UserId,
    ) {
      const preview = serializePreview(input.preview);
      const batchResult = await client
        .rpc("create_field_import_batch", {
          target_workspace_id: input.workspaceId,
          import_source_type: "spreadsheet",
          import_file_name: input.preview.fileName,
          import_sheet_name: input.preview.sheetName,
          import_row_count: preview.rowCount,
          import_valid_row_count: preview.validRowCount,
          import_field_count: preview.fieldCount,
          import_issue_count: preview.issueCount,
          import_issues: preview.issues,
          import_candidates: preview.candidates,
          actor_user_id: actorUserId,
        })
        .single();

      const batch = mapFieldImportBatch(
        requireSupabaseData(batchResult, "fieldIntake.createSpreadsheetImportBatch"),
      );
      const candidates = await listCandidatesByBatch(
        batch.workspaceId,
        batch.id,
      );

      return {
        batch,
        candidates,
      };
    },

    async getBatchById(workspaceId: WorkspaceId, batchId: EntityId) {
      const result = await client
        .rpc("get_field_import_batch_detail", {
          target_workspace_id: workspaceId,
          target_batch_id: batchId,
        })
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldImportBatch(result.data) : null;
    },

    async getLatestCommittedCandidateByField(
      workspaceId: WorkspaceId,
      fieldId: EntityId,
    ) {
      const result = await client
        .from("field_import_candidates")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("committed_field_id", fieldId)
        .eq("status", "committed")
        .order("committed_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldImportCandidate(result.data) : null;
    },

    listCandidatesByBatch,

    async markCandidateCommitted(
      workspaceId: WorkspaceId,
      batchId: EntityId,
      candidateId: EntityId,
      input: {
        fieldId: EntityId;
        action: "created" | "reused";
      },
    ) {
      const updateResult = await client
        .rpc("mark_field_import_candidate_committed", {
          target_workspace_id: workspaceId,
          target_batch_id: batchId,
          target_candidate_id: candidateId,
          target_field_id: input.fieldId,
          target_commit_action: input.action,
        })
        .single();

      return mapFieldImportCandidate(
        requireSupabaseData(
          updateResult,
          "fieldIntake.markCandidateCommitted.update",
        ),
      );
    },

    async markBatchCommitted(
      workspaceId: WorkspaceId,
      batchId: EntityId,
      actorUserId: UserId,
    ) {
      const updateResult = await client
        .rpc("mark_field_import_batch_committed", {
          target_workspace_id: workspaceId,
          target_batch_id: batchId,
          actor_user_id: actorUserId,
        })
        .single();

      return mapFieldImportBatch(
        requireSupabaseData(
          updateResult,
          "fieldIntake.markBatchCommitted.update",
        ),
      );
    },
  };
}
