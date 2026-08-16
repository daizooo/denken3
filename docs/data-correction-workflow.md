# 問題データの追加・修正ワークフロー（トークン/工数の最小化）

`docs/problem-data-integration.md` は「画像を Supabase へ一元化する」設計書。
本書はその**運用側**、すなわち **取り込み後のデータをどう直すか**を定める。

## 0. 現状の何がコストになっているか

画像バイナリ自体は Supabase Storage（非公開バケット `denken-problems`）へ移行済みで、
`denken_question_assets` にも登録済み。にもかかわらず、修正のたびに元データのある
Google Drive へ接続し直して再取得する運用になっていた。原因は次の4点。

| # | 問題 | コストへの効き方 |
|---|---|---|
| ① | ~~年度別のマスク座標（`questionStartPct` / `answerYPct` / `explanationEndPct`）が Supabase ではなく `src/data/denken3/*/papers/*.ts` に直書き~~ **（migration 014 で解消済み。TSの値は取り込み時の初期値に降格し、表示の正はDB）** | 値を1つ直すだけでも「大きなTS配列をRead→該当行探索→Edit→commit→PR→デプロイ」。DBの1行UPDATEで済む作業をファイル操作でやっている |
| ② | Supabase 側に画像の中身を確認する手段が無い（Supabase MCP は SQL 系のみ。Storage のダウンロード手段が無い） | 確認のたびに Drive のフォルダを一覧→対象を探索→ダウンロード。**画像を毎回ゼロから読み直している**のが最大のコスト源 |
| ③ | ~~`denken_question_assets.answer_y_pct` は年度別取り込み時に書かれるが、表示側（`PaperImage.tsx`）は DB を読まない~~ **（解消済み。`PaperImage` が `fetchAssets()` でDBの3座標を読む）** | 書くだけで誰も読まない行。DBとTSの値がズレても検知できず、毎回目視で確かめ直すことになる |
| ④ | `ImportPanel` は「一度きりの取り込み」専用で、単発修正の動線が無い | 1問直すだけでもフル手順（Drive探索→ローカル保存→ドラッグ）を踏む |

## 1. 原則

1. **修正は Supabase 内で完結させる。Google Drive へ戻らない。**
   Drive へ接続してよいのは「まだ Supabase に取り込んでいない新規画像を持ってくるとき」だけ。
   既に取り込み済みの問題の修正で Drive を開いたら、それは手順が間違っている。
2. **判定根拠を使い捨てにしない。**
   「画像を見る → %を測る → TSに書く → 捨てる」を繰り返さない。測定結果は DB に残し、
   次回は「残っている値を読む → ずれている箇所だけ再測定」で済ませる。
3. **データのみの修正はコード変更ではない。**
   座標値・正答など単一利用者の私用データの修正は、PRフローではなく直接 SQL で直す（§3）。
   コード（表示ロジック・UI）の変更は従来どおり `CLAUDE.md` のPR方針に従う。

## 2. 修正したい問題の画像をSupabaseから確認する（②の解消）

`scripts/peek-asset.mjs` が、`question_id` から
`denken_question_assets` の登録行と**短期署名付きURL**を出力する。
Drive のフォルダを漁る必要がなくなる。

```bash
export SUPABASE_URL='https://<project>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service role key>'   # リポジトリには置かない

npm run peek -- dc_8              # 分野別（章単位）
npm run peek -- r7-1_a06 r7-1_b16 # 年度別（複数まとめて指定可）
```

出力には各行の `sort` / `region` / `answer_x_pct` / `answer_y_pct` が
署名付きURLと並べて表示される。**URLを開いて現物を見ながら、現在の座標値と突き合わせる**のが
確認の最短経路。未登録の `question_id` は `⬜` で表示され、その場合のみ Drive からの新規取り込みが要る。

> service role キーは RLS を bypass する。`.gitignore` 済みの `.env` かシェルの環境変数で扱い、
> コミットしないこと（`docs/problem-data-integration.md` §5 と同じ方針）。

## 3. 修正の実行（①③④の解消後の姿）

### データのみの修正
Supabase MCP の `execute_sql` で直接 UPDATE する。git clone → branch → commit → push → PR → CI
のフルサイクルを省略できるのが、工数削減として最も効く。

```sql
-- 例: 年度別 理論 r7-1 問6 の解答マスク位置を是正
-- question_id は科目をまたいで重複する（理論と機械の 'r6-2_b16' は別問題）ため、
-- 年度別は storage_path で科目を絞り込む。
UPDATE denken_question_assets
   SET answer_y_pct = 27.75
 WHERE question_id = 'r7-1_a06'
   AND storage_path LIKE '%/papers/riron/r7-1/a06.png';
```

年度別の表示範囲は3つの列で決まる（いずれも縦位置%）。

| 列 | 意味 | CBT解答中 | 結果画面 |
|---|---|---|---|
| `question_start_pct` | 問題文の開始（【難易度】行の直後）。ここより上は常に隠す | 上端 | 上端 |
| `answer_y_pct` | 【ワンポイント解説】見出しの直前 | 下端 | — |
| `explanation_end_pct` | 解説・解答の本文の終わり（宣伝バナーの直前） | — | 下端 |

### コード変更を伴う修正
表示ロジック・UI・スキーマの変更は従来どおり `CLAUDE.md` のコンフリクト最小化方針に従い、
ブランチを切って PR を出す。

> 年度別（`question_start_pct` / `answer_y_pct` / `explanation_end_pct`）・分野別
> （`answer_x_pct` / `region` 等）とも DB が正なので、上記 SQL 方式がそのまま使える。
> TS 側（`src/data/denken3/*/papers/*.ts`）の座標は **取り込み時にDBへ投入する初期値** であり、
> 取り込み済みの回の表示には使われない。TS を直しても画面は変わらないので触らないこと
> （未取り込みの回を新規収録するときだけ TS に値を書く）。

## 4. 質を落とさずに手数を減らすための運用

- **まとめて処理する。** 1問ずつ「探す→直す→確認」を繰り返すと、ツール呼び出しの固定
  オーバーヘッドが問題数分かかる。疑わしい問題を先に洗い出してから、1セッションでまとめて直す。
- **抜き取り確認を許容する。** 同一ロット（同じ章・同じ回の一括収録）で機械的な検出が
  十分機能している場合は全件目視をしない。直流回路では自動マッチ率100%・要目視0件の実績がある。
- **Vision入力を軽くする。** 画像を見て判断する場面が残るなら、フル解像度の全体ではなく
  該当箇所付近のクロップを渡す。Vision の入力トークンは画像サイズにほぼ比例する。
- **測定の信頼度を残す。** 値を保存する際に「機械測定」か「目視確認済み」かを区別できるように
  しておくと、後から怪しい箇所だけを再監査でき、精度と省力化を両立できる。

## 5. 実装状況

### A. 年度別マスク座標を TS ソースから Supabase へ移す（①③の解消）— **実装済み**
- `denken_question_assets` に `question_start_pct` / `explanation_end_pct` を **ADD COLUMN** で追加
  （既存カラムの変更・削除はしない＝`docs/problem-data-integration.md` §migration 008 の方針）。
  → `supabase/migrations/014_paper_mask_pcts.sql`
- `PaperImage` が `fetchAssets()` で DB の3座標を読み、`CBTRunner` / `ResultView` は `questionId` を
  渡すだけにした。`PaperDefinition` 側の座標は初期投入用の既定値に降格し、`ImportPanel` が
  取り込み時に3座標とも DB へ書く。
- 既存の `.ts` の値（収録済み4科目・266問）を DB へ流し込む1回限りの移行を 014 に同梱した。
  突き合わせは `question_id` だけでは足りない（科目をまたいで重複するため）ので、
  科目を含む `storage_path` の末尾で一意に決めている。
- これにより §3 の「SQL 1行で修正」が年度別にも適用でき、③の死んだ書き込みも解消された。

以下2件はスキーマ変更・移行スクリプトを伴うため、独立したPRとして個別に進める。

### B. マスク座標の測定をスクリプト化する（Vision推論の削減）
- 現状 `package.json` に OCR 依存が無く、コメントに残る「tesseractで検出」は毎回使い捨て。
  結果として **毎回 Claude が画像を目で見て % を推定**しており、ここが新規追加時の主コスト。
- 見出し文字列（`【難易度】` `【ワンポイント解説】` 等）の Y 座標検出 → % 変換を行う
  スクリプトをリポジトリに常設し、Claude の役割を「実行して妥当性を確認するだけ」に縮小する。
- Vision 推論はスクリプトの出力が明らかにおかしいときの例外対応に限定する。
- 一度作れば全章・全年度で使い回せるため、初期投資は章追加のたびに回収できる。

### C. ImportPanel に差し替え・単発修正モードを追加する（④の解消）
- A が終われば座標修正は SQL で足りるので、残るのは「画像そのものの差し替え」。
- 対象1問を選んで新しい画像を1枚だけ上書きできる導線を用意し、フル取り込み手順を踏まずに済むようにする。
