// 採用中の FSRS パラメータ w[] の読み込み（denken_fsrs_params）。
//
// w[] は忘却曲線そのものを決めるので、版を取り違えると過去の予定日がすべて変わる。
// 読み込みの責務はここに閉じ、fsrs.ts の登録簿（registerParams）へ流し込むだけにする。
//
// 版 0 ＝ ts-fsrs の既定パラメータ。テーブルに行が無い状態がこれに当たる。

import { supabase } from './supabase'
import { DEFAULT_PARAMS_VERSION, registerParams } from './fsrs'

// FSRS-6 の重みの個数。個数が合わない行はデータの取り違えなので採用しない
// （ts-fsrs 側が受け取ると例外になるか、黙って別物のスケジュールを出す）。
export const W_LENGTH = 21

export interface FsrsParamsRow {
  version: number
  w: number[]
  trained_at: string
  review_count: number
  item_count: number
  log_loss_before: number | null
  log_loss_after: number | null
  rmse_before: number | null
  rmse_after: number | null
}

function isValidW(w: unknown): w is number[] {
  return Array.isArray(w) && w.length === W_LENGTH && w.every(v => typeof v === 'number' && Number.isFinite(v))
}

/**
 * 採用中の版を読み、fsrs.ts の登録簿へ入れる。
 * 採用中が無ければ null（既定パラメータのまま動く）。
 *
 * 失敗しても例外にしない。読めなければ既定パラメータで動くだけで、
 * 履歴に刻まれた版が既定へフォールバックするのは想定内の挙動（fsrs.ts の wFor）。
 */
export async function loadAdoptedParams(
  userId: string,
  examId: string,
): Promise<FsrsParamsRow | null> {
  const { data, error } = await supabase
    .from('denken_fsrs_params')
    .select('version, w, trained_at, review_count, item_count, log_loss_before, log_loss_after, rmse_before, rmse_after')
    .eq('user_id', userId)
    .eq('exam_id', examId)
    .eq('adopted', true)
    .maybeSingle()

  if (error) { console.error(error); return null }
  if (!data || !isValidW(data.w) || data.version <= DEFAULT_PARAMS_VERSION) return null

  const row = { ...data, w: data.w } as FsrsParamsRow
  registerParams({ version: row.version, w: row.w })
  return row
}

export interface OptimizeMetrics {
  logLoss: { before: number; after: number }
  rmse: { before: number; after: number }
}

export interface OptimizeResult {
  ok: true
  adopted: boolean
  version?: number
  w?: number[]
  stats: { cards: number; reviews: number; items: number; ratings: Record<string, number> }
  metrics?: OptimizeMetrics
  gain?: number
  reason?: string
  rescheduled?: number
  message?: string
}

/**
 * 最適化APIを叩く。`apply: false` なら学習と評価だけ（採用しない）。
 * 認証は Supabase のアクセストークンをそのまま渡す ―― サーバ側は RLS で絞る。
 */
export async function requestOptimize(
  examId: string,
  apply: boolean,
): Promise<OptimizeResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('ログインが必要です')

  const res = await fetch('/api/optimize', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ examId, apply }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `最適化に失敗しました（${res.status}）`)
  return body as OptimizeResult
}
