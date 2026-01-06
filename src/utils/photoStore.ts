const DB_NAME = "elrey-photo-store";
const DB_VERSION = 1;
const STORE_NAME = "cley-photos";

export type StoredPhoto = {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
  size: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB no disponible"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function savePhoto(input: {
  id: string;
  blob: Blob;
  mimeType?: string;
  createdAt?: number;
}): Promise<StoredPhoto> {
  const db = await openDb();
  const record: StoredPhoto = {
    id: input.id,
    blob: input.blob,
    mimeType: input.mimeType || input.blob.type || "image/jpeg",
    createdAt: input.createdAt ?? Date.now(),
    size: input.blob.size,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(record);

    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getPhoto(id: string): Promise<StoredPhoto | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve((request.result as StoredPhoto | undefined) ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deletePhotos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
