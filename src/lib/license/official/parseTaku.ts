// 択一式の抽出テキスト → 構造化（licensehub-expansion.md §13・PR-D）。純関数。
//
// 想定する並び（pdftotext の出力）:
//   労働基準法及び労働安全衛生法            ← 科目の見出し（無ければ問1の出現で次の科目に進む）
//   〔問 1〕 労働基準法に関する次の記述のうち、誤っているものはどれか。
//   Ａ …（折り返しは次の行に続く）
//   Ｂ … 〜 Ｅ …
//   〔問 2〕 … 次のアからオの記述のうち、正しいものの組合せは、後記ＡからＥまでのうちどれか。
//   ア … 〜 オ …
//   Ａ（アとイ） Ｂ（アとウ） Ｃ（イとエ） Ｄ（ウとオ） Ｅ（エとオ）
//   〔問 3〕 … 正しいものはいくつあるか。 ア〜オ ＋ 「Ａ 一つ Ｂ 二つ …」
// 問番号は科目ごと（1〜10）でも通し（1〜70）でも読める。読めなかった問・肢は検証ゲートで理由つきの失敗になる。
import type { ItemLabel } from '../../../domain/license.ts'
import { ITEM_LABELS, normalizeLabel } from '../../../domain/license.ts'
import { headingSubject, TAKU_ORDER, TAKU_QUESTIONS_PER_SUBJECT } from './subjects.ts'
import { joinLines, splitLines, toHalfWidth } from './text.ts'
import type { Direction, OfficialIssue, OfficialTakuItem, OfficialTakuQuestion, TakuKind } from './types.ts'

const Q_HEAD_RE = /^[〔[［(（]?\s*問\s*(\d{1,2})\s*[〕\]］)）]?\s*(.*)$/
const KANA: readonly string[] = ['ア', 'イ', 'ウ', 'エ', 'オ']
const SPACE = '[\\s\\u3000]'

interface Block { code: string; qNo: number; lines: string[] }

// テキストを問ごとの行のまとまりに分ける
function splitBlocks(lines: string[], year: string, issues: OfficialIssue[]): Block[] {
  const blocks: Block[] = []
  const started = new Map<string, number>()   // 科目 → 始まった問数
  let current: string | null = null
  let block: Block | null = null
  const nextSubject = () => TAKU_ORDER.find(c => !started.has(c)) ?? null

  for (const line of lines) {
    const h = headingSubject(line, 'taku')
    // 見出しの後ろ（次の問まで）は見出しの括弧書きの折り返し（「（労働保険の…を含む。」「）」）。前の問に入れない
    if (h) { current = h; block = null; continue }
    const m = toHalfWidth(line).match(Q_HEAD_RE)
    if (m) {
      const n = Number(m[1])
      const rest = line.slice(line.length - m[2].length)
      let target: { code: string; qNo: number } | null = null
      if (n > TAKU_QUESTIONS_PER_SUBJECT && n === blocks.length + 1) {
        // 通し番号（問11〜70）
        const code = TAKU_ORDER[Math.floor((n - 1) / TAKU_QUESTIONS_PER_SUBJECT)]
        if (code) target = { code, qNo: ((n - 1) % TAKU_QUESTIONS_PER_SUBJECT) + 1 }
      } else if (current && n === (started.get(current) ?? 0) + 1) {
        target = { code: current, qNo: n }
      } else if (n === 1) {
        // 見出しが読めなかった: 科目の並びで次の科目に進む
        const code = nextSubject()
        if (code) target = { code, qNo: 1 }
      }
      if (target) {
        current = target.code
        started.set(target.code, target.qNo)
        block = { ...target, lines: rest ? [rest] : [] }
        blocks.push(block)
        continue
      }
      issues.push({ level: 'warning', where: `${year} 択一 ${current ?? '?'}`, reason: `問番号の並びが合わない行を本文として扱った: ${line.slice(0, 30)}` })
    }
    if (block) block.lines.push(line)
  }
  return blocks
}

function markerRe(label: string, loose: boolean): RegExp {
  const half = label
  const full = /[A-E]/.test(label) ? String.fromCharCode(label.charCodeAt(0) + 0xfee0) : label
  const after = loose ? '(?![A-Za-zＡ-Ｚａ-ｚ0-9０-９])' : `(?:${SPACE}+|$)`
  return new RegExp(`^[${half}${full}]${after}${SPACE}*`)
}

const CHOICE_START_RE = /^[AＡ](?:[\s\u3000（(]|[一二三四五]つ|なし)/

interface Split { lead: string[]; items: { labelRaw: string; lines: string[] }[]; choices: string[] }

// minItems: 選択肢（Ａ…）の始まりと見る肢の数。○×の組合せは肢が5つより少ない（R6 はア〜ウ）
function splitItems(lines: string[], kana: boolean, loose: boolean, minItems = 5): Split {
  const labels = kana ? KANA : (ITEM_LABELS as readonly string[])
  const out: Split = { lead: [], items: [], choices: [] }
  let inChoices = false
  for (const line of lines) {
    if (inChoices) { out.choices.push(line); continue }
    if (kana && out.items.length >= minItems && CHOICE_START_RE.test(line)) {
      inChoices = true
      out.choices.push(line)
      continue
    }
    const next = labels[out.items.length]
    const m = next ? line.match(markerRe(next, loose)) : null
    if (m) {
      out.items.push({ labelRaw: next, lines: [line.slice(m[0].length)] })
    } else if (out.items.length === 0) {
      out.lead.push(line)
    } else {
      out.items[out.items.length - 1].lines.push(line)
    }
  }
  return out
}

// 「正しいものには○、誤っているものには×を付した場合の組合せ」
const MARKS_RE = /[○〇][^。]*[×✕][^。]*(?:組合せ|組み合わせ)/

function detectKind(lead: string): TakuKind {
  if (MARKS_RE.test(lead)) return 'marks'
  if (/組合せ|組み合わせ/.test(lead)) return 'combo'
  if (/いくつ|幾つ|個数|の数は/.test(lead)) return 'count'
  return 'one'
}

// 問いの文（最後の「〜か。」）から、誤り／正しいを選ぶ方向を読む
export function detectDirection(lead: string): Direction | null {
  const sentences = lead.split('。').filter(s => s.trim() !== '')
  const ask = [...sentences].reverse().find(s => /か$|か[）)]?$/.test(s.trim())) ?? lead
  if (/誤っている|誤りである|誤りの|正しくない|妥当でない|適切でない|不適切/.test(ask)) return 'wrong'
  if (/正しい|妥当な|適切な/.test(ask)) return 'right'
  // 「業務災害として保険給付の対象となるものはいくつあるか」「…に含まれない行為はどれか」: 条件に当たる肢を ○ とする
  if (/(?:となら|に該当し|に当たら|と認められ|に含まれ|ことができ)ない(?:もの|行為)/.test(ask)) return 'wrong'
  if (/(?:となる|に該当する|に当たる|と認められる|に含まれる|ことができる)(?:もの|行為)/.test(ask)) return 'right'
  return null
}

const COUNT_WORDS: Record<string, number> = {
  'なし': 0, '一つ': 1, '二つ': 2, '三つ': 3, '四つ': 4, '五つ': 5,
  '1つ': 1, '2つ': 2, '3つ': 3, '4つ': 4, '5つ': 5,
}

function parseChoices(text: string, kind: TakuKind): { choices: string[]; comboPairs: ItemLabel[][] | null; countOptions: number[] | null; markPatterns?: boolean[][] } {
  const t = toHalfWidth(text)
  if (kind === 'marks') {
    // Ａ（ア○ イ○ ウ×）: 肢の印の順（ア→オ）に ○× を読む。印の並びが ア から連続しない選択肢は読まない（ゲートで失敗）
    const found = [...t.matchAll(/([A-E])\s*[（(]\s*((?:[ア-オ]\s*[○〇×✕]\s*)+)[）)]/g)]
    const patterns: boolean[][] = []
    for (const m of found) {
      const marks = [...m[2].matchAll(/([ア-オ])\s*([○〇×✕])/g)]
      if (marks.every((x, i) => x[1] === KANA[i])) patterns.push(marks.map(x => x[2] === '○' || x[2] === '〇'))
    }
    return {
      choices: found.map(m => m[2].replace(/\s+/g, ' ').trim()),
      comboPairs: null, countOptions: null, markPatterns: patterns,
    }
  }
  if (kind === 'combo') {
    const re = /([A-E])\s*[（(]?\s*([ア-オ])\s*(?:と|及び|・|、|,)\s*([ア-オ])\s*[）)]?/g
    const found = [...t.matchAll(re)]
    return {
      choices: found.map(m => `${m[2]}と${m[3]}`),
      comboPairs: found.map(m => [normalizeLabel(m[2])!, normalizeLabel(m[3])!]),
      countOptions: null,
    }
  }
  if (kind === 'count') {
    const re = /([A-E])\s*(なし|[一二三四五1-5]つ)/g
    const found = [...t.matchAll(re)]
    return { choices: found.map(m => m[2]), comboPairs: null, countOptions: found.map(m => COUNT_WORDS[m[2]]) }
  }
  return { choices: [], comboPairs: null, countOptions: null }
}

function toQuestion(b: Block): OfficialTakuQuestion {
  // 最初の肢の印が ア なら 組合せ・個数の問（肢はア〜オ、選択肢がA〜E）
  const firstMarker = b.lines.find(l => markerRe('ア', false).test(l) || markerRe('A', false).test(l))
  const kana = !!firstMarker && markerRe('ア', false).test(firstMarker)
  let s = splitItems(b.lines, kana, false)
  if (s.items.length < 5) {
    const loose = splitItems(b.lines, kana, true)
    if (loose.items.length > s.items.length) s = loose
  }
  let lead = joinLines(s.lead)
  let kind: TakuKind | null = detectKind(lead)
  if (kind === 'marks' && kana) {
    // ○×の組合せは肢が5つより少ない。3肢目以降に Ａ（…）が来たら選択肢として切る
    s = splitItems(b.lines, kana, false, 2)
    lead = joinLines(s.lead)
  }
  if (kana !== (kind !== 'one')) kind = null   // 肢の印と問型が食い違う
  const items: OfficialTakuItem[] = s.items.map(it => ({
    labelRaw: it.labelRaw,
    label: normalizeLabel(it.labelRaw)!,
    text: joinLines(it.lines),
  }))
  const c = kind ? parseChoices(s.choices.join(' '), kind) : { choices: [], comboPairs: null, countOptions: null }
  return {
    scoredSubject: b.code,
    qNo: b.qNo,
    kind,
    // ○×の組合せは「正しいものには○」で truth を直接決める（問いの文の「誤っている」に引きずられない）
    direction: kind === 'marks' ? 'right' : detectDirection(lead),
    lead,
    items,
    ...c,
  }
}

export function parseTakuText(text: string, year: string): { questions: OfficialTakuQuestion[]; issues: OfficialIssue[] } {
  const issues: OfficialIssue[] = []
  const blocks = splitBlocks(splitLines(text), year, issues)
  return { questions: blocks.map(toQuestion), issues }
}
