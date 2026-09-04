import { SlidersHorizontal, AlertTriangle } from 'lucide-react'
import type { Policy } from '../../lib/policy'
import {
  RETENTION_BUFFER_CALC, RETENTION_BUFFER_MEMORY, RETENTION_CORE,
} from '../../lib/policy'
import { RETENTION_ENDGAME, RETENTION_ENDGAME_DAYS, FINAL_CHECK_DAYS_BEFORE_EXAM } from '../../lib/fsrs'
import { formatMinutes } from '../../lib/estimateMinutes'
import { formatMD } from '../../lib/date'

// 「いま効いているパラメータ」カード（adaptive-fsrs-policy.md Phase A・A-3/A-4）。
//
// 利用者の一次不満は「幾度となく最適化を試みたが、いま何が効いているのか分からない」。
// 設定値はコミット履歴の中にしかなく、アプリのどこからも見えない状態だった（§1.1）。
// このカードはその一点だけを解消する ―― **自動で動かす前に、見えるようにする。**
//
// 【表示の規約・A-4】
//  ① 表示する値は**保守側のみ**。楽観値は並記しない。
//     「未着手を0点にすれば46点／A=0.75なら36点」のような並記は、読み手が都合のよい
//     ほうを信じる余地を残す。それは原則 §0（不確実性はもっとやる側へ）を画面の側から
//     破ることになるので、採用した保守側の値だけを出す。
//  ② 想定得点には**「CBT実測で未検証」を明示する**。この数字は一度も本番形式の実測と
//     突き合わせていない仮定の上に乗っており、それを黙って点数として出してはならない。
//  ③ 「現在適用中」と「Phase C で適用予定」を必ず区別する。ポリシー値（層3の保持率など）は
//     まだスケジューリングに流れていない。効いているかのように並べれば、このカードが
//     解こうとしている「何が効いているのか分からない」を自ら再生産する。
export default function PolicyCard({ policy }: { policy: Policy }) {
  const f = policy.feasibility
  const verdictMeta = {
    safe: { label: '余裕あり', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    tight: { label: 'ぎりぎり', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
    shortfall: { label: '時間が足りない', cls: 'text-red-600 bg-red-50 border-red-200' },
  }[f.verdict]

  const row = (label: string, value: string, note?: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-right min-w-0">
        <span className="text-xs font-medium text-gray-800 tabular-nums">{value}</span>
        {note && <span className="block text-[10px] text-gray-400 leading-tight">{note}</span>}
      </span>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={16} className="text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-800">いま効いているパラメータ</h2>
      </div>

      {/* ---- 想定得点と目標（層1）---- */}
      <section>
        <h3 className="text-[11px] font-semibold text-gray-400 mb-0.5">合格ラインまで</h3>
        {row(
          '想定得点',
          `${policy.estimate}点`,
          'CBT実測で未検証（保守側の仮定による推定値）',
        )}
        {row(
          '目標得点',
          `${policy.targetScore}点`,
          `合格${policy.targetScore - policy.passMargin}点 ＋ 安全マージン${policy.passMargin}点`,
        )}
        {row(
          '安全マージン',
          `${policy.passMargin}点`,
          policy.estimateValidated
            ? 'CBT実測とのズレから自動算出'
            : 'CBT実測が無いため最大側。実測で較正できたら自動で下がる',
        )}
      </section>

      {/* 想定得点が未検証であることは、注記1行では弱い。原則 §0 に直結する前提なので明示する。 */}
      {!policy.estimateValidated && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          <AlertTriangle size={11} className="inline-block mr-1 -mt-0.5" />
          想定得点は<strong>CBT実測で未検証</strong>です。理解度A/Bは解答を見た後の自己申告で、
          本番の正誤と突き合わせた実績が1件もありません。そのため未着手は0点、A・Sも0.75として
          <strong>保守側だけ</strong>で計算しています（楽観側の値は表示しません）。
          この状態では「合格に必要な最小集合だけをやる」モードは無効で、ゴールは全範囲完走です。
        </p>
      )}

      {/* ---- コア集合と必要ペース（層2）---- */}
      <section>
        <h3 className="text-[11px] font-semibold text-gray-400 mb-0.5">やる量</h3>
        {row(
          '残り（前進）',
          `${policy.coreForwardQ}問`,
          'まだ A 以上に届いていない問題。総量は減らさない',
        )}
        {row(
          '維持',
          `${policy.coreMaintainQ}問`,
          '既に A・S の問題。放置すれば忘れて想定得点が下がる',
        )}
        {row(
          '必要ペース',
          `${policy.requiredPaceQ.toFixed(1)}問/日`,
          policy.horizonDate
            ? `完走目標 ${formatMD(policy.horizonDate)} まで残り${policy.horizonDays}日`
            : '完走目標日が未設定（試験日を設定すると自動計算）',
        )}
        {row(
          '1日の最低ライン',
          `${policy.dailyFloor}問`,
          '勉強できない日が続いても、ここは切らない',
        )}
      </section>

      {/* ---- 実現可能性（§3.6）---- */}
      <section>
        <h3 className="text-[11px] font-semibold text-gray-400 mb-0.5">時間</h3>
        {row('必要', `${formatMinutes(f.requiredMinutesPerDay)}/日`, '前進＋維持の合計を残り日数で割った値')}
        {row(
          '直近の実績',
          `${formatMinutes(f.availableMinutesPerDay)}/日`,
          '解答時間を計測できた分のみ（半減期14日の指数加重平均）',
        )}
        <div className={`mt-2 text-[11px] rounded-lg border px-3 py-2 leading-relaxed ${verdictMeta.cls}`}>
          <strong>{verdictMeta.label}</strong>
          {f.verdict === 'shortfall' && (
            <>
              — コアだけでも時間が足りません。ただし
              <strong>目標もノルマも自動では下げません</strong>。
              取れる手は分析タブの警告にまとめてあります。
            </>
          )}
        </div>
      </section>

      {/* ---- 保持率（層3）---- */}
      <section>
        <h3 className="text-[11px] font-semibold text-gray-400 mb-0.5">復習の間隔（目標保持率）</h3>
        {row(
          '適用中',
          policy.layer3Active
            ? `コア ${policy.endgame ? Math.max(RETENTION_CORE, RETENTION_ENDGAME).toFixed(2) : RETENTION_CORE.toFixed(2)} ／ バッファ 計算 ${RETENTION_BUFFER_CALC}・暗記 ${RETENTION_BUFFER_MEMORY}`
            : policy.fallbackRetention.toFixed(2),
          policy.layer3Active
            ? 'コアは落とさない側、バッファは回転優先'
            : policy.endgame
              ? `全問共通。直前期（試験${RETENTION_ENDGAME_DAYS}日前以内）のため ${RETENTION_ENDGAME}`
              : `全問共通。試験${RETENTION_ENDGAME_DAYS}日前から ${RETENTION_ENDGAME} へ自動で上がる`,
        )}
        {row('S の試験前 最終確認', `試験${FINAL_CHECK_DAYS_BEFORE_EXAM}日前`, '復習不要にした問題を1回だけキューへ戻す')}
        {!policy.layer3Active && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1.5 leading-relaxed">
            <AlertTriangle size={11} className="inline-block mr-1 -mt-0.5" />
            コア／バッファで保持率を変える仕組み（層3）は<strong>保留中</strong>です。
            これは「コアを上げた分バッファを下げて相殺し、総復習量を増やさずに配分だけ変える」
            仕組みですが、いまは<strong>バッファが0問</strong>（想定得点が未検証の間は全問がコア）で
            相殺する相手がいません。実測では保持率 0.85→0.90 で復習間隔が
            <strong>約半分（-47〜-49%）</strong>になり、維持の復習量が約2倍になります。
            増えるのは「既にAの問題を再復習する時間」で、その分が未着手の範囲から奪われるため、
            合格を確実にする方向ではないと判断しました。
            CBT実測2回で較正できればコアが最小集合へ絞られ、相殺が成立して自動で有効になります。
          </p>
        )}
        <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
          記録するたびに、その日に使った保持率を履歴へ書き残しています。
          そのため<strong>ポリシーが明日変わっても、過去の復習予定日は書き換わりません</strong>。
          保持率が記録されていない古い履歴は、従来式（日付だけで決まる {policy.fallbackRetention.toFixed(2)}）で
          再生されます。
        </p>
      </section>

      <p className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-50 pt-2">
        ここに出ている値は、いずれも実際に効いています（保持率＝復習間隔、マージン＝目標得点、
        コア＝今日のキューの並び）。先に画面へ出してから自動で動かす、という順序で入れました。
      </p>
    </div>
  )
}
