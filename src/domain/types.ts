import type { Attempt } from '../lib/attempt.js'
import type { ScoringModel } from './scoring.js'

// ==============================
// ドメイン型定義
// 資格(Exam) → 科目(Subject) → 章(Chapter) → 問題(Question) の階層。
// マスターデータは DB 化せず src/data/ に TS として分離し、この型で表現する。
// ==============================

// 学習資格のID（現在は 'sharoushi' のみ）。DB の exam_id 列の値と一致させる。
export type ExamId = string

// 科目の表示名（'労基' など。licensehub-expansion.md §3.2）。
export type Subject = string

// S = 完璧に理解した（復習不要）。復習キューから外すが、いつでも復習に戻せる（due_date を再設定するだけ）。
export type Status = 'S' | 'A' | 'B' | 'C' | '未着手'

// 問題の学習形態（所要時間の推定に使う）。
//   'calc'   … 計算問題（立式が必要）
//   'memory' … 暗記・概念問題（立式せず頭で解ける。社労士の肢はすべてこれ）
// 未設定は「未分類」として扱う。
export type StudyMode = 'calc' | 'memory'

export interface MasterQuestion {
  id: string
  number: number
  title: string
  difficulty: 1 | 2 | 3
  importance?: 1 | 2 | 3
  studyMode?: StudyMode
}

export interface Chapter {
  code: string
  name: string
  subject: Subject
  totalCount: number   // オーム社原本の問題数（捨て問含む）
  questions: MasterQuestion[]
}

export interface SubjectDefinition {
  id: string           // 'rouki'
  name: Subject         // '理論'
  chapters: Chapter[]
}

// 資格ごとの試験制度の差異（§7.8）。UIの分岐やモデルの拡張点はここに集約する。
export interface ExamFeatures {
  // 科目別の配点・足切り（licensehub-expansion.md §4.3）。未指定なら passingScore の従来経路。
  scoring?: ScoringModel
  // 全問がテキストを持つ資格（社労士）。問題を見る／解くを画像の有無に依らず出す。
  allText?: boolean
}

export interface ExamDefinition {
  id: ExamId
  name: string          // '社労士'
  passingScore: number  // 60（移行判定・合格ライン・想定得点推定の既定値）
  features: ExamFeatures
  subjects: SubjectDefinition[]
}

// ==============================
// 進捗・FSRS 状態
// ==============================

export interface ReviewHistoryEntry {
  date: string
  status: Status
  // 解答時間（秒）。「問題を見る」→A/B/C の計測（§7.6）。
  // 未計測（計測前データ・画像未登録・30分超などの外れ値）は付かない＝オプショナル。
  duration_seconds?: number
  // 解答前コミットの観測値（選んだ選択肢・降参したか）。
  // docs/design/calculation-active-learning.md §3.2。旧データには無いのでオプショナル。
  attempt?: Attempt
  // その記録時に実際に FSRS へ渡した目標保持率（adaptive-fsrs-policy.md §3.4・Phase C）。
  //
  // ポリシーは日々変わる。記録時の値を残さないと、`deriveFromHistory` が履歴を再生する
  // たびに過去の予定日まで書き換わり、**何が起きているか誰にも分からなくなる**
  // ―― 利用者の一次不満（「現状が分からない」）の悪化そのもの。
  // 再生時は `entry.policy?.retention ?? retentionFor(entry.date, examDate)` とすることで、
  // 旧データは従来式のまま（後方互換）・新データは記録時の値（決定的）になる。
  // attempt と同じ JSONB の器に入るためマイグレーションは不要。
  //
  // w_version は、その記録に使った FSRS パラメータ w[] の版（denken_fsrs_params.version）。
  // 保持率とまったく同じ理由でここに残す ―― w[] は忘却曲線そのものを決めるので、
  // 版を書き残さずに差し替えると過去の予定日がすべて書き換わる。
  // 省略・0 は ts-fsrs の既定パラメータ（学習前）を意味する。
  policy?: { retention: number; w_version?: number }
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
// 模試セッション（denken_mock_sessions。テーブル名は旧名のまま据え置き）
// ==============================

export type MockMode = 'cbt' | 'free'
export type MockStatus = 'in_progress' | 'finished' | 'abandoned'

// 1問ぶんの解答状態。
export interface MockAnswer {
  selected: number[]                 // 選んだ選択肢の番号。未解答の要素は 0
  flagged?: boolean                  // 「後で見直す」フラグ
  seconds?: number                   // その問題を表示していた累積秒数（§7.6）
}

export interface MockSession {
  kind?: 'paper'                     // 判別子（省略可）。テキストの模試は TextMockSession
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

// テキストの本番形式模試（社労士。licensehub-expansion.md §7）。同じ denken_mock_sessions の行で、
// subject_id は式（'taku'｜'sentaku'）、paper_id は年度（'R99'）、section_scores は採点科目コード → 得点（{"RK":7,...}）。
// score はその式の総得点（素点。100点換算ではない）。
export interface TextMockSession extends Omit<MockSession, 'kind' | 'subject_id' | 'section_scores'> {
  kind: 'text'
  subject_id: 'taku' | 'sentaku'
  section_scores: Record<string, number> | null
}

export type AnyMockSession = MockSession | TextMockSession

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
