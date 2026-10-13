// 一括コピーした肢の組の保持と復元（licensehub-expansion.md §6.3）。
//
// コピーした時点で組（肢IDの並び・作成日時・userId・examId）を localStorage に保存し、
// ブラウザを閉じても BatchGrade で同じ組を復元できるようにする。
// localStorage は引数（StorageLike）で受け取り、vitest で差し替えて検証する。
//
// 方針:
// - 壊れたデータ・形の合わないデータ・別ユーザーの組は、読み出し時に破棄する
// - 別の資格（examId）の組は破棄せず「無いもの」として扱う（資格を戻せば復元できる）
// - 記録が済んだ組には gradedAt を付ける（再読み込みで二重に記録しないため）
// - 1つのキーに最新の1組だけを置く（新しくコピーしたら上書き）

export const BATCH_SESSION_KEY = 'licensehub.batchSession.v1'

export interface BatchSession {
  v: 1
  /** 肢IDの並び（番号順）。 */
  ids: string[]
  /** 作成日時（ISO 8601）。 */
  createdAt: string
  userId: string
  examId: string
  /** 全行の記録が済んだ日時（ISO 8601）。未記録なら無し。 */
  gradedAt?: string
}

/** localStorage のうち使う部分だけ。 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 使える localStorage を返す（プライベートモード等で使えなければ null）。 */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function newBatchSession(ids: string[], userId: string, examId: string, now: Date): BatchSession {
  return { v: 1, ids: [...new Set(ids)], createdAt: now.toISOString(), userId, examId }
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x !== ''
}

/** 保存値の形を確かめる。合わなければ null。 */
export function parseBatchSession(raw: string | null): BatchSession | null {
  if (raw === null) return null
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const s = o as Record<string, unknown>
  if (s.v !== 1) return null
  if (!Array.isArray(s.ids) || s.ids.length === 0 || !s.ids.every(isNonEmptyString)) return null
  if (new Set(s.ids).size !== s.ids.length) return null
  if (!isNonEmptyString(s.createdAt) || Number.isNaN(Date.parse(s.createdAt))) return null
  if (!isNonEmptyString(s.userId) || !isNonEmptyString(s.examId)) return null
  if (s.gradedAt !== undefined && (!isNonEmptyString(s.gradedAt) || Number.isNaN(Date.parse(s.gradedAt)))) return null
  return {
    v: 1,
    ids: [...s.ids] as string[],
    createdAt: s.createdAt,
    userId: s.userId,
    examId: s.examId,
    ...(s.gradedAt !== undefined ? { gradedAt: s.gradedAt as string } : {}),
  }
}

/** 保存する。失敗（容量超過・無効化）しても例外は出さず false を返す。 */
export function saveBatchSession(storage: StorageLike | null, session: BatchSession): boolean {
  if (!storage) return false
  try {
    storage.setItem(BATCH_SESSION_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export function clearBatchSession(storage: StorageLike | null): void {
  if (!storage) return
  try {
    storage.removeItem(BATCH_SESSION_KEY)
  } catch {
    // 消せなくても次の保存で上書きされる
  }
}

/**
 * 読み出す。
 * - 壊れている・別ユーザーの組 → 破棄して null
 * - 別の資格の組 → 残したまま null
 */
export function loadBatchSession(
  storage: StorageLike | null, userId: string, examId: string,
): BatchSession | null {
  if (!storage) return null
  let raw: string | null
  try {
    raw = storage.getItem(BATCH_SESSION_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  const s = parseBatchSession(raw)
  if (!s || s.userId !== userId) {
    clearBatchSession(storage)
    return null
  }
  if (s.examId !== examId) return null
  return s
}

/**
 * 記録済み／未記録の印を付け替えて保存する。
 * 保存先が別の組（別タブで新しくコピーした等）に変わっていたら上書きしない。
 */
export function markBatchGraded(
  storage: StorageLike | null, session: BatchSession, gradedAt: string | null,
): BatchSession {
  const { gradedAt: _prev, ...rest } = session
  void _prev
  const next: BatchSession = gradedAt ? { ...rest, gradedAt } : rest
  const stored = loadBatchSession(storage, session.userId, session.examId)
  if (stored && isSameBatch(stored, session)) saveBatchSession(storage, next)
  return next
}

/** 同じ組か（作成日時と肢の並びが一致）。 */
export function isSameBatch(a: BatchSession, b: BatchSession): boolean {
  return a.createdAt === b.createdAt && a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i])
}
