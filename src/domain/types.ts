// ==============================
// ドメイン型定義
// 資格(Exam) → 科目(Subject) → 章(Chapter) → 問題(Question) の階層。
// マスターデータは DB 化せず src/data/ に TS として分離し、この型で表現する。
// ==============================

// 学習資格。将来 'denken2' | 'enekan' | 'denko2' 等を追加する。
export type ExamId = 'denken3'

export type Subject = '理論' | '電力' | '機械' | '法規'

export type Status = 'A' | 'B' | 'C' | '未着手'

export interface MasterQuestion {
  id: string
  number: number
  title: string
  difficulty: 1 | 2 | 3
  importance?: 1 | 2 | 3
}

export interface Chapter {
  code: string
  name: string
  subject: Subject
  totalCount: number   // オーム社原本の問題数（捨て問含む）
  questions: MasterQuestion[]
}

export interface SubjectDefinition {
  id: string           // 'riron'
  name: Subject         // '理論'
  chapters: Chapter[]
}

export interface ExamDefinition {
  id: ExamId
  name: string          // '電験3種'
  subjects: SubjectDefinition[]
}

// ==============================
// 進捗・FSRS 状態
// ==============================

// 記録直前のFSRS状態のスナップショット。
// 履歴エントリを取り消したとき、スケジューラで再計算するのではなく
// この値へ正確に巻き戻すために使う（アルゴリズム変更の影響を受けない）。
export interface ReviewSnapshot {
  status: Status
  stability: number
  difficulty_fsrs: number
  repetitions: number
  lapses: number
  due_date: string | null
  last_reviewed: string | null
  fsrs_state: number
}

export interface ReviewHistoryEntry {
  date: string
  status: Status
  // 記録時に付与。取消時にこの状態へ戻す。旧データには無いのでオプショナル。
  prev?: ReviewSnapshot
  // 解答時間（秒）。「問題を見る」→A/B/C の計測（§7.6）。
  // 未計測（計測前データ・画像未登録・30分超などの外れ値）は付かない＝オプショナル。
  duration_seconds?: number
}

export interface Review {
  question_id: string
  status: Status
  stability: number
  difficulty_fsrs: number
  due_date: string | null
  repetitions: number
  lapses: number
  last_reviewed: string | null
  fsrs_state: number
  tags: string[]
  memo: string
  review_history: ReviewHistoryEntry[]
  first_reviewed: string | null
}

// ==============================
// 試験日程（denken_exam_plans / §6.2）
// 資格×科目ごとの試験日・申込期間・マイルストーン。
// ペース分析（§7.2）・申込リマインド（§7.1）・FSRS試験日クリップ（§7.3）の起点。
// ==============================
export interface ExamPlan {
  exam_id: string
  subject_id: string
  label: string
  exam_date: string | null           // 'YYYY-MM-DD'
  application_start: string | null
  application_end: string | null
  bunya_target_date: string | null   // 未設定なら exam_date - 90日を既定として扱う
  nendo_start_date: string | null
}
