// マスター索引（本文なし）の生成（licensehub-expansion.md §4.5・PR-J1a）。
// scripts/license/build-master.mjs が DB の lic_items からこの関数で
// src/data/sharoushi/subjects/<学習科目>.ts を作り、registry（subjects/index.ts）の末尾に1行足す。
//
// 章 = 論点グループ（topic_id）。章の並びは論点名の自然順（目次番号を先頭に書けば目次順になる）、
// 論点の無い肢は末尾の「論点未設定」にまとめる。章内の肢は肢ID順（年度→問→肢）。
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

const IMPORTANCE_WEIGHT: Record<Importance, 1 | 2 | 3> = { A: 3, B: 2, C: 1 }

const byNatural = (a: string, b: string) => a.localeCompare(b, 'ja', { numeric: true })

export function chapterConstName(subjectId: string): string {
  return `${subjectId.toUpperCase()}_CHAPTERS`
}

// 肢の索引上の表題: 論点名（年度 問n 肢）。電験の分野別（'抵抗直列回路（H10-A5）'）と同じ形。
function titleOf(topic: string, id: string): string {
  const c = parseItemId(id)
  return c ? `${topic}（${c.year} 問${c.qNo} ${c.label}）` : `${topic}（${id}）`
}

export function buildSubjectChapters(
  items: MasterSourceItem[], subject: { id: string; name: string },
): Chapter[] {
  const groups = new Map<string, MasterSourceItem[]>()
  for (const it of items) {
    const topic = it.topic_id?.trim() || NO_TOPIC
    groups.set(topic, [...(groups.get(topic) ?? []), it])
  }
  const topics = [...groups.keys()].sort((a, b) =>
    a === NO_TOPIC ? 1 : b === NO_TOPIC ? -1 : byNatural(a, b))
  return topics.map((topic, i) => {
    const qs = [...groups.get(topic)!].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const questions: MasterQuestion[] = qs.map((it, j) => ({
      id: it.id,
      number: j + 1,
      title: titleOf(topic, it.id),
      difficulty: 2,
      ...(it.importance ? { importance: IMPORTANCE_WEIGHT[it.importance] } : {}),
      studyMode: 'memory',
    }))
    return {
      code: `${subject.id}_${String(i + 1).padStart(2, '0')}`,
      name: topic,
      subject: subject.name,
      totalCount: questions.length,
      questions,
    }
  })
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
