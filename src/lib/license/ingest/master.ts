// マスター索引（本文なし）の生成（licensehub-expansion.md §4.5・PR-J1a）。
// scripts/license/build-master.mjs が DB の lic_items からこの関数で
// src/data/sharoushi/subjects/<学習科目>.ts を作り、registry（subjects/index.ts）の末尾に1行足す。
//
// 章 = 論点グループ（topic_id）。章の並びは論点名の自然順（目次番号を先頭に書けば目次順になる）、
// 論点の無い肢は末尾の「論点未設定」にまとめる。章内の肢は肢ID順（年度→問→肢）。
// 選択式の空欄は論点を持たないので、択一式の章の後ろに1つの章「選択式」（code: <科目>_sentaku）として足す。
// 生成結果は入力の順序に依らない（同じ DB からは常に同じファイルになる）。
import type { Importance } from '../../../domain/license.ts'
import { parseItemId } from '../../../domain/license.ts'
import type { Chapter, MasterQuestion } from '../../../domain/types.ts'

export interface MasterSourceItem {
  id: string
  topic_id: string | null
  importance: Importance | null
}

export const NO_TOPIC = '論点未設定'
export const SENTAKU_CHAPTER = '選択式'

const IMPORTANCE_WEIGHT: Record<Importance, 1 | 2 | 3> = { A: 3, B: 2, C: 1 }

const byNatural = (a: string, b: string) => a.localeCompare(b, 'ja', { numeric: true })

export function chapterConstName(subjectId: string): string {
  return `${subjectId.toUpperCase()}_CHAPTERS`
}

// 肢の索引上の表題: 論点名（年度 問n 肢）。電験の分野別（'抵抗直列回路（H10-A5）'）と同じ形。
// 選択式の空欄は「選択式（R06 RK 空欄A）」（画面側 titleJa が年度・科目を日本語にする）。
function titleOf(topic: string, id: string): string {
  const c = parseItemId(id)
  if (!c) return `${topic}（${id}）`
  return c.format === 'sentaku'
    ? `${topic}（${c.year} ${c.scoredSubject} 空欄${c.label}）`
    : `${topic}（${c.year} 問${c.qNo} ${c.label}）`
}

const isSentaku = (id: string) => parseItemId(id)?.format === 'sentaku'
const byId = (a: MasterSourceItem, b: MasterSourceItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function toQuestions(topic: string, qs: MasterSourceItem[]): MasterQuestion[] {
  return qs.map((it, j) => ({
    id: it.id,
    number: j + 1,
    title: titleOf(topic, it.id),
    difficulty: 2,
    ...(it.importance ? { importance: IMPORTANCE_WEIGHT[it.importance] } : {}),
    studyMode: 'memory',
  }))
}

export function buildSubjectChapters(
  items: MasterSourceItem[], subject: { id: string; name: string },
): Chapter[] {
  const groups = new Map<string, MasterSourceItem[]>()
  for (const it of items.filter(i => !isSentaku(i.id))) {
    const topic = it.topic_id?.trim() || NO_TOPIC
    groups.set(topic, [...(groups.get(topic) ?? []), it])
  }
  const topics = [...groups.keys()].sort((a, b) =>
    a === NO_TOPIC ? 1 : b === NO_TOPIC ? -1 : byNatural(a, b))
  const chapters: Chapter[] = topics.map((topic, i) => {
    const questions = toQuestions(topic, [...groups.get(topic)!].sort(byId))
    return {
      code: `${subject.id}_${String(i + 1).padStart(2, '0')}`,
      name: topic,
      subject: subject.name,
      totalCount: questions.length,
      questions,
    }
  })
  const sentaku = items.filter(i => isSentaku(i.id)).sort(byId)
  if (sentaku.length > 0) {
    chapters.push({
      code: `${subject.id}_sentaku`,
      name: SENTAKU_CHAPTER,
      subject: subject.name,
      totalCount: sentaku.length,
      questions: toQuestions(SENTAKU_CHAPTER, sentaku),
    })
  }
  return chapters
}

const jsString = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

function renderQuestion(q: MasterQuestion): string {
  const importance = q.importance ? `, importance: ${q.importance}` : ''
  return `      { id: ${jsString(q.id)}, number: ${q.number}, title: ${jsString(q.title)}, difficulty: ${q.difficulty}${importance}, studyMode: '${q.studyMode}' },`
}

export function renderSubjectFile(subject: { id: string; name: string }, chapters: Chapter[]): string {
  const body = chapters.map(c => [
    '  {',
    `    code: ${jsString(c.code)}, name: ${jsString(c.name)}, subject: ${jsString(c.subject)}, totalCount: ${c.totalCount},`,
    '    questions: [',
    ...c.questions.map(renderQuestion),
    '    ],',
    '  },',
  ].join('\n')).join('\n')
  return `// ${subject.name}（${subject.id}）の論点グループと肢の索引。本文は含まない（licensehub-expansion.md §4.5）。
// 自動生成: node --env-file-if-exists=.env scripts/license/build-master.mjs --subject ${subject.id}
// 手で編集しない（DB の lic_items が正本。直すときは DB を直して再生成する）。
import type { Chapter } from '../../../domain/types'

export const ${chapterConstName(subject.id)}: Chapter[] = [
${body}
]
`
}

// registry（subjects/index.ts）に科目を追記する。既にあれば変更しない（冪等）。
// import は既存の import の後ろ、要素はオブジェクトの末尾に足す（並び替えない。CLAUDE.md §2）。
export function addToRegistry(src: string, subjectId: string): string {
  const key = `  ${subjectId}: ${chapterConstName(subjectId)},`
  if (src.includes(key)) return src
  const lines = src.split('\n')
  const importLine = `import { ${chapterConstName(subjectId)} } from './${subjectId}.ts'`
  let lastImport = -1
  lines.forEach((l, i) => { if (l.startsWith('import ')) lastImport = i })
  lines.splice(lastImport + 1, 0, importLine)
  const close = lines.lastIndexOf('}')
  if (close < 0) throw new Error('registry の末尾（}）が見つかりません')
  lines.splice(close, 0, key)
  return lines.join('\n')
}
