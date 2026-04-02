import type { ScoutNoteOutcome } from "../../components/panels/NotesTab";
import {
  OFFLINE_SCOUT_NOTE_STORE,
  isIndexedDbAvailable,
  openOfflineDb,
  waitForRequest,
  waitForTransaction,
} from "./offlineStorage";

export type OfflineScoutNotePayload = {
  outcome: ScoutNoteOutcome;
  noteText: string;
  findingId: string | null;
  zoneId: string | null;
  cellKey: string | null;
  observedAt?: string | null;
};

export type OfflineScoutNoteRecord = {
  id: string;
  fieldId: string;
  workspaceId: string;
  submitUrl: string;
  payload: OfflineScoutNotePayload;
  createdAt: string;
  syncStatus: "pending" | "failed";
  lastError: string | null;
  attemptCount: number;
};

type FlushOfflineScoutNotesResult = {
  syncedFieldIds: string[];
  syncedNotes: Array<{
    queuedId: string;
    fieldId: string;
    note: {
      id: string;
      observedAt: string;
      noteText: string;
      outcome: ScoutNoteOutcome;
      findingId?: string | null;
      zoneId?: string | null;
      cellKey?: string | null;
    };
  }>;
  failedIds: string[];
};

function buildOfflineScoutNoteId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `offline-note-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function createOfflineScoutNoteRecord(input: {
  fieldId: string;
  workspaceId: string;
  submitUrl: string;
  payload: OfflineScoutNotePayload;
}): OfflineScoutNoteRecord {
  return {
    id: buildOfflineScoutNoteId(),
    fieldId: input.fieldId,
    workspaceId: input.workspaceId,
    submitUrl: input.submitUrl,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
    lastError: null,
    attemptCount: 0,
  };
}

export async function queueOfflineScoutNote(input: {
  fieldId: string;
  workspaceId: string;
  submitUrl: string;
  payload: OfflineScoutNotePayload;
}) {
  if (!isIndexedDbAvailable()) {
    throw new Error("Offline queue is not available in this browser.");
  }

  const record = createOfflineScoutNoteRecord(input);
  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_SCOUT_NOTE_STORE, "readwrite");
    transaction.objectStore(OFFLINE_SCOUT_NOTE_STORE).put(record);
    await waitForTransaction(transaction);
    return record;
  } finally {
    db.close();
  }
}

export async function listQueuedOfflineScoutNotes(fieldId?: string) {
  if (!isIndexedDbAvailable()) {
    return [] as OfflineScoutNoteRecord[];
  }

  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_SCOUT_NOTE_STORE, "readonly");
    const records = (await waitForRequest(
      transaction.objectStore(OFFLINE_SCOUT_NOTE_STORE).getAll(),
    )) as OfflineScoutNoteRecord[];
    await waitForTransaction(transaction);

    return records
      .filter((record) => (fieldId ? record.fieldId === fieldId : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } finally {
    db.close();
  }
}

async function updateOfflineScoutNoteRecord(record: OfflineScoutNoteRecord) {
  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_SCOUT_NOTE_STORE, "readwrite");
    transaction.objectStore(OFFLINE_SCOUT_NOTE_STORE).put(record);
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

async function removeOfflineScoutNote(id: string) {
  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_SCOUT_NOTE_STORE, "readwrite");
    transaction.objectStore(OFFLINE_SCOUT_NOTE_STORE).delete(id);
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

export async function flushOfflineScoutNotesQueue(
  fetcher: typeof fetch = fetch,
): Promise<FlushOfflineScoutNotesResult> {
  const result: FlushOfflineScoutNotesResult = {
    syncedFieldIds: [],
    syncedNotes: [],
    failedIds: [],
  };

  if (!isIndexedDbAvailable()) {
    return result;
  }

  const queuedNotes = await listQueuedOfflineScoutNotes();
  for (const queuedNote of [...queuedNotes].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  )) {
    try {
      const response = await fetcher(queuedNote.submitUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-fieldpulse-workspace-id": queuedNote.workspaceId,
          "x-fieldpulse-offline-replay": "1",
        },
        body: JSON.stringify(queuedNote.payload),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            note?: {
              id: string;
              observedAt: string;
              noteText: string;
              outcome: ScoutNoteOutcome;
              findingId?: string | null;
              zoneId?: string | null;
              cellKey?: string | null;
            } | null;
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !body?.note) {
        queuedNote.syncStatus = "failed";
        queuedNote.attemptCount += 1;
        queuedNote.lastError =
          body?.error?.message ?? `Sync failed with status ${response.status}.`;
        await updateOfflineScoutNoteRecord(queuedNote);
        result.failedIds.push(queuedNote.id);
        continue;
      }

      await removeOfflineScoutNote(queuedNote.id);
      result.syncedFieldIds.push(queuedNote.fieldId);
      result.syncedNotes.push({
        queuedId: queuedNote.id,
        fieldId: queuedNote.fieldId,
        note: body.note,
      });
    } catch (error) {
      queuedNote.syncStatus = "failed";
      queuedNote.attemptCount += 1;
      queuedNote.lastError =
        error instanceof Error ? error.message : "Offline sync failed.";
      await updateOfflineScoutNoteRecord(queuedNote);
      result.failedIds.push(queuedNote.id);
    }
  }

  return {
    ...result,
    syncedFieldIds: [...new Set(result.syncedFieldIds)],
    failedIds: [...new Set(result.failedIds)],
  };
}
