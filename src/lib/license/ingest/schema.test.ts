// 書き起こしJSONの検証・DB行への変換・件数報告（licensehub-expansion.md §4.2・§14・PR-J1a）。
import { describe, expect, it } from 'vitest'
import {
  FIXTURE_YEARS, formatSummary, holdoutGroupOf, isFixtureId, parseSourceRef, summarize, toRows, validateTranscription,
} from './schema'
import fixtureRaw from '../../../../scripts/license/fixtures/ippon-fixture.json?raw'
import invalidRaw from '../../../../scripts/license/fixtures/ippon-fixture-invalid.json?raw'

const item = (over: Record<string, unknown> = {}) => ({
  source_ref: 'R03-RK-05-C', statement: '本文', truth: false,
  explanation: '解説', topic: '01 総則', importance: 'A', ...over,
})

const reasonsOf = (input: unknown[], opts = { studySubject: 'rouki' }) =>
  validateTranscription(input, opts).errors.flatMap(e => e.reasons)

describe('parseSourceRef', () => {
  it('座標を分解し、ア〜オを A〜E に正規化する（元の表記は labelRaw）', () => {
    expect(parseSourceRef('R03-RK-05-ウ')).toEqual({
      ref: { year: 'R03', scoredSubject: 'RK', qNo: 5, labelRaw: 'ウ' }, label: 'C',
    })
  })

  it('形式・科目コード・問番号・肢ラベルの誤りを理由つきで返す', () => {
    expect(parseSourceRef('R03_RK_5_C')).toHaveProperty('reasons')
    expect(parseSourceRef('R03-ZZ-05-C')).toEqual({ reasons: [expect.stringContaining('科目コードが未知')] })
    expect(parseSourceRef('R03-RI-05-C')).toEqual({ reasons: [expect.stringContaining('択一式に無い科目コード')] })
    expect(parseSourceRef('R03-RK-11-C')).toEqual({ reasons: [expect.stringContaining('問番号が範囲外')] })
    expect(parseSourceRef('R03-RK-00-C')).toEqual({ reasons: [expect.stringContaining('問番号が範囲外')] })
    expect(parseSourceRef('R03-RK-05-カ')).toEqual({ reasons: [expect.stringContaining('肢ラベルが不正')] })
  })
})

describe('validateTranscription', () => {
  it('正しい肢から §4.2 の肢ID・問ID を作る', () => {
    const { valid, errors } = validateTranscription([item({ source_ref: 'R03-RK-05-ア' })], { studySubject: 'rouki' })
    expect(errors).toEqual([])
    expect(valid[0]).toMatchObject({
      itemId: 'R03_T_RK_05_A', questionId: 'R03_T_RK_05', label: 'A', labelRaw: 'ア',
      studySubject: 'rouki', scoredSubject: 'RK', qNo: 5, truth: false, importance: 'A', holdoutGroup: null,
    })
  })

  it('必須項目・truth の型・空の本文の欠けを失敗にする', () => {
    expect(reasonsOf([item({ statement: undefined })])).toEqual([expect.stringContaining('statement が無い')])
    expect(reasonsOf([item({ statement: '  ' })])).toEqual(['statement（本文）が空'])
    expect(reasonsOf([item({ truth: 'false' })])).toEqual([expect.stringContaining('truth が true/false でない')])
    expect(reasonsOf([item({ truth: undefined })])).toEqual([expect.stringContaining('truth が true/false でない')])
    expect(reasonsOf([item({ source_ref: undefined })])).toEqual(['source_ref が無い・空'])
  })

  it('任意項目の型・値と、不明な項目を失敗にする', () => {
    expect(reasonsOf([item({ importance: 'S' })])).toEqual([expect.stringContaining('importance は A/B/C')])
    expect(reasonsOf([item({ explanation: 3 })])).toEqual(['explanation が文字列でない'])
    expect(reasonsOf([item({ explaination: 'x' })])).toEqual([expect.stringContaining('不明な項目')])
  })

  it('任意項目は省略・空文字を null にする', () => {
    const { valid } = validateTranscription([item({ explanation: '', topic: undefined, importance: null })], { studySubject: 'rouki' })
    expect(valid[0]).toMatchObject({ explanation: null, topic: null, importance: null })
  })

  it('学習科目の欠け・未知・採点科目との不一致（§4.3）を失敗にする', () => {
    expect(reasonsOf([item()], { studySubject: '' })).toEqual([expect.stringContaining('study_subject が無い')])
    expect(reasonsOf([item({ study_subject: 'xxx' })])).toEqual(['学習科目が未知: xxx'])
    expect(reasonsOf([item({ study_subject: 'kenpo' })])).toEqual([expect.stringContaining('採点科目 RK に含まれない')])
    // 肢の study_subject は --subject より優先する。徴収は労災・雇用に含まれる。
    const { valid } = validateTranscription([item({ source_ref: 'R03-RS-09-A', study_subject: 'choushu' })], { studySubject: 'rousai' })
    expect(valid[0].studySubject).toBe('choushu')
  })

  it('肢IDの重複（ア と A のような表記違いを含む）は該当の全肢を失敗にする', () => {
    const { valid, errors } = validateTranscription(
      [item({ source_ref: 'R03-RK-05-A' }), item({ source_ref: 'R03-RK-05-ア' }), item({ source_ref: 'R03-RK-05-B' })],
      { studySubject: 'rouki' },
    )
    expect(valid.map(v => v.itemId)).toEqual(['R03_T_RK_05_B'])
    expect(errors.map(e => e.index)).toEqual([0, 1])
    expect(errors[0].reasons[0]).toContain('肢IDが重複: R03_T_RK_05_A（#0, #1）')
  })

  it('同じ問の肢で学習科目が食い違うものを失敗にする', () => {
    const { valid, errors } = validateTranscription(
      [item({ source_ref: 'R03-RK-05-A', study_subject: 'rouki' }), item({ source_ref: 'R03-RK-05-B', study_subject: 'anei' })],
    )
    expect(valid).toEqual([])
    expect(errors).toHaveLength(2)
    expect(errors[0].reasons[0]).toContain('学習科目が食い違う')
  })

  it('最上位が配列でなければ全体を失敗にする', () => {
    expect(validateTranscription({ items: [] }).errors[0].reasons).toEqual(['JSON の最上位が肢の配列でない'])
    expect(validateTranscription([42]).errors[0].reasons).toEqual(['肢がオブジェクトでない'])
  })

  it('フィクスチャ年度は --fixture のときだけ通し、--fixture ではそれ以外の年度を通さない', () => {
    expect(reasonsOf([item({ source_ref: 'R99-RK-01-A' })])).toEqual([expect.stringContaining('フィクスチャ専用の年度')])
    const fx = (ref: string) => validateTranscription([item({ source_ref: ref })], { studySubject: 'rouki', fixture: true })
    expect(fx('R99-RK-01-A').errors).toEqual([])
    expect(fx('R03-RK-01-A').errors[0].reasons).toEqual([expect.stringContaining('年度は R98/R99 のみ')])
  })
})

describe('isFixtureId / holdoutGroupOf', () => {
  it('フィクスチャ年度の問・肢だけを識別する', () => {
    expect(isFixtureId('R99_T_RK_01_A')).toBe(true)
    expect(isFixtureId('R98_T_RK_01')).toBe(true)
    expect(isFixtureId('R08_T_RK_01_A')).toBe(false)
    expect(isFixtureId('R9X_T_RK_01_A')).toBe(false)
    expect(isFixtureId('dc_1')).toBe(false)
  })

  it('温存は廃止したので、どの座標にも温存グループを付けない（§8）', () => {
    expect(holdoutGroupOf('R07', 'RK')).toBeNull()
    expect(holdoutGroupOf('R07', 'KH')).toBeNull()
    expect(holdoutGroupOf('R08', 'KN')).toBeNull()
    expect(holdoutGroupOf('R03', 'RK')).toBeNull()
  })
})

describe('toRows', () => {
  it('問は1行にまとめ、書籍の肢として lic_items の行を作る（origin_statement は送らない）', () => {
    const { valid } = validateTranscription(
      [item({ source_ref: 'R07-RK-01-A' }), item({ source_ref: 'R07-RK-01-B', explanation: null, truth: true })],
      { studySubject: 'rouki' },
    )
    const { questions, items } = toRows(valid, 'u1')
    expect(questions).toEqual([{
      user_id: 'u1', id: 'R07_T_RK_01', year: 'R07', format: 'taku', scored_subject: 'RK', study_subject: 'rouki',
      q_no: 1, stem: null, answer_spec: null, source: 'ippon', holdout_group: null,
    }])
    expect(items[0]).toEqual({
      user_id: 'u1', id: 'R07_T_RK_01_A', question_id: 'R07_T_RK_01', label: 'A', label_raw: 'A',
      statement: '本文', truth: false, truth_source: 'book', explanation: '解説', explanation_source: 'book',
      explanation_verified: true, topic_id: '01 総則', importance: 'A', law_status: 'ok', law_note: null,
      study_subject: 'rouki', scored_subject: 'RK',
    })
    expect(items[1]).toMatchObject({ explanation: null, explanation_source: 'none', explanation_verified: false })
    expect(items[0]).not.toHaveProperty('origin_statement')
  })
})

describe('summarize / formatSummary', () => {
  it('科目別・年度別の件数を出す（温存は廃止したので温存対象は0件）', () => {
    const { valid } = validateTranscription([
      item({ source_ref: 'R07-RK-01-A' }), item({ source_ref: 'R08-RK-01-A', topic: null }),
      item({ source_ref: 'R03-RK-07-A', study_subject: 'anei', importance: undefined }),
    ], { studySubject: 'rouki' })
    const s = summarize(valid)
    expect(s).toEqual({
      items: 3, questions: 3,
      byStudySubject: { anei: 1, rouki: 2 },
      byYear: { R03: 1, R07: 1, R08: 1 },
      byHoldout: {},
      withoutExplanation: 0, withoutTopic: 1, withoutImportance: 1,
    })
    expect(formatSummary(s).join('\n')).toContain('温存対象:   0 件')
  })
})

describe('フィクスチャ（scripts/license/fixtures）', () => {
  const FILES: Record<string, string> = { 'ippon-fixture.json': fixtureRaw, 'ippon-fixture-invalid.json': invalidRaw }
  const read = (name: string) => JSON.parse(FILES[name])

  it('ippon-fixture.json は架空年度の100肢で、すべて検証を通る', () => {
    const { valid, errors } = validateTranscription(read('ippon-fixture.json'), { fixture: true })
    expect(errors).toEqual([])
    expect(valid).toHaveLength(100)
    expect(valid.every(v => FIXTURE_YEARS.includes(v.year) && isFixtureId(v.itemId))).toBe(true)
    expect(valid.every(v => v.statement.includes('架空'))).toBe(true)
  })

  it('ippon-fixture-invalid.json は1肢だけ通り、残りは理由つきで失敗する', () => {
    const input = read('ippon-fixture-invalid.json')
    const { valid, errors } = validateTranscription(input, { fixture: true })
    expect(valid.map(v => v.itemId)).toEqual(['R98_T_RK_07_A'])
    expect(errors).toHaveLength(input.length - 1)
    expect(errors.every(e => e.reasons.length > 0)).toBe(true)
  })
})
