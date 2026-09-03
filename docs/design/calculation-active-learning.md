# 計算問題のアクティブラーニング化と FSRS 分離・電験2種スケーラビリティ設計

対象: `denken3`（React + Vite + Supabase / PWA）
起点となる課題: **電験のキモである計算問題が「解説を読むだけ」で終わっており、想起（retrieval）が
起きていない。** 本書はコードベースの実地調査に基づき、最短合格に向けた改修案・DB拡張案・
実装ロードマップを定める。既存設計書（`expansion-design.md` / `study-time-scarcity.md`）の
続きに位置づけ、その決定事項は引き継ぐ。

---

## 1. 現状のコード評価

### 1.1 強み（そのまま活かす資産）

| 資産 | 実体 | なぜ強いか |
|---|---|---|
| ロジックの純関数分離 | `src/lib/{fsrs,reviewPlan,estimateMinutes,pace,mock}.ts` | React・Supabase 非依存。学習モデルを差し替えても UI を触らずに済む |
| **履歴からの決定的再生** | `deriveFromHistory()` + `ReviewHistoryEntry.prev` | 評価軸を後から足しても、`review_history` を再生すれば全フィールドが再導出できる。**本改修の最大の土台** |
| 時間予算（分）ベースの計画 | `estimateMinutes.ts` / `planByBudget()` / `TodayPanel` | 学習時間が希少な利用者に対し、既に「問題数」でなく「分」で線を引けている |
| 画像表示のパラメータ化 | `denken_question_assets`（`question_start_pct` / `answer_y_pct` / `explanation_end_pct`）+ `PaperImage` / `ProblemViewer` | 画像を物理加工せず、**%座標だけで見せる範囲を切り替えられる**。段階的開示はこの仕組みの再利用で実現できる |
| 1問↔複数画像 | `denken_question_assets.sort` | 長文・複数枚（電験2種）の**DB側は既に対応済み**。制約は TS 型の `imageFile: string` 単数のみ |
| 資格スコープ | migration 008（`exam_id` を PK へ） | 2種を足しても既存進捗を壊さない |
| 学習モードの型 | `StudyMode = 'calc' \| 'memory'` | 計算/暗記の区別が**型とデータには既にある** |

### 1.2 伸びしろ（最短合格に向けた真の課題）

**① 客観的な正誤データが1件も存在しない**（最重要）

分野別の学習フローは `ProblemViewer` の「問題を見る → 解答を見る → A/B/C」だけで、

- 解答を**見た後**に自己評価する順序のため、後知恵バイアス（「あ、そう解くんだった＝A」）を構造的に防げない
- 最終解答の数値すら入力しないため、**DB には「本人の自己申告」しかなく、正誤の実測が無い**
- `MasterQuestion` に正答フィールドが無い（年度別 `PaperQuestionPart.correct` のみ）

FSRS の入力（Rating）が全面的に自己申告に依存している。計算問題は「解けた気」と「解けた」の
乖離が最も大きい領域であり、ここが最短合格の最大のボトルネック。

**② FSRS が計算/暗記を区別していない**

`studyMode` は `estimateMinutes.ts`（所要時間の推定）でしか使われていない。`fsrs.ts` の
`retentionFor()` は日付のみ、初期難易度は `createEmptyCard()` の D=5 固定。計算問題（手順の
運動記憶・一度崩れると復旧コストが大きい）と暗記問題（事実の再生・回転数が効く）を同一の
忘却モデルで回している。

**③ Rating が3値で、`Rating.Hard` を使っていない**

`RATING_MAP` は `A=Easy / B=Good / C=Again`。とくに **B（方向性OK・計算ミス）を Good に
写している**が、計算ミスは本番では 0 点であり、Good（順調）として間隔を伸ばすのは合格確率の
観点で誤り。ts-fsrs は 4 段階を前提としており、`Hard` を空けているのは情報の捨てすぎ。

**④ 所要時間を測っているのに、時間の観点で出題していない**

`duration_seconds` / CBT の `seconds` は蓄積されているが、`reviewValue()` の主キーは
「理解度 × 忘却リスク」のみ。電験は 90 分／18 問で**時間切れが典型的な落ち方**であり、
「正解できるが遅い問題」が可視化されていない。

**⑤ 電験2種の唯一のハード障壁は `PaperQuestionPart.correct: 1|2|3|4|5`**

択一が型レベルで固定されている。逆に言えば、**ここ以外は追加で拡張可能**
（複数枚画像は `sort` で対応済み、`MockAnswer` / `MockSession.answers` は JSONB）。

---

## 2. 計算問題の UI/UX 改修案

### 2.0 設計原則 —— 「読むだけ」を防ぐ最小の一手は何か

デジタルノート・手書きキャンバスが真っ先に思いつくが、**この利用者の制約
（育児中・隙間時間・片手操作・中断が常態: `study-time-scarcity.md` 課題13）** に照らすと、
手書き入力は摩擦が大きく、記録そのものが止まるリスクが高い。

学習効果 ÷ 入力コストが最大なのは、手書きではなく **「答えを見る前に、最終答を1つ確定させること」**。
テスト効果（testing effect）は解答過程の量ではなく**想起を試みたかどうか**で立ち上がる。
したがって必須入力は最終答 1 つに限定し、立式・ミス種別は任意とする。

### 2.1 Answer-First Gate（解答前コミット）— `ProblemViewer` の改修

現行の「解答を見る」ボタンを **2 段階**に置き換える。

```
[問題表示]
  ↓  下部バー: 大きなテンキー + 単位ドロップダウン ／ または (1)〜(5)
  ↓  ┌ 答えを確定 ─→ [解答表示] ─→ 自己採点 ○/× ─→ 理解度 A/B/C/S
  └─→ ヒント（ワンポイント解説だけ表示）… 任意・1回まで
  └─→ 「わからない（降参）」 ─→ [解答表示] ─→ 自動で C 相当
```

要点:

- **「解答を見る」を無条件では押せなくする。** 押すには「答えを確定」か「わからない」のどちらかを
  通す。降参もデータ（`gave_up: true`）であり、罰ではない。
- 分野別（`MasterQuestion`）は正答データを持たないので**採点は自己申告の ○/×**。ただし
  *答えを先に確定させてから* ○/× を押すため、後知恵バイアスが構造的に入らない。
  年度別（`PaperQuestion.parts[].correct`）は自動採点できる。
- 入力 UI は **OS キーボードを呼ばない自前テンキー**（画面の半分を潰さないため）。
  `[7 8 9] [4 5 6] [1 2 3] [0 . -] [×10^n] [削除]` + 単位チップ（A / V / W / Ω / F / H / % / なし）。
- 記録バー（現行の A/B/C/S）はそのまま残す。**タップ数は「答え入力 → ○/× → 理解度」の
  最小 3 アクション**に収める。

新規ファイル（既存の巨大ファイルへ足さない・CLAUDE.md §1）:

```
src/features/questions/AnswerGate.tsx   … 下部バーの2段階UI（テンキー・単位・確定/降参/ヒント）
src/lib/attempt.ts                      … 試行データの純ロジック（正規化・比較・grade補正）
```

`src/lib/attempt.ts`（骨子）:

```ts
// 1回の解答試行。review_history のエントリに同梱して保存する（DBスキーマ変更なし）。
export interface Attempt {
  answer?: string        // 入力した最終答（'3.14', '1/2π' 等。正規化前の生値）
  unit?: string          // 'A' | 'V' | ... | ''
  correct?: boolean      // 自己採点（年度別は自動採点）
  hintUsed?: boolean     // ワンポイント解説を開いたか
  gaveUp?: boolean       // 答えを入力せず解答を見たか
  setup?: string         // 立式（任意・1行。例 'I = E/(r+R)'）
  errorKind?: ErrorKind  // 誤答の型（任意）
}

// 計算問題の誤りは「立式」と「実行」で対策がまったく違う。型で切り分ける。
export type ErrorKind =
  | 'setup'      // 立式ミス（公式の選択を誤った）… 理解の穴 → 教科書へ戻す
  | 'transform'  // 式変形ミス
  | 'arithmetic' // 計算・電卓ミス
  | 'unit'       // 単位・接頭語（k/m/μ）ミス
  | 'read'       // 問題文・図の読み違い
```

### 2.2 段階的開示（Graduated Prompting）— `PaperImage` / `denken_question_assets` の1カラム追加

電験王の問題画像は縦に
**`タイトル → 問題文 → ワンポイント解説 → 解答 → 関連記事`** の順で並んでおり
（`types.ts` の `PaperQuestion` コメント）、すでに 3 つの %座標で切り出している。

ここに **`hint_y_pct`（ワンポイント解説の終わり＝解答本文の始まり）** を 1 本足すだけで、
既存の切り出し機構をそのまま使って 3 段階開示が成立する。

| 段階 | 表示範囲 | 用途 |
|---|---|---|
| 問題 | `question_start_pct` 〜 `answer_y_pct` | 現行と同じ |
| **ヒント** | `question_start_pct` 〜 **`hint_y_pct`** | ワンポイント解説だけを追加開示。**解答は見えない** |
| 解答・解説 | `question_start_pct` 〜 `explanation_end_pct` | 現行の `showAnswer=true` と同じ |

`PaperImage` の改修は `showAnswer: boolean` を `reveal: 'question' \| 'hint' \| 'answer'` に
広げ、`endPct` の選択を 3 分岐にするだけ（既存の呼び出しは `showAnswer` を残したまま
`reveal` を任意 props として**追加**し、非破壊で移行する）。

分野別（見開き画像・`ProblemViewer`）は電験王と構造が違い、ワンポイント解説の帯が無い。
こちらのヒントは **`answerRects()` の先頭矩形の上部 25% だけを開示**する（解答の書き出し＝
「まず○○の等価回路に直す」に相当する部分）を暫定とし、精度が要る問題だけ
`denken_question_assets.hint_y_pct` を SQL の UPDATE 1 行で個別調整する
（`docs/data-correction-workflow.md` §5-A と同じ運用）。

### 2.3 計算用紙 —— 「立式1行」に絞る

フル手書きキャンバスは Phase 3 以降の任意機能とし、Phase 1 では **立式 1 行のテキスト入力**
（`Attempt.setup`）にとどめる。理由:

- 電験3種の計算問題は「どの式を立てるか」でほぼ勝負が決まり、以降は電卓作業である
- 立式だけなら片手・15 秒で入力でき、**復習時に自分の立式と正答の立式を並べられる**
- 手書き画像は検索も比較もできず、ストレージ（非公開バケット）と同期のコストだけが増える

立式は任意入力。ただし **`errorKind === 'setup'` を選んだときだけ入力を促す**
（理解の穴が出た瞬間に、その場で言語化させるのが最も定着する）。

### 2.4 `QuestionCard` の改修（一覧側）

カードは**情報を増やさず、入口を変える**。

- 「問題を見る」「問題を解く」の 2 ボタンを維持しつつ、`studyMode === 'calc'` の問題では
  「問題を解く」を主ボタン（塗り）にする。計算問題を眺めるだけの導線を弱める。
- 履歴チップに `Attempt` の情報を 1 文字で足す:
  `初回 9/3 ⏱3分7秒 ✓`（正答）/ `✗立式`（誤答・型つき）/ `⚑`（ヒント使用）。
  既存の履歴チップ内へ **追記のみ**（行を増やさない）。
- リスク帯（`bandMeta`）の隣に**「⏱ 遅い」バッジ**を出す（2.5 参照）。

### 2.5 「解けるが遅い」の可視化

`estimateSeconds()` は既に「難易度 × studyMode の実測中央値」を持っている。本番の 1 問あたり
持ち時間（理論: 90 分 ÷ 18 問 ≒ 5 分、B 問題は 2 小問で 10 分）と比較し、
**正答かつ持ち時間超**の問題に「時間内に解けない」タグを付ける。

これは `reviewValue()` の主キーには入れない（`study-time-scarcity.md` 課題11 と同じ轍を踏まない）。
**復習タブの絞り込み（`FilterBar`）に「⏱ 時間切れ」チップを 1 つ足す**にとどめ、
直前期（試験 30 日前）に一括で洗い出せるようにする。

---

## 3. DB・アルゴリズム拡張案

### 3.1 方針 —— 「観測値」だけを足し、「派生値」は持たない

- `studyMode` は `src/data/` のマスタ側にあるので、DB へ複製しない（二重管理を避ける）
- 新しく保存すべきは **試行の観測値**（入力した答え・正誤・ヒント・降参・誤りの型）だけ
- それらは **`denken_reviews.review_history`（JSONB）に同梱する** →
  **マイグレーション不要・他 PR とのコンフリクトゼロ**（CLAUDE.md §2・§4）

### 3.2 `src/domain/types.ts` の変更（追記のみ）

```ts
// ReviewHistoryEntry へ追記（既存フィールドは触らない・すべて optional）
export interface ReviewHistoryEntry {
  date: string
  status: Status
  prev?: ReviewSnapshot
  duration_seconds?: number
  attempt?: Attempt        // ← 追加。旧データには無いので optional
}
```

`Attempt` は `src/lib/attempt.ts`（§2.1）に定義し、`types.ts` からは `import type` で参照する。
`types.ts` は全 PR が触る共有ファイルなので**変更を 2 行に抑える**。

### 3.3 `src/lib/fsrs.ts` の変更（知識/計算の分離）

**やらないこと**: ts-fsrs の重み `w[]` を calc / memory で丸ごと分けること。
利用者 1 名・数百問の規模では過学習になり、決定的再生（`deriveFromHistory`）の再現性検証も
難しくなる。**分けるのは「入力パラメータ」だけ**にする。

**(a) 目標保持率を studyMode で分ける**

```ts
export const RETENTION_BY_MODE: Record<EstimateModeKey, number> = {
  calc:   0.90,  // 手順の運動記憶。崩れると復旧コストが大きい → 高めに保つ
  memory: 0.82,  // 事実の再生。回転数を稼いだほうが総得点が伸びる
  unset:  0.85,  // 現行既定と同値（機械・電力・法規・未分類の挙動を変えない）
}

export function retentionFor(
  eventDate: string, examDate?: string | null, mode: EstimateModeKey = 'unset',
): number {
  const base = RETENTION_BY_MODE[mode]
  if (!examDate) return base
  return diffDays(eventDate, examDate) <= RETENTION_ENDGAME_DAYS
    ? Math.max(base, RETENTION_ENDGAME)   // 直前期は精度優先（既存挙動を維持）
    : base
}
```

`schedulerFor(retention)` は既に retention 別に FSRS インスタンスをキャッシュしているため、
**この 1 関数の引数追加だけで分離が通る**。`calcFSRS` / `deriveFromHistory` は `mode` を
受け取って素通しするだけ（引数はいずれも末尾に optional で追加＝既存呼び出しは無改修）。

`reviewPlan.ts` の `bandOf()` も同じ `retentionFor(today, examDate, mode)` を使うため、
リスク帯（🔴/🟡/🟢）が自動的にモード別のしきい値へ連動する（`study-time-scarcity.md` 課題5 と同じ思想）。

**(b) `Rating.Hard` を導入し、Rating を客観データで補正する**

新規ファイル `src/lib/grade.ts`（`fsrs.ts` を肥大化させない）:

```ts
// 自己申告の Status に、その試行の観測値（正誤・ヒント・降参・所要時間）を掛けて
// ts-fsrs の Grade を決める。自己申告だけを信じない、が要点。
export function gradeOf(status: Status, a: Attempt | undefined, slow: boolean): Grade {
  if (status === 'C') return Rating.Again
  if (a?.gaveUp) return Rating.Again
  // B（方向性OK・計算ミス）は本番0点。Good ではなく Hard に落とす。
  if (status === 'B') return a?.errorKind === 'setup' ? Rating.Again : Rating.Hard
  // A（見ずに解けた）でも、自己採点が×／ヒント使用／持ち時間超なら1段下げる。
  if (a?.correct === false) return Rating.Again
  if (a?.hintUsed || slow) return Rating.Good
  return Rating.Easy
}
```

現行の `RATING_MAP` は `Attempt` の無い旧データ向けのフォールバックとして残す
（`deriveFromHistory` の決定的再生が旧履歴でも同じ結果を返す＝後方互換）。

**(c) 初期難易度のシード**

`createEmptyCard()` の D=5 固定を、`calc` かつ `difficulty === 3` の問題では D を上げる
（初回から間隔を短く始める）。ts-fsrs の内部重みは触らず、生成後のカードの
`difficulty` を差し替えるだけにする。

### 3.4 マイグレーション（追加のみ・破壊的変更なし）

現行の最新は **014**。採番は実装完了・コミット直前に再確認する（CLAUDE.md §4）。

```sql
-- 015_hint_y_pct.sql  （Phase 1）
-- 段階的開示のヒント境界。ワンポイント解説の終わり＝解答本文が始まる縦位置(%)。
-- 既定 100 = ヒント段階なし（現行と同じ2段階表示に落ちる）。
ALTER TABLE denken_question_assets
  ADD COLUMN IF NOT EXISTS hint_y_pct NUMERIC NOT NULL DEFAULT 100;
```

Phase 2 は**マイグレーション不要**（観測値は `review_history` JSONB）。

将来、試行データの集計が JSONB では重くなった段階で、正規化テーブルへ切り出す:

```sql
-- 017_attempts.sql （Phase 3・必要になってから）
-- review_history から生成できる派生テーブル。真実の源は引き続き review_history 側に置き、
-- こちらは分析クエリ専用の投影とする（二重管理を避けるため、書き込みは常に両方へ）。
CREATE TABLE IF NOT EXISTS denken_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT auth.uid(),
  exam_id       TEXT NOT NULL,
  question_id   TEXT NOT NULL,
  attempted_on  DATE NOT NULL,
  status        TEXT NOT NULL,
  correct       BOOLEAN,
  hint_used     BOOLEAN NOT NULL DEFAULT FALSE,
  gave_up       BOOLEAN NOT NULL DEFAULT FALSE,
  error_kind    TEXT,
  seconds       INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.5 電験2種（記述式）へのスケーラビリティ

**唯一のハード障壁は `PaperQuestionPart.correct: 1|2|3|4|5`。** ここだけを今のうちに
判別可能ユニオンへ広げておけば、以降は追加だけで記述式に届く。

```ts
// types.ts（既存 PaperQuestionPart を kind 付きユニオンへ。'choice' が既定＝既存データ無改修）
export interface RubricItem {
  id: string        // 'r1'
  label: string     // '等価回路を描き、インピーダンスを Z = R + jX で表せている'
  points: number
}

export type PaperQuestionPart =
  | { kind?: 'choice'; label?: PartLabel; correct: 1|2|3|4|5; points: number }
  | { kind: 'numeric'; label?: PartLabel; correct: number; tolerance: number; unit: string; points: number }
  | { kind: 'descriptive'; label?: PartLabel; rubric: RubricItem[]; points: number }

// 既存データ（kind 無し）を choice として扱う唯一の入口。分岐はここに閉じる。
export function partKind(p: PaperQuestionPart): 'choice' | 'numeric' | 'descriptive' {
  return ('kind' in p && p.kind) ? p.kind : 'choice'
}
```

対応する残りの拡張点（すべて追加のみ）:

| 論点 | 対応 | 影響ファイル |
|---|---|---|
| 長文・複数枚画像 | `PaperQuestion.imageFiles?: string[]` を**末尾に追加**（`imageFile` は残す）。DB は `denken_question_assets.sort` で既に 1問↔複数画像に対応済み | `types.ts`（1行）、新規 `PaperImageStack.tsx` |
| 記述式の自己採点 | `MockAnswer.rubric?: Record<string, boolean>` を追加。`answers` は JSONB なので**DB変更なし** | `types.ts`（1行）、新規 `RubricGrader.tsx` |
| 数値記述の採点 | `scorePaper()` に `partKind` 分岐を足す。`numeric` は `Math.abs(got - correct) <= tolerance` | `lib/mock.ts` |
| 部分点 → FSRS | ルーブリック達成率 → Status のマッピング（`>=0.9→A / >=0.6→B / それ未満→C`）を `grade.ts` に 1 関数 | `lib/grade.ts` |
| 二次試験（記述）の制度差 | `ExamFeatures` に `descriptive: boolean` を**末尾追加** | `types.ts`（1行） |
| 二次の合格ライン | `ExamDefinition.passingScore` を流用（変更不要） | — |

**あえて今やらないこと（YAGNI）**: ルーブリックの独立テーブル化、記述解答の全文保存、
AI 採点。いずれも 2 種の学習データが 1 件も無い段階で作り込むと、実際の運用で作り直しになる。
**今回入れるのは「型のユニオン化」1 点のみ**——これは diff が小さく、かつ後から入れると
既存の年度別データ全件の書き換えが要るため、先にやる価値がある。

---

## 4. 実装ロードマップ

各 Phase は独立してマージできる単位に切ってある（CLAUDE.md §1）。
新規ファイル中心・共有ファイルは末尾追記のみ。

### Phase 1 —— 明日入れられる、学習効果が最も高い UI 改修

**狙い: 「読むだけ」を構造的に不可能にし、客観データの蓄積を今日から始める。**

| # | 内容 | 変更 |
|---|---|---|
| 1-1 | `Attempt` 型と純ロジック | **新規** `src/lib/attempt.ts` |
| 1-2 | 解答前コミット UI（テンキー・単位・確定/降参/ヒント） | **新規** `src/features/questions/AnswerGate.tsx` |
| 1-3 | `ProblemViewer` に Gate を組み込み、`showAnswer` を `reveal` 3 段階へ | `ProblemViewer.tsx`（既存の `onRecord` に `attempt` 引数を**追加**） |
| 1-4 | 履歴エントリに `attempt` を同梱 | `types.ts`（1行）、`App.tsx` の `updateStatus`（数行） |
| 1-5 | ヒント境界カラム | **新規** `supabase/migrations/015_hint_y_pct.sql`、`lib/assets.ts` の `QuestionAsset`（1行） |
| 1-6 | `PaperImage` の `reveal` 対応（年度別のヒント表示） | `PaperImage.tsx`（`endPct` を3分岐） |
| 1-7 | `QuestionCard` の履歴チップに ✓/✗/⚑ を追記、calc の主ボタン化 | `QuestionCard.tsx` |

Phase 1 の時点では FSRS の挙動は**一切変えない**（`attempt` は記録するだけ）。
UI 改修と学習モデル変更を同一 PR に混ぜると、効果の切り分けができなくなるため。

### Phase 2 —— FSRS のチューニングと分析

前提: Phase 1 で `attempt` が 2〜3 週間ぶん貯まっていること。

| # | 内容 | 変更 |
|---|---|---|
| 2-1 | `Rating.Hard` 導入と観測値による Grade 補正 | **新規** `src/lib/grade.ts`、`fsrs.ts`（`calcFSRS` の rating 決定を差し替え） |
| 2-2 | 目標保持率の studyMode 分離 | `fsrs.ts` の `retentionFor()`（引数追加）、`reviewPlan.ts` の `bandOf()` 呼び出し |
| 2-3 | 初期難易度のシード（calc × 難易度3） | `fsrs.ts`（`createEmptyCard` 直後で `difficulty` を差し替え） |
| 2-4 | 「解けるが遅い」の絞り込みチップ | `FilterBar.tsx`（`MODE_OPTIONS` の隣へ**末尾追加**） |
| 2-5 | 分析タブに「誤りの型」の内訳（立式 / 式変形 / 計算 / 単位 / 読み違い） | `DashboardView.tsx`（カード1枚を末尾追加） |
| — | マイグレーション | **不要**（観測値は JSONB） |

**移行時の検証**: `deriveFromHistory()` を旧・新の両実装で全問回し、`attempt` を持たない
履歴に対して結果が完全一致することを確認してからマージする（決定的再生の後方互換）。

### Phase 3 —— 電験2種対応へ向けた基盤構築

| # | 内容 | 変更 |
|---|---|---|
| 3-1 | `PaperQuestionPart` の判別可能ユニオン化 + `partKind()` | `types.ts`、`lib/mock.ts`（`scorePaper` に分岐） |
| 3-2 | `imageFiles?: string[]` と複数枚表示 | `types.ts`（1行）、**新規** `PaperImageStack.tsx` |
| 3-3 | 数値記述（`numeric`）の解答 UI と採点 | `CBTRunner.tsx`（`AnswerGate` のテンキーを再利用） |
| 3-4 | ルーブリック自己採点 | **新規** `features/mock-exam/RubricGrader.tsx`、`ResultView.tsx` |
| 3-5 | ルーブリック達成率 → Status → FSRS | `lib/grade.ts` に 1 関数追加 |
| 3-6 | `ExamFeatures.descriptive` と `denken2` の `ExamDefinition` 雛形 | `types.ts`（1行）、**新規** `src/data/denken2/index.ts` |

Phase 3 は 3-1 だけ先に単独 PR で出すことを推奨する（他が全部後回しでも、将来の
データ書き換えを避けられる）。

---

## 5. 批判的検証 —— この案の偏りと、その打ち消し方

| リスク | 検証 | 打ち手（本設計に織り込み済み） |
|---|---|---|
| **入力が増えて記録が止まる**（最大のリスク） | 隙間時間・片手操作・中断常態という制約下で、入力コストは学習量に直結する | 必須入力は「最終答 1 つ」のみ。立式・誤りの型は任意。テンキーは自前実装で OS キーボードを呼ばない。**Phase 1 リリース後、1 週間の記録件数が Phase 1 前を下回ったら 1-2 を即ロールバック**する基準を先に決めておく |
| 自己採点は結局 self-report であり、客観データではない | そのとおり。分野別には正答データが無い | 「答えを先に確定させる」順序で後知恵バイアスだけは構造的に潰す。完全な客観正誤が要るのは年度別（`correct` あり）で、そちらは自動採点になる |
| `retention` をモード別に上げると復習量が増え、時間予算を圧迫する | calc を 0.90 にすると計算問題の復習間隔が縮む | memory を 0.82 へ**下げて相殺する**（総量を増やさない）。リリース後 `TodayPanel` の「今日やること（分）」が改修前より増えていないかを実測で確認し、増えていれば calc 0.88 / memory 0.80 へ再調整 |
| B → Hard 化で間隔が縮み、A 問題の回転が落ちる | 計算ミスを厳しく扱うと総復習量が増える | B のうち `errorKind === 'setup'`（理解の穴）だけ Again、それ以外は Hard に留める段階付けで過剰反応を避ける |
| FSRS を触ると過去の学習履歴が壊れる | `deriveFromHistory` は全履歴を再生するため、パラメータ変更は全問の予定日を動かす | `attempt` を持たない旧エントリは従来の `RATING_MAP` で処理し、**旧データの再生結果を完全一致で保つ**。Phase 2 のマージ条件にこの検証を入れる |
| 2種の設計を今やるのは早すぎるのでは | 概ね正しい | だから Phase 3 で作るのは**型のユニオン化 1 点**に絞った。ルーブリックテーブル・AI 採点は明示的に非スコープ |
| 段階的開示（ヒント）が「答えを見る前の言い訳」になり、想起努力を削ぐ | 起こり得る | ヒント使用を `hintUsed` として記録し、Grade を 1 段下げる（`Easy → Good`）。ヒントは「無料」ではないことを学習モデル側で表現する |

---

## 6. 期待効果（何をもって成功とするか）

| 指標 | 現状 | Phase 1 後の目標 | 計測方法 |
|---|---|---|---|
| 客観的な正誤データ | 0 件 | 全試行に付与 | `review_history[].attempt.correct` の付与率 |
| 自己評価と実正誤の乖離 | 測れない | A 申告のうち `correct === false` の割合を可視化 | 分析タブ |
| 記録件数（学習量） | 現行 | **下回らないこと**（ロールバック基準） | 週次の履歴エントリ数 |
| 誤りの型の分布 | 不明 | 立式ミス比率を把握し、教科書に戻す判断に使う | 分析タブ（Phase 2） |

---

## 7. 参照

- `docs/design/expansion-design.md` — 年度別演習・多資格対応・試験日程ベースのペース分析
- `docs/design/study-time-scarcity.md` — 時間予算・FSRS 保持率・課題13（計測上限）
- `docs/data-correction-workflow.md` §5-A — 表示座標は `denken_question_assets` が唯一の正
- `CLAUDE.md` — コンフリクト最小化方針（新規ファイル優先・末尾追加・migration 採番）
