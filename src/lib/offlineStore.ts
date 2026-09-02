// オフラインの永続層（課題7d・Phase F）。IndexedDB に2つだけ持つ。
//
//   ① snapshot: 直近にサーバから取れた学習データ（reviews / plans）のスナップショット。
//      起動時にまずこれを描画するので、電波が無くても「今日の復習」がそのまま開く。
//      service worker（課題7b）がアプリシェルを返せても、学習データが無ければ
//      オフラインの画面は空になる ―― シェルのキャッシュとデータのキャッシュは対で要る。
//   ② outbox: オフライン中・送信に失敗した `denken_reviews` の upsert 待ち行列。
//      オンライン復帰時に古い順で送る。同じ問題への記録は後勝ちで1件に畳む
//      （現行の「最後の書き込みが勝つ」方針そのまま・§3 課題7d）。
//
// Supabase・React には依存しない（送信は呼び出し側が行い、ここは行の入れ物に徹する）。
// IndexedDB が使えない環境（プライベートモード等）では、全関数が「何もしない」に縮退する。
import type { ExamPlan, Review } from '../domain/types'

const DB_NAME = 'electricpro-offline'
const DB_VERSION = 1
const SNAPSHOT_STORE = 'snapshot'
const OUTBOX_STORE = 'outbox'

export interface OfflineSnapshot {
  key: string // `${userId}:${examId}`
  reviews: Record<string, Review>
  plans: Record<string, ExamPlan>
  savedAt: string // ISO8601。将来「N時間前のデータです」を出すために持つ
}

export interface PendingWrite {
  key: string // `${userId}:${examId}:${questionId}`。同じ問題は後勝ちで畳まれる
  row: Record<string, unknown> // denken_reviews へそのまま upsert する行
  queuedAt: string // ISO8601。送信順（古い順）に使う
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise(resolve => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    // 開けない場合はオフライン機能だけを諦める（アプリ本体は今までどおり動く）。
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
}

// 1トランザクションを Promise 化する小さなヘルパ。失敗は握り潰して fallback を返す
// （オフラインの補助機能のために本体の記録操作を失敗させない）。
async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  const db = await openDb()
  if (!db) return fallback
  return new Promise<T>(resolve => {
    let req: IDBRequest
    try {
      req = run(db.transaction(store, mode).objectStore(store))
    } catch {
      db.close()
      resolve(fallback)
      return
    }
    req.onsuccess = () => { db.close(); resolve((req.result as T) ?? fallback) }
    req.onerror = () => { db.close(); resolve(fallback) }
  })
}

/** スナップショットのキー。ユーザ×資格ごとに1件だけ持つ。 */
export function snapshotKey(userId: string, examId: string): string {
  return `${userId}:${examId}`
}

export async function loadSnapshot(key: string): Promise<OfflineSnapshot | null> {
  return withStore<OfflineSnapshot | null>(SNAPSHOT_STORE, 'readonly', s => s.get(key), null)
}

export async function saveSnapshot(
  key: string,
  data: { reviews: Record<string, Review>; plans: Record<string, ExamPlan> },
): Promise<void> {
  const record: OfflineSnapshot = { key, ...data, savedAt: new Date().toISOString() }
  await withStore(SNAPSHOT_STORE, 'readwrite', s => s.put(record), undefined)
}

/** 送信待ちに積む。同じ key（＝同じ問題）は上書き＝最後の記録が勝つ。 */
export async function queueWrite(key: string, row: Record<string, unknown>): Promise<void> {
  const record: PendingWrite = { key, row, queuedAt: new Date().toISOString() }
  await withStore(OUTBOX_STORE, 'readwrite', s => s.put(record), undefined)
}

/** 送信待ちを古い順で返す。 */
export async function pendingWrites(): Promise<PendingWrite[]> {
  const all = await withStore<PendingWrite[]>(OUTBOX_STORE, 'readonly', s => s.getAll(), [])
  return all.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
}

export async function removeWrite(key: string): Promise<void> {
  await withStore(OUTBOX_STORE, 'readwrite', s => s.delete(key), undefined)
}

export async function pendingCount(): Promise<number> {
  return withStore<number>(OUTBOX_STORE, 'readonly', s => s.count(), 0)
}
