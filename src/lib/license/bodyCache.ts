// 肢の本文の IndexedDB キャッシュ（offlineStore.ts の bodies ストア・licensehub-expansion.md §5）。
// 共有端末で別の利用者の本文が混ざらないよう、キーは `${userId}:${itemId}` にする。
// IndexedDB が使えない環境では「何も無い」に縮退する（本文は毎回 DB から取る）。
import { BODIES_STORE, openDb } from '../offlineStore'
import type { ItemBody } from './itemBody'

interface BodyRecord {
  key: string
  body: ItemBody
  savedAt: string
}

export function bodyKey(userId: string, itemId: string): string {
  return `${userId}:${itemId}`
}

export async function readBodies(userId: string, ids: string[]): Promise<Record<string, ItemBody>> {
  const out: Record<string, ItemBody> = {}
  if (ids.length === 0) return out
  const db = await openDb()
  if (!db) return out
  return new Promise(resolve => {
    try {
      const tx = db.transaction(BODIES_STORE, 'readonly')
      const store = tx.objectStore(BODIES_STORE)
      for (const id of ids) {
        const req = store.get(bodyKey(userId, id))
        req.onsuccess = () => {
          const rec = req.result as BodyRecord | undefined
          if (rec?.body) out[id] = rec.body
        }
      }
      tx.oncomplete = () => { db.close(); resolve(out) }
      tx.onerror = () => { db.close(); resolve(out) }
      tx.onabort = () => { db.close(); resolve(out) }
    } catch {
      db.close()
      resolve(out)
    }
  })
}

export async function writeBodies(userId: string, bodies: ItemBody[]): Promise<void> {
  if (bodies.length === 0) return
  const db = await openDb()
  if (!db) return
  const savedAt = new Date().toISOString()
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(BODIES_STORE, 'readwrite')
      const store = tx.objectStore(BODIES_STORE)
      for (const body of bodies) {
        const rec: BodyRecord = { key: bodyKey(userId, body.id), body, savedAt }
        store.put(rec)
      }
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
      tx.onabort = () => { db.close(); resolve() }
    } catch {
      db.close()
      resolve()
    }
  })
}
