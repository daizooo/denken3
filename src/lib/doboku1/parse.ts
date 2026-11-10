// 公式PDF（試験問題A/B・正答肢）から抽出したテキストを構造化する純関数（docs/design/doboku1-ichiji.md §6 T2）。
// 抽出は scripts/doboku1/extract.py（ルビを除き、同じ行の文字を連結）。式・図を含む問は自動では崩れるため、
// 書き起こしの補正（overrides）で上書きする前提（validate.ts の検証ゲートで検出する）。
import type { Direction, Paper, ParsedQuestion, QuestionKind } from './types.ts'

const CHOICE_MARKS = ['⑴', '⑵', '⑶', '⑷'] as const
const STATEMENT_MARKS = ['①', '②', '③', '④'] as const
const BLANK_LABELS = ['イ', 'ロ', 'ハ', 'ニ', 'ホ'] as const

/** ページ区切り・ページ番号・注意書き（※）を落とす。 */
function isNoise(line: string): boolean {
  const t = line.trim()
  return t === '' || /^=== page \d+/.test(t) || /^―\s*\d+\s*―$/.test(t) || t.startsWith('※')
    || /^(て|ください。)/.test(t) && t.length < 12
}

/** 折り返しで分かれた行を連結する。箇条書き（・）と「ただし」「また，」は段落を分ける。 */
export function joinWrapped(lines: string[]): string {
  let out = ''
  for (const raw of lines) {
    const l = raw.trim()
    if (!l) continue
    if (out && (/^[・]/.test(l) || /^(ただし|また，)/.test(l))) out += '\n'
    out += l
  }
  return out
}

/** 空欄（全角空白＋記号）を ［イ］ に正規化する。空欄を説明する「　　 の」は ［ ］ にする。 */
export function normalizeBlanks(s: string): string {
  let t = s
  for (const b of BLANK_LABELS) t = t.replace(new RegExp(`[\\s　]+${b}[\\s　]+`, 'g'), `［${b}］`)
  return t.replace(/文章中の[\s　]+の/g, '文章中の［　］の')
}

/** 表形式の選択肢を列に分ける（3つ以上の空白で区切る）。 */
function splitColumns(s: string): string[] {
  const cols = s.trim().split(/\s{3,}|　{2,}/).map(c => c.trim()).filter(Boolean)
  return cols.length ? cols : [s.trim()]
}

export function detectDirection(stem: string): Direction {
  return /適当でないもの|誤っているもの|正しくないもの/.test(stem) ? 'wrong' : 'right'
}

function detectKind(stem: string, statements: string[], choices: string[][]): QuestionKind {
  if (statements.length > 0) return 'statements'
  if (/当てはまる/.test(stem) && /組合せ/.test(stem)) return 'fill'
  if (/式|値|順に|並べ/.test(stem) && choices.every(c => c.join('').length < 40)) return 'calc'
  return 'single'
}

/** 問題冊子のテキスト全体 → 問の配列。 */
export function parseQuestions(text: string, paper: Paper): ParsedQuestion[] {
  const parts = text.split(/【No\.\s*(\d+)】/)
  const out: ParsedQuestion[] = []
  for (let i = 1; i < parts.length; i += 2) {
    const no = Number(parts[i])
    const lines = parts[i + 1].split('\n').filter(l => !isNoise(l))
    const stemLines: string[] = []
    const statements: string[][] = []
    const choices: string[][] = []   // 行のまま。最後に連結・列分割する
    let header: string[] = []
    let mode: 'stem' | 'stmt' | 'choice' = 'stem'
    for (const line of lines) {
      const t = line.trim()
      const c = CHOICE_MARKS.findIndex(m => t.startsWith(m))
      const s = STATEMENT_MARKS.findIndex(m => t.startsWith(m))
      if (c >= 0) { mode = 'choice'; choices.push([t.slice(1).trim()]); continue }
      if (s >= 0 && mode !== 'choice') { mode = 'stmt'; statements.push([t.slice(1).trim()]); continue }
      // 選択肢の直前の見出し行（イ ロ ハ ニ ／ ［湿潤密度］ など）
      if (mode !== 'choice' && /^(［[^］]+］\s*){2,}$|^([イロハニホ]\s+)+[イロハニホ]$/.test(t)) {
        header = t.split(/(?<=］)\s*|\s+/).map(h => h.trim()).filter(Boolean); continue
      }
      if (mode === 'choice') choices[choices.length - 1].push(t)
      else if (mode === 'stmt') statements[statements.length - 1].push(t)
      else stemLines.push(line)
    }
    const stem = normalizeBlanks(joinWrapped(stemLines))
    const stmts = statements.map(l => joinWrapped(l))
    const tabular = header.length >= 2
    const chs = choices.map(l => tabular ? splitColumns(l.join('   ')) : [joinWrapped(l)])
    out.push({
      paper, no, stem,
      statements: stmts,
      choiceHeader: header,
      choices: chs,
      direction: detectDirection(stem),
      kind: detectKind(stem, stmts, chs),
      hasFigure: /下図|図に示す|図の|模式図/.test(stem),
    })
  }
  return out
}

/**
 * 正答肢PDFのテキスト（PyMuPDF の get_text: 番号の並び → 解答の並び が交互）→ { A: Map, B: Map }。
 * 「問題番号」の後の連続する数字列を番号、その次の同じ長さの列を解答として読む。
 * A の表が先、B の表が後（「問題番号No.1〜No.35は全問解答」の注記で B の終わりを確かめる）。
 */
export function parseAnswerKey(text: string): Record<Paper, Map<number, number>> {
  const nums = text.split('\n').map(l => l.trim()).filter(l => /^\d{1,2}$/.test(l)).map(Number)
  const result: Record<Paper, Map<number, number>> = { A: new Map(), B: new Map() }
  let paper: Paper = 'A'
  let i = 0
  while (i < nums.length) {
    // 番号列: 前の値+1 が続く並び
    let j = i + 1
    while (j < nums.length && nums[j] === nums[j - 1] + 1) j++
    const ids = nums.slice(i, j)
    const ans = nums.slice(j, j + ids.length)
    if (ans.length < ids.length || ans.some(a => a < 1 || a > 4)) break
    if (ids[0] === 1 && result.A.size > 0) paper = 'B'
    ids.forEach((no, k) => result[paper].set(no, ans[k]))
    i = j + ids.length
  }
  return result
}
