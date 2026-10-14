// 構造化 → 検証ゲート → DB 行（licensehub-expansion.md §8・§9・§13・PR-D）。フィクスチャは架空の年度 R98/R99 だけ。
import { describe, expect, it } from 'vitest'
import { buildOfficialYear, deriveTruths, officialHoldoutGroup, SENTAKU_TOTAL_BLANKS, TAKU_TOTAL_ITEMS } from './build'
import { parseTakuText } from './parseTaku'
import { parseSentakuText } from './parseSentaku'
import { parseAnswersText } from './parseAnswers'
import { formatCounts, formatGate } from './report'
import type { OfficialTakuQuestion, OfficialYear } from './types'
import takuRaw from '../../../../scripts/license/fixtures/official-r99-taku.txt?raw'
import sentakuRaw from '../../../../scripts/license/fixtures/official-r99-sentaku.txt?raw'
import answersRaw from '../../../../scripts/license/fixtures/official-r99-answers.txt?raw'
import invalidTakuRaw from '../../../../scripts/license/fixtures/official-r98-invalid-taku.txt?raw'
import invalidSentakuRaw from '../../../../scripts/license/fixtures/official-r98-invalid-sentaku.txt?raw'
import invalidAnswersRaw from '../../../../scripts/license/fixtures/official-r98-invalid-answers.txt?raw'

function load(year: string, taku: string, sentaku: string, answers: string): { data: OfficialYear; parseIssues: ReturnType<typeof parseTakuText>['issues'] } {
  const t = parseTakuText(taku, year)
  const s = parseSentakuText(sentaku, year)
  const a = parseAnswersText(answers, year)
  return { data: { year, taku: t.questions, sentaku: s.questions, answers: a.answers }, parseIssues: [...t.issues, ...s.issues, ...a.issues] }
}

const r99 = () => load('R99', takuRaw, sentakuRaw, answersRaw)

describe('deriveTruths（§13）', () => {
  const q = (over: Partial<OfficialTakuQuestion>) => ({ kind: 'one', direction: 'wrong', comboPairs: null, countOptions: null, ...over }) as OfficialTakuQuestion

  it('誤っている／正しいものを1つ選べ: 全肢を導出する', () => {
    expect(deriveTruths(q({}), 3)).toEqual([true, true, false, true, true])
    expect(deriveTruths(q({ direction: 'right' }), 2)).toEqual([false, true, false, false, false])
  })

  it('組合せ: 選んだ2肢が方向どおり、他は逆', () => {
    const pairs = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'E']] as OfficialTakuQuestion['comboPairs']
    expect(deriveTruths(q({ kind: 'combo', direction: 'right', comboPairs: pairs }), 3)).toEqual([false, true, false, true, false])
    expect(deriveTruths(q({ kind: 'combo', direction: 'wrong', comboPairs: pairs }), 5)).toEqual([true, true, true, false, false])
  })

  it('個数: 0個・5個だけ導出し、それ以外は null', () => {
    const counts = [1, 2, 3, 4, 5]
    expect(deriveTruths(q({ kind: 'count', direction: 'right', countOptions: counts }), 5)).toEqual([true, true, true, true, true])
    expect(deriveTruths(q({ kind: 'count', direction: 'wrong', countOptions: counts }), 5)).toEqual([false, false, false, false, false])
    expect(deriveTruths(q({ kind: 'count', direction: 'right', countOptions: [0, 1, 2, 3, 4] }), 1)).toEqual([false, false, false, false, false])
    expect(deriveTruths(q({ kind: 'count', direction: 'right', countOptions: counts }), 3)).toEqual([null, null, null, null, null])
  })
})

describe('officialHoldoutGroup（§8）', () => {
  it('温存は廃止したので、どの年度・式にも温存グループを付けない', () => {
    expect(officialHoldoutGroup('R07', 'taku', 'RK')).toBeNull()
    expect(officialHoldoutGroup('R07', 'sentaku', 'RK')).toBeNull()
    expect(officialHoldoutGroup('R08', 'sentaku', 'KN')).toBeNull()
    expect(officialHoldoutGroup('R08', 'taku', 'RK')).toBeNull()
    expect(officialHoldoutGroup('R06', 'taku', 'RK')).toBeNull()
  })
})

describe('buildOfficialYear（フィクスチャ R99: 全件がゲートを通る）', () => {
  const { data, parseIssues } = r99()
  const units = buildOfficialYear(data, { fixture: true, parseIssues })
  const [taku, sentaku] = units

  it('択一 70問/350肢、選択式 8科目/40空欄で合格する', () => {
    expect(parseIssues).toEqual([])
    expect(units.map(u => [u.format, u.passed, u.issues.filter(i => i.level === 'error')])).toEqual([['taku', true, []], ['sentaku', true, []]])
    expect(taku.questions).toHaveLength(70)
    expect(taku.items).toHaveLength(TAKU_TOTAL_ITEMS)
    expect(sentaku.questions).toHaveLength(8)
    expect(sentaku.items).toHaveLength(SENTAKU_TOTAL_BLANKS)
  })

  it('公式の肢は honshiken / derived / unchecked / 解説なし（§9）', () => {
    expect(new Set(taku.questions.map(q => q.source))).toEqual(new Set(['honshiken']))
    for (const i of [...taku.items, ...sentaku.items]) {
      expect(i).toMatchObject({ truth_source: 'derived', law_status: 'unchecked', explanation: null, explanation_source: 'none', explanation_verified: false })
      expect(i.origin_statement).toBe(i.statement)
    }
  })

  it('問ID・肢ID・answer_spec・学習科目（徴収・労一/社一の分割）', () => {
    const q = (id: string) => taku.questions.find(x => x.id === id)!
    expect(q('R99_T_KH_01')).toMatchObject({ format: 'taku', scored_subject: 'KH', study_subject: 'kenpo', q_no: 1, answer_spec: { kind: 'one', direction: 'wrong', correct: 4 } })
    expect(q('R99_T_KH_03').answer_spec).toEqual({ kind: 'combo', correct: 5 })
    expect(q('R99_T_KH_03').stem).toContain('E（エとオ）')
    expect(q('R99_T_RS_08').study_subject).toBe('choushu')
    expect(q('R99_T_IP_06').study_subject).toBe('shaippan')
    const items = taku.items.filter(i => i.question_id === 'R99_T_KH_01')
    expect(items.map(i => [i.id, i.truth])).toEqual([
      ['R99_T_KH_01_A', true], ['R99_T_KH_01_B', true], ['R99_T_KH_01_C', true], ['R99_T_KH_01_D', false], ['R99_T_KH_01_E', true],
    ])
    expect(taku.items.find(i => i.id === 'R99_T_KH_03_A')!.label_raw).toBe('ア')
  })

  it('個数の問で 0個・5個でないものは truth を null にし、警告に出す', () => {
    const rk1 = taku.items.filter(i => i.question_id === 'R99_T_RK_01')
    expect(rk1.every(i => i.truth === null)).toBe(true)
    expect(taku.issues.some(i => i.level === 'warning' && i.where === 'R99 択一 RK 問1')).toBe(true)
    expect(taku.counts.find(c => c.questionId === 'R99_T_RK_01')).toEqual({ questionId: 'R99_T_RK_01', direction: 'right', count: 3 })
  })

  it('選択式: answer_spec は sentaku 形式、空欄は ［A］ の1文、労基・安衛の空欄 D・E は安衛', () => {
    const rk = sentaku.questions.find(q => q.id === 'R99_S_RK')!
    expect(rk).toMatchObject({ format: 'sentaku', q_no: null, study_subject: 'rouki' })
    expect(rk.answer_spec).toMatchObject({ kind: 'sentaku', blanks: { A: 1, B: 5, C: 9, D: 13, E: 17 } })
    expect(Object.keys((rk.answer_spec as { wordbank: object }).wordbank)).toHaveLength(20)
    const items = sentaku.items.filter(i => i.question_id === 'R99_S_RK')
    expect(items.map(i => i.study_subject)).toEqual(['rouki', 'rouki', 'rouki', 'anei', 'anei'])
    expect(items[3].statement).toMatch(/^【架空・テスト用】架空の審査会は、［D］/)
    expect(items.every(i => i.truth === null)).toBe(true)
  })

  it('件数の報告（年度別・科目別・温存対象）', () => {
    const lines = formatCounts(units).join('\n')
    expect(lines).toContain('lic_items 390 行')
    expect(lines).toContain('R99 択一 350 / R99 選択式 40')
    expect(lines).toContain('温存対象:     0 件')
    expect(formatGate(units)[1]).toContain('R99 択一: ✓ 合格')
  })

  it('R07 でも温存グループは付かない（温存は廃止）', () => {
    const asR07 = buildOfficialYear({ ...data, year: 'R07' }, {})
    expect(asR07.every(u => u.passed)).toBe(true)
    expect(asR07.every(u => u.questions.every(q => q.holdout_group === null))).toBe(true)
    expect(formatCounts(asR07).join('\n')).toContain('温存対象:     0 件')
  })
})

describe('検証ゲートの失敗（理由つきの一覧。保存しない）', () => {
  it('フィクスチャ年度の混入・本番年度の --fixture を拒否する', () => {
    const { data } = r99()
    expect(buildOfficialYear(data, {}).map(u => u.passed)).toEqual([false, false])
    expect(buildOfficialYear({ ...data, year: 'R08' }, { fixture: true })[0].issues[0].reason).toContain('フィクスチャの取り込みでは')
  })

  it('失敗見本 R98: 添字の崩れ・肢の欠け・選択肢の欠け・正答なし・労一/社一の分割・空欄の欠け・語群に無い正答', () => {
    const { data, parseIssues } = load('R98', invalidTakuRaw, invalidSentakuRaw, invalidAnswersRaw)
    const units = buildOfficialYear(data, { fixture: true, parseIssues })
    expect(units.map(u => u.passed)).toEqual([false, false])
    expect(units.every(u => u.items.length === 0 && u.questions.length === 0)).toBe(true)
    const reasons = units.flatMap(u => u.issues.filter(i => i.level === 'error').map(i => `${i.where}: ${i.reason}`))
    for (const want of [
      /RK 問1: 肢 A: 添字/, /RK 問2: 肢が A〜E/, /RK 問3: 組合せの選択肢が5つ読めない/, /RK 問3: 正答が無い/, /RK 問4〜10: 問が読めない/,
      /RS 問1〜10: 問が読めない/, /IP 問1: 学習科目の分割位置/, /択一: 件数が足りない: 問 0\/70/,
      /選択式 RK: 空欄が A〜E の各1つでない/, /選択式 RK: 空欄 C の正答 9 が語群に無い/, /選択式 KN: 科目が読めない/,
    ]) expect(reasons.some(r => want.test(r)), String(want)).toBe(true)
    // 択一式の ÷ は正しい記号なので失敗にしない
    expect(reasons.some(r => r.includes('IP 問1: 肢 B'))).toBe(false)
  })

  it('1問でも失敗すれば、その年度の式は丸ごと保存しない', () => {
    const { data } = r99()
    const broken = { ...data, taku: data.taku!.map(q => (q.scoredSubject === 'KN' && q.qNo === 10 ? { ...q, items: q.items.slice(0, 4) } : q)) }
    const [taku, sentaku] = buildOfficialYear(broken, { fixture: true })
    expect(taku.passed).toBe(false)
    expect(taku.items).toEqual([])
    expect(taku.issues.filter(i => i.level === 'error').map(i => i.where)).toEqual(['R99 択一 KN 問10', 'R99 択一'])
    expect(sentaku.passed).toBe(true)
  })

  it('問題か正答の片方だけでは失敗し、どちらも無い式は「未提供」', () => {
    const { data } = r99()
    const units = buildOfficialYear({ ...data, sentaku: null, answers: { taku: {}, sentaku: data.answers!.sentaku } }, { fixture: true })
    expect(units[0]).toMatchObject({ provided: true, passed: false })
    expect(units[0].issues.some(i => i.reason.includes('正答が与えられていない'))).toBe(true)
    expect(units[1].issues.some(i => i.reason.includes('問題のテキストが与えられていない'))).toBe(true)
    const none = buildOfficialYear({ year: 'R99', taku: null, sentaku: null, answers: null }, { fixture: true })
    expect(none.map(u => [u.provided, u.passed])).toEqual([[false, false], [false, false]])
    expect(formatGate(none)[1]).toContain('未提供')
  })

  it('問ID の重複を失敗にする', () => {
    const { data } = r99()
    const dup = { ...data, taku: [...data.taku!, data.taku![0]] }
    const [taku] = buildOfficialYear(dup, { fixture: true })
    expect(taku.issues.some(i => i.where === 'R99 択一 RK 問1' && i.reason.includes('ID重複'))).toBe(true)
  })
})

describe('問題誤りの公表による補正（R6。corrections）', () => {
  it('excluded: 正答が無くても通し、肢を law_status=excluded にする', () => {
    const { data } = r99()
    const answers = structuredClone(data.answers!)
    answers.taku.KY[4] = null
    const [taku] = buildOfficialYear({ ...data, answers }, {
      fixture: true, corrections: { questions: { R99_T_KY_05: { action: 'excluded', note: '全員正解' } } },
    })
    expect(taku.passed).toBe(true)
    expect(taku.questions.find(q => q.id === 'R99_T_KY_05')!.answer_spec).toBeNull()
    const items = taku.items.filter(i => i.question_id === 'R99_T_KY_05')
    expect(items.every(i => i.law_status === 'excluded' && i.truth === null && i.law_note!.includes('全員正解'))).toBe(true)
  })

  it('correct: 公表どおりの正答に置き換え、truth もそれで導出する', () => {
    const { data } = r99()
    const [taku] = buildOfficialYear(data, {
      fixture: true, corrections: { questions: { R99_T_KH_01: { action: 'correct', correct: 'B', note: '正答をBに訂正' } } },
    })
    expect(taku.questions.find(q => q.id === 'R99_T_KH_01')!.answer_spec).toEqual({ kind: 'one', direction: 'wrong', correct: 2 })
    expect(taku.items.filter(i => i.question_id === 'R99_T_KH_01').map(i => i.truth)).toEqual([true, false, true, true, true])
    expect(taku.issues.some(i => i.level === 'warning' && i.reason.includes('D → B'))).toBe(true)
  })

  it('studySplit で労一・社一の分割位置を上書きする', () => {
    const { data } = r99()
    const [taku] = buildOfficialYear(data, { fixture: true, corrections: { studySplit: { IP: 6 } } })
    // 問6 は本文が社一の語なので、分割位置を 6 にすると食い違いで失敗する
    expect(taku.passed).toBe(false)
    expect(taku.issues.find(i => i.level === 'error')!.where).toBe('R99 択一 IP 問6')
  })
})
