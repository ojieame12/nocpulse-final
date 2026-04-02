import type { SidebarFieldItem } from "../../components/layout/Sidebar";
import type { FieldViewModel, PreviewShellViewer } from "../../app/preview/PreviewShell";
import {
  OFFLINE_FIELD_STORE,
  isIndexedDbAvailable,
  openOfflineDb,
  waitForRequest,
  waitForTransaction,
} from "./offlineStorage";

const MAX_OFFLINE_FIELDS_PER_OWNER = 8;

type OfflineFieldSnapshotRecord = {
  key: string;
  ownerKey: string;
  workspaceId: string;
  fieldId: string;
  fieldName: string;
  savedAt: string;
  data: FieldViewModel;
};

export function buildOfflineCacheOwnerKey(input: {
  workspaceId: string;
  viewer?: PreviewShellViewer | null;
  isGuestSession: boolean;
}) {
  if (input.isGuestSession) {
    return null;
  }

  const viewerId =
    input.viewer?.email?.trim().toLowerCase()
    || input.viewer?.displayName.trim().toLowerCase()
    || "workspace-member";

  return `${viewerId}:${input.workspaceId}`;
}

export function createOfflineFieldSnapshotRecord(
  ownerKey: string,
  field: FieldViewModel,
): OfflineFieldSnapshotRecord {
  return {
    key: `${ownerKey}:${field.fieldId}`,
    ownerKey,
    workspaceId: field.workspaceId,
    fieldId: field.fieldId,
    fieldName: field.fieldName,
    savedAt: new Date().toISOString(),
    data: {
      ...field,
      sidebarFields: field.sidebarFields.map((entry) => ({ ...entry })) as SidebarFieldItem[],
    },
  };
}

export function listPrunableOfflineSnapshotKeys(
  records: readonly OfflineFieldSnapshotRecord[],
  maxSnapshots = MAX_OFFLINE_FIELDS_PER_OWNER,
) {
  if (records.length <= maxSnapshots) {
    return [];
  }

  return [...records]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(maxSnapshots)
    .map((record) => record.key);
}

export async function saveOfflineFieldSnapshot(
  ownerKey: string,
  field: FieldViewModel,
) {
  if (!isIndexedDbAvailable()) {
    return;
  }

  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_FIELD_STORE, "readwrite");
    const store = transaction.objectStore(OFFLINE_FIELD_STORE);
    const record = createOfflineFieldSnapshotRecord(ownerKey, field);

    store.put(record);

    const allRecords = await waitForRequest(store.getAll()) as OfflineFieldSnapshotRecord[];
    const ownerRecords = allRecords.filter((entry) => entry.ownerKey === ownerKey);
    for (const key of listPrunableOfflineSnapshotKeys(ownerRecords)) {
      store.delete(key);
    }

    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

export async function loadOfflineFieldSnapshot(
  ownerKey: string,
  fieldId: string,
): Promise<FieldViewModel | null> {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_FIELD_STORE, "readonly");
    const store = transaction.objectStore(OFFLINE_FIELD_STORE);
    const record = await waitForRequest(
      store.get(`${ownerKey}:${fieldId}`),
    ) as OfflineFieldSnapshotRecord | undefined;
    await waitForTransaction(transaction);
    return record?.data ?? null;
  } finally {
    db.close();
  }
}

export async function clearOfflineSnapshotsExceptOwner(ownerKey: string | null) {
  if (!isIndexedDbAvailable()) {
    return;
  }

  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_FIELD_STORE, "readwrite");
    const store = transaction.objectStore(OFFLINE_FIELD_STORE);
    const allRecords = await waitForRequest(store.getAll()) as OfflineFieldSnapshotRecord[];

    for (const record of allRecords) {
      if (ownerKey == null || record.ownerKey !== ownerKey) {
        store.delete(record.key);
      }
    }

    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}
