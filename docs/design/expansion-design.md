# 拡張設計書：年度別演習・多資格対応・試験日程ベースのペース分析

- 作成日: 2026-07-22
- ステータス: レビュー待ち（設計のみ・実装は別PR）
- 対象リポジトリ: daizooo/denken3（電験3種 過去問マスター）

---

## 1. 背景と目的

現在のアプリはオーム社「分野別過去問」（理論）の周回管理に特化している。
一方で学習計画上、以下のニーズが確定・想定されている。

| 時期 | ニーズ |
|---|---|
| 2026/11中旬〜 | 公式過去問の**年度別演習**開始。「60点×2回連続」で次科目へ移行判定 |
| 常時 | **試験日程を起点にした学習ペース分析**（残り日数から新規消化ペース・復習負荷を逆算） |
| 2027年以降 | 電験3種の残り科目（機械・電力・法規）に加え、合格後の**電験2種・エネ管・電工2種・危険物乙4**等への横展開 |

本設計書は、この3つを **既存データ（denken_reviews の進捗・FSRS状態）を壊さずに** 段階導入するための構成を定める。

## 2. 現状分析

### 2.1 現状アーキテクチャ

```
src/App.tsx（約1,470行・単一ファイル）
├─ MASTER DATA     … 章別問題配列（DC_QUESTIONS 等9章・理論のみ）をハードコード
├─ FSRS簡易実装    … calcFSRS()（保持率0.9固定・間隔上限なし）
├─ 状態管理        … reviews: Record<question_id, Review> を全件フェッチ
└─ UI              … 今日の復習 / 全問題 / 分析 の3タブ

supabase/migrations/
├─ 001 denken_reviews  … PK(user_id, question_id)・FSRS状態・メモ・タグ
└─ 002 denken_settings … daily_cap（1日の復習上限、端末間同期）
```

### 2.2 拡張の障害になっている点

1. **question_id が資格・教材スコープを持たない**（`dc_1` 等）。別資格・別教材を足すとID衝突リスクがあり、集計も分離できない。
2. **マスターデータとアプリロジックが同一ファイル**。問題集を足すたびApp.tsxが肥大化する（既に4万トークン超）。
3. **「分野別1周回」前提のデータモデル**。年度別演習（=セッション単位のスコア記録）を表現する場所がない。
4. **時間軸の概念がない**。試験日・申込期限・休止期間（育休 8/13〜9/23 等）をアプリが知らないため、ペース逆算・FSRS間隔の試験日クリップができない。

### 2.3 活かせる資産

- 分野別問題のタイトルに **出典（`H10-A5`、`R6上-B16` 等）が既に記録されている**。これを構造化すれば、年度別過去問の各問と分野別問題の**相互リンク**（誤答→分野別復習の前倒し等）を自動生成できる。
- 年度別の問題・正答は**公式に公表されており取得可能**。アプリ内解答（CBT再現）に必要なデータは揃えられる。
- FSRS状態・review_history はそのまま流用可能。スキーマ追加のみで移行できる。

## 3. 要件整理

### 必須（今回の設計スコープ）

- **R1 試験日程設定**: 資格×科目ごとに試験日・申込期間を登録できる。休止期間（演習ゼロ期間）も登録できる。
- **R2 ペース分析**: 残り日数（休止期間控除後）・残り未着手数から「必要新規ペース（問/日）」「現ペースでの完走予測日」を算出し、先行/順調/遅延を表示する。申込期限は事前にリマインド表示する。
- **R3 復習最適化**: FSRSの復習予定日が試験日を越えないよう間隔を制限（クリップ）し、直前期は弱点（C/B×重要度高）優先で復習を組む。
- **R4 年度別演習（CBT模試）**: 公式公表の過去問データ（問題・正答）をアプリに収録し、**CBT本番と同等の形式**（制限時間90分・問題ナビゲーション・後で見直すフラグ・5択解答・自動採点）で年度・回（例: R6上）単位の通し演習ができる。**60点×2回連続**の移行判定を自動表示する。
- **R5 多資格対応**: 電験2種・エネ管等を後から追加できる構造にする。既存の理論データ・進捗は無変更で動き続ける。

### 非スコープ

- **分野別**教材の問題文・解説の収録（現行どおり書籍参照。アプリはメタデータと進捗のみ）。※年度別は問題・解説とも収録する（R4参照）
- 複数ユーザー向け機能（現行どおり個人利用・RLSで分離）
- 電験2種二次試験（記述式）の採点支援 ※枠だけ設ける

## 4. 設計方針（サマリ）

| 論点 | 決定 | 理由 |
|---|---|---|
| マスターデータの置き場 | **DB化せず、TSファイルのままコード管理を継続**。ただし `src/data/` に資格・科目別で分離 | 単一ユーザー・追記はClaude Codeセッションで行う運用が確立済み。gitで版管理でき、管理UIが不要 |
| 資格の識別 | ドメイン階層 **Exam（資格）→ Subject（科目）→ QuestionSet（教材）→ Chapter → Question** を導入。DBには `exam_id` 列を追加 | 資格ごとの科目構成・試験制度の違い（科目合格、一次/二次）を吸収する最小の階層 |
| 既存 question_id | **変更しない**。一意性は `(exam_id, question_id)` で担保 | 進捗データ移行を無リスクにする。既存行は `exam_id='denken3'` でバックフィル |
| 年度別演習 | **CBT本番を再現する模試システム**。公式公表の問題・正答を回（ペーパー）単位で収録し、アプリ内で解答・採点する | 本番と同じ操作感（時間管理・見直しフラグ・5択）での訓練が目的。公表データがあるため収録可能 |
| 年度別問題の表示形式 | 問題文・図は**問題単位で切り出した画像**、選択肢・正答・配点はメタデータ。取得元は**電験王**（問題・解説が同一ページにあり、私的利用の範囲で取得） | 数式・回路図の転記/レンダリング（KaTeX等）を不要にし、転記ミスをゼロにする。CBT本番も静的な問題表示であり体験は損なわれない。解説も同時に確保できる |
| 年度別の収録範囲 | **2010年度（H22）〜令和8年度上期（R8上）**の全回（約21回分） | 演習量を最大化する。取り込みは直近回から遡順で段階実施 |
| 分野別との連携 | 年度別の各問に `sourceQuestionId`（分野別問題への参照）を任意で持たせる | 誤答→分野別の該当問題の復習前倒し、既習カバレッジ表示に使う（従属関係は年度別→分野別の一方向） |
| ペース分析 | 試験日程テーブル＋純関数の分析モジュール（`src/lib/pace.ts`）。UIは分析タブに統合 | ロジックをUIから分離しテスト可能にする |
| App.tsx | データ分離と機能追加のタイミングで **features/ 構成に分割** | これ以上の単一ファイル成長を止める |

## 5. ドメインモデルとデータ配置

### 5.1 ドメイン階層

```
Exam（資格）           denken3 / denken2 / enekan / …
└─ Subject（科目）     理論 / 電力 / 機械 / 法規（資格ごとに定義）
   └─ QuestionSet     オーム社分野別（bunya）/ 公式過去問年度別（nendo）/ …
      └─ Chapter      分野別: 直流回路… ／ 年度別: R6上・R6下…（=1回分）
         └─ Question  既存 MasterQuestion ＋ sources（出典）
```

### 5.2 TypeScript 型（`src/domain/types.ts` 新設）

```ts
type ExamId = 'denken3' | 'denken2' | 'enekan' | (string & {})

interface ExamDefinition {
  id: ExamId
  name: string                    // '電験三種'
  subjects: SubjectDefinition[]
  passingScore: number            // 60（移行判定・合格ラインの既定値）
  features: {
    subjectPass: boolean          // 科目合格制度（電験3種: true）
    twoStage: boolean             // 一次/二次（電験2種: true）
  }
}

interface SubjectDefinition {
  id: string                      // 'riron'
  name: string                    // '理論'
  questionSets: QuestionSet[]
}

interface QuestionSet {
  id: string                      // 'ohmsha-bunya'
  name: string                    // 'オーム社 分野別過去問'
  kind: 'bunya' | 'nendo'
  chapters: Chapter[]
}

interface MasterQuestion {        // 既存＋sources追加
  id: string                      // 既存ID維持（例 'dc_1'）
  number: number
  title: string
  difficulty: 1 | 2 | 3
  importance?: 1 | 2 | 3
  sources?: PastExamRef[]         // 出典。年度別⇔分野別リンクの生成元
}

interface PastExamRef {
  era: 'H' | 'R'
  year: number                    // H10, R6 → 10, 6
  session?: '上' | '下'           // R4以降のみ
  section: 'A' | 'B'
  number: number                  // A5 → 5
}

// ---- 年度別（CBT模試）----

interface PaperDefinition {
  id: string                      // 'r6-1'（R6上期）
  examId: ExamId
  subjectId: string               // 'riron'
  name: string                    // '令和6年度 上期'
  timeLimitMin: number            // 理論: 90
  questions: PaperQuestion[]      // 理論: A×14 + B×3（選択問題含む）
}

interface PaperQuestion {
  id: string                      // 'r6-1_a05'
  section: 'A' | 'B'
  number: number                  // 表示上の問番号
  imageUrl: string                // 問題文・図・選択肢を含む切り出し画像
  explanationImageUrl?: string    // 解説の切り出し画像（結果画面でのみ表示）
  explanationUrl?: string         // 取得元（電験王）該当ページURL（外部参照用）
  selectable?: boolean            // B問題の選択問題（問17/18択一等）
  parts: PaperQuestionPart[]      // A問題は1要素。B問題は (a)(b) の2要素
  topic?: string                  // 'RLC共振' 等（分野集計用）
  sourceQuestionId?: string       // 分野別の既存問題ID（例 'ac1_54'）任意
}

interface PaperQuestionPart {
  label?: '(a)' | '(b)'
  correct: 1 | 2 | 3 | 4 | 5      // 公式正答
  points: number                  // A: 5点 / B: 5点×2 等（配点は回により定義）
}
```

### 5.3 ファイル配置（Phase 0 で実施）

```
src/
├─ domain/types.ts                 # 上記型定義
├─ data/
│  ├─ registry.ts                  # EXAMS: ExamDefinition[]（唯一の入口）
│  └─ denken3/
│     └─ riron/
│        ├─ ohmsha-bunya/
│        │  ├─ dc.ts               # DC_QUESTIONS を移設
│        │  ├─ ac1.ts … ecircuit.ts
│        │  └─ index.ts            # Chapter[] を組み立て
│        ├─ papers/                # 年度別（CBT模試）メタデータ
│        │  ├─ r6-1.ts             # PaperDefinition（正答・配点・画像パス）
│        │  ├─ r6-2.ts …
│        │  └─ index.ts            # PAPERS: PaperDefinition[]
│        └─ index.ts               # SubjectDefinition
├─ public/papers/denken3/riron/    # または Supabase Storage（§9参照）
│  └─ r6-1/a01.png, a01_exp.png …  # 電験王から切り出した問題画像＋解説画像の対
├─ lib/
│  ├─ supabase.ts                  # 既存
│  ├─ fsrs.ts                      # calcFSRS を移設＋試験日クリップ対応
│  ├─ pace.ts                      # ペース分析（純関数）
│  └─ sources.ts                   # タイトル文字列→PastExamRef パーサ＋分野別⇔年度別リンク解決
├─ features/
│  ├─ review/                      # 今日の復習タブ
│  ├─ list/                        # 全問題タブ
│  ├─ dashboard/                   # 分析タブ（ペース分析を含む）
│  ├─ mock-exam/                   # 年度別演習タブ（Phase 2）
│  └─ settings/                    # 試験日程・休止期間・上限設定
└─ App.tsx                         # ルーティングと認証のみ（目標200行以下）
```

`sources` は当面、既存タイトル末尾の `（H10-A5）` 等を `sources.ts` のパーサで実行時に解釈する（**データの二重管理をしない**）。表記ゆれでパースできないものはビルド時チェック（lint スクリプト）で検出し、順次 `sources` フィールドへ明示移行する。

## 6. DBスキーマ設計

### 6.1 migration 003: exam_id 導入（Phase 0）

```sql
-- 既存進捗を壊さずに資格スコープを導入する
ALTER TABLE denken_reviews ADD COLUMN exam_id TEXT NOT NULL DEFAULT 'denken3';
ALTER TABLE denken_reviews DROP CONSTRAINT denken_reviews_pkey;
ALTER TABLE denken_reviews ADD PRIMARY KEY (user_id, exam_id, question_id);
```

- 既存行は DEFAULT で自動バックフィルされ、アプリ側は当面 `eq('exam_id', currentExam)` を付けるだけ。
- `question_id` の命名規則は資格内一意（現行どおり）。新資格では `d2_riron_xx` のように科目を含めた接頭辞を推奨（規約であり制約にはしない）。

### 6.2 migration 004: 試験日程・休止期間（Phase 1）

```sql
CREATE TABLE denken_exam_plans (
  user_id            UUID NOT NULL,
  exam_id            TEXT NOT NULL,          -- 'denken3'
  subject_id         TEXT NOT NULL,          -- 'riron'
  label              TEXT NOT NULL DEFAULT '', -- '2027年2月 下期CBT'
  exam_date          DATE NOT NULL,
  application_start  DATE,                   -- 申込開始（例 2026-11-09）
  application_end    DATE,                   -- 申込締切（例 2026-11-26）※リマインド対象
  bunya_target_date  DATE,                   -- 分野別完走の目標日（未設定時は exam_date - 90日）
  nendo_start_date   DATE,                   -- 年度別演習の開始予定日
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, exam_id, subject_id)
);

CREATE TABLE denken_pause_periods (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  start_date DATE NOT NULL,                  -- 例 2026-08-13（育休）
  end_date   DATE NOT NULL,                  -- 例 2026-09-23
  label      TEXT NOT NULL DEFAULT '',
  mode       TEXT NOT NULL DEFAULT 'no_new'  -- 'no_new'(新規停止・復習のみ) / 'full_stop'(全停止)
             CHECK (mode IN ('no_new', 'full_stop'))
);
```

（両テーブルとも denken_reviews と同形の RLS ポリシーを付与する。）

### 6.3 migration 005: 年度別演習セッション（Phase 2）

CBT模試はアプリ内で解答するため、セッション（受験1回）と解答内容をDBに保存する。
中断・再開（端末をまたぐ場合を含む）に対応するため、解答のたびに autosave する。

```sql
CREATE TABLE denken_mock_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  exam_id           TEXT NOT NULL,            -- 'denken3'
  subject_id        TEXT NOT NULL,            -- 'riron'
  paper_id          TEXT NOT NULL,            -- 'r6-1'（PaperDefinition.id）
  mode              TEXT NOT NULL DEFAULT 'cbt'
                    CHECK (mode IN ('cbt', 'free')),  -- cbt: 90分計測 / free: 時間無制限
  status            TEXT NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'finished', 'abandoned')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  remaining_seconds INTEGER,                  -- 中断時の残り時間（cbtモードのみ）
  answers           JSONB NOT NULL DEFAULT '{}',
    -- { "r6-1_a05": {"selected": [3], "flagged": true}, "r6-1_b16": {"selected": [2,4]} }
    -- selected は parts の並び順に対応（A問題は1要素、B問題は(a)(b)の2要素）
  score             INTEGER,                  -- 採点確定時に格納（100点換算）
  section_scores    JSONB,                    -- {"A": 55, "B": 20} / topic別集計はアプリ側で導出
  memo              TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON denken_mock_sessions (user_id, exam_id, subject_id, started_at);
```

- 採点は `PaperDefinition` の正答・配点と `answers` から導出できるが、正答データの改訂に影響されないよう **finished 時点のスコアを確定値として保存**する。
- 移行判定「60点×2回連続」は `status='finished'` かつ `mode='cbt'` のセッションを `finished_at` 降順で見て、直近2件が `score >= passingScore` かで導出（アプリ側の純関数。DBには持たない）。
- `in_progress` セッションが存在する場合、年度別タブに「再開」カードを表示する。同一ペーパーの複数回受験は新セッションとして記録（回数制限なし）。

## 7. 機能設計

### 7.1 試験日程設定（R1）

- 設定画面（features/settings）で資格×科目ごとに `denken_exam_plans` を編集。
- 初期値プリセット: 電験3種の CBT期・筆記日程はマスターに年度テンプレートを持たず**手入力**とする（年度で変わるため。プレースホルダとして既知の確定日程をフォームの説明文に表示）。
- ヘッダーに「理論試験まで あと N 日」のカウントダウンを常時表示。
- `application_start/end` が設定されており、当日が「開始14日前〜締切」の範囲にある場合、**申込リマインドバナー**を全タブ上部に表示（締切3日前からは赤色強調）。締切超過で未申込のまま放置される事故（=CBT欠席は筆記も受験不可）を防ぐことが目的。

### 7.2 ペース分析（R2）— `src/lib/pace.ts`

すべて純関数として実装し、入力は `(questions, reviews, plan, pausePeriods, today)`。

```
実働残日数 R  = (対象日 - today) から full_stop 期間を除いた日数
              （no_new 期間は「新規」の分母からのみ除外）

【新規消化ペース】
  残り未着手 U = 分野別の status='未着手' 件数
  必要ペース   = U / R(対象日 = bunya_target_date)          … 問/日
  現在ペース   = 直近14日の新規着手数 / 14（休止日は分母から除外）
  完走予測日   = today + U / 現在ペース
  判定         = 完走予測日 vs bunya_target_date → 先行 n日 / 順調 / 遅延 n日

【復習負荷予測】
  試験日までの due_date 分布ヒストグラム（週単位）
  ＋ 未着手を必要ペースで着手した場合に発生する初回復習の推定を重ねる
  → 「このペースだと11月の1日あたり復習は約m問」を可視化し、daily_cap の妥当性を判断

【年度別期の指標（Phase 2以降）】
  直近スコア推移・60点ライン・移行判定まであと n 回
```

表示は分析タブ最上部に「ペース」カードを追加:

1. カウントダウン＋マイルストーン表（分野別完走目標 → 年度別開始 → 申込期間 → 試験日）
2. 必要ペース vs 現在ペース（数値＋差分の色分け）
3. 週次の復習負荷予測バーチャート（既存の recharts を流用）
4. 遅延が14日超の場合は警告表示（軌道修正の提案文言つき）

### 7.3 復習最適化（R3）

FSRS計算（`lib/fsrs.ts`）に試験日コンテキストを渡す。

- **間隔クリップ**: `interval = min(interval, 試験日までの残日数)`。加えて直前期テーパー:
  - 残り28日以内 → 間隔上限14日
  - 残り14日以内 → 間隔上限7日
  - これにより「試験後に復習予定が漏れる」「直前に間隔が開きすぎて忘れる」を防ぐ。
- **休止期間の考慮**: due_date が `full_stop` 期間に落ちる場合は期間明けに繰り延べ（`no_new` 期間は復習継続なので繰り延べない）。
- **直前期の優先度**: 既存 todayPlan のソート（遅延→理解度→重要度）は維持しつつ、残り28日以内は「C/B かつ importance=3」を最優先に引き上げるブースト項を追加。
- **既存データへの影響**: 既に設定済みの due_date は次回レビュー時に新ロジックで再計算されるだけであり、一括変換は行わない。

### 7.4 年度別演習（R4）— features/mock-exam（CBT模試システム）

新タブ「年度別」を追加（`nendo_start_date` 到来まではタブを目立たせない/バッジ表示のみ）。
**CBT本番と同じ操作で解ける**ことを最優先に設計する。

#### (1) ペーパー選択画面

- 収録済みペーパー（R6上 等）を一覧表示。各カードに受験回数・ベストスコア・最終受験日。
- モード選択: **CBTモード**（90分カウントダウン・本番同等）/ **フリーモード**（時間無制限・練習用）。
- `in_progress` セッションがあれば最上部に「再開」カード。

#### (2) 解答画面（CBT再現）

本番CBT（試験センターのCBT体験版）に準拠したUI:

- **ヘッダー**: 残り時間カウントダウン（フリーモードは経過時間）・解答済み/全問数。
- **問題表示**: 切り出し画像（問題文・図・選択肢を含む）を原寸で表示。ピンチズーム/拡大対応（スマホ・iPad前提）。
- **解答操作**: (1)〜(5) の選択ボタン。B問題は (a)(b) を同一画面で個別に選択。
- **ナビゲーション**: 前へ/次へ、および**問題一覧グリッド**（解答済み=塗り・見直しフラグ=マーク・未解答=白 の3状態表示）から任意の問題へジャンプ。
- **後で見直すフラグ**: 問題ごとにトグル。一覧グリッドに反映。
- **選択問題**: B問題の択一（問17/18等）は「どちらを解答するか」を先に選ばせる。
- **終了**: 「試験終了」ボタン→未解答・フラグ付きの残数を出して確認→採点確定。時間切れ（CBTモード）は自動終了・自動採点。
- **中断**: 明示的な中断ボタンで `remaining_seconds` を保存して退出。解答は都度autosaveされるため、ブラウザが落ちても失われない。厳格モード（中断不可）は**作らない**——中断しない運用は利用者の裁量に委ねる（確定仕様）。
- **計算用メモ**: 画面内メモ機能は**作らない**。本番同様、手元に計算用紙を用意して解く前提とする（確定仕様）。

#### (3) 採点・結果画面

- 総得点（100点換算）・A/B別得点・60点ラインとの差・所要時間。
- 問題別の○×一覧: 自分の解答 vs 正答。問題画像と**解説画像**（電験王由来・`explanationImageUrl`）をその場で開いて振り返り可能。解説は採点前には一切表示しない。
- **分野別集計**: `topic` / `sourceQuestionId` から章単位の正答率を集計し、弱い章を提示。
- **移行判定カード**: 直近2回（CBTモード・確定分）のスコアと「60点×2回連続」の達成状況を明示（達成時: 「機械科目へ移行OK」）。スコア推移の折れ線＋60点ライン。
- **誤答の分野別連携**: 誤答問題に `sourceQuestionId` があれば、該当する分野別問題の復習を前倒し（due_date を今日に設定）するアクションをワンタップで提供。

#### (4) 問題データの取り込みワークフロー（運用）

取得元は**電験王**（問題・解説が同一ページに掲載。**私的利用の範囲**で取得し、再配布しない）。
回ごとに以下を作成する（Claude Codeセッションで半自動化）:

1. 電験王の該当ページから、**問題部分**と**解説部分**を分けて画像に切り出し →
   `public/papers/denken3/riron/{paperId}/` に `a01.png` / `a01_exp.png` の対で配置（幅1200px程度・PNG/WebP）。
   解答画面には問題画像のみを表示し、解説画像は採点後の結果画面でのみ開けるようにする（ネタバレ防止）。
2. 正答・配点・選択問題フラグ・電験王ページURLを `PaperDefinition` として `src/data/.../papers/{paperId}.ts` に作成。
   正答は公式正答表と突き合わせて検証する。
3. `topic` / `sourceQuestionId`（分野別リンク）は任意で追記。既存タイトルの出典パーサ（`sources.ts`）で逆引きの候補を自動提示し、目視確認して確定する。
4. ビルド時チェック: 画像ファイルの存在・問題数（理論: A14+B3）・配点合計100点をスクリプトで検証。

**収録範囲は 2010年度（H22）〜令和8年度上期（R8上）の全回（約21回分）**。
取り込みは直近回（R8上・R7下…）から遡順で段階実施し、Phase 2b の完了ラインとする。
年1回制の H22〜R3 は12回、上期/下期制の R4〜R8上 は9回。未公表・未掲載の回はスキップして後日追加。

### 7.5 多資格対応（R5）

- `data/registry.ts` の `EXAMS` 配列に ExamDefinition を追加するだけで新資格が現れる構造にする（UIは registry 駆動）。
- 資格切替UIは、登録資格が2つ以上になるまで非表示（現状のUIを維持）。
- 資格ごとの差異は ExamDefinition の `features` で吸収:
  - 電験3種・2種一次: 科目合格制（subjectPass: true）→ 科目ごとの試験日・合格済みフラグ
  - 電験2種: 一次/二次（twoStage: true）→ Subject を「一次:理論…」「二次:電力管理・機械制御」として定義（二次は記述式のためA/B/C自己評価をそのまま流用）
  - エネ管: 課目I〜IV を Subject として定義
- 進捗系テーブルはすべて `exam_id`（＋`subject_id`）でスコープ済みのため、DB変更は不要。
- 科目合格の有効期限（電験3種: 申請により最大5回等）は exam_plans の label/memo 運用とし、モデル化しない（過剰設計を避ける）。

## 8. 実装フェーズ計画

学習スケジュール（11月中旬 年度別開始・11/9〜26 申込・2027/2 受験）から逆算して優先順位を付ける。

| Phase | 内容 | 完了目標 | 規模感 |
|---|---|---|---|
| **0** | リファクタリング: `src/data/` 分離・features分割・migration 003（exam_id）。**挙動変更なし** | 2026/8上旬 | 中（機械的移動が主） |
| **1** | 試験日程設定＋ペース分析＋申込リマインド＋FSRS試験日クリップ・休止期間（migration 004） | 2026/8中旬（育休前） | 中 |
| **2a** | CBT模試エンジン: 解答画面・タイマー・採点・移行判定・セッション保存（migration 005）＋直近2回分（R7上・R6下）のデータ収録 | 2026/10中旬 | 大 |
| **2b** | 年度別データ拡充（H22〜R8上の全約21回分・直近回から遡順）・分野別リンク・分野別集計・弱点連携 | 直近10回分: 2026/11上旬（年度別開始前）／残りは順次 | 中〜大（大半はデータ入力） |
| **3** | 多資格対応の仕上げ: registry 駆動UI・資格切替・電験3種の機械/電力/法規データ追加から順次 | 2027年〜 必要時 | 小（構造はPhase 0で完成済み） |

各Phaseは独立したPRとし、Phase 0 完了時点で既存機能のデグレがないことを確認してから進める。

## 9. 非機能・リスク

- **データ互換**: すべての migration は追加・PK拡張のみで破壊的変更なし。ロールバックは列削除で可能。実施前に Supabase のバックアップ（無料枠の日次）を確認。
- **RLS**: 新テーブルはすべて既存と同形の `auth.uid() = user_id` ポリシーを付与。
- **オフライン/複数端末**: 現行同様「最後の書き込みが勝つ」方針を維持（単一ユーザーのため競合は実質発生しない）。
- **出典パーサの精度**: タイトル表記ゆれ（`R3／R5下` `H15／R5上` など区切り文字の揺れ）があるため、パーサはビルド時チェックで全件検証し、失敗分はログに出して手動修正する。分野別リンクは参考情報のため、パース漏れが学習記録・採点を壊すことはない。
- **問題データの正確性**: 正答・配点の転記ミスは採点を直接壊すため、ビルド時チェック（問題数・配点合計100点・画像存在）を必須とする。問題文は画像方式のため転記ミスが原理的に発生しない。
- **著作権・公開範囲**: 問題・解説の取得元は電験王であり、**私的利用の範囲**に限定する（本アプリはGoogleログイン・RLSで本人のみアクセス）。リポジトリ・デプロイ先を公開設定にせず、コンテンツの再配布を行わないことを運用の前提とする。取得は手動ペースで行い、取得元サイトに負荷をかけない。
- **画像アセットのサイズ**: 問題+解説で1回分約34枚×21回分＝約700枚。WebP圧縮（1枚100〜200KB目安）で総量100MB前後になり得るため、**年度別画像は最初から Supabase Storage 配置を第一候補**とする（`imageUrl` はURL文字列のため、リポジトリ内 `public/` とStorageのどちらでも動く。少量のうちは `public/` でも可）。
- **過剰設計の抑制**: 解説文の収録・複数ユーザー・科目合格期限の厳密モデル化は明示的に非スコープ。必要になった時点で追補する。

## 10. 未決事項（実装前に確認したいこと）

1. 休止期間中の復習（Anki側と二重になる期間）のアプリ上の扱い: `no_new`（復習は継続表示）で良いか。
2. ペース分析の「現在ペース」の窓（本書は直近14日）: 週末集中型の学習パターンなら21日窓の方が安定する可能性。

### 決定済み（2026-07-22 ユーザー回答）

- 収録範囲: **2010年度（H22）〜令和8年度上期（R8上）の全回**。取得元は電験王（私的利用）。→ §7.4(4)
- CBTタイマー: 厳格モードは**なし**（中断＝残り時間保存の単一仕様。中断しない運用は利用者の裁量）。→ §7.4(2)
- 計算用メモ: 画面内メモは**なし**（本番想定・手元の計算用紙で解く）。→ §7.4(2)
- 解答時間の計測: 年度別・分野別とも**問題単位で計測しデータ化**する。→ §7.6
- 分析機能: 単純集計から、理解度×解答時間×分野を統合した**総合分析**へ強化する。→ §7.7
