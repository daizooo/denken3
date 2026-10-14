// 法改正の影響を受けやすい肢の自動判定（licensehub-expansion.md §9・PR-K）。純関数。
//
// 数値・期間・金額・年齢・割合・「〜日以内」などを含む肢を review 候補にする。判定は「候補を拾う」ためのもので、
// 取りこぼしより拾いすぎを許す（最終判定は Claude Code が根拠条文で行う。docs/license-law-review.md）。
//
// 規則（LAW_RISK_RULES）は JS の RegExp と PostgreSQL の正規表現（ARE、`~`）の両方でそのまま使える書き方に限る
// （文字クラス・選択・量指定子・否定先読みだけ。\d や後読みは使わない）。lawRiskSql.ts が同じ規則を SQL に埋め込み、
// DB 上の本文で同じ判定をする（本文をリポジトリやスクリプトに持ち出さないため。§4.1）。
import type { AnswerSpec, LawStatus } from '../../domain/license'

/** 法令の基準日（官報公告日）の既定値。令和8年は 4/10（§9）。利用者の設定（denken_settings.law_base_date）が優先。 */
export const DEFAULT_LAW_BASE_DATE = '2026-04-10'

/** 自動判定が law_note に書く見出し。冪等性（二重追記しない）とロールバックの目印に使う。 */
export const LAW_RISK_MARKER = '[法改正の自動判定]'

// 数（算用数字・全角数字・漢数字）。「一時金」「十分」のような語に当たらないよう、単位と組でだけ使う。
const N = '[0-9０-９〇一二三四五六七八九十百千万億.,．，]+'
const DIGIT = '[0-9０-９]'

export interface LawRiskRule {
  /** 識別子（SQL の並び順・テストに使う）。 */
  code: string
  /** law_note・一覧に出す名前。 */
  label: string
  /** JS・PostgreSQL 共通の正規表現。 */
  pattern: string
}

export const LAW_RISK_RULES: readonly LawRiskRule[] = [
  { code: 'period', label: '期間', pattern: `${N}(日|週間|か月|ヶ月|箇月|カ月|月|年|年度)(以内|以上|以下|未満|を超え|前|後|経過|間|ごと|分)` },
  { code: 'amount', label: '金額', pattern: `${N}円` },
  { code: 'age', label: '年齢', pattern: `${N}歳` },
  { code: 'ratio', label: '割合', pattern: `(${N}(パーセント|％|%|割)|${N}分の${N})` },
  { code: 'time', label: '時間', pattern: `${N}(時間|分間|時から|時まで)` },
  { code: 'count', label: '人数・回数', pattern: `${N}(人以|人を|人未満|回|件|倍|等級|週)` },
  { code: 'date', label: '改正・施行', pattern: `((令和|平成|昭和)[0-9０-９〇一二三四五六七八九十元]+年|改正|施行|新設|廃止)` },
  // 上のどれにも当たらない算用数字（条・項・号の番号は除く）
  { code: 'number', label: '数値', pattern: `${DIGIT}+(?![0-9０-９]|条|項|号)` },
]

const COMPILED = LAW_RISK_RULES.map(r => ({ ...r, re: new RegExp(r.pattern) }))

/** 本文が当たった規則の名前（規則の並び順）。当たらなければ空。 */
export function flagLawRisk(text: string): string[] {
  return COMPILED.filter(r => r.re.test(text)).map(r => r.label)
}

/**
 * 判定に使う本文。選択式の空欄は、空欄入りの文に正答の語句を足す（「6か月」のように数値は空欄側にあることが多い）。
 * lawRiskSql.ts の SQL も同じ組み立てをする。
 */
export function lawRiskText(
  item: { label: string; statement: string },
  answerSpec: AnswerSpec | null | undefined,
): string {
  if (answerSpec?.kind !== 'sentaku') return item.statement
  const n = answerSpec.blanks[item.label as keyof typeof answerSpec.blanks]
  const word = n === undefined ? '' : (answerSpec.wordbank[String(n)] ?? '')
  return `${item.statement} ${word}`
}

/** 自動判定が付ける注記（1行）。 */
export function lawRiskNote(reasons: string[], baseDate: string): string {
  return `${LAW_RISK_MARKER} 法令基準日 ${baseDate} 時点で要確認（${reasons.join('・')}）`
}

/**
 * law_note に追記する（既存の注記——問題誤りの公表の内容など——は消さない）。
 * 同じ行がすでにあれば何もしない。
 */
export function appendLawNote(existing: string | null | undefined, addition: string): string {
  const add = addition.trim()
  const prev = (existing ?? '').trim()
  if (add === '') return prev
  if (prev === '') return add
  if (prev.split('\n').some(l => l.trim() === add)) return prev
  return `${prev}\n${add}`
}

export interface LawRiskInput {
  id: string
  label: string
  statement: string
  law_status: LawStatus
  law_note: string | null
  answer_spec?: AnswerSpec | null
}

export interface LawRiskCandidate {
  id: string
  reasons: string[]
  /** 更新後の law_note（既存の注記を残して追記）。 */
  law_note: string
}

/**
 * review 候補を選ぶ。対象は law_status='unchecked' の肢だけ（ok・review・excluded は触らない＝冪等）。
 * すでに自動判定の注記がある肢は注記を足さない。
 */
export function pickLawRiskCandidates(items: LawRiskInput[], baseDate: string): LawRiskCandidate[] {
  const out: LawRiskCandidate[] = []
  for (const it of items) {
    if (it.law_status !== 'unchecked') continue
    const reasons = flagLawRisk(lawRiskText(it, it.answer_spec))
    if (reasons.length === 0) continue
    const already = (it.law_note ?? '').includes(LAW_RISK_MARKER)
    out.push({
      id: it.id,
      reasons,
      law_note: already ? (it.law_note ?? '') : appendLawNote(it.law_note, lawRiskNote(reasons, baseDate)),
    })
  }
  return out
}
