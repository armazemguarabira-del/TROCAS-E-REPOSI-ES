const DB_NAME = "SSTR_Photos_Cache";
const STORE_NAME = "images";
const LARGE_STORE_NAME = "large_kv";
const SNAPSHOTS_STORE_NAME = "safety_snapshots";
const DB_VERSION = 3;

export interface SafetySnapshotMeta {
  id: string;
  timestamp: number;
  dateStr: string;
  reason: string;
  summary: {
    recordsCount: number;
    pendingCount: number;
    valesCount: number;
    batchesCount: number;
    productsCount: number;
    managersCount: number;
  };
}

export interface SafetySnapshot extends SafetySnapshotMeta {
  data: {
    records?: any[];
    pendingRequests?: any[];
    vales?: any[];
    batches?: any[];
    managers?: any[];
    crewList?: any[];
    repsSetor?: any;
    motoristasRotas?: any;
    products?: any[];
  };
}

// Global synchronous in-RAM cache to make IDB data accessible synchronously to localStorage monkey-patch
if (!(window as any).sstr_image_cache) {
  (window as any).sstr_image_cache = new Map<string, string>();
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(LARGE_STORE_NAME)) {
        db.createObjectStore(LARGE_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE_NAME)) {
        db.createObjectStore(SNAPSHOTS_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Loads all cached items from IndexedDB large_kv store into memory.
 */
export async function initLargeKVCacheFromIDB(onItemLoaded?: (key: string, value: string) => void): Promise<void> {
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(LARGE_STORE_NAME)) return;
    const tx = db.transaction(LARGE_STORE_NAME, "readonly");
    const store = tx.objectStore(LARGE_STORE_NAME);
    
    return new Promise((resolve) => {
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.key && cursor.value && onItemLoaded) {
            onItemLoaded(cursor.key.toString(), cursor.value);
          }
          cursor.continue();
        } else {
          console.log(`[IDB Large KV] IndexedDB large data cache loaded into memory.`);
          resolve();
        }
      };
      request.onerror = () => {
        console.warn("[IDB Large KV] Failed to load large_kv cursor.");
        resolve();
      };
    });
  } catch (e) {
    console.error("[IDB Large KV] Initialization failed:", e);
  }
}

/**
 * Saves a large key-value pair to IndexedDB.
 */
export async function saveLargeKVToIDB(key: string, value: string): Promise<void> {
  if (!key) return;
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(LARGE_STORE_NAME)) return;
    const tx = db.transaction(LARGE_STORE_NAME, "readwrite");
    const store = tx.objectStore(LARGE_STORE_NAME);
    store.put(value, key);
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        console.log(`[IDB Large KV] Successfully persisted "${key}" (${Math.round(value.length / 1024)} KB) to IndexedDB.`);
        resolve();
      };
      tx.onerror = () => {
        console.error("[IDB Large KV] Store put failed:", tx.error);
        resolve();
      };
    });
  } catch (e) {
    console.error("[IDB Large KV] Failed to persist key to IDB:", e);
  }
}

/**
 * Deletes a large key-value pair from IndexedDB.
 */
export async function deleteLargeKVFromIDB(key: string): Promise<void> {
  if (!key) return;
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(LARGE_STORE_NAME)) return;
    const tx = db.transaction(LARGE_STORE_NAME, "readwrite");
    const store = tx.objectStore(LARGE_STORE_NAME);
    store.delete(key);
  } catch (e) {
    console.error("[IDB Large KV] Failed to delete key from IDB:", e);
  }
}

/**
 * Retrieves all stored key-value pairs from IndexedDB.
 */
export async function getAllLargeKVFromIDB(): Promise<Record<string, string>> {
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(LARGE_STORE_NAME)) return {};
    const tx = db.transaction(LARGE_STORE_NAME, "readonly");
    const store = tx.objectStore(LARGE_STORE_NAME);
    
    return new Promise((resolve) => {
      const result: Record<string, string> = {};
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.key && cursor.value) {
            result[cursor.key.toString()] = cursor.value;
          }
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      request.onerror = () => resolve(result);
    });
  } catch (e) {
    console.error("[IDB Large KV] Failed to get all entries:", e);
    return {};
  }
}

/**
 * Saves a full immutable safety snapshot to the IndexedDB Vault.
 */
export async function saveSafetySnapshotToIDB(snapshot: SafetySnapshot): Promise<void> {
  if (!snapshot || !snapshot.id) return;
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(SNAPSHOTS_STORE_NAME)) return;
    const tx = db.transaction(SNAPSHOTS_STORE_NAME, "readwrite");
    const store = tx.objectStore(SNAPSHOTS_STORE_NAME);
    store.put(snapshot);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => {
        console.log(`[IDB Vault] Snapshot "${snapshot.id}" salvo com sucesso no cofre local.`);
        resolve();
      };
      tx.onerror = () => {
        console.error("[IDB Vault] Falha ao salvar snapshot:", tx.error);
        resolve();
      };
    });
    // Auto-clean older snapshots beyond 30
    await cleanOldSnapshots(30);
  } catch (e) {
    console.error("[IDB Vault] Erro ao salvar snapshot de segurança:", e);
  }
}

/**
 * Lists all safety snapshot metadata sorted from newest to oldest.
 */
export async function listSafetySnapshotsFromIDB(): Promise<SafetySnapshotMeta[]> {
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(SNAPSHOTS_STORE_NAME)) return [];
    const tx = db.transaction(SNAPSHOTS_STORE_NAME, "readonly");
    const store = tx.objectStore(SNAPSHOTS_STORE_NAME);

    return new Promise((resolve) => {
      const list: SafetySnapshotMeta[] = [];
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const item = cursor.value;
          if (item) {
            list.push({
              id: item.id,
              timestamp: item.timestamp,
              dateStr: item.dateStr,
              reason: item.reason,
              summary: item.summary
            });
          }
          cursor.continue();
        } else {
          list.sort((a, b) => b.timestamp - a.timestamp);
          resolve(list);
        }
      };
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    console.error("[IDB Vault] Erro ao listar snapshots:", e);
    return [];
  }
}

/**
 * Retrieves a full safety snapshot including data by ID.
 */
export async function getSafetySnapshotFromIDB(id: string): Promise<SafetySnapshot | null> {
  if (!id) return null;
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(SNAPSHOTS_STORE_NAME)) return null;
    const tx = db.transaction(SNAPSHOTS_STORE_NAME, "readonly");
    const store = tx.objectStore(SNAPSHOTS_STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error("[IDB Vault] Erro ao carregar snapshot:", e);
    return null;
  }
}

/**
 * Deletes a safety snapshot by ID.
 */
export async function deleteSafetySnapshotFromIDB(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await getDB();
    if (!db.objectStoreNames.contains(SNAPSHOTS_STORE_NAME)) return;
    const tx = db.transaction(SNAPSHOTS_STORE_NAME, "readwrite");
    const store = tx.objectStore(SNAPSHOTS_STORE_NAME);
    store.delete(id);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    console.error("[IDB Vault] Erro ao deletar snapshot:", e);
  }
}

/**
 * Keeps only the most recent N snapshots to avoid unbounded storage usage.
 */
export async function cleanOldSnapshots(maxKeep: number = 30): Promise<void> {
  try {
    const snapshots = await listSafetySnapshotsFromIDB();
    if (snapshots.length <= maxKeep) return;
    const toDelete = snapshots.slice(maxKeep);
    for (const snap of toDelete) {
      await deleteSafetySnapshotFromIDB(snap.id);
    }
    console.log(`[IDB Vault] Limpeza automática: ${toDelete.length} snapshots antigos removidos.`);
  } catch (e) {
    console.warn("[IDB Vault] Aviso na limpeza de snapshots:", e);
  }
}

/**
 * Loads all cached photos from IndexedDB into the synchronous in-RAM cache.
 * Call this during app initialization.
 */
export async function initImageCacheFromIDB(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    
    // Use openCursor to load all keys and values
    return new Promise((resolve) => {
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.key && cursor.value) {
            (window as any).sstr_image_cache.set(cursor.key.toString(), cursor.value);
          }
          cursor.continue();
        } else {
          console.log(`[IDB Cache] Synchronous image cache populated with ${(window as any).sstr_image_cache.size} assets.`);
          resolve();
        }
      };
      request.onerror = () => {
        console.warn("[IDB Cache] Failed to load image cursor.");
        resolve();
      };
    });
  } catch (e) {
    console.error("[IDB Cache] Initialization failed:", e);
  }
}

/**
 * Saves photo to both IndexedDB and synchronous in-RAM cache.
 */
export async function savePhotoToIDB(id: string, base64: string): Promise<void> {
  if (!id || !base64) return;
  
  // Set in synchronous RAM cache immediately
  (window as any).sstr_image_cache.set(id, base64);
  
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(base64, id);
    
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error("[IDB Cache] Store put failed:", tx.error);
        resolve();
      };
    });
  } catch (e) {
    console.error("[IDB Cache] Failed to persist photo to IDB:", e);
  }
}

/**
 * Gets a photo from the synchronous cache, or falls back to reading IndexedDB.
 */
export async function getPhotoFromCacheOrIDB(id: string): Promise<string | null> {
  if (!id) return null;
  const ramValue = (window as any).sstr_image_cache.get(id);
  if (ramValue) return ramValue;
  
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const val = request.result || null;
        if (val) {
          (window as any).sstr_image_cache.set(id, val);
        }
        resolve(val);
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Helper to process any JSON string before storing in localStorage,
 * stripping heavy images into IDB and replacing them with 'idb:ID'
 */
export function extractImagesToIDB(jsonString: string): string {
  if (!jsonString || (!jsonString.includes("data:image") && !jsonString.includes("data:application"))) return jsonString;
  
  try {
    const data = JSON.parse(jsonString);
    let changed = false;
    
    const fieldsToPrune = ["fotoUrl", "faltaBaixaReciboUrl", "comprovanteUrl", "reciboUrl"];

    const traverseAndPrune = (obj: any) => {
      if (!obj || typeof obj !== "object") return;
      
      for (const field of fieldsToPrune) {
        if (obj[field] && typeof obj[field] === "string" && obj[field].startsWith("data:")) {
          const keyId = obj.id || obj.requestId || Math.random().toString(36).substring(2, 9);
          const photoId = `photo_${field}_${keyId}`;
          savePhotoToIDB(photoId, obj[field]); // Async write in background
          obj[field] = `idb:${photoId}`;
          changed = true;
        }
      }
      
      for (const key in obj) {
        if (typeof obj[key] === "object") {
          traverseAndPrune(obj[key]);
        }
      }
    };
    
    traverseAndPrune(data);
    return changed ? JSON.stringify(data) : jsonString;
  } catch (e) {
    return jsonString;
  }
}

/**
 * Helper to restore heavy images from RAM cache back into JSON string when reading from localStorage
 */
export function restoreImagesFromCache(jsonString: string): string {
  if (!jsonString || !jsonString.includes("idb:")) return jsonString;
  
  try {
    const data = JSON.parse(jsonString);
    let changed = false;

    const fieldsToRestore = ["fotoUrl", "faltaBaixaReciboUrl", "comprovanteUrl", "reciboUrl"];
    
    const traverseAndRestore = (obj: any) => {
      if (!obj || typeof obj !== "object") return;

      for (const field of fieldsToRestore) {
        if (obj[field] && typeof obj[field] === "string" && obj[field].startsWith("idb:")) {
          const photoKey = obj[field].substring(4);
          const ramVal = (window as any).sstr_image_cache?.get(photoKey);
          if (ramVal) {
            obj[field] = ramVal;
            changed = true;
          }
        }
      }
      
      for (const key in obj) {
        if (typeof obj[key] === "object") {
          traverseAndRestore(obj[key]);
        }
      }
    };
    
    traverseAndRestore(data);
    return changed ? JSON.stringify(data) : jsonString;
  } catch (e) {
    return jsonString;
  }
}
