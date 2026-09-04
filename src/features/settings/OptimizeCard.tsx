import { useState } from 'react'
import { Cpu, Loader2, Check, Info } from 'lucide-react'
import {
  requestOptimize, type FsrsParamsRow, type OptimizeResult,
} from '../../lib/fsrsParams'
import { formatMD } from '../../lib/date'

// FSRS パラメータ w[] の最適化カード（Phase D）。
//
// 【2段構えにしている理由】
// 押すと即座に全カードの予定日が書き換わる、では「何が効いているのか分からない」を
// 悪化させる。まず「調べる」で当てはまりの数字だけを出し、利用者がそれを見てから
// 「採用する」を押す。画面に出ていない値は自動で動かさない、という Phase A からの方針。
//
// 【改善しなければ採用しない】
// 本番データは学習アイテム 277件で、FSRS プロジェクトの推奨（1,000件以上）に届いていない。
// サーバ側が既定パラメータとの当てはまりを比べ、改善が無ければ `no_improvement` を返す。
// **「採用しない」は失敗ではなく正しい答え**なので、そう読める文言で出す。
const REASON_TEXT: Record<string, string> = {
  not_enough_data: '学習に使える演習がまだ足りません。演習が貯まると自動で対象になります',
  no_improvement: '既定のパラメータより良くなりませんでした。いまは既定のままが最善です',
  unexpected_w_length: 'パラメータの個数が想定と違いました（採用を見送りました）',
  reschedule_failed: 'スケジュールの更新に失敗したため、採用を取り消しました',
  dry_run: '調べただけです。採用するには「このパラメータを採用」を押してください',
}

function pct(before: number, after: number): string {
  if (!before) return '—'
  const gain = ((before - after) / before) * 100
  return `${gain >= 0 ? '−' : '+'}${Math.abs(gain).toFixed(1)}%`
}

export default function OptimizeCard({
  examId, adopted, onAdopted,
}: {
  examId: string
  /** いま採用中の版（未採用なら null）。 */
  adopted: FsrsParamsRow | null
  onAdopted: () => void
}) {
  const [busy, setBusy] = useState<null | 'check' | 'apply'>(null)
  const [result, setResult] = useState<OptimizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (apply: boolean) => {
    setBusy(apply ? 'apply' : 'check')
    setError(null)
    try {
      const r = await requestOptimize(examId, apply)
      setResult(r)
      if (r.adopted) onAdopted()
    } catch (e) {
      setError(e instanceof Error ? e.message : '最適化に失敗しました')
    } finally {
      setBusy(null)
    }
  }

  // 「調べる」で改善が確認できた結果だけ、採用ボタンを出す。
  const canAdopt = result?.ok && !result.adopted && result.reason === 'dry_run' && !!result.metrics

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Cpu size={16} className="text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-800">復習間隔の最適化（FSRS パラメータ）</h2>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        これまでの演習記録から、あなた自身の忘却曲線に合わせた復習間隔を学習します。
        既定より当てはまりが良くなったときだけ採用され、そうでなければ既定のまま変わりません。
      </p>

      {/* 現在の状態 */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
        {adopted ? (
          <div className="text-[11px] text-gray-600 leading-relaxed">
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <Check size={12} /> 学習済みパラメータを適用中
            </span>
            <span className="block text-gray-500 mt-0.5 tabular-nums">
              版 {adopted.version} · {formatMD(adopted.trained_at.slice(0, 10))} 学習 ·
              演習 {adopted.review_count}件
              {adopted.log_loss_before != null && adopted.log_loss_after != null && (
                <> · 当てはまり {pct(adopted.log_loss_before, adopted.log_loss_after)}</>
              )}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-gray-600">
            <span className="font-medium text-gray-700">既定のパラメータで動作中</span>
            <span className="block text-gray-500 mt-0.5">
              まだ学習したパラメータは採用されていません
            </span>
          </div>
        )}
      </div>

      {/* 結果 */}
      {result && (
        <div className="rounded-xl border border-gray-100 px-3 py-2 space-y-1.5">
          {result.metrics ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <span className="text-gray-400">指標</span>
                <span className="text-gray-400 text-right">既定</span>
                <span className="text-gray-400 text-right">学習後</span>

                <span className="text-gray-500">予測のズレ</span>
                <span className="text-right tabular-nums text-gray-600">{result.metrics.logLoss.before.toFixed(4)}</span>
                <span className="text-right tabular-nums font-medium text-gray-800">
                  {result.metrics.logLoss.after.toFixed(4)}
                  <span className={`ml-1 ${result.metrics.logLoss.after < result.metrics.logLoss.before ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {pct(result.metrics.logLoss.before, result.metrics.logLoss.after)}
                  </span>
                </span>

                <span className="text-gray-500">想起確率の誤差</span>
                <span className="text-right tabular-nums text-gray-600">{result.metrics.rmse.before.toFixed(4)}</span>
                <span className="text-right tabular-nums font-medium text-gray-800">
                  {result.metrics.rmse.after.toFixed(4)}
                  <span className={`ml-1 ${result.metrics.rmse.after < result.metrics.rmse.before ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {pct(result.metrics.rmse.before, result.metrics.rmse.after)}
                  </span>
                </span>
              </div>
              <p className="text-[10px] text-gray-400 tabular-nums">
                演習 {result.stats.reviews}件 / 学習アイテム {result.stats.items}件
                {result.stats.ratings && (
                  <> · 内訳 A {result.stats.ratings['4'] ?? 0} / B {result.stats.ratings['3'] ?? 0} / C {result.stats.ratings['1'] ?? 0}</>
                )}
              </p>
            </>
          ) : null}

          {result.adopted ? (
            <p className="text-[11px] text-emerald-700 flex items-start gap-1">
              <Check size={12} className="mt-0.5 shrink-0" />
              版 {result.version} を採用し、{result.rescheduled}問の復習予定を引き直しました
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 flex items-start gap-1">
              <Info size={12} className="mt-0.5 shrink-0" />
              {result.message ?? REASON_TEXT[result.reason ?? ''] ?? '採用しませんでした'}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={() => run(false)}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:border-blue-300 disabled:opacity-50 transition-colors"
        >
          {busy === 'check' ? <Loader2 size={13} className="animate-spin" /> : <Cpu size={13} />}
          {busy === 'check' ? '学習中...' : '調べる'}
        </button>
        {canAdopt && (
          <button
            onClick={() => run(true)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {busy === 'apply' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {busy === 'apply' ? '適用中...' : 'このパラメータを採用'}
          </button>
        )}
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        採用すると、これまでの記録に版番号を書き込んだうえで全問の復習予定を計算し直します。
        以後どの画面から見ても同じ予定日になり、次に採用するまで勝手に動くことはありません。
      </p>
    </div>
  )
}
