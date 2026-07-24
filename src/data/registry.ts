// マスターデータの唯一の入口（registry）。
// 資格・科目・章を追加するときは各 data ファイルを編集し、ここから辿れるようにする。
import type { Chapter, ExamDefinition, ExamId, PaperDefinition, Subject, SubjectDefinition } from '../domain/types'
import { DENKEN3_EXAM } from './denken3'

// 全資格。将来 電験2種・エネ管等を配列に追加する。
export const EXAMS: ExamDefinition[] = [DENKEN3_EXAM]

// 現在アプリが対象にしている資格。denken_reviews の exam_id スコープにも使う。
export const CURRENT_EXAM_ID: ExamId = 'denken3'

// 科目タブの並び。章が未入力の科目もタブとしては表示する（現行挙動を維持）。
export const SUBJECTS: Subject[] = ['理論', '電力', '機械', '法規']

function examById(id: ExamId): ExamDefinition {
  const exam = EXAMS.find(e => e.id === id)
  if (!exam) throw new Error(`unknown exam: ${id}`)
  return exam
}

// 現在の資格の全章（科目横断でフラット化）。
export const CHAPTERS: Chapter[] = examById(CURRENT_EXAM_ID)
  .subjects.flatMap(s => s.chapters)

// 現在の資格の科目定義一覧（試験日程・ペース分析の subject_id 引き当てに使う）。
export const SUBJECT_DEFS: SubjectDefinition[] = examById(CURRENT_EXAM_ID).subjects

// 現在の資格の全年度別ペーパー（科目横断）。取り込みパネルの年度別モードで使う。
export const PAPERS: PaperDefinition[] = SUBJECT_DEFS.flatMap(s => s.papers ?? [])

// 科目表示名（'理論'）→ subject_id（'riron'）。
// 定義が未整備の科目（電力・機械・法規）は表示名をそのまま id として扱う（フォールバック）。
export function subjectIdOf(name: Subject): string {
  return SUBJECT_DEFS.find(s => s.name === name)?.id ?? name
}

// 指定科目の年度別（CBT模試）ペーパー一覧。未収録なら空配列。
export function papersForSubject(name: Subject): PaperDefinition[] {
  return SUBJECT_DEFS.find(s => s.name === name)?.papers ?? []
}
