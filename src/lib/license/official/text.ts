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

// テキストを行に分け、改ページ・ページ番号だけの行を除き、行頭・行末の空白を落とす。
export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\f/g, '\n').split('\n')
    .map(l => l.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''))
    .filter(l => l !== '' && !NOISE_RE.test(l))
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
    .trim()
}

// ---------------------------------------------------------------------------
// 文字化けの検出（§13: 添字の数字が ₁₂₃、記号（÷×）が崩れる事例があった）

const GARBLE_RULES: { re: RegExp; reason: string }[] = [
  { re: /[₀-₉⁰¹²³⁴-⁹]/u, reason: '添字・上付きの数字（₁₂₃ など）が混入（数字・算式の崩れの疑い）' },
  { re: /�/u, reason: '置換文字（�）が混入（抽出できなかった文字）' },
  { re: /[-]/u, reason: '私用領域の文字が混入（記号 ÷× などの崩れの疑い）' },
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
