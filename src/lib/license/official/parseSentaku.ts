// 選択式の抽出テキスト → 構造化（licensehub-expansion.md §6.4・§13・PR-D）。純関数。
//
// 想定する並び（pdftotext の出力）:
//   〔問 1〕 次の文中の［ ］の部分を選択肢の中の最も適切な語句で埋め、完全な文章とせよ。
//   労働基準法及び労働安全衛生法            ← 科目の見出し（無ければ問番号 1〜8 を科目の並びに当てる）
//   …本文… Ａ …本文…                       ← 空欄は前後が空白・括弧の英大文字1字（A〜E / Ａ〜Ｅ）
//   ① 語句 ② 語句 … ⑳ 語句                  ← 語群（最初の ① から科目の終わりまで）
// 1科目＝1問。空欄は本文中で ［A］ の形にそろえる。
import type { ItemLabel } from '../../../domain/license.ts'
import { normalizeLabel } from '../../../domain/license.ts'
import { headingSubject, SENTAKU_ORDER } from './subjects.ts'
import { circledToNumber, joinLines, splitLines, toHalfWidth } from './text.ts'
import type { OfficialIssue, OfficialSentakuQuestion } from './types.ts'

const Q_HEAD_RE = /^[〔[［(（]?\s*問\s*(\d{1,2})\s*[〕\]］)）]?\s*(.*)$/
// 空欄: 括弧・□ で囲まれた A〜E 1字か、前後が行頭・行末・空白・丸括弧で区切られた A〜E 1字（「Ａ社」は空欄にしない）
const BLANK_RE = /[［[【□][\s\u3000]*([A-EＡ-Ｅ])[\s\u3000]*[］\]】□]|(^|[\s\u3000（(])([A-EＡ-Ｅ])(?=[\s\u3000）)]|$)/g

interface Block { code: string; lines: string[] }

function splitBlocks(lines: string[], year: string, issues: OfficialIssue[]): Block[] {
  const blocks: Block[] = []
  let block: Block | null = null
  const open = (code: string) => {
    if (block && block.code === code) return
    if (blocks.some(b => b.code === code)) {
      issues.push({ level: 'error', where: `${year} 選択式 ${code}`, reason: '同じ科目が2回現れた（見出しの読み違いの疑い）' })
    }
    block = { code, lines: [] }
    blocks.push(block)
  }
  let pending: string | null = null   // 最初の問より前の見出し（表紙の略記凡例の法令名を見出しと取り違えないよう、問が来るまで開かない）
  for (const line of lines) {
    const h = headingSubject(line, 'sentaku')
    if (h && blocks.length === 0) { pending = h; continue }
    if (h) { open(h); continue }
    const m = toHalfWidth(line).match(Q_HEAD_RE)
    if (m && blocks.length === 0 && Number(m[1]) === 1) {
      open(pending ?? SENTAKU_ORDER[0])
      continue
    }
    if (m && block && Number(m[1]) === blocks.length && (block as Block).code === SENTAKU_ORDER[blocks.length - 1]) {
      continue   // 見出しの後に来た問番号の行（指示文）
    }
    if (m && Number(m[1]) === blocks.length + 1 && SENTAKU_ORDER[blocks.length]) {
      // 問番号の行。見出しが後に来る場合に備えて、まず並び順の科目として開く
      open(SENTAKU_ORDER[blocks.length])
      continue   // 指示文（「次の文中の…完全な文章とせよ。」）は本文に入れない
    }
    if (block) (block as Block).lines.push(line)
  }
  return blocks
}

// 段落番号（行頭の「1 」「2 」… の連番）で段落に分け、段落ごとに折り返しを詰めて「1 …。2 …」の形にする
function joinParagraphs(lines: string[]): string {
  const paras: { no: number | null; lines: string[] }[] = [{ no: null, lines: [] }]
  for (const line of lines) {
    const m = toHalfWidth(line).match(/^(\d{1,2})[\s\u3000]+/)
    const last = paras[paras.length - 1]
    if (m && Number(m[1]) === (paras.filter(p => p.no !== null).length + 1)) {
      paras.push({ no: Number(m[1]), lines: [line.slice(m[0].length)] })
    } else last.lines.push(line)
  }
  return paras.map(p => (p.no === null ? joinLines(p.lines) : `${p.no} ${joinLines(p.lines)}`)).filter(s => s !== '').join('')
}

// 空欄ごとの語群の行（「Ａ ① 365日分 ② 600日分 …」。R6 は「Ａ」だけの行の次に語群が続く）
const GROUP_RE = /^([A-EＡ-Ｅ])(?:[\s\u3000]*(?=[①-⑳])|$)/

function toQuestion(b: Block): OfficialSentakuQuestion {
  // 語群は「選択肢」の見出しの次の行から（本文の判決文などに ① が現れる年度がある）。見出しが無ければ最初の ① の行から
  const heading = b.lines.findIndex(l => l.replace(/[\s\u3000]/g, '') === '選択肢')
  const firstBank = heading >= 0 ? heading + 1 : b.lines.findIndex(l => /[①-⑳]/.test(l))
  const stemLines = firstBank < 0 ? b.lines : b.lines.slice(0, firstBank)
  const bankLines = firstBank < 0 ? [] : b.lines.slice(firstBank)

  const blanks: ItemLabel[] = []
  const marked = stemLines.map(l => l.replace(BLANK_RE, (_all, boxed?: string, pre?: string, bare?: string) => {
    const label = normalizeLabel((boxed ?? bare)!)!
    if (!blanks.includes(label)) blanks.push(label)   // 同じ空欄が本文に複数回出る問がある（初出の順に1つ）
    return `${pre ?? ''}［${label}］`
  }))
  const stem = joinParagraphs(marked)
    .replace(/\s*［([A-E])］\s*/g, '［$1］')
    .replace(/^[^。]*?文章とせよ。/, '')   // 指示文の続き（「次の文中の…完全な文章とせよ。」の折り返し）
    .replace(/選択肢$/, '')               // 語群の見出し
    .trim()

  const wordbank: Record<string, string> = {}
  if (bankLines.some(l => GROUP_RE.test(l))) {
    // 空欄ごとの語群: 通し番号（A の①〜④ → 1〜4、B の①〜④ → 5〜8 …）にそろえ、空欄 → 番号を groups に持つ
    // 語句が行をまたぐ（「③ 1，」「000日分 ④ …」）ので、空欄ごとに行をつないでから読む
    const texts: { label: ItemLabel; lines: string[] }[] = []
    for (const line of bankLines) {
      const g = line.match(GROUP_RE)
      if (g) texts.push({ label: normalizeLabel(g[1])!, lines: [line.slice(g[0].length)] })
      else texts[texts.length - 1]?.lines.push(line)
    }
    const groups: Partial<Record<ItemLabel, number[]>> = {}
    let seq = 0
    for (const t of texts) {
      for (const m of t.lines.join(' ').matchAll(/([①-⑳])([^①-⑳]*)/g)) {
        wordbank[String(++seq)] = joinLines([m[2]])
        ;(groups[t.label] ??= []).push(seq)
      }
    }
    return { scoredSubject: b.code, stem, blanks, wordbank, groups }
  }
  const bank = bankLines.join(' ')
  for (const m of bank.matchAll(/([①-⑳])([^①-⑳]*)/g)) {
    const n = circledToNumber(m[1])
    const word = joinLines([m[2]])
    if (n !== null) wordbank[String(n)] = word
  }
  return { scoredSubject: b.code, stem, blanks, wordbank }
}

export function parseSentakuText(text: string, year: string): { questions: OfficialSentakuQuestion[]; issues: OfficialIssue[] } {
  const issues: OfficialIssue[] = []
  const blocks = splitBlocks(splitLines(text), year, issues)
  return { questions: blocks.map(toQuestion), issues }
}

// 空欄 X を含む文（本文を「。」で区切った1文）。空欄のカード（lic_items.statement）に使う。
export function sentenceWithBlank(stem: string, label: ItemLabel): string {
  const sentences = stem.split(/(?<=。)/)
  const found = sentences.find(s => s.includes(`［${label}］`)) ?? stem
  return found.trim().replace(/^[0-9０-９]+[\s\u3000]+/, '')   // 段落番号（「2 」）は落とす
}
