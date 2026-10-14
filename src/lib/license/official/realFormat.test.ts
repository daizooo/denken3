// 試験センターの公式PDF（R6〜R8）の抽出テキストの書式への対応（licensehub-expansion.md §13・PR-D の続き）。
// 本物の本文・正答は入れない。書式（改ページ・トンボ・下付き数字・縦書きの案内・表の並び）だけを架空の文で再現する。
import { describe, expect, it } from 'vitest'
import { parseTakuText, detectDirection } from './parseTaku'
import { parseSentakuText, sentenceWithBlank } from './parseSentaku'
import { parseAnswersText } from './parseAnswers'
import { findGarbled, joinLines, restoreSubscriptDigits, splitLines } from './text'
import { buildOfficialYear, deriveTruths } from './build'
import { ITEM_LABELS } from '../../../domain/license'
import type { OfficialAnswers, OfficialSentakuQuestion, OfficialTakuQuestion, OfficialYear } from './types'

describe('text（実PDFの書式）', () => {
  it('下付き数字の並びを半角数字に戻す（通常の数字と混ざったものは崩れとして残す）', () => {
    expect(restoreSubscriptDigits('架空法第 ₁₂ 条第 ₃ 項')).toBe('架空法第 12 条第 3 項')
    expect(restoreSubscriptDigits('₆，₀₀₀ 円')).toBe('6，000 円')
    expect(restoreSubscriptDigits('通常の賃金の１₂５パーセント')).toBe('通常の賃金の１₂５パーセント')
  })

  it('トンボ・改ページの番号・縦書きの案内を落とし、折り返しで数字だけになった本文の行は残す', () => {
    const text = [
      '架空の本文の一行目で',
      '1234_102_TAKU01_M.indd 3 2099/07/10 17:13',
      '\f4',
      '架空の割合は 18．',
      '9',
      '％である。',
      '問', '題', 'は', '次', 'ペ', '�', 'ジ', 'に', '続', 'き', 'ま', 'す', '︒',
      '\f5',
      '最後の行',
    ].join('\n')
    expect(splitLines(text)).toEqual(['架空の本文の一行目で', '架空の割合は 18．', '9', '％である。', '最後の行'])
  })

  it('日本語と数字の間の空白（比例幅の数字の抽出で入る）を詰める', () => {
    expect(joinLines(['架空法第 12 条は、', '6，000 円とする。'])).toBe('架空法第12条は、6，000円とする。')
  })

  it('数式の書体の記号の崩れ（× → #、÷ → \'、≒ → ]）を検出する', () => {
    expect(findGarbled('（400 円 + 10 円）\'（250 # 7 \' 12）')).toEqual([expect.stringContaining('算式の記号')])
    expect(findGarbled('平均額#乗率')).toEqual([expect.stringContaining('算式の記号')])
    expect(findGarbled('5．2日 ] 7．69日')).toEqual([expect.stringContaining('算式の記号')])
    expect(findGarbled('［A］と［B］の比は 3：4')).toEqual([])
  })
})

// pdftotext -raw の並び: 見出しの括弧書きが2行に折り返し、改ページの番号とトンボが挟まる
const TAKU_RAW = [
  '1234_102_TAKU_H.indd 2 2099/07/12 5:54',
  '\f1',
  '労働基準法及び労働安全衛生法',
  '〔問 1〕 架空規程に関する次の記述のうち、正しいものはどれか。',
  'Ａ 架空規程第 ₁ 条の記述である。',
  'Ｂ 架空規程第 ₂ 条の記述で、折り返して',
  '続く記述である。',
  'Ｃ 架空規程の記述Ｃである。',
  'Ｄ 架空規程の記述Ｄである。',
  'Ｅ 架空規程の記述Ｅである。',
  '1234_102_TAKU01_M.indd 1 2099/07/12 4:15',
  '\f2',
  '労働者災害補償保険法',
  '（架空の保険料の徴収等に関する法律を含',
  'む。）',
  '〔問 1〕 次の記述のうち、業務災害として保険給付の対象となるものはいくつあるか。',
  'ア 架空の記述ア',
  'イ 架空の記述イ',
  'ウ 架空の記述ウ',
  'エ 架空の記述エ',
  'オ 架空の記述オ',
  'Ａ 一つ',
  'Ｂ 二つ',
  'Ｃ 三つ',
  '1234_102_TAKU01_M.indd 2 2099/07/12 4:15',
  '\f3',
  'Ｄ 四つ',
  'Ｅ 五つ',
].join('\n')

describe('parseTakuText（実PDFの書式）', () => {
  it('見出しの括弧書きの折り返しを前の問に入れず、改ページをまたぐ選択肢を読む', () => {
    const { questions } = parseTakuText(TAKU_RAW, 'R99')
    expect(questions.map(q => `${q.scoredSubject}${q.qNo}`)).toEqual(['RK1', 'RS1'])
    const [rk, rs] = questions
    expect(rk.items.map(i => i.text)).toEqual([
      '架空規程第1条の記述である。', '架空規程第2条の記述で、折り返して続く記述である。', '架空規程の記述Ｃである。', '架空規程の記述Ｄである。', '架空規程の記述Ｅである。',
    ])
    expect(rs.kind).toBe('count')
    expect(rs.direction).toBe('right')
    expect(rs.countOptions).toEqual([1, 2, 3, 4, 5])
  })

  it('条件に当たる／当たらない肢を選ぶ問の方向', () => {
    expect(detectDirection('次の記述のうち、業務災害として保険給付の対象となるものはいくつあるか。')).toBe('right')
    expect(detectDirection('架空規則が定めるものに含まれない行為はどれか。')).toBe('wrong')
    expect(detectDirection('次の記述のうち、架空の申出をすることができないものはいくつあるか。')).toBe('wrong')
  })
})

const SENTAKU_RAW = [
  '【法令等略記凡例】',
  '労働者災害補償保険法',               // 表紙の略記凡例（見出しではない）
  '架 空 保 険 法',
  '労働基準法及び労働安全衛生法',
  '〔問 1〕 次の文中の の部分を選択肢の中の最も適切な語句で埋め、完全',
  'な文章とせよ。',
  '₁ 架空法第 ₂₂ 条は、使用者は Ａ これを交付しなければならないと定め、',
  '架空の判決は「① 架空の事情によれば、 Ｂ ときに当たる。」とした。',
  '₂ 架空の委員は Ｃ とし、 Ｃ ごとに Ｄ を置き、 Ｅ とする。',
  '選択肢',
  '① 架空語句1 ② 架空語句2 ③ 架空語句3 ④ 架空語句4',
  '⑤ 架空語句5 ⑥ 1，',
  '000 人 ⑦ 架空語句7 ⑧ 架空語句8',
  '⑨ 架空語句9 ⑩ 架空語句10 ⑪ 架空語句11 ⑫ 架空語句12',
  '⑬ 架空語句13 ⑭ 架空語句14 ⑮ 架空語句15 ⑯ 架空語句16',
  '⑰ 架空語句17 ⑱ 架空語句18 ⑲ 架空語句19 ⑳ 架空語句20',
  '1234_101_SEN01_M.indd 3 2099/07/04 21:24',
  '\f4',
  '労働者災害補償保険法',
  '〔問 2〕 次の文中の の部分を選択肢の中の最も適切な語句で埋め、完全',
  'な文章とせよ。',
  '₁ 架空の一時金の額は Ａ とし、日額は Ｂ となる。',
  '₂ 架空の状態は Ｃ にあり、等級は Ｄ 、額は Ｅ となる。',
  '選択肢',
  'Ａ ① ₃₆₅ 日分 ② ₆₀₀ 日分 ③ ₁，',
  '₀₀₀ 日分 ④ ₁，',
  '₂₀₀ 日分',
  'Ｂ ① 架空B1 ② 架空B2 ③ 架空B3 ④ 架空B4',
  'Ｃ',                                // R6 は空欄の記号だけの行の次に語群が続く
  '① 架空C1 ② 架空C2',
  '③ 架空C3 ④ 架空C4',
  'Ｄ ① 架空D1 ② 架空D2 ③ 架空D3 ④ 架空D4',
  'Ｅ ① 架空E1 ② 架空E2 ③ 架空E3 ④ 架空E4',
].join('\n')

describe('parseSentakuText（実PDFの書式）', () => {
  const { questions } = parseSentakuText(SENTAKU_RAW, 'R99')

  it('最初の問より前の見出し（略記凡例）を科目と取り違えない', () => {
    expect(questions.map(q => q.scoredSubject)).toEqual(['RK', 'RS'])
  })

  it('本文中の ① は語群にせず、同じ空欄が何度出ても1つ、段落番号は「1 …」の形', () => {
    const rk = questions[0]
    expect(rk.blanks).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(rk.stem.startsWith('1 架空法第22条は、使用者は［A］これを交付しなければならない')).toBe(true)
    expect(rk.stem).toContain('「① 架空の事情によれば、［B］ときに当たる。」')
    expect(rk.stem).toContain('とした。2 架空の委員は［C］とし、［C］ごとに［D］を置き、［E］とする。')
    expect(Object.keys(rk.wordbank)).toHaveLength(20)
    expect(rk.wordbank['6']).toBe('1，000人')
    expect(rk.groups).toBe(undefined)
    expect(sentenceWithBlank(rk.stem, 'C')).toBe('架空の委員は［C］とし、［C］ごとに［D］を置き、［E］とする。')
  })

  it('空欄ごとの語群は通し番号にそろえ、空欄 → 番号を groups に持つ（行をまたぐ語句もつなぐ）', () => {
    const rs = questions[1]
    expect(Object.values(rs.wordbank).slice(0, 4)).toEqual(['365日分', '600日分', '1，000日分', '1，200日分'])
    expect(rs.wordbank['9']).toBe('架空C1')
    expect(rs.groups).toEqual({ A: [1, 2, 3, 4], B: [5, 6, 7, 8], C: [9, 10, 11, 12], D: [13, 14, 15, 16], E: [17, 18, 19, 20] })
  })
})

// pdftotext -layout の正答表: 選択式と択一式が1つの表。科目名が折り返し、一般常識は行が分かれ、複数正答は上下に積まれる。
// 字の位置（列）は見出しの「1 … 10」にそろう（pdftotext -layout は1字を1桁として並べる）
const HEAD = '試験科目               Ａ   Ｂ    Ｃ    Ｄ   Ｅ   1   2   3   4   5   6   7   8   9   10'
const COLS = Array.from({ length: 10 }, (_, i) => HEAD.indexOf(` ${i + 1}`, HEAD.indexOf('Ｅ')) + 1)
// name: 行頭の科目名、circled: 選択式の丸数字（null は無し）、cells: 問 → 字（'/' も可）
function gridRow(name: string, circled: string | null, cells: Record<number, string>): string {
  const chars = [...name.padEnd(COLS[0] - 2, ' ').slice(0, COLS[0] - 2)]
  if (circled) chars.splice(HEAD.indexOf('Ａ'), circled.length, ...circled)
  const line = chars.join('').padEnd(COLS[9] + 2, ' ').split('')
  Object.entries(cells).forEach(([q, c]) => { line[COLS[Number(q) - 1]] = c })
  return line.join('').trimEnd()
}
const all = (s: string) => Object.fromEntries([...s].map((c, i) => [i + 1, c]))
const GRID = [
  '２   試験問題の正答',
  '            出題形式           選択式                           択一式',
  HEAD,
  '     労働基準法及び',
  gridRow('', '①   ②    ③    ④   ⑤', all('ABCDEABCDE')),
  '     労働安全衛生法',
  gridRow('    労働者災害補償保険法', null, { 6: 'C' }),
  gridRow('    (架空の徴収法を含む)', '②   ③    ④    ⑤   ⑥', { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'A', 7: 'C', 8: 'D', 9: 'E', 10: 'A' }),
  gridRow('', null, { 6: 'D' }),
  gridRow('      雇用保険法', '③   ④    ⑤    ⑥   ⑦', all('CDEABCDEAB')),
  '          労務管理その他の労',
  gridRow('          働に関する一般常識', '④   ⑤    ⑥    ⑦   ⑧', { 1: 'D', 2: 'E', 3: 'A', 4: 'B', 5: 'C' }),
  gridRow('', null, { 9: 'D' }),
  gridRow('社会保険に関    する一般常識', '⑤   ⑥    ⑦    ⑧   ⑨', { 6: 'D', 7: 'E', 8: 'A', 9: '/', 10: 'C' }),
  gridRow('', null, { 9: 'E' }),
  gridRow('      健康保険法', '⑥   ⑦    ⑧    ⑨   ⑩', all('EABCDEABCD')),
  gridRow('     厚生年金保険法', '⑦   ⑧    ⑨    ⑩   ⑪', all('ABCDEABCDE')),
  gridRow('      国民年金法', '⑧   ⑨    ⑩    ⑪   ⑫', all('BCDEABCDEA')),
].join('\n')

describe('parseAnswersText（列の位置で読む表）', () => {
  it('選択式は丸数字5つの行の順、択一式は列の位置で読み、積まれた複数正答は null と理由', () => {
    const { answers, issues } = parseAnswersText(GRID, 'R99')
    const taku = Object.fromEntries(Object.entries(answers.taku).map(([k, v]) => [k, v.map(x => x ?? '-').join('')]))
    expect(taku).toEqual({
      RK: 'ABCDEABCDE', RS: 'BCDEA-CDEA', KY: 'CDEABCDEAB', IP: 'DEABCDEA-C', KH: 'EABCDEABCD', KO: 'ABCDEABCDE', KN: 'BCDEABCDEA',
    })
    expect(answers.sentaku.RI).toEqual({ A: 4, B: 5, C: 6, D: 7, E: 8 })
    expect(answers.sentaku.KN).toEqual({ A: 8, B: 9, C: 10, D: 11, E: 12 })
    expect(issues.map(i => `${i.where}: ${i.reason}`)).toEqual([
      'R99 正答 択一 RS 問6: 正答が複数（C・D）。公表どおりなら corrections の multi で指定する',
      'R99 正答 択一 IP 問9: 正答が複数（D・E）。公表どおりなら corrections の multi で指定する',
    ])
  })
})

// ---------------------------------------------------------------------------
// 複数正答（問題誤りの公表）と空欄ごとの語群の正答

function takuQuestion(code: string, qNo: number): OfficialTakuQuestion {
  return {
    scoredSubject: code, qNo, kind: 'one', direction: 'wrong',
    lead: '架空の記述のうち、誤っているものはどれか。',
    items: ITEM_LABELS.map(l => ({ labelRaw: l, label: l, text: `架空の記述${l}` })),
    choices: [], comboPairs: null, countOptions: null,
  }
}
const TAKU_CODES = ['RK', 'RS', 'KY', 'IP', 'KH', 'KO', 'KN']
const SENTAKU_CODES = ['RK', 'RS', 'KY', 'RI', 'SI', 'KH', 'KO', 'KN']

function fullYear(): OfficialYear {
  const taku = TAKU_CODES.flatMap(c => Array.from({ length: 10 }, (_, i) => takuQuestion(c, i + 1)))
  const sentaku: OfficialSentakuQuestion[] = SENTAKU_CODES.map(c => ({
    scoredSubject: c,
    stem: '架空の本文は［A］［B］［C］［D］［E］である。',
    blanks: [...ITEM_LABELS],
    wordbank: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), `架空語句${i + 1}`])),
    ...(c === 'RS' ? { groups: { A: [1, 2, 3, 4], B: [5, 6, 7, 8], C: [9, 10, 11, 12], D: [13, 14, 15, 16], E: [17, 18, 19, 20] } } : {}),
  }))
  const answers: OfficialAnswers = {
    taku: Object.fromEntries(TAKU_CODES.map(c => [c, [...'ABCDEABCDE'] as OfficialAnswers['taku'][string]])),
    sentaku: Object.fromEntries(SENTAKU_CODES.map(c => [c, { A: 1, B: 2, C: 3, D: 4, E: 4 }])),
  }
  answers.taku.RS[5] = null   // 正答表で C・D が積まれていた問
  return { year: 'R99', taku, sentaku, answers }
}

describe('複数正答（corrections の multi）', () => {
  it('truth は正解とされた肢がすべて方向どおり', () => {
    const q = takuQuestion('RS', 6)
    expect(deriveTruths(q, 3, [3, 4])).toEqual([true, true, false, false, true])
    expect(deriveTruths(q, 3)).toEqual([true, true, false, true, true])
  })

  it('answer_spec に correct（先頭）と accepted（全部）を持ち、law_note に公表を残す', () => {
    const units = buildOfficialYear(fullYear(), {
      fixture: true,
      corrections: { questions: { R99_T_RS_06: { action: 'multi', correct: ['C', 'D'], note: '架空の公表: C及びDを正答' } } },
    })
    const taku = units.find(u => u.format === 'taku')!
    expect(taku.passed).toBe(true)
    const q = taku.questions.find(x => x.id === 'R99_T_RS_06')!
    expect(q.answer_spec).toEqual({ kind: 'one', direction: 'wrong', correct: 3, accepted: [3, 4] })
    const items = taku.items.filter(i => i.question_id === 'R99_T_RS_06')
    expect(items.map(i => i.truth)).toEqual([true, true, false, false, true])
    expect(items.every(i => i.law_note === '問題誤りの公表により複数の選択肢を正解とした: 架空の公表: C及びDを正答')).toBe(true)
    expect(taku.questions.find(x => x.id === 'R99_T_RS_05')!.answer_spec).toEqual({ kind: 'one', direction: 'wrong', correct: 5 })
  })

  it('multi は「1つ選ぶ」問だけ・2つ以上の A〜E だけ', () => {
    const data = fullYear()
    data.taku![10 + 5] = { ...takuQuestion('RS', 6), kind: 'count', countOptions: [1, 2, 3, 4, 5], items: takuQuestion('RS', 6).items.map((it, i) => ({ ...it, labelRaw: 'アイウエオ'[i] })) }
    const bad = buildOfficialYear(data, { fixture: true, corrections: { questions: { R99_T_RS_06: { action: 'multi', correct: ['C', 'D'], note: 'x' } } } })
    expect(bad[0].passed).toBe(false)
    expect(bad[0].issues.map(i => i.reason)).toContain('複数正答（multi）は「1つ選ぶ」問だけに指定できる')
    const one = buildOfficialYear(fullYear(), { fixture: true, corrections: { questions: { R99_T_RS_06: { action: 'multi', correct: ['C'], note: 'x' } } } })
    expect(one[0].passed).toBe(false)
  })
})

describe('空欄ごとの語群の正答', () => {
  it('正答表の ①〜④ を、その空欄の語群の通し番号に直し、groups を answer_spec に持つ', () => {
    const units = buildOfficialYear(fullYear(), { fixture: true, corrections: { questions: { R99_T_RS_06: { action: 'multi', correct: ['C', 'D'], note: 'x' } } } })
    const sentaku = units.find(u => u.format === 'sentaku')!
    expect(sentaku.passed).toBe(true)
    const rs = sentaku.questions.find(q => q.id === 'R99_S_RS')!
    expect(rs.answer_spec).toMatchObject({ kind: 'sentaku', blanks: { A: 1, B: 6, C: 11, D: 16, E: 20 }, groups: { A: [1, 2, 3, 4] } })
    expect(sentaku.questions.find(q => q.id === 'R99_S_RK')!.answer_spec).not.toHaveProperty('groups')
  })

  it('空欄の語群の数を超える正答は失敗', () => {
    const data = fullYear()
    data.answers!.sentaku.RS = { A: 5, B: 1, C: 1, D: 1, E: 1 }
    const sentaku = buildOfficialYear(data, { fixture: true }).find(u => u.format === 'sentaku')!
    expect(sentaku.passed).toBe(false)
    expect(sentaku.issues.map(i => i.reason)).toContain('空欄 A の正答 5 がその空欄の語群（4 語）に無い')
  })
})
