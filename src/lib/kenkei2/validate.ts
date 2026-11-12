// 取り込み・保存前の検証ゲート（docs/design/kenkei2.md §3.3）。通らないものは保存しない。すべて純関数。
// 戻り値は問題点の一覧（空なら合格）。
import type { Cell, JournalKey, SettlementRow } from './types.ts'

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

/** 仕訳の正答: 借方と貸方があり、金額が正の整数で、借方合計＝貸方合計。symbols を渡せば記号の実在も確かめる。 */
export function validateJournalKey(key: JournalKey, symbols?: readonly string[]): string[] {
  const p: string[] = []
  if (key.debit.length === 0) p.push('借方の行がない')
  if (key.credit.length === 0) p.push('貸方の行がない')
  for (const l of [...key.debit, ...key.credit]) {
    if (!Number.isInteger(l.amount) || l.amount <= 0) p.push(`金額が正の整数でない: ${l.symbol} ${l.amount}`)
    if (!/^[A-Z]$/.test(l.symbol)) p.push(`記号が不正: ${l.symbol}`)
    else if (symbols && !symbols.includes(l.symbol)) p.push(`科目群に無い記号: ${l.symbol}`)
  }
  const d = sum(key.debit.map(l => l.amount))
  const c = sum(key.credit.map(l => l.amount))
  if (d !== c) p.push(`借方合計 ${d} と貸方合計 ${c} が一致しない`)
  return p
}

/** 採点マス: id の重複なし・配点は正・金額は有限数・記号は英大文字1字。 */
export function validateCells(cells: Cell[]): string[] {
  const p: string[] = []
  const seen = new Set<string>()
  for (const c of cells) {
    if (seen.has(c.id)) p.push(`id が重複: ${c.id}`)
    seen.add(c.id)
    if (!(c.points > 0)) p.push(`配点が正でない: ${c.id}`)
    if (c.kind === 'amount' && !(typeof c.expected === 'number' && Number.isFinite(c.expected))) {
      p.push(`金額の正答が数値でない: ${c.id}`)
    }
    if (c.kind === 'symbol' && !(typeof c.expected === 'string' && /^[A-Z]$/.test(c.expected))) {
      p.push(`記号の正答が不正: ${c.id}`)
    }
  }
  return p
}

/** 回ごとの配点の合計が total（既定 100）か。parts は大問ごとの配点。 */
export function validatePointsTotal(parts: { part: number; points: number }[], total = 100): string[] {
  const s = sum(parts.map(x => x.points))
  return s === total ? [] : [`配点の合計 ${s} が ${total} でない`]
}

/**
 * 精算表の整合。取り込みの数値取り違えを見つける最大の網。
 *  - 行ごと: 試算表＋整理記入（借−貸）＝損益計算書＋貸借対照表（借−貸）
 *  - 列ごと: 試算表・整理記入の借方合計＝貸方合計
 *  - 損益計算書: 貸方合計−借方合計＝当期純利益（損失なら負）
 *  - 貸借対照表: 借方合計−貸方合計＝当期純利益
 */
export function validateSettlement(rows: SettlementRow[], netIncome: number): string[] {
  const p: string[] = []
  for (const r of rows) {
    const before = r.tb[0] - r.tb[1] + sum(r.adj[0]) - sum(r.adj[1])
    const after = r.pl[0] - r.pl[1] + r.bs[0] - r.bs[1]
    if (before !== after) p.push(`行が合わない: ${r.name}（整理後 ${before}、損益・貸借 ${after}）`)
  }
  const col = (f: (r: SettlementRow) => number) => sum(rows.map(f))
  if (col(r => r.tb[0]) !== col(r => r.tb[1])) p.push('試算表の借方合計と貸方合計が一致しない')
  if (col(r => sum(r.adj[0])) !== col(r => sum(r.adj[1]))) p.push('整理記入の借方合計と貸方合計が一致しない')
  const pl = col(r => r.pl[1]) - col(r => r.pl[0])
  if (pl !== netIncome) p.push(`損益計算書から出した当期純利益 ${pl} が ${netIncome} と一致しない`)
  const bs = col(r => r.bs[0]) - col(r => r.bs[1])
  if (bs !== netIncome) p.push(`貸借対照表から出した当期純利益 ${bs} が ${netIncome} と一致しない`)
  return p
}
