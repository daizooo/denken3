// 図解解説（Explain）の検証と、SVG 図の安全な表示形式（docs/design/doboku1-ichiji.md §6.5）。
// 正答と食い違う解説・壊れた図は保存しない（build.ts・explain-sql.mjs のゲート）。
import type { Direction, Explain, ExplainFigure, QuestionKind } from './types.ts'

/** 検証に使う問の情報（DB 行・構造化結果のどちらからでも作れる最小形）。 */
export interface ExplainTarget {
  kind: QuestionKind
  direction: Direction
  correct: number          // 1〜4
  choices: string[][]
}

export const CHOICE_LABELS = ['⑴', '⑵', '⑶', '⑷'] as const
export const STATEMENT_LABELS = ['①', '②', '③', '④'] as const

// 初学者向けに短く保つための上限（超えたら分割・削る）。
export const LIMITS = { point: 120, note: 80, figures: 2, rows: 8, steps: 8, columns: 4, svgBytes: 8000 } as const

/** SVG の安全確認。<img src="data:..."> で表示するためスクリプトは実行されないが、保存前に弾いておく。 */
export function svgProblems(svg: string): string[] {
  const p: string[] = []
  const s = svg.trim()
  if (!/^<svg[\s>]/.test(s) || !/<\/svg>$/.test(s)) p.push('<svg>…</svg> の形でない')
  if (!/\sviewBox="[\d.\s-]+"/.test(s)) p.push('viewBox がない（拡大縮小できない）')
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(s)) p.push('xmlns がない（img で表示できない）')
  if (/<script|<foreignObject|<iframe|<image|<use[\s>]/i.test(s)) p.push('使えない要素（script・foreignObject・image・use など）')
  if (/\son[a-z]+\s*=/i.test(s)) p.push('イベント属性（on…）')
  if (/(?:href|src)\s*=\s*["'](?!#)/i.test(s) || /javascript:|url\(\s*["']?(?!#)/i.test(s)) p.push('外部参照（href・src・url）')
  if (new TextEncoder().encode(s).length > LIMITS.svgBytes) p.push(`大きすぎる（${LIMITS.svgBytes} バイト超）`)
  return p
}

/** <img src> に渡す data URL。 */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`
}

function figureProblems(f: ExplainFigure, n: number): string[] {
  const at = `図${n}（${f.type}）`
  const p: string[] = []
  if (!f.title?.trim()) p.push(`${at}: 題がない`)
  switch (f.type) {
    case 'rule':
      if (f.rows.length === 0 || f.rows.length > LIMITS.rows) p.push(`${at}: 行数 ${f.rows.length}（1〜${LIMITS.rows}）`)
      if (f.rows.some(r => !r.label.trim() || !r.value.trim())) p.push(`${at}: 空の行`)
      break
    case 'flow':
      if (f.steps.length < 2 || f.steps.length > LIMITS.steps) p.push(`${at}: 手順数 ${f.steps.length}（2〜${LIMITS.steps}）`)
      if (f.steps.some(s => !s.trim())) p.push(`${at}: 空の手順`)
      for (const b of f.branches ?? []) {
        if (!Number.isInteger(b.from) || b.from < 0 || b.from >= f.steps.length) p.push(`${at}: 分岐の from=${b.from} が手順の範囲外`)
      }
      break
    case 'compare':
      if (f.columns.length < 1 || f.columns.length > LIMITS.columns) p.push(`${at}: 列数 ${f.columns.length}（1〜${LIMITS.columns}）`)
      if (f.rows.length === 0 || f.rows.length > LIMITS.rows) p.push(`${at}: 行数 ${f.rows.length}（1〜${LIMITS.rows}）`)
      if (f.rows.some(r => r.cells.length !== f.columns.length)) p.push(`${at}: セル数が列数と合わない`)
      break
    case 'svg':
      if (!f.alt?.trim()) p.push(`${at}: alt（図の説明文）がない`)
      for (const s of svgProblems(f.svg)) p.push(`${at}: ${s}`)
      break
    default:
      p.push(`${at}: 未知の型`)
  }
  return p
}

const CIRCLED = /[①②③④]/g

/**
 * statements 形式の正答肢が意味する「○ の記述」の条件。
 * - 組合せ（①③ など）: ○ の集合がその組と一致
 * - 数（2 つ など）: ○ の数が一致
 */
function statementsExpectation(choice: string): { set?: Set<number>; count?: number } | null {
  const marks = choice.match(CIRCLED)
  if (marks) return { set: new Set(marks.map(m => STATEMENT_LABELS.indexOf(m as typeof STATEMENT_LABELS[number]))) }
  const m = choice.replace(/\s/g, '').match(/^([1-4１-４])つ$/)
  if (m) return { count: Number(m[1].replace(/[１-４]/, d => String(d.charCodeAt(0) - 0xff10))) }
  return null
}

/** 解説の検証。空配列なら保存してよい。 */
export function explainProblems(ex: Explain, q: ExplainTarget): string[] {
  const p: string[] = []
  if (!ex.point?.trim()) p.push('論点がない')
  else if (ex.point.length > LIMITS.point) p.push(`論点が長い（${ex.point.length}字 > ${LIMITS.point}）`)
  if (ex.figures.length > LIMITS.figures) p.push(`図が ${ex.figures.length} 枚（0〜${LIMITS.figures}）`)
  ex.figures.forEach((f, i) => p.push(...figureProblems(f, i + 1)))

  const labels = q.kind === 'statements' ? STATEMENT_LABELS : CHOICE_LABELS
  if (ex.checks.length !== 4) {
    p.push(`肢チェックが ${ex.checks.length} 個（期待 4）`)
    return p
  }
  ex.checks.forEach((c, i) => {
    if (c.label !== labels[i]) p.push(`肢チェック${i + 1}: ラベル「${c.label}」（期待「${labels[i]}」）`)
    if (!c.note?.trim()) p.push(`肢チェック${labels[i]}: 一言がない`)
    else if (c.note.length > LIMITS.note) p.push(`肢チェック${labels[i]}: 一言が長い（${c.note.length}字 > ${LIMITS.note}）`)
  })

  if (!Number.isInteger(q.correct) || q.correct < 1 || q.correct > 4) {
    p.push(`正答 ${q.correct} が 1〜4 でない`)
    return p
  }
  if (q.kind === 'statements') {
    const exp = statementsExpectation((q.choices[q.correct - 1] ?? []).join(''))
    const okIdx = ex.checks.flatMap((c, i) => (c.ok ? [i] : []))
    // 「適当でないもの」を問う形なら × の記述が対象
    const target = q.direction === 'right' ? okIdx : ex.checks.flatMap((c, i) => (c.ok ? [] : [i]))
    if (!exp) p.push('正答肢から ○ の記述を読み取れない（組合せでも数でもない）')
    else if (exp.set && (exp.set.size !== target.length || target.some(i => !exp.set!.has(i)))) {
      p.push(`肢チェックの ○×（${target.map(i => STATEMENT_LABELS[i]).join('') || 'なし'}）が正答（${q.correct}）と食い違う`)
    } else if (exp.count !== undefined && exp.count !== target.length) {
      p.push(`肢チェックの ○ の数（${target.length}）が正答（${q.correct}＝${exp.count}つ）と食い違う`)
    }
  } else {
    // ⑴〜⑷: 正答肢だけが「選ぶべき肢」。適当なものを選ぶなら正答だけ ○、適当でないものなら正答だけ ×
    const bad = ex.checks.some((c, i) => c.ok !== ((i + 1 === q.correct) === (q.direction === 'right')))
    if (bad) p.push(`肢チェックの ○× が正答（${q.correct}）と食い違う`)
  }
  return p
}
