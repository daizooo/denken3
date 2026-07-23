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
  papers?: PaperDefinition[]  // 年度別（CBT模試）ペーパー。未収録の科目は undefined。
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
// 年度別演習（CBT模試）— PaperDefinition / §5.2・§7.4
// 公式過去問1回分（例: 令和8年度上期 理論）のメタデータ。
// 問題文・図・選択肢・解説はすべて切り出し画像（非公開Storage）で持ち、
// 正答・配点だけをこの TS 定義で持つ（データの二重管理を避ける）。
// ==============================

// 出典（分野別⇔年度別リンクの生成元）。当面は任意フィールド。
export interface PastExamRef {
  era: 'H' | 'R'
  year: number                       // H10, R6 → 10, 6
  session?: '上' | '下'              // R4以降のみ
  section: 'A' | 'B'
  number: number                     // A5 → 5
}

// 1問（A問題）または1小問（B問題の(a)(b)）の正答・配点。
export interface PaperQuestionPart {
  label?: '(a)' | '(b)'
  correct: 1 | 2 | 3 | 4 | 5         // 公式正答（公式正答表と突き合わせて確定する）
  points: number                     // A: 5点 / B: 5点×2 等（配点は回により定義）
}

export interface PaperQuestion {
  id: string                         // 'r8-1_a05'（paperId_セクション+番号）
  section: 'A' | 'B'
  number: number                     // 表示上の問番号（A: 1..14 / B: 15..18）
  // 問題文・図・選択肢を含む切り出し画像のファイル名（paperフォルダ内）。
  // 実際のStorageパスは paperImagePath(userId, paperId, imageFile) で解決する。
  imageFile: string                  // 'a05.png'
  explanationFile?: string           // 'a05_exp.png'（結果画面でのみ表示）
  explanationUrl?: string            // 取得元（電験王）該当ページURL（外部参照用）
  selectable?: boolean               // B問題の選択問題（問17/18 の択一等）。同一paper内の selectable 群から1問を選ぶ
  parts: PaperQuestionPart[]         // A問題は1要素。B問題は (a)(b) の2要素
  topic?: string                     // 'RLC共振' 等（分野集計用）
  sourceQuestionId?: string          // 分野別の既存問題ID（例 'ac1_54'）任意。誤答の復習前倒しに使う
}

export interface PaperDefinition {
  id: string                         // 'r8-1'（R8上期）
  examId: ExamId
  subjectId: string                  // 'riron'
  name: string                       // '令和8年度 上期'
  timeLimitMin: number               // 理論: 90
  questions: PaperQuestion[]         // 理論: A×14 + B×4（うち選択1問）
  // 収録準備中（正答・画像が未確定）のペーパー。選択画面では非活性表示にし、
  // ビルド時の正答・配点チェック（validatePaper）の対象外にする（設計 §8 Phase 2a: エンジン＋雛形）。
  draft?: boolean
}

// ==============================
// CBT模試セッション（denken_mock_sessions / §6.3）
// ==============================

export type MockMode = 'cbt' | 'free'
export type MockStatus = 'in_progress' | 'finished' | 'abandoned'

// 1問ぶんの解答状態。
export interface MockAnswer {
  selected: number[]                 // parts の並び順に対応（A: 1要素 / B: (a)(b) の2要素）。未解答の要素は 0
  flagged?: boolean                  // 「後で見直す」フラグ
  seconds?: number                   // その問題を表示していた累積秒数（§7.6）
}

export interface MockSession {
  id: string
  exam_id: string
  subject_id: string
  paper_id: string
  mode: MockMode
  status: MockStatus
  started_at: string
  finished_at: string | null
  remaining_seconds: number | null   // 中断時の残り時間（cbtモードのみ）
  answers: Record<string, MockAnswer>
  score: number | null               // 採点確定時（100点換算）
  section_scores: { A: number; B: number } | null
  memo: string
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
