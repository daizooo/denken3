// ==============================
// ドメイン型定義
// 資格(Exam) → 科目(Subject) → 章(Chapter) → 問題(Question) の階層。
// マスターデータは DB 化せず src/data/ に TS として分離し、この型で表現する。
// ==============================

// 学習資格。既知のIDは補完のために列挙しつつ、`(string & {})` で将来のIDも許容する。
export type ExamId = 'denken3' | 'denken2' | 'enekan' | (string & {})

export type Subject = '理論' | '電力' | '機械' | '法規'

// S = 完璧に理解した（復習不要）。復習キューから外すが、いつでも復習に戻せる（due_date を再設定するだけ）。
export type Status = 'S' | 'A' | 'B' | 'C' | '未着手'

// 学習場所の振り分け軸（会社=暗記・概念 / 自宅=計算）。出典（電験王）の問題区分に対応する。
//   'calc'   … 計算問題（立式が必要。回路図の精読・紙での式展開が要る）→ 自宅向け
//   'memory' … 暗記・概念問題（論説・空欄穴埋・選択。立式せず頭で解ける）→ 会社向け
// 未設定は「未分類」（会社モードのフィルタには出さない安全側の扱い）。
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
  id: string           // 'riron'
  name: Subject         // '理論'
  chapters: Chapter[]
  papers?: PaperDefinition[]  // 年度別（CBT模試）ペーパー。未収録の科目は undefined。
}

// 資格ごとの試験制度の差異（§7.8）。UIの分岐やモデルの拡張点はここに集約する。
export interface ExamFeatures {
  subjectPass: boolean  // 科目合格制度（電験3種・2種一次: true）
  twoStage: boolean     // 一次/二次の二段階（電験2種: true）
}

export interface ExamDefinition {
  id: ExamId
  name: string          // '電験3種'
  passingScore: number  // 60（移行判定・合格ライン・想定得点推定の既定値）
  features: ExamFeatures
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
  // タイトル・シェアボタン・動画埋め込み・目次…問題文…ワンポイント解説…解答…関連記事、
  // が縦に並んだ1問1枚の元画像（paperフォルダ内、物理クロップなし）。
  // 実際のStorageパスは paperImagePath(userId, paperId, imageFile) で解決する。
  imageFile: string                  // 'a05.png'
  // 【難易度】行の直後（問題文が始まる位置）の縦位置(%)。表示は常にこの位置から始め、上部の
  // タイトル・共有ボタン・動画・目次・【問題】見出し・難易度行を切り捨てる。既定0=切り捨てなし。
  // 小数可（画像によっては難易度行と本文の間の空白が1%未満しかなく、整数では収まらないため）。
  questionStartPct: number
  // 【ワンポイント解説】見出しの直前（見出し自体も表示しない）の縦位置(%)。CBT解答中はこの位置
  // より下をマスクして隠し、結果画面では解除する（§11.2）。既定100=分割なし（検出不能時に安全側へ
  // 倒し、目視確認を促すためのプレースホルダ）。小数可（questionStartPct と同様の理由）。
  answerYPct: number
  // 解説・解答の実質的な内容が終わる位置（%）。関連記事の宣伝バナー・タグ・共有ボタン・
  // おすすめ記事リンクなど、電験王ページ末尾の定型フッターが始まる直前で切る。
  // 結果画面（showAnswer=true）ではこの位置までを表示する。既定100=切り捨てなし。
  explanationEndPct: number
  explanationUrl?: string            // 取得元（電験王）該当ページURL（外部参照用）
  selectable?: boolean               // B問題の選択問題（問17/18 の択一等）。同一paper内の selectable 群から1問を選ぶ
  parts: PaperQuestionPart[]         // A問題は1要素。B問題は (a)(b) の2要素
  topic?: string                     // 'RLC共振' 等（分野集計用）
  studyMode?: StudyMode              // 会社/自宅の振り分け（計算 / 暗記・概念）。電験王の問題区分に対応（§MasterQuestion 参照）
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
