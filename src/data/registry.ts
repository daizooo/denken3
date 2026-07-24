// マスターデータの唯一の入口（registry）。
// 資格・科目・章を追加するときは各 data ファイルを編集し、EXAMS から辿れるようにする。
// UI はこの registry を起点に描画する（資格・科目のハードコードをしない・§7.8）。
import type { Chapter, ExamDefinition, ExamId, PaperDefinition, Subject, SubjectDefinition } from '../domain/types'
import { DENKEN3_EXAM } from './denken3'

// 全資格。将来 電験2種・エネ管等を配列に追加するだけで UI に現れる。
export const EXAMS: ExamDefinition[] = [DENKEN3_EXAM]

// 既定の資格。アプリ起動時に選択される資格（登録が1つの間はこれで固定）。
export const DEFAULT_EXAM_ID: ExamId = EXAMS[0].id

// 資格IDから定義を引く。未知IDは既定資格にフォールバックする（データ不整合で落とさない）。
export function getExam(id: ExamId): ExamDefinition {
  return EXAMS.find(e => e.id === id) ?? EXAMS[0]
}

// ---- 資格スコープの派生データ（examId を引数に取り、資格切替に追従する）----

// 指定資格の科目定義一覧（試験日程・ペース分析の subject_id 引き当てに使う）。
export function subjectDefsOf(id: ExamId): SubjectDefinition[] {
  return getExam(id).subjects
}

// 指定資格の科目タブの並び。章が未収録の科目もタブとしては表示する。
export function subjectNamesOf(id: ExamId): Subject[] {
  return getExam(id).subjects.map(s => s.name)
}

// 指定資格の全章（科目横断でフラット化）。
export function chaptersOf(id: ExamId): Chapter[] {
  return getExam(id).subjects.flatMap(s => s.chapters)
}

// 移行判定・合格ライン・想定得点推定の合格点。
export function passingScoreOf(id: ExamId): number {
  return getExam(id).passingScore
}

// 科目表示名（'理論'）→ subject_id（'riron'）。
// 定義が見つからない場合は表示名をそのまま id として扱う（フォールバック）。
export function subjectIdOf(examId: ExamId, name: Subject): string {
  return getExam(examId).subjects.find(s => s.name === name)?.id ?? name
}

// 指定資格・指定科目の年度別（CBT模試）ペーパー一覧。未収録なら空配列。
export function papersForSubject(examId: ExamId, name: Subject): PaperDefinition[] {
  return getExam(examId).subjects.find(s => s.name === name)?.papers ?? []
}

// ---- 後方互換の静的エクスポート（既定資格ベース）----
// 資格切替に依存しない箇所（ImportPanel の取り込みパネル等）で使う。
export const PAPERS: PaperDefinition[] = subjectDefsOf(DEFAULT_EXAM_ID).flatMap(s => s.papers ?? [])
