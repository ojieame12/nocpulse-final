export const OFFLINE_DB_NAME = "fieldpulse-offline";
export const OFFLINE_DB_VERSION = 2;
export const OFFLINE_FIELD_STORE = "recent-field-snapshots";
export const OFFLINE_SCOUT_NOTE_STORE = "offline-scout-notes";

export function isIndexedDbAvailable() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export function waitForRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

export function openOfflineDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OFFLINE_FIELD_STORE)) {
        db.createObjectStore(OFFLINE_FIELD_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(OFFLINE_SCOUT_NOTE_STORE)) {
        db.createObjectStore(OFFLINE_SCOUT_NOTE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open offline database."));
  });
}
