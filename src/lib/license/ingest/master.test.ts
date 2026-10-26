// マスター索引（本文なし）の生成（licensehub-expansion.md §4.5・PR-J1a）。
import { describe, expect, it } from 'vitest'
import { NO_TOPIC, addToRegistry, buildSubjectChapters, chapterConstName, renderSubjectFile } from './master'

const ROUKI = { id: 'rouki', name: '労基' }
const it_ = (id: string, topic: string | null, importance: 'A' | 'B' | 'C' | null = null) => ({ id, topic_id: topic, importance })

describe('buildSubjectChapters', () => {
  const items = [
    it_('R99_T_RK_02_A', '10 架空の賃金', 'A'),
    it_('R98_T_RK_01_B', '2 架空の契約', 'C'),
    it_('R98_T_RK_01_A', '2 架空の契約'),
    it_('R98_T_RK_03_A', null, 'B'),
  ]

  it('論点ごとに章を作り、論点名の自然順・論点未設定は末尾、章内は肢ID順に並べる', () => {
    const chapters = buildSubjectChapters(items, ROUKI)
    expect(chapters.map(c => [c.code, c.name, c.totalCount])).toEqual([
      ['rouki_01', '2 架空の契約', 2],
      ['rouki_02', '10 架空の賃金', 1],
      ['rouki_03', NO_TOPIC, 1],
    ])
    expect(chapters[0].subject).toBe('労基')
    expect(chapters[0].questions).toEqual([
      { id: 'R98_T_RK_01_A', number: 1, title: '2 架空の契約（R98 問1 A）', difficulty: 2, studyMode: 'memory' },
      { id: 'R98_T_RK_01_B', number: 2, title: '2 架空の契約（R98 問1 B）', difficulty: 2, importance: 1, studyMode: 'memory' },
    ])
    expect(chapters[1].questions[0].importance).toBe(3)
  })

  it('入力の順序に依らず同じ結果になる（再生成で差分が出ない）', () => {
    expect(buildSubjectChapters([...items].reverse(), ROUKI)).toEqual(buildSubjectChapters(items, ROUKI))
  })
})

describe('buildSubjectChapters（選択式）', () => {
  const mixed = [
    it_('R98_S_RK_B', null),
    it_('R98_T_RK_01_A', '2 架空の契約'),
    it_('R98_S_RK_A', null),
    it_('R99_S_RK_A', null),
  ]

  it('空欄は択一式の章の後ろに1つの章「選択式」としてまとめ、空欄ID順に並べる', () => {
    const chapters = buildSubjectChapters(mixed, ROUKI)
    expect(chapters.map(c => [c.code, c.name, c.totalCount])).toEqual([
      ['rouki_01', '2 架空の契約', 1],
      ['rouki_sentaku', '選択式', 3],
    ])
    expect(chapters[1].questions).toEqual([
      { id: 'R98_S_RK_A', number: 1, title: '選択式（R98 RK 空欄A）', difficulty: 2, studyMode: 'memory' },
      { id: 'R98_S_RK_B', number: 2, title: '選択式（R98 RK 空欄B）', difficulty: 2, studyMode: 'memory' },
      { id: 'R99_S_RK_A', number: 3, title: '選択式（R99 RK 空欄A）', difficulty: 2, studyMode: 'memory' },
    ])
  })

  it('選択式だけの科目は「選択式」の章だけになる。択一式だけなら章は増えない', () => {
    expect(buildSubjectChapters(mixed.filter(i => i.id.includes('_S_')), ROUKI).map(c => c.code)).toEqual(['rouki_sentaku'])
    expect(buildSubjectChapters(mixed.filter(i => i.id.includes('_T_')), ROUKI).map(c => c.code)).toEqual(['rouki_01'])
  })

  it('入力の順序に依らず同じ結果になる', () => {
    expect(buildSubjectChapters([...mixed].reverse(), ROUKI)).toEqual(buildSubjectChapters(mixed, ROUKI))
  })
})

describe('renderSubjectFile', () => {
  it('本文を含まない Chapter[] の TS を出力する', () => {
    const src = renderSubjectFile(ROUKI, buildSubjectChapters([it_('R98_T_RK_01_A', "架空の'引用'", 'A')], ROUKI))
    expect(src).toContain('export const ROUKI_CHAPTERS: Chapter[] = [')
    expect(src).toContain("import type { Chapter } from '../../../domain/types'")
    expect(src).toContain("{ id: 'R98_T_RK_01_A', number: 1, title: '架空の\\'引用\\'（R98 問1 A）', difficulty: 2, importance: 3, studyMode: 'memory' },")
    expect(src).not.toContain('statement')
  })
})

describe('addToRegistry', () => {
  const registry = `// コメント
import type { Chapter } from '../../../domain/types'

export const SHAROUSHI_SUBJECT_CHAPTERS: Record<string, Chapter[]> = {
}
`

  it('import と要素を末尾に追記し、2回目は変更しない', () => {
    const once = addToRegistry(registry, 'rouki')
    const twice = addToRegistry(addToRegistry(once, 'anei'), 'rouki')
    expect(twice).toBe(`// コメント
import type { Chapter } from '../../../domain/types'
import { ROUKI_CHAPTERS } from './rouki.ts'
import { ANEI_CHAPTERS } from './anei.ts'

export const SHAROUSHI_SUBJECT_CHAPTERS: Record<string, Chapter[]> = {
  rouki: ROUKI_CHAPTERS,
  anei: ANEI_CHAPTERS,
}
`)
    expect(chapterConstName('anei')).toBe('ANEI_CHAPTERS')
  })
})
