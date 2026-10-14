// 公式PDFの抽出テキスト → 構造化（licensehub-expansion.md §13・PR-D）。
import { describe, expect, it } from 'vitest'
import { parseTakuText, detectDirection } from './parseTaku'
import { parseSentakuText, sentenceWithBlank } from './parseSentaku'
import { answersFromJson, parseAnswersText } from './parseAnswers'
import { findGarbled, joinLines, splitLines } from './text'
import { classifyStudy, headingSubject, takuStudySubject, sentakuBlankStudySubject } from './subjects'

describe('text', () => {
  it('ページ番号・改ページの行を落とし、折り返しを詰める', () => {
    expect(splitLines('本文1\n－ 3 －\n\f\n  12  \n本文2')).toEqual(['本文1', '本文2'])
    expect(joinLines(['架空の事業所は\u3000所定の', '手続を行う。', 'ABC', 'DEF'])).toBe('架空の事業所は所定の手続を行う。ABC DEF')
  })

  it('添字・記号の崩れを検出する（§13）', () => {
    expect(findGarbled('通常の賃金の１₂５パーセント')).toEqual([expect.stringContaining('添字')])
    expect(findGarbled('４２')).toEqual([expect.stringContaining('私用領域')])
    expect(findGarbled('額に�を乗じる')).toEqual([expect.stringContaining('置換文字')])
    expect(findGarbled('(cid:12)')).toEqual([expect.stringContaining('cid')])
    expect(findGarbled('４Ö２')).toEqual([expect.stringContaining('ラテン文字')])
    expect(findGarbled('４÷２×３ ①⑳ Ａ（アとイ）')).toEqual([])
  })
})

describe('subjects', () => {
  it('見出しは正式名（＋括弧書き）だけを科目と読む', () => {
    expect(headingSubject('労働者災害補償保険法（労働保険の保険料の徴収等に関する法律を含む。）', 'taku')).toBe('RS')
    expect(headingSubject('労務管理その他の労働及び社会保険に関する一般常識', 'taku')).toBe('IP')
    expect(headingSubject('労務管理その他の労働に関する一般常識', 'sentaku')).toBe('RI')
    expect(headingSubject('健康保険法（以下「法」という。）に関する次の記述', 'taku')).toBeNull()
    expect(headingSubject('雇用保険法第10条の規定', 'taku')).toBeNull()
  })

  it('問・空欄 → 学習科目（既定の分割位置と上書き）', () => {
    expect(takuStudySubject('RK', 7)).toBe('rouki')
    expect(takuStudySubject('RK', 8)).toBe('anei')
    expect(takuStudySubject('RS', 8)).toBe('choushu')
    expect(takuStudySubject('IP', 5)).toBe('rouippan')
    expect(takuStudySubject('IP', 6)).toBe('shaippan')
    expect(takuStudySubject('IP', 5, { IP: 4 })).toBe('shaippan')
    expect(takuStudySubject('KH', 9)).toBe('kenpo')
    expect(sentakuBlankStudySubject('RK', 'C')).toBe('rouki')
    expect(sentakuBlankStudySubject('RK', 'D')).toBe('anei')
    expect(sentakuBlankStudySubject('SI', 'D')).toBe('shaippan')
  })

  it('本文の語から労一・社一を判定する（両方・どちらも無ければ判定しない）', () => {
    expect(classifyStudy('IP', '労働契約法に関する記述')).toBe('rouippan')
    expect(classifyStudy('IP', '国民健康保険法に関する記述')).toBe('shaippan')
    expect(classifyStudy('IP', '労働契約法と介護保険法')).toBeNull()
    expect(classifyStudy('IP', '架空の記述')).toBeNull()
    expect(classifyStudy('KH', '国民健康保険法')).toBeNull()
  })
})

const TAKU = `表紙の注意事項
労働基準法及び労働安全衛生法
〔問 1〕 労働基準法に関する次の記述のうち、誤って
いるものはどれか。
Ａ\u3000架空の記述Ａの
\u3000\u3000続きである。
Ｂ\u3000架空の記述Ｂ
Ｃ\u3000架空の記述Ｃ
－ 1 －
Ｄ\u3000架空の記述Ｄ
Ｅ\u3000架空の記述Ｅ
〔問 2〕 次のアからオの記述のうち、正しいものの組合せは、後記ＡからＥまでのうちどれか。
ア\u3000架空の記述ア
イ\u3000架空の記述イ
ウ\u3000架空の記述ウ
エ\u3000架空の記述エ
オ\u3000架空の記述オ
Ａ（アとイ）\u3000Ｂ（アとウ）\u3000Ｃ（イとエ）
Ｄ（ウとオ）\u3000Ｅ（エとオ）
〔問 3〕 次のアからオの記述のうち、誤っているものはいくつあるか。
ア\u3000架空の記述ア
イ\u3000架空の記述イ
ウ\u3000架空の記述ウ
エ\u3000架空の記述エ
オ\u3000架空の記述オ
Ａ\u3000一つ\u3000\u3000Ｂ\u3000二つ\u3000\u3000Ｃ\u3000三つ
Ｄ\u3000四つ\u3000\u3000Ｅ\u3000五つ
労働者災害補償保険法（労働保険の保険料の徴収等に関する法律を含む。）
〔問 1〕 労災保険法に関する次の記述のうち、正しいものはどれか。
Ａ\u3000Ａ社に雇用される労働者の記述
Ｂ\u3000架空の記述Ｂ
Ｃ\u3000架空の記述Ｃ
Ｄ\u3000架空の記述Ｄ
Ｅ\u3000架空の記述Ｅ
`

describe('parseTakuText', () => {
  const { questions, issues } = parseTakuText(TAKU, 'R99')

  it('科目の見出しと問番号で問に分け、肢の折り返し・ページ番号を処理する', () => {
    expect(issues).toEqual([])
    expect(questions.map(q => `${q.scoredSubject}-${q.qNo}`)).toEqual(['RK-1', 'RK-2', 'RK-3', 'RS-1'])
    const q1 = questions[0]
    expect(q1).toMatchObject({ kind: 'one', direction: 'wrong', lead: '労働基準法に関する次の記述のうち、誤っているものはどれか。', choices: [] })
    expect(q1.items.map(i => i.label).join('')).toBe('ABCDE')
    expect(q1.items[0].text).toBe('架空の記述Ａの続きである。')
    expect(q1.items[3].text).toBe('架空の記述Ｄ')
  })

  it('組合せ・個数の問は肢ア〜オ（A〜E に正規化）と選択肢を読む', () => {
    const [, combo, count] = questions
    expect(combo).toMatchObject({ kind: 'combo', direction: 'right', choices: ['アとイ', 'アとウ', 'イとエ', 'ウとオ', 'エとオ'] })
    expect(combo.comboPairs).toEqual([['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'E']])
    expect(combo.items.map(i => `${i.labelRaw}${i.label}`)).toEqual(['アA', 'イB', 'ウC', 'エD', 'オE'])
    expect(combo.items[4].text).toBe('架空の記述オ')
    expect(count).toMatchObject({ kind: 'count', direction: 'wrong', countOptions: [1, 2, 3, 4, 5] })
  })

  it('肢の本文が「Ａ社」で始まっても肢の印と誤認しない', () => {
    expect(questions[3].items[0].text).toBe('Ａ社に雇用される労働者の記述')
  })

  it('見出しが読めなくても、問1の出現で科目の並びどおりに進む。通し番号（問11〜）も読む', () => {
    const body = (n: number) => `〔問 ${n}〕 次の記述のうち、正しいものはどれか。\nＡ\u3000a\nＢ\u3000b\nＣ\u3000c\nＤ\u3000d\nＥ\u3000e`
    const perSubject = parseTakuText([1, 2, 1].map(body).join('\n'), 'R99').questions
    expect(perSubject.map(q => `${q.scoredSubject}-${q.qNo}`)).toEqual(['RK-1', 'RK-2', 'RS-1'])
    const serial = parseTakuText(Array.from({ length: 12 }, (_, i) => body(i + 1)).join('\n'), 'R99').questions
    expect(serial.slice(-2).map(q => `${q.scoredSubject}-${q.qNo}`)).toEqual(['RS-1', 'RS-2'])
  })

  it('問型・方向を読めないものは null（ゲートで失敗にする）', () => {
    const q = parseTakuText('〔問 1〕 次の記述について答えよ。\nア\u3000a\nイ\u3000b\nウ\u3000c\nエ\u3000d\nオ\u3000e', 'R99').questions[0]
    expect(q.kind).toBeNull()
    expect(q.direction).toBeNull()
    expect(detectDirection('前文で誤りを述べる。次の記述のうち、妥当なものはどれか。')).toBe('right')
    expect(detectDirection('次の記述のうち、適切でないものはどれか。')).toBe('wrong')
  })
})

const SENTAKU = `〔問 1〕 次の文中の［\u3000\u3000］の部分を選択肢の中の最も適切な語句で埋め、完全な文章とせよ。
労働基準法及び労働安全衛生法
1\u3000架空の規程によれば、事業主は\u3000Ａ\u3000までに届け出る。給付は\u3000Ｂ
とし、Ａ社の\u3000Ｃ\u3000から始まる。
2\u3000架空の審査会は\u3000Ｄ\u3000の委員で組織し、任期は［ Ｅ ］とする。
① 語1\u3000② 語2\u3000③ 語3
④ 語4\u3000⑤ 語5\u3000⑳ 語20
〔問 2〕 次の文中の［\u3000\u3000］の部分を選択肢の中の最も適切な語句で埋め、完全な文章とせよ。
労働者災害補償保険法
本文\u3000Ａ\u3000だけ。
① 語1
`

describe('parseSentakuText', () => {
  const { questions, issues } = parseSentakuText(SENTAKU, 'R99')

  it('1科目＝1問。空欄を ［A］ にそろえ、語群を番号 → 語句にする', () => {
    expect(issues).toEqual([])
    expect(questions.map(q => q.scoredSubject)).toEqual(['RK', 'RS'])
    const rk = questions[0]
    expect(rk.blanks).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(rk.stem).toBe('1 架空の規程によれば、事業主は［A］までに届け出る。給付は［B］とし、Ａ社の［C］から始まる。2 架空の審査会は［D］の委員で組織し、任期は［E］とする。')
    expect(rk.wordbank).toEqual({ 1: '語1', 2: '語2', 3: '語3', 4: '語4', 5: '語5', 20: '語20' })
    expect(questions[1].blanks).toEqual(['A'])
  })

  it('空欄を含む1文をカードの本文にする（段落番号は落とす）', () => {
    expect(sentenceWithBlank(questions[0].stem, 'D')).toBe('架空の審査会は［D］の委員で組織し、任期は［E］とする。')
    expect(sentenceWithBlank(questions[0].stem, 'B')).toBe('給付は［B］とし、Ａ社の［C］から始まる。')
  })
})

describe('parseAnswersText', () => {
  it('表の向き（問×科目 / 科目×問、科目×空欄 / 空欄×科目）を読み、合格基準の文章は読み飛ばす', () => {
    const text = [
      '選択式試験は、総得点25点以上かつ各科目3点以上である者。択一式試験は総得点47点以上',
      '労働基準法及び 労働安全衛生法 ③ ⑫ ⑤ ⑱ ⑨',
      '問1\u3000C\u3000A\u3000D\u3000B\u3000D\u3000D\u3000D',
      '健康保険法\u3000ＤＢＣＤＥＡＢＣＤＥ',
      'B ① ② ③ ④ ⑤ ⑥ ⑦ ⑧',
    ].join('\n')
    const { answers, issues } = parseAnswersText(text, 'R99')
    expect(issues).toEqual([])
    expect(answers.sentaku.RK).toEqual({ A: 3, B: 1, C: 5, D: 18, E: 9 })   // B 行で RK の B を上書き
    expect(answers.sentaku.KN).toEqual({ B: 8 })
    expect(answers.taku.RK[0]).toBe('C')
    expect(answers.taku.IP[0]).toBe('B')
    expect(answers.taku.KH).toEqual(['D', 'B', 'C', 'D', 'E', 'A', 'B', 'C', 'D', 'E'])
  })

  it('読めない表記は null と理由、2通りに読めたら失敗', () => {
    const { answers, issues } = parseAnswersText('国民年金法 A B 全員正解 C D E A B C D\n国民年金法 A B C D D E A B C D', 'R99')
    expect(answers.taku.KN[2]).toBe('C')
    expect(issues.map(i => i.level)).toEqual(['warning', 'error'])
  })

  it('正答JSON（文字列・配列）を読む', () => {
    const { answers, reasons } = answersFromJson({ taku: { RK: 'ACEBD ABCDE' }, sentaku: { RK: [3, 12, 5, 18, 9], KH: { A: 1 } } })
    expect(reasons).toEqual([])
    expect(answers.taku.RK.join('')).toBe('ACEBDABCDE')
    expect(answers.sentaku.RK).toEqual({ A: 3, B: 12, C: 5, D: 18, E: 9 })
    expect(answers.sentaku.KH).toEqual({ A: 1 })
    expect(answersFromJson({ taku: { RK: 3 } }).reasons).toHaveLength(1)
  })
})
