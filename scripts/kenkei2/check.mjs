// 抽出結果（extract_answers.py の JSON）の検証ゲート（docs/design/kenkei2.md §3.3・K2）。
// usage: node scripts/kenkei2/check.mjs a39.json s39.json [...]   通らなければ終了コード 1（保存しない）。
// a*.json = extract_answers.py（第1・2・5問）、s*.json = extract_sheets.py（第3・4問）。
// 検証の本体は src/lib/kenkei2/validate.ts（取り込み・画面・テストで共通）。
import { readFileSync } from 'node:fs'
import { validateJournalKey, validateSettlement } from '../../src/lib/kenkei2/validate.ts'

const sum = xs => xs.reduce((s, x) => s + x, 0)
const POINTS_PART5 = 30
const POINTS_PER_CELL = 2

/** 採点の単位数。当期純利益の見出し（第34回）を解答欄とする回は、見出し＋金額を1単位（要確認）として数える。 */
export function scoredUnits(scored) {
  const ni = scored.filter(s => s.row === 'ni')
  const others = scored.length - ni.length
  const niUnits = ni.some(s => s.col === 'label') ? 1 : ni.length
  return others + niUnits
}

/** 第3・4問の解答用紙（extract_sheets.py の JSON）。配点の合計は 38点（14点と24点の2大問。第36回だけ順序が逆）。 */
export function checkSheets(d) {
  const problems = []
  const totals = {}
  const ids = new Set()
  for (const sh of d.sheets) {
    totals[sh.part] = 0
    for (const u of sh.units) {
      totals[sh.part] += u.points
      if (ids.has(u.id)) problems.push(`第${sh.part}問: 単位の id が重複 ${u.id}`)
      ids.add(u.id)
      if (!(u.points > 0)) problems.push(`第${sh.part}問 ${u.id}: 配点が正でない`)
      if (u.cells.length === 0) problems.push(`第${sh.part}問 ${u.id}: 解答欄が空`)
      for (const c of u.cells) {
        const okAmount = c.kind === 'amount' && Number.isInteger(c.expected) && c.expected >= 0
        const okSymbol = c.kind === 'symbol' && /^[A-Z]$/.test(c.expected)
        const okText = c.kind === 'text' && typeof c.expected === 'string' && c.expected !== ''
        if (!(okAmount || okSymbol || okText)) problems.push(`第${sh.part}問 ${u.id}: 正答が読めない ${JSON.stringify(c)}`)
      }
    }
  }
  const parts = [totals[3], totals[4]].join()
  if (parts !== '14,24' && parts !== '24,14') problems.push(`第3問・第4問の配点が ${parts}（14,24 または 24,14 のはず）`)
  return problems
}

export function checkFile(path) {
  const d = JSON.parse(readFileSync(path, 'utf8'))
  if (d.sheets) return { d, problems: checkSheets(d) }
  const problems = []
  const add = (part, list) => list.forEach(m => problems.push(`第${part}問: ${m}`))

  // 第1問: 仕訳5組・借貸一致
  if (d.part1.length !== 5) add(1, [`仕訳が ${d.part1.length} 組（5組のはず）`])
  for (const e of d.part1) {
    add(1, validateJournalKey(e).map(m => `(${e.no}) ${m}`))
  }

  // 第2問: 4問
  const nos = d.part2.map(x => x.no).join()
  if (nos !== '1,2,3,4') add(2, [`設問番号が ${nos}（1,2,3,4 のはず）`])

  // 第5問: 精算表
  const p5 = d.part5
  if (!p5) {
    add(5, ['精算表が見つからない'])
  } else {
    add(5, validateSettlement(p5.accounts, p5.netIncome))
    const tb = [sum(p5.accounts.map(a => a.tb[0])), sum(p5.accounts.map(a => a.tb[1]))]
    if (tb.join() !== p5.tbTotal.join()) add(5, [`試算表の合計が印字 ${p5.tbTotal} と計算 ${tb} で違う`])
    const sub = {
      adj: [sum(p5.accounts.flatMap(a => a.adj[0])), sum(p5.accounts.flatMap(a => a.adj[1]))],
      pl: [sum(p5.accounts.map(a => a.pl[0])), sum(p5.accounts.map(a => a.pl[1]))],
      bs: [sum(p5.accounts.map(a => a.bs[0])), sum(p5.accounts.map(a => a.bs[1]))],
    }
    for (const k of ['adj', 'pl', 'bs']) {
      if (sub[k].join() !== p5.subtotal[k].join()) add(5, [`${k} の小計が印字 ${p5.subtotal[k]} と計算 ${sub[k]} で違う`])
    }
    for (const s of p5.scored) {
      if (s.expected === null || s.row === null) add(5, [`採点マスの正答が取れない: ${JSON.stringify(s)}`])
    }
    const units = scoredUnits(p5.scored)
    if (units * POINTS_PER_CELL !== POINTS_PART5) add(5, [`採点マス ${units} 個×${POINTS_PER_CELL}点 が ${POINTS_PART5}点でない`])
  }
  return { d, problems }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0
  for (const f of process.argv.slice(2)) {
    const { d, problems } = checkFile(f)
    const p5 = d.part5
    const label = d.sheets
      ? `第${d.kai}回 第3・4問 採点単位${d.sheets.reduce((n, sh) => n + sh.units.length, 0)}`
      : `${d.title}  仕訳${d.part1.length} 金額${d.part2.length} 精算表${p5?.accounts.length ?? '-'}行 採点マス${p5 ? scoredUnits(p5.scored) : '-'}`
    console.log(`${f.split('/').pop()}: ${label}  ${problems.length ? 'NG' : 'OK'}`)
    for (const m of problems) console.log(`   - ${m}`)
    if (problems.length) bad++
  }
  process.exit(bad ? 1 : 0)
}
