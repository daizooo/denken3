// FSRS（ts-fsrs v5 公式実装）による復習スケジューリング。
// enable_short_term=false で日単位スケジューリング。
import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs'
import type { Card, Grade } from 'ts-fsrs'
import type { Review, ReviewHistoryEntry, Status } from '../domain/types.js'
import { addDaysStr, dateAtUTCNoon, diffDays, toDateStr, todayJST } from './date.js'

// 目標保持率 request_retention（§6-2）。
// 学習時間が希少で未着手が多い段階では 0.9 は保守的すぎる（同じ時間で触れる問題数が減る）。
// 既定を 0.85 に下げ、直前期＝試験60日前からは精度優先で 0.9 へ戻す。
// retention を「その実施日から試験日までの残日数」だけで決めるのが要点で、こうすると
// deriveFromHistory が review_history を再生するたびに同じ結果になる（決定的）。
export const RETENTION_DEFAULT = 0.85
export const RETENTION_ENDGAME = 0.9
export const RETENTION_ENDGAME_DAYS = 60

export function retentionFor(eventDate: string, examDate?: string | null): number {
  if (!examDate) return RETENTION_DEFAULT
  return diffDays(eventDate, examDate) <= RETENTION_ENDGAME_DAYS
    ? RETENTION_ENDGAME
    : RETENTION_DEFAULT
}

// ---- 学習済みパラメータ w[]（FSRS-6・21個）の版管理 ----
//
// w[] は忘却曲線そのものを決めるので、差し替えると**過去の予定日がすべて変わる**。
// 決定的再生（§3.4）を壊さないために、保持率と同じ扱いにする:
//   ① 記録時に、そのとき使った版を履歴エントリへ書き残す（entry.policy.w_version）
//   ② 再生時は、各エントリに書かれた版のパラメータで計算する
// こうすると、あとで新しい版を採用しても過去の再生結果は動かない。
//
// 版 0 は ts-fsrs の既定パラメータ（DBに行を持たない）。版を持たない旧履歴も 0 に落ちる。
// 版 → w は一度決まったら変わらない不変の対応なので、ここに登録簿として持つ。
export const DEFAULT_PARAMS_VERSION = 0

export interface FsrsParams {
  version: number
  w: number[]
}

const paramRegistry = new Map<number, number[]>()

/**
 * 版 → w を登録する（起動時にDBから読んだぶん・API側の再計算時に新しい版）。
 *
 * **同じ版番号で中身が違うことがある。** 版は `denken_fsrs_params` の
 * (user_id, exam_id, version) で振られるので、資格が違えば別人の版1・別科目の版1が
 * 存在する。番号だけで区別すると、資格を切り替えたときや、暖まったサーバレス
 * コンテナが別の利用者を続けて処理したときに、**古い w で作ったスケジューラを
 * 引き当てて別物の予定日を出す**。中身が変わったらキャッシュを捨てる。
 */
export function registerParams(params: FsrsParams): void {
  if (params.version === DEFAULT_PARAMS_VERSION) return
  const existing = paramRegistry.get(params.version)
  if (existing && existing.length === params.w.length
      && existing.every((v, i) => v === params.w[i])) return
  paramRegistry.set(params.version, params.w)
  schedulers.clear()
}

/** 登録簿を空にする（テスト用）。 */
export function resetParams(): void {
  paramRegistry.clear()
  schedulers.clear()
}

/** 履歴エントリの w_version から w を引く。未登録・版0は既定パラメータ（undefined）。 */
function wFor(version: number | undefined): number[] | undefined {
  if (version === undefined || version === DEFAULT_PARAMS_VERSION) return undefined
  return paramRegistry.get(version)
}

// (request_retention, w の版) ごとに FSRS インスタンスを使い回す（実施日ごとに生成しない）。
const schedulers = new Map<string, FSRS>()
function schedulerFor(retention: number, version?: number): FSRS {
  const w = wFor(version)
  // 未登録の版は既定パラメータで計算する。キーも版0に寄せて、あとで登録された
  // ときに古いインスタンスを引き当てないようにする。
  const key = `${retention}:${w ? version : DEFAULT_PARAMS_VERSION}`
  let s = schedulers.get(key)
  if (!s) {
    s = new FSRS({ enable_short_term: false, request_retention: retention, ...(w ? { w } : {}) })
    schedulers.set(key, s)
  }
  return s
}

// S（復習不要）の試験前最終確認（§6-4・課題4）。
// S にした問題は due_date=null で忘却追跡から完全に外れ、そのままだと試験まで一度も
// 戻ってこない。試験日の21日前に1回だけ復習キューへ戻す。
// - 試験日が未設定なら従来どおり null（復習キューから外れたまま）。
// - 最終確認日が実施日を過ぎている場合も null。過去日を due にすると毎日 due に
//   居座り、直前期に S を付け直すたびに翌日また出てくることになるため。
export const FINAL_CHECK_DAYS_BEFORE_EXAM = 21

export function finalCheckDue(eventDate: string, examDate?: string | null): string | null {
  if (!examDate) return null
  const due = addDaysStr(examDate, -FINAL_CHECK_DAYS_BEFORE_EXAM)
  return due > eventDate ? due : null
}

const RATING_MAP: Record<Status, Grade> = {
  A: Rating.Easy,
  B: Rating.Good,
  C: Rating.Again,
  // S・未着手 はスケジューラを回さない（calcFSRS で早期リターン）。便宜上の既定値。
  S: Rating.Easy,
  '未着手': Rating.Good,
}

function toFSRSCard(review: Partial<Review>, now: Date): Card {
  const lastReview = review.last_reviewed ? dateAtUTCNoon(toDateStr(review.last_reviewed)) : now
  const due = review.due_date ? dateAtUTCNoon(toDateStr(review.due_date)) : now
  return {
    due,
    stability: review.stability ?? 0,
    difficulty: review.difficulty_fsrs ?? 5,
    elapsed_days: Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / 86400000)),
    scheduled_days: Math.max(0, Math.floor((due.getTime() - lastReview.getTime()) / 86400000)),
    learning_steps: 0,
    reps: review.repetitions ?? 0,
    lapses: review.lapses ?? 0,
    state: (review.fsrs_state ?? State.New) as State,
    last_review: lastReview,
  }
}

// 復習できる最後の日は試験前日。試験当日は受験するので復習日にならない。
export const LAST_REVIEW_LEAD_DAYS = 1

// 直前期テーパーが効き始める残日数（§7.3）。ここから内側は「間隔が開きすぎて忘れる」を
// 防ぐために間隔へ上限をかける。この範囲では、モデルが安全と言っても必ず1回は入れる。
export const TAPER_FROM_DAYS = 28

// 試験日クリップ（§7.3）。
// FSRS が出した次回復習日(due)を、試験前日を越えない範囲に丸める。
// - interval = min(interval, 試験前日までの残日数)
// - 直前期テーパー：残28日以内→間隔上限14日 / 残14日以内→間隔上限7日
//   （直前に間隔が開きすぎて忘れるのを防ぐ）
// examDate 未指定・試験日を過ぎている場合は素通し（現行挙動を維持）。
//
// 【2026-09-04 修正】上限を「残日数」から「残日数 − 1」へ変えた。
// 従来は maxInterval = daysToExam だったため、間隔が残日数以上のカードが
// **ちょうど試験日**に着地していた。試験当日は受験するので復習は消化できず、
// 予定として成立していない。
function clipDueToExam(due: string, eventDate: string, examDate?: string | null): string {
  if (!examDate) return due
  const daysToExam = diffDays(eventDate, examDate)
  if (daysToExam <= 0) return due // 試験日当日/経過後はクリップしない
  const interval = diffDays(eventDate, due)
  if (interval <= 0) return due
  let maxInterval = daysToExam - LAST_REVIEW_LEAD_DAYS
  if (daysToExam <= 14) maxInterval = Math.min(maxInterval, 7)
  else if (daysToExam <= TAPER_FROM_DAYS) maxInterval = Math.min(maxInterval, 14)
  if (maxInterval <= 0) return due // 試験前日以降は丸めない（次の復習は無い）
  const clipped = Math.min(interval, maxInterval)
  return clipped >= interval ? due : addDaysStr(eventDate, clipped)
}

/**
 * FSRS が出した次回復習日に、試験日という地平を適用する。
 *
 * 【なぜクリップだけでは足りないか（2026-09-04 の実測）】
 * 学習済みパラメータの採用で間隔が伸びた結果、232カード中 **58件（25%）の予定日が
 * ちょうど試験日に張り付いた**。原因は2つある。
 *
 *   ① 試験当日は復習日にならない。受験する日に「復習58問」が積まれても消化できない。
 *   ② 試験日は 分野別 の地平ではない。この枠組みは 分野別 の主軸期間を
 *      `bunya_target_date` までとし、その後は `nendo_start_date` から年度別演習が
 *      主軸になると定めている。試験日に置かれた予定は、年度別が主軸の時期に
 *      分野別 の山を作るだけになる。
 *
 * 【どこへ動かすか ―― 固定日ではなく保持率で決める】
 * 当初は S と同じ最終確認（試験21日前）へ集約しようとしたが、それは誤りだった。
 * `finalCheckDue` は固定値であって FSRS の出力ではなく、**58件を1日へ潰してしまう**。
 * 実測では、この58件の素の予定日は「試験当日」から「試験の224日後」まで224日の幅がある。
 *
 * 代わりに、**この枠組みが既に持っている直前期の基準で引き直す**。
 * `retentionFor` は試験60日前から目標保持率を `RETENTION_ENDGAME`(0.90) へ上げる。
 * 予定日が試験日を越えるカードは「試験までに一度も復習されない」のだから、直前期の
 * 基準を満たすかどうかで判断するのが筋が通る。
 *
 *   - 0.90 で引き直した予定日が試験日より前 → その日に入れる（＝試験日時点で 0.90 を
 *     割るカードなので、割る前に1回入れる）
 *   - それでも試験日を越える → 触れない（試験日時点で 0.90 を満たしている）
 *
 * 新しい定数は増えない。各カード自身の忘却曲線が日付を決めるので、実測では
 * **55件が22日へ自然に分散**した（同一日の最大10件）。残る3件は基準を満たすため対象外。
 *
 * 予定日が試験日を越えたまま残るのは異常ではなく、「試験までに復習は要らない」という
 * モデルの判断をそのまま表している。復習キューには出てこない。
 */
function applyExamHorizon(params: {
  card: Card
  rating: Grade
  now: Date
  eventDate: string
  examDate?: string | null
  wVersion?: number
  /** 通常の保持率で出した予定日（クリップ前）。 */
  rawDue: string
}): { due: string | null; card: Card | null } {
  const { card, rating, now, eventDate, examDate, wVersion, rawDue } = params
  if (!examDate) return { due: rawDue, card: null }

  const daysToExam = diffDays(eventDate, examDate)
  if (daysToExam <= 0) return { due: rawDue, card: null } // 試験日当日/経過後は素通し
  // 試験前日に記録した時点で、復習できる日はもう残っていない。
  if (daysToExam <= LAST_REVIEW_LEAD_DAYS) return { due: null, card: null }

  if (rawDue < examDate) return { due: clipDueToExam(rawDue, eventDate, examDate), card: null }

  // 試験日を越えた → 直前期の基準（0.90）で引き直す。
  const endgame = schedulerFor(RETENTION_ENDGAME, wVersion).repeat(card, now)[rating].card
  const endgameDue = endgame.due.toISOString().split('T')[0]
  // 直前期テーパーの範囲内では、モデルが安全と言っても必ず1回は入れる。
  // ここを「触れない」にすると、テーパーが防ごうとした
  // 「直前に間隔が開きすぎて忘れる」をそのまま招く（§7.3）。
  if (endgameDue < examDate || daysToExam <= TAPER_FROM_DAYS) {
    return { due: clipDueToExam(endgameDue, eventDate, examDate), card: endgame }
  }
  // 0.90 でも越える ＝ 試験日時点で基準を満たす。触れない。
  return { due: rawDue, card: null }
}

// eventDate = 実施日（過去日でもよい）。未指定なら今日。
// examDate を渡すと due を試験日クリップする（§7.3）。
//
// retention = その記録に適用する目標保持率（adaptive-fsrs-policy.md §3.4・Phase C）。
// 省略時は従来どおり `retentionFor(実施日, 試験日)`＝日付だけで決まる値を使う。
// 明示的に渡す経路は2つだけで、どちらも「その記録に紐づく1つの値」を運ぶためにある:
//   ① 記録時（App.tsx）… ポリシーが決めた保持率を使い、同じ値を履歴へ書き残す
//   ② 再生時（deriveFromHistory）… 履歴に書かれた値をそのまま使う
// この2つが一致するので、何度再生しても結果が変わらない（決定的）。
export function calcFSRS(
  current: Partial<Review> | null,
  status: Status,
  eventDate?: string,
  examDate?: string | null,
  retention?: number,
  wVersion?: number,
) {
  if (status === '未着手') return {}
  // 実施日未指定なら JST基準の「今日」を使う（UTC日付ズレ防止）
  const eDate = eventDate ?? todayJST()
  // S（完璧に理解・復習不要）: 通常の復習キューからは外し、試験前の最終確認だけ残す。
  // stability 等の FSRS 値は現状のまま温存するので、後で復習に戻す（due_date 再設定）／
  // A・B・C で再採点したときに、それまでの学習履歴を失わずスケジューリングを再開できる。
  if (status === 'S') return { due_date: finalCheckDue(eDate, examDate), last_reviewed: eDate }
  const rating = RATING_MAP[status]
  const now = dateAtUTCNoon(eDate)
  const card = current && (current.repetitions ?? 0) > 0
    ? toFSRSCard(current, now)
    : createEmptyCard(now)
  const newCard = schedulerFor(retention ?? retentionFor(eDate, examDate), wVersion)
    .repeat(card, now)[rating].card
  const rawDue = newCard.due.toISOString().split('T')[0]
  const horizon = applyExamHorizon({
    card, rating, now, eventDate: eDate, examDate, wVersion, rawDue,
  })
  // 直前期の基準で引き直した場合は、その結果の安定度・難易度を採る
  // （保持率は間隔だけでなく状態の記録にも影響しないが、同じカードから一貫して取る）。
  const applied = horizon.card ?? newCard
  return {
    stability: applied.stability,
    difficulty_fsrs: applied.difficulty,
    repetitions: applied.reps,
    lapses: applied.lapses,
    due_date: horizon.due,
    last_reviewed: eDate,
    fsrs_state: applied.state,
  }
}

// review_history を実施日順に再生し、FSRS・初回/実施日・ステータスを一括導出する。
// 記録・取消のどちらでも履歴と各フィールドが常に一致する。
// examDate を渡すと各ステップの due を試験日クリップする（§7.3）。
//
// 【決定的再生・§3.4】各ステップの目標保持率は、その記録が持つ `policy.retention` を最優先で
// 使う。持たない旧データは `retentionFor(実施日, 試験日)` へフォールバックするので、
// **Phase C 以前に記録された履歴の再生結果は改修前と完全に一致する**（後方互換）。
// この仕組み無しにポリシーをスケジューリングへ流すと、ポリシーが変わるたびに過去の
// 予定日が毎日書き換わる。層3を実装する前提条件（設計書 §6 の「この仕組み無しに
// 層3を実装してはならない」）がこの1行である。
export function deriveFromHistory(history: ReviewHistoryEntry[], examDate?: string | null) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  let acc: Partial<Review> = {
    stability: 0, difficulty_fsrs: 5, repetitions: 0, lapses: 0,
    due_date: null, last_reviewed: null, fsrs_state: State.New,
  }
  for (const e of sorted) {
    acc = { ...acc, ...calcFSRS(acc, e.status, e.date, examDate, e.policy?.retention, e.policy?.w_version) }
  }
  return {
    stability: acc.stability ?? 0,
    difficulty_fsrs: acc.difficulty_fsrs ?? 5,
    repetitions: acc.repetitions ?? 0,
    lapses: acc.lapses ?? 0,
    due_date: acc.due_date ?? null,
    fsrs_state: acc.fsrs_state ?? State.New,
    review_history: sorted,
    first_reviewed: sorted.length ? sorted[0].date : null,
    last_reviewed: sorted.length ? sorted[sorted.length - 1].date : null,
    status: (sorted.length ? sorted[sorted.length - 1].status : '未着手') as Status,
  }
}

// 現在の想起確率 R（0..1）。復習キューの価値・リスク帯の算定に使う（reviewPlan.ts）。
// FSRS の忘却曲線から「今この瞬間まだ正解できる確率」を求める。
// 対象外（未学習=repetitions 0／S 等で due_date 無し）は null を返す。
export function retrievability(review: Partial<Review> | null | undefined, today?: string): number | null {
  if (!review || (review.repetitions ?? 0) <= 0) return null
  if (!review.due_date) return null
  const now = dateAtUTCNoon(today ?? todayJST())
  // get_retrievability は忘却曲線そのもので request_retention には依存しないが、
  // **w[] には依存する**（減衰の形が変わる）。そのカードを最後にスケジュールした版で引く。
  // ここを既定パラメータ固定にすると、学習済みパラメータでスケジュールした問題の
  // リスク帯（🔴優先）だけが別の曲線で判定され、帯が優先度として機能しなくなる。
  const history = review.review_history
  const wVersion = history?.length ? history[history.length - 1].policy?.w_version : undefined
  const r = schedulerFor(RETENTION_DEFAULT, wVersion)
    .get_retrievability(toFSRSCard(review, now), now, false)
  return typeof r === 'number' ? r : null
}

export function defaultReview(questionId: string): Review {
  return {
    question_id: questionId, status: '未着手',
    stability: 0, difficulty_fsrs: 5,
    due_date: null, repetitions: 0, lapses: 0,
    last_reviewed: null, fsrs_state: State.New,
    tags: [], memo: '',
    review_history: [], first_reviewed: null,
  }
}
