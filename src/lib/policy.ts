// 適応型ポリシー（adaptive-fsrs-policy.md §3・Phase A）。すべて純関数。
//
// ==========================================================================
// 最上位の原則（設計書 §0）: **不確実性は、必ず「もっとやる」側へ倒す。**
//
// 「設定を下げない」の設定とは、retention や daily_cap のような明示的なつまみだけを
// 指さない。**モデルの中の仮定も設定である。** 検証されていない楽観的な仮定を使って
// 「必要な学習量は少ない」と結論することは、つまみを下げるのとまったく同じ結果を招く。
// このファイルの値はすべてこの原則に従い、迷ったら「学習量が増える側」を採る。
//
// 派生則:
//   1. 未着手は 0点。当て推量による得点を計画に組み込まない（analytics.STATUS_PROB）
//   2. 検証されていない正答確率は、もっともらしい範囲の悲観側を採る
//   3. 「合格に必要な最小集合」モードは、推定が実測で検証されるまで無効。
//      既定ゴールは全範囲完走（passTarget.isEstimateValidated がゲート）
// ==========================================================================
//
// 【適用状況】Phase A では値を算出して返すだけだったが、**Phase C で `retentionOf()` が
// 実際のスケジューリングへ流れるようになった。** 流す条件（設計書 §3.4）は
// 「その日に適用した保持率を履歴エントリへ書き残すこと」で、App.tsx の記録時に
// `ReviewHistoryEntry.policy.retention` として保存し、`deriveFromHistory` がそれを
// 最優先で読む。旧データは従来式へフォールバックするため後方互換が保たれる。
//
// 順序は Phase A（可視化）→ Phase C（自動化）を守った ―― **画面に出ていない値は
// 自動で動かさない。** 利用者の一次不満は「幾度となく最適化したが、いま何が効いているのか
// 分からない」であり、可視化より先に自動化すればそれを悪化させるだけだったため。
// `effectiveRetention` は日付だけで決まる従来式の値で、いまは
// 「policy を持たない旧履歴を再生するときのフォールバック」を表す。

import type { Chapter, MockSession, Review, Status } from '../domain/types'
import type { ScoreEstimate } from './analytics'
import type { PassTarget } from './passTarget'
import type { EstimateModeKey, TimeStats } from './estimateMinutes'
import { isEstimateValidated } from './passTarget'
import { estimateMinutes } from './estimateMinutes'
import { RETENTION_ENDGAME, RETENTION_ENDGAME_DAYS, retentionFor } from './fsrs'
import { addDaysStr, diffDays } from './date'

// ---- 層1: 安全マージン（設計書 §3.3 層1）----
//
// 現行の固定値 10点（passTarget.DEFAULT_PASS_MARGIN）を、推定の信頼度から決め直す。
// 「合格を確実にする」なら、**推定が信用できないほどマージンを厚くする**のが正しい。
// CBT実測が無い間は最大側（15点＝目標75点）を採り、実測が貯まったら「想定得点が実測より
// どれだけ甘かったか」の分だけ上乗せする。実測で想定が正しいと分かれば 8点まで下がり、
// 無駄な負荷が自動的に消える ―― 下げるのは検証できたときだけ。
export const MARGIN_UNVALIDATED = 15
export const MARGIN_MIN = 8
export const MARGIN_MAX = 20

// ---- 層3: 目標保持率（設計書 §3.3 層3）----
// コアは落とさない（0.90）。バッファは回転優先で、計算は 0.85・暗記は 0.80。
// 直前期（試験60日前から）はコア/バッファを問わず 0.90 を下限にする。
export const RETENTION_CORE = 0.9
export const RETENTION_BUFFER_CALC = 0.85
export const RETENTION_BUFFER_MEMORY = 0.8

// ---- 停止中でも切らない最低ライン（設計書 §3.5）----
export const DAILY_FLOOR_MAX = 3

// 1問を A 以上へ引き上げるまでに要する演習回数（実績が無いときの既定と上限）。pace.ts と同値。
const DEFAULT_ATTEMPTS_PER_MASTERY = 2
const MAX_ATTEMPTS_PER_MASTERY = 5

// 維持コア1問あたりの復習回数の上限。stability が極端に小さい問題で見積もりが
// 発散するのを防ぐだけのガード（下限は 1回＝期間中に最低1回は触る）。
const MAX_MAINTENANCE_REVIEWS = 10

// 実績時間の EWMA 半減期（日）。pace.ts の学習ペース推定と揃える。
const EWMA_HALF_LIFE_DAYS = 14
const EWMA_ALPHA = 1 - Math.pow(0.5, 1 / EWMA_HALF_LIFE_DAYS)

// 分野別完走の既定目標＝試験日の何日前か（plan.bunya_target_date 未設定時）。pace.ts と同値。
const DEFAULT_BUNYA_LEAD_DAYS = 90

export type FeasibilityVerdict = 'safe' | 'tight' | 'shortfall'
export type FeasibilityOption = 'increase_time' | 'defer_exam' | 'accept_risk'

// 実現可能性（設計書 §3.6）。
// コアだけでも供給（使える時間）が足りないとき、**黙って目標を下げてはならない**。
// 事実を計算して提示し、選ぶのは利用者に委ねる。アプリは自動では何も下げない。
export interface Feasibility {
  requiredMinutesPerDay: number   // コア完遂に必要な 分/日
  availableMinutesPerDay: number  // 直近の実績から推定した 分/日（EWMA・実測ぶんのみ）
  verdict: FeasibilityVerdict
  options: FeasibilityOption[]    // shortfall のとき提示する選択肢（自動では選ばない）
}

export interface Policy {
  today: string
  examDate: string | null
  horizonDate: string | null   // コア完遂の目標日（分野別完走目標日 → 無ければ試験日）
  horizonDays: number          // その日までの残り日数（下限1）

  // 層1
  estimateValidated: boolean   // 想定得点が CBT 実測で較正できる状態か
  passMargin: number
  targetScore: number
  estimate: number             // 保守側の想定得点（未検証なら estimateValidated=false）

  // 層2（コア集合）。前進コア＝未修得すべて／維持コア＝既に A・S の問題。
  // 【設計書 §7】コアを「合格に必要な最小集合」から作ってはならない（＝やる量を減らす仕組み）。
  // 今日の絞り込みは順序付けだけに使い、総量は減らさない。積み残しは翌日以降に必ず戻す。
  coreIds: Set<string>
  coreForwardQ: number         // 前進コア（未着手・C・B）の問数
  coreMaintainQ: number        // 維持コア（A・S）の問数
  requiredPaceQ: number        // 前進コア ÷ 残り日数（問/日）
  dailyFloor: number           // 停止中でも切らない最低ライン（問）
  // 1問を A 以上へ引き上げるまでに要する演習回数（実績。無ければ既定2・上限5）。
  // planToday が「1回あたりの伸び」を出すのに使う（前進と維持を同じ土俵に並べるため）。
  attemptsPerMastery: number

  // 層3。id と学習モードから目標保持率を返す（Phase C で FSRS のスケジューリングへ適用済み）。
  retentionOf(id: string, mode: EstimateModeKey): number
  // 層3のコア/バッファ分岐が有効か。バッファが0問の間は無効で、従来式の値を返す（下の解説）。
  layer3Active: boolean
  // 日付だけで決まる従来式の保持率（fsrs.retentionFor）。
  // policy を持たない旧履歴を再生するときのフォールバック値。
  fallbackRetention: number
  endgame: boolean             // 直前期（試験 RETENTION_ENDGAME_DAYS 日前以内）か

  feasibility: Feasibility
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function finishedCbt(sessions: MockSession[]): MockSession[] {
  return sessions.filter(s => s.status === 'finished' && s.mode === 'cbt' && s.score != null)
}

function isMastered(status: Status | undefined): boolean {
  return status === 'A' || status === 'S'
}

/**
 * 層1: 安全マージン（点）。
 *
 * 設計書 §3.3 のコードは「実測が1件でもあれば bias から決める」としていたが、
 * ここでは較正の判定を passTarget.isEstimateValidated（CBT 2回以上）に合わせる。
 * 1回の結果は実力なのか出題の当たり外れなのか切り分けられず、それを根拠にマージンを
 * 15→8点へ下げると、たまたま良かった1回でゴールが下がる。原則 §0 の「不確実性は
 * もっとやる側へ」に照らして、下げる判断は検証が成立してからにする。
 */
export function passMarginFor(est: ScoreEstimate, sessions: MockSession[]): number {
  if (!isEstimateValidated(sessions)) return MARGIN_UNVALIDATED
  const finished = finishedCbt(sessions)
  // bias が正 = 想定得点が実測より甘い。甘い分だけマージンへ上乗せする。
  const bias =
    finished.reduce((s, m) => s + (est.estimate - (m.score as number)), 0) / finished.length
  return clamp(Math.round(MARGIN_MIN + Math.max(0, bias)), MARGIN_MIN, MARGIN_MAX)
}

// 1問を A 以上へ引き上げるのに要した実績演習回数。実績が無ければ既定値。
function attemptsPerMastery(chapters: Chapter[], reviews: Record<string, Review>): number {
  let attempts = 0
  let mastered = 0
  for (const c of chapters) {
    for (const q of c.questions) {
      const r = reviews[q.id]
      if (!r) continue
      attempts += r.review_history?.length ?? 0
      if (isMastered(r.status)) mastered++
    }
  }
  if (mastered === 0 || attempts === 0) return DEFAULT_ATTEMPTS_PER_MASTERY
  return clamp(attempts / mastered, 1, MAX_ATTEMPTS_PER_MASTERY)
}

// 維持コア1問が期間中に発生させる復習回数の見込み。
// FSRS の stability（この間隔なら目標保持率を保てる日数）で残り日数を割った回数。
// S は復習キューから外れており、試験前の最終確認1回だけが発生する。
function maintenanceReviews(r: Review | undefined, horizonDays: number): number {
  if (r?.status === 'S') return 1
  const stability = Math.max(1, r?.stability ?? 0)
  return clamp(Math.ceil(horizonDays / stability), 1, MAX_MAINTENANCE_REVIEWS)
}

/**
 * コア完遂に必要な 分/日。
 *
 * 前進コア（未修得）… 1問を A 以上にするまでの演習回数 × 1問の推定所要分
 * 維持コア（A・S）  … 期間中に発生する復習回数 × 1問の推定所要分
 *
 * 【設計書 §3.3 訂正】維持を勘定に入れるのが要点。A が C へ落ちる損失（0.15点/問）は
 * 新規着手の伸び（0.17点/問）とほぼ同じ大きさで、維持と前進は同じ土俵に並ぶ。
 * 既に A の問題を放置すれば忘れて落ち、想定得点はそのぶん下がる。
 *
 * 見積もりは保守側（多め）に出る。維持コアの1問あたり時間には、その問題の直近実測
 * （＝初見や苦戦した回を含む所要時間）をそのまま使っており、実際の復習はこれより速い。
 * 精緻な補正は入れない ―― 必要時間を過小に見せるより過大に見せるほうが安全側で、
 * 原則 §0 の倒し方に一致するため（estimateMinutes.ts 冒頭の判断と同じ）。
 */
function requiredMinutesPerDay(
  chapters: Chapter[],
  reviews: Record<string, Review>,
  stats: TimeStats,
  horizonDays: number,
  attempts: number,
): number {
  let minutes = 0
  for (const c of chapters) {
    for (const q of c.questions) {
      const r = reviews[q.id]
      const per = estimateMinutes(q, r, stats)
      minutes += isMastered(r?.status)
        ? per * maintenanceReviews(r, horizonDays)
        : per * attempts
    }
  }
  return minutes / horizonDays
}

/**
 * 直近の実績から推定した 分/日（EWMA・半減期14日）。
 *
 * **計測できた解答時間（duration_seconds）だけを数える。** 計測が付いていない記録を
 * 推定値で補うと「使えた時間」が実際より大きく出て、供給過大＝必要量過小の方向へ倒れる。
 * 原則 §0 に従い、供給側は控えめに見積もる。実績ゼロの日も 0分として算入するので、
 * 停止期間は自動的に平均を押し下げる（休止を宣言させない・pace.ts と同じ考え方）。
 *
 * 集計対象は**この科目の収録問題だけ**。`reviews` は資格（exam_id）単位で読み込まれており
 * 他科目の進捗も入っているため、`Object.values(reviews)` を走らせると他科目の学習時間まで
 * 「この科目に使える時間」として数えてしまう。必要側（requiredMinutesPerDay）は科目内の
 * 問題だけで積んでいるので、供給側だけ科目をまたぐと供給過大＝shortfall の見逃しになる。
 */
function availableMinutesPerDay(
  chapters: Chapter[],
  reviews: Record<string, Review>,
  today: string,
): number {
  const daily = new Map<string, number>()
  for (const c of chapters) {
    for (const q of c.questions) {
      for (const e of reviews[q.id]?.review_history ?? []) {
        const sec = e.duration_seconds
        if (typeof sec !== 'number' || sec <= 0) continue
        daily.set(e.date, (daily.get(e.date) ?? 0) + sec / 60)
      }
    }
  }
  if (daily.size === 0) return 0
  const start = [...daily.keys()].sort()[0]
  const span = diffDays(start, today)
  if (span < 0) return 0
  let ewma = 0
  for (let i = 0; i <= span; i++) {
    ewma = EWMA_ALPHA * (daily.get(addDaysStr(start, i)) ?? 0) + (1 - EWMA_ALPHA) * ewma
  }
  return ewma
}

function feasibilityOf(required: number, available: number): Feasibility {
  let verdict: FeasibilityVerdict
  if (required <= 0) verdict = 'safe'
  else if (available >= required * 1.2) verdict = 'safe'
  else if (available >= required) verdict = 'tight'
  else verdict = 'shortfall'
  return {
    requiredMinutesPerDay: required,
    availableMinutesPerDay: available,
    verdict,
    // 自動では選ばない。事実として並べるだけ（設計書 §3.6）。
    options: verdict === 'shortfall' ? ['increase_time', 'defer_exam', 'accept_risk'] : [],
  }
}

/**
 * 毎日1回まわす純関数。三層のポリシー（設計書 §3.3）と実現可能性（§3.6）を算出する。
 *
 * Phase C 以降、`retentionOf()` は実際の scheduling に効いている。効かせる前提条件は
 * `ReviewHistoryEntry.policy` に適用値を書き残すこと（§3.4）で、App.tsx の記録時に
 * 満たしている。この仕組み無しに層3を実装すると、ポリシーが日々変わるたびに
 * `deriveFromHistory` の再生結果が変わり、過去の予定日が毎日書き換わる
 * ―― まさに利用者が困っている「現状が分からない」の悪化。
 */
export function optimizePolicy(params: {
  chapters: Chapter[]
  reviews: Record<string, Review>
  scoreEstimate: ScoreEstimate
  passTarget: PassTarget
  sessions: MockSession[]
  timeStats: TimeStats
  today: string
  examDate: string | null
  bunyaTargetDate: string | null
}): Policy {
  const {
    chapters, reviews, scoreEstimate, passTarget, sessions, timeStats,
    today, examDate, bunyaTargetDate,
  } = params

  const estimateValidated = isEstimateValidated(sessions)
  const passMargin = passMarginFor(scoreEstimate, sessions)
  const targetScore = Math.min(100, scoreEstimate.passingScore + passMargin)

  // コア完遂の目標日: 明示指定 > (試験日 - 90日) > なし（試験日も未設定のとき）。
  const horizonDate =
    bunyaTargetDate ?? (examDate ? addDaysStr(examDate, -DEFAULT_BUNYA_LEAD_DAYS) : null)
  const horizonDays = horizonDate ? Math.max(1, diffDays(today, horizonDate)) : 1

  // ---- 層2: コア集合 ----
  // 前進コア＝未修得すべて。維持コア＝既に A・S の問題。合わせて収録済みの全問になる。
  // 想定得点が CBT 実測で較正できたときにだけ、前進コアを最小集合（requiredIds）へ絞る。
  // 検証前に絞ると、未検証の楽観的な推定がそのまま「やらなくてよい」に化ける（§0 派生則3）。
  const coreIds = new Set<string>()
  let coreForwardQ = 0
  let coreMaintainQ = 0
  let totalQ = 0
  for (const c of chapters) {
    for (const q of c.questions) {
      totalQ++
      const status = reviews[q.id]?.status ?? '未着手'
      if (isMastered(status)) {
        coreIds.add(q.id)
        coreMaintainQ++
      } else if (!estimateValidated || passTarget.requiredIds.has(q.id)) {
        coreIds.add(q.id)
        coreForwardQ++
      }
    }
  }

  const requiredPaceQ = coreForwardQ / horizonDays
  // 停止中でも切らない最低ライン。必要ペース（問/日）を上限3問で丸めた値。
  // 「今日はここまでで計画どおり」の下限であって、上限キャップではない。
  const dailyFloor =
    coreForwardQ === 0 ? 1 : clamp(Math.ceil(requiredPaceQ), 1, DAILY_FLOOR_MAX)

  // ---- 層3: 問題ごとの目標保持率（Phase C でスケジューリングへ適用）----
  //
  // 【バッファが0問の間は分岐させない ―― 2026-09-04 の実測による判断】
  //
  // 層3は「コアを上げた分、バッファを下げて相殺する」ことで、**総復習量を増やさずに**
  // 時間の配分だけを変える仕組みである（設計書 §3.3 の但し書き。§6 で実測検証すること、
  // と明記されていた）。その実測を行った結果、前提が現状では成立しないことが分かった。
  //
  //   保持率 0.85 → 0.90 で、FSRS の次回間隔は stability 3〜36 のいずれでも **-47〜-49%**。
  //   つまり維持の復習回数はおよそ2倍になる。
  //
  // ところが想定得点が未検証の間は `coreIds` が収録全問になり（前進コア＝未修得すべて＋
  // 維持コア＝A・S）、**バッファが0問**。下げる相手がいないので相殺が成立せず、層3は
  // 「全問の保持率を一律に上げる」＝グローバルな負荷2倍にしかならない。
  //
  // これは原則 §0（不確実性はもっとやる側へ）に見えて、実際には逆を向く。増えるのは
  // 「既に A の179問をより頻繁に再復習する時間」であり、その時間は §7 が
  // 「最大かつ唯一の律速」と呼ぶ**未着手208問**から奪われる。範囲が埋まらないまま
  // 維持だけが厚くなる状態は、合格を確実にする方向ではない。
  //
  // したがって、コアとバッファに実際の差が生まれるまでは従来式（日付ベース）を返す。
  // 較正が済んで `coreIds` が最小集合へ絞られた時点で分岐が自動で有効になる ――
  // そのときは相殺が成立するので、設計書どおりの意味で機能する。
  // 分岐そのものは実装済みで、有効化に必要なのは CBT 実測2回だけ。
  const endgame = examDate ? diffDays(today, examDate) <= RETENTION_ENDGAME_DAYS : false
  const layer3Active = coreIds.size < totalQ
  const retentionOf = (id: string, mode: EstimateModeKey): number => {
    if (!layer3Active) return retentionFor(today, examDate)
    const base = coreIds.has(id)
      ? RETENTION_CORE
      : mode === 'calc'
        ? RETENTION_BUFFER_CALC
        : RETENTION_BUFFER_MEMORY
    return endgame ? Math.max(base, RETENTION_ENDGAME) : base
  }

  const attempts = attemptsPerMastery(chapters, reviews)
  const required = requiredMinutesPerDay(chapters, reviews, timeStats, horizonDays, attempts)
  const available = availableMinutesPerDay(chapters, reviews, today)

  return {
    today,
    examDate,
    horizonDate,
    horizonDays,
    estimateValidated,
    passMargin,
    targetScore,
    estimate: scoreEstimate.estimate,
    coreIds,
    coreForwardQ,
    coreMaintainQ,
    requiredPaceQ,
    dailyFloor,
    attemptsPerMastery: attempts,
    retentionOf,
    layer3Active,
    fallbackRetention: retentionFor(today, examDate),
    endgame,
    feasibility: feasibilityOf(required, available),
  }
}
