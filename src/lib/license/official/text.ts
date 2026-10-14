// 公式PDFから抽出したテキストの正規化と、文字化け（添字・記号の崩れ）の検出（licensehub-expansion.md §13・PR-D）。
//
// 抽出は pdftotext（poppler）などで行い、ここでは行単位のテキストだけを扱う（純関数）。
// 本文の全角英数は書き換えない（問題文の表記を変えない）。マーカー（問番号・肢ラベル・空欄）の判定にだけ半角化を使う。

// 全角英数字 → 半角（マーカーの判定用）
export function toHalfWidth(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

// 丸数字 ①〜⑳ → 1〜20。それ以外は null。
export function circledToNumber(c: string): number | null {
  const code = c.codePointAt(0) ?? 0
  return code >= 0x2460 && code <= 0x2473 ? code - 0x2460 + 1 : null
}

// ページ番号・改ページだけの行（本文ではない）
const NOISE_RE = /^[\s\-－—‐ー―]*[0-9０-９]+[\s\-－—‐ー―]*$/
const DASHED_PAGE_RE = /^[\-－—‐ー―]\s*[0-9０-９]+\s*[\-－—‐ー―]$/
// 組版のトンボ（「8043_102_TAKU01_M.indd 1 2025/07/12 4:15」）、日時だけの行、ページ送りの案内
const PRINT_MARK_RE = /\.indd\s+\d+|^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}$|^問題は次ページに続きます。?$/

// 数字の書体が下付き数字（₀〜₉）として抽出される PDF がある（R7/R8: 「第 ₁₂ 条」）。前後に通常の数字が無い
// 下付き数字の並びだけを半角数字に戻す（「１₂５」のように通常の数字と混ざったものは崩れとして残し、検出させる）。
export function restoreSubscriptDigits(line: string): string {
  return line.replace(/(?<![0-9０-９])[₀-₉]+(?![0-9０-９])/g, run => [...run].map(c => String(c.charCodeAt(0) - 0x2080)).join(''))
}

// テキストを行に分け、改ページ・ページ番号・トンボの行を除き、行頭・行末の空白を落とす。
// ページ番号の判定は下付き数字を戻す前に行う（折り返しで行頭に残った本文の数字「₁」をページ番号と取り違えない）。
// 改ページ（\f）を含むテキストでは、数字だけの行をページ番号とみなすのはページの最初と最後の行だけにする
// （「18．」「9」のように折り返しで数字だけになった本文の行を落とさない）。「－ 3 －」の形はどこでもページ番号。
export function splitLines(text: string): string[] {
  const trim = (l: string) => l.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
  const pages = text.replace(/\r\n?/g, '\n').split('\f')
  const lines = pages.flatMap(page => {
    const ls = page.split('\n').map(trim).filter(l => l !== '' && !PRINT_MARK_RE.test(l))
    return ls.filter((l, i) => !(pages.length === 1 || i === 0 || i === ls.length - 1 ? NOISE_RE : DASHED_PAGE_RE).test(l))
  })
  return dropVerticalNotes(lines).map(restoreSubscriptDigits)
}

// 縦書きの案内（「問題は次ページに続きます。」が1字ずつの行になる）を落とす
function dropVerticalNotes(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length;) {
    let j = i
    while (j < lines.length && [...lines[j]].length === 1) j++
    if (j - i >= 4 && /^問題は次/.test(lines.slice(i, j).join(''))) { i = j; continue }   // 縦書きの「ー」「。」は崩れて抽出されることがある
    if (j === i) j = i + 1
    out.push(...lines.slice(i, j))
    i = j
  }
  return out
}

const CJK = '\\u3000-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef（）「」、。'

// 折り返された行を1つの文にする。日本語どうしの間の空白は詰め、英数字どうしの間は空白1つを残す。
export function joinLines(lines: string[]): string {
  let out = ''
  for (const raw of lines) {
    const l = raw.trim()
    if (l === '') continue
    if (out !== '' && /[A-Za-z0-9]$/.test(out) && /^[A-Za-z0-9]/.test(l)) out += ' '
    out += l
  }
  return out
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(new RegExp(`([${CJK}]) (?=[${CJK}])`, 'g'), '$1')
    // 数字の前後の空白（「第 12 条」。比例幅の数字の抽出で入る）も日本語との間なら詰める
    .replace(new RegExp(`([${CJK}]) (?=[0-9])|([0-9]) (?=[${CJK}])`, 'g'), '$1$2')
    .trim()
}

// ---------------------------------------------------------------------------
// 文字化けの検出（§13: 添字の数字が ₁₂₃、記号（÷×）が崩れる事例があった）

const GARBLE_RULES: { re: RegExp; reason: string }[] = [
  { re: /[₀-₉⁰¹²³⁴-⁹]/u, reason: '添字・上付きの数字（₁₂₃ など）が混入（数字・算式の崩れの疑い）' },
  { re: /�/u, reason: '置換文字（�）が混入（抽出できなかった文字）' },
  { re: /[-]/u, reason: '私用領域の文字が混入（記号 ÷× などの崩れの疑い）' },
  // 数式の書体の記号が ASCII に化ける（R6/R8 で × → #、÷ → '、≒ → ] を確認）
  { re: /#|(?<!\[[^\]]*)\]|[0-9０-９)）]\s*'\s*[（(0-9０-９]/, reason: '算式の記号が ASCII の記号（# \' ] など）に化けた疑い（×÷≒ の崩れ）' },
  { re: /\(cid:\d+\)/, reason: '(cid:N) が混入（抽出できなかった文字）' },
  { re: /[À-ÖØ-öø-ÿ]/u, reason: 'ラテン文字の記号が混入（÷× が別の文字に化けた疑い）' },
  // eslint-disable-next-line no-control-regex
  { re: /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u, reason: '制御文字が混入' },
]

// 文字化けの疑いを理由の配列で返す（無ければ空）。理由には該当箇所の前後を添える。
export function findGarbled(text: string): string[] {
  const out: string[] = []
  for (const { re, reason } of GARBLE_RULES) {
    const m = re.exec(text)
    if (!m) continue
    const at = m.index
    out.push(`${reason}: …${text.slice(Math.max(0, at - 8), at + m[0].length + 8)}…`)
  }
  return out
}
