// 抽出結果（extract_answers.py の JSON）の検証ゲート（docs/design/kenkei2.md §3.3・K2）。
// usage: node scripts/kenkei2/check.mjs a39.json [a38.json …]   通らなければ終了コード 1（保存しない）。
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

export function checkFile(path) {
  const d = JSON.parse(readFileSync(path, 'utf8'))
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
    console.log(`${f}: ${d.title}  仕訳${d.part1.length} 金額${d.part2.length} 精算表${p5?.accounts.length ?? '-'}行 採点マス${p5 ? scoredUnits(p5.scored) : '-'}  ${problems.length ? 'NG' : 'OK'}`)
    for (const m of problems) console.log(`   - ${m}`)
    if (problems.length) bad++
  }
  process.exit(bad ? 1 : 0)
}
