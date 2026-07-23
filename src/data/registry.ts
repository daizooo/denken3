// マスターデータの唯一の入口（registry）。
// 資格・科目・章を追加するときは各 data ファイルを編集し、ここから辿れるようにする。
import type { Chapter, ExamDefinition, ExamId, Subject } from '../domain/types'
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
