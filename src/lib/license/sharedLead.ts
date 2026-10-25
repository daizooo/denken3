// 本試験形式の画面で、各肢が頭に持つ共通の前文を1回だけ表示するための整形（表示専用。DB は変えない）。
//
// 書籍版の肢は単独で読めるよう、問の前文を各肢の頭に含めている。本試験形式の画面は
// 問の前文（stem）を出したうえで各肢も出すため、そのままだと前文が肢の数だけ重なる。
// 肢の頭に共通する前文を切り出し、stem にまだ無ければ stem に足して、肢からは外す。
//
// 安全側に倒す: 共通部分が短い／肢が1つ／外すと肢が空になる場合は何もしない。

const MIN_LEAD = 20          // これより短い共通部分は前文とみなさない
const BOUNDARY = /[。、）」』]/  // 前文の切れ目（語の途中で切らない）

function commonPrefix(texts: string[]): string {
  let p = texts[0]
  for (const t of texts.slice(1)) {
    let i = 0
    while (i < p.length && i < t.length && p[i] === t[i]) i++
    p = p.slice(0, i)
  }
  return p
}

export function splitSharedLead<T extends { statement: string }>(
  stem: string | null, items: T[],
): { stem: string | null; items: T[] } {
  if (items.length < 2) return { stem, items }
  const prefix = commonPrefix(items.map(it => it.statement))
  let cut = -1
  for (let i = prefix.length - 1; i >= 0; i--) if (BOUNDARY.test(prefix[i])) { cut = i + 1; break }
  if (cut < MIN_LEAD) return { stem, items }
  const lead = prefix.slice(0, cut)
  const rest = items.map(it => it.statement.slice(cut).trimStart())
  if (rest.some(r => r === '')) return { stem, items }
  const stemHasLead = !!stem && stem.replace(/\s+/g, '').includes(lead.slice(0, MIN_LEAD).replace(/\s+/g, ''))
  return {
    stem: stemHasLead ? stem : [stem?.trim(), lead.trim()].filter(Boolean).join('\n'),
    items: items.map((it, i) => ({ ...it, statement: rest[i] })),
  }
}
