// 2級建設業経理士の入力の正規化（docs/design/kenkei2.md §4.2）。すべて純関数。
// 全角・半角・カンマ・「¥」「円」の揺れをそろえる。ここで null になる入力は「未入力または解釈できない」。

/** 数字・符号を全角→半角にそろえる（NFKC。「Ⅽ」「Ⅿ」などのローマ数字記号も英字になる）。 */
function fold(raw: string): string {
  return raw.normalize('NFKC').replace(/\s+/g, '')
}

/**
 * 金額・年数の入力を数値にする。
 * 「¥1,234」「￥１２３４円」「5年」を許容。「△」「▲」「-」「−」で始まれば負数。空欄・解釈不能は null。
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null
  let s = fold(raw).replace(/[¥円年,]/g, '')
  if (s === '') return null
  let sign = 1
  if (/^[△▲\-−ー]/.test(s)) { sign = -1; s = s.slice(1) }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  // -0 を作らない（0 と比較して一致するように）
  return n === 0 ? 0 : sign * n
}

/** 勘定科目群・選択肢の記号（A〜Z）。全角・小文字・ローマ数字記号を英大文字1字にする。1字でなければ null。 */
export function parseSymbol(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = fold(raw).toUpperCase()
  return /^[A-Z]$/.test(s) ? s : null
}

/** 空欄（空白だけを含む）か。 */
export function isBlank(raw: string | null | undefined): boolean {
  return raw == null || fold(raw) === ''
}
