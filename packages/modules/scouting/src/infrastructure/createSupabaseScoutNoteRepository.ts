import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { CreateScoutNoteInput } from "../contracts/CreateScoutNoteInput";
import type { ScoutNote } from "../contracts/ScoutNote";
import type { ScoutNoteRepository } from "./ScoutNoteRepository";

type ScoutNoteRow = DatabaseSchema["app"]["Tables"]["field_scout_notes"]["Row"];

function mapScoutNote(row: ScoutNoteRow): ScoutNote {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    findingId: row.finding_id,
    zoneId: row.zone_id,
    cellKey: row.cell_key,
    outcome: row.outcome,
    noteText: row.note_text,
    observedAt: row.observed_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseScoutNoteRepository(
  client: DatabaseClient,
): ScoutNoteRepository {
  return {
    async listByField(workspaceId, fieldId, limit = 20) {
      const result = await client
        .from("field_scout_notes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("observed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map(mapScoutNote);
    },
    async createNote(input: CreateScoutNoteInput) {
      const result = await client
        .from("field_scout_notes")
        .insert({
          workspace_id: input.workspaceId,
          field_id: input.fieldId,
          finding_id: input.findingId ?? null,
          zone_id: input.zoneId ?? null,
          cell_key: input.cellKey ?? null,
          outcome: input.outcome,
          note_text: input.noteText,
          observed_at: input.observedAt ?? new Date().toISOString(),
          created_by_user_id: input.createdByUserId,
        })
        .select("*")
        .single();

      return mapScoutNote(requireSupabaseData(result, "scoutNotes.createNote"));
    },
  };
}
