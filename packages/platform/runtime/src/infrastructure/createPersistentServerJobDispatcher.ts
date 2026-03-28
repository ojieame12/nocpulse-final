import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
} from "@fieldpulse/platform-db";
import type { ServerJobDispatcher } from "../contracts/ServerRuntime";

type JobDispatchRow = DatabaseSchema["app"]["Tables"]["job_dispatches"]["Row"];

function mapDispatch(row: JobDispatchRow) {
  return {
    id: row.id,
    key: row.job_key,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    availableAt: row.available_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toJsonValue(value: unknown): JsonValue {
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return {
      message: String(value),
    };
  }
}

export function createPersistentServerJobDispatcher(
  client: DatabaseClient,
): ServerJobDispatcher {
  return {
    async enqueue(input) {
      if (input.payload === undefined) {
        throw new Error(
          `[runtime] persistent job dispatcher requires an explicit payload for "${input.key}"`,
        );
      }

      const result = await client
        .from("job_dispatches")
        .insert({
          job_key: input.key,
          payload: toJsonValue(input.payload),
        })
        .select("*")
        .single();

      const dispatch = mapDispatch(
        requireSupabaseData(result, "runtime.jobDispatcher.enqueue"),
      );

      return {
        key: dispatch.key,
        payload: dispatch.payload,
        result: dispatch,
      };
    },
  };
}
