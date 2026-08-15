
import { openDB } from 'idb';

export type LocalNote = {
  localId: string;
  original_text: string;
  status: 'pending' | 'reviewing' | 'reviewed';
  corrected_text?: string;
  explanation_ja?: string;
  created_at: string;
  reviewed_at?: string | null;
  remoteId?: number;
  dirty: boolean;
};

const DB_NAME = 'english-review-v1';
const STORE = 'notes';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'localId' });
        store.createIndex('created_at', 'created_at');
      }
    },
  });
}

export async function saveLocal(note: LocalNote) {
  const db = await getDB();
  await db.put(STORE, note);
}

export async function getAllLocal(): Promise<LocalNote[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getLocal(localId: string) {
  const db = await getDB();
  return db.get(STORE, localId);
}

export async function deleteLocal(localId: string) {
  const db = await getDB();
  await db.delete(STORE, localId);
}
