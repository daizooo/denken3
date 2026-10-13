// 肢の本文（lic_items の一部）の取得とキャッシュ、出題可否の判定（licensehub-expansion.md §5・§6.1）。
//
// 本文はリポジトリに置かず DB から必要な分だけ取る。ここは React・Supabase・IndexedDB に依存しない
// 純粋なロジック（取得経路は deps として注入）にして、vitest で検証できるようにする。
import type { LicItemRow } from '../../domain/license'

/** 肢モードで使う列だけ。行の型は src/domain/license.ts を正とする。 */
export type ItemBody = Pick<
  LicItemRow,
  | 'id' | 'question_id' | 'label' | 'statement' | 'truth' | 'explanation'
  | 'explanation_source' | 'law_status' | 'study_subject' | 'scored_subject'
>

/** lic_items から取る列（ItemBody と対応）。 */
export const ITEM_BODY_COLUMNS =
  'id,question_id,label,statement,truth,explanation,explanation_source,law_status,study_subject,scored_subject'

/** 1回の `in` 取得の件数（URL 長の上限を避ける）。 */
export const FETCH_CHUNK = 200

/**
 * 肢モードに出してよいか（判定はこの1か所に置く）。
 * - 本文が無い・空 → 出さない（空の問題を出さない）
 * - truth が null → 出さない（問モード専用）
 * - law_status が 'ok' 以外 → 出さない（法改正の確認待ち・除外。§9）
 */
export function isAskableItem(body: ItemBody | undefined | null): body is ItemBody {
  return !!body
    && typeof body.statement === 'string' && body.statement.trim() !== ''
    && body.truth !== null && body.truth !== undefined
    && body.law_status === 'ok'
}

export function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

export interface ItemBodyDeps {
  /** キャッシュから取り出す（無いものは結果に含めない）。 */
  readCache: (ids: string[]) => Promise<Record<string, ItemBody>>
  /** キャッシュへ入れる。 */
  writeCache: (bodies: ItemBody[]) => Promise<void>
  /** DB から取る（最大 FETCH_CHUNK 件）。失敗は throw してよい。 */
  fetchRemote: (ids: string[]) => Promise<ItemBody[]>
  /** false ならリモート取得をしない（オフライン）。 */
  online: boolean
}

export interface ItemBodyResult {
  bodies: Record<string, ItemBody>
  /** 取得できなかった ID（未登録・失敗・オフライン）。出題しない側に倒す。 */
  missing: string[]
  /** リモート取得で失敗した塊があったか。 */
  failed: boolean
}

/** キャッシュ → 不足分を FETCH_CHUNK 件ずつ DB から取得し、キャッシュへ入れる。 */
export async function loadItemBodies(ids: string[], deps: ItemBodyDeps): Promise<ItemBodyResult> {
  const unique = [...new Set(ids)]
  let bodies: Record<string, ItemBody> = {}
  try {
    bodies = { ...(await deps.readCache(unique)) }
  } catch {
    bodies = {}
  }
  let failed = false
  const lacking = unique.filter(id => !bodies[id])
  if (deps.online && lacking.length > 0) {
    for (const part of chunk(lacking, FETCH_CHUNK)) {
      try {
        const rows = await deps.fetchRemote(part)
        const wanted = new Set(part)
        const got = rows.filter(r => wanted.has(r.id))
        for (const r of got) bodies[r.id] = r
        if (got.length > 0) {
          try { await deps.writeCache(got) } catch { /* キャッシュ失敗は表示を妨げない */ }
        }
      } catch {
        failed = true
      }
    }
  }
  return { bodies, missing: unique.filter(id => !bodies[id]), failed }
}
