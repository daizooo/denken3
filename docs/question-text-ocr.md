# 会社向けテキスト転記の自動生成（`npm run gen-question-text`）

## 背景・目的

denken3 は問題文・選択肢・解説を画像（非公開バケット `denken-problems`）でのみ保持しており、
テキストのデータは持っていなかった。会社（周囲の目がある場所）では画像を開けないため、
暗記・概念問題（`studyMode: 'memory'`）だけをテキスト化し、メモ帳などに貼り付けて解ける形に
する。手入力での書き起こしはしない。画像から Vision（Claude）で自動抽出し、コードだけで完結
させる。

- 生成物: `src/data/questionText/<chapter>.ts`（`src/lib/questionText.ts` が読む）
- 表示側: `QuestionCard` の「テキストをコピー」ボタン（転記が無い問題ではボタン自体が出ない）
- 絞り込み: `FilterBar` の「テキスト対応のみ」

## 図が必要な問題は対象外にする

「図をまじまじと見なければ解けない問題は会社では解けない」という制約に合わせ、モデル自身に
`requiresDiagram` を判定させ、true ならそのままスキップする（テキスト化しない＝ボタンが出ない
＝自宅で画像を見て解く運用に残る）。書き起こしに自信が持てない場合も `uncertain` で自己申告させ、
誤った問題文・解答を混入させるより「対象外」を選ぶ。

## 使い方

```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... \
  npm run gen-question-text -- --chapter ac1
```

- `--chapter <code>`: 対象の章（`dc` / `ac1` / `trans` / `ac3` / `elec` / `mag` / `meas` /
  `etheory` / `ecircuit`。`src/lib/assets.ts` の `CHAPTER_ASSET_MAPS` と同じキー）
- `--question <id>`: 特定の問題だけ処理（複数指定可）。省略時はその章の `memory` 問題全部
- `--force`: 既にテキスト化済みの問題も上書きしてやり直す
- `--dry-run`: ファイルへ書き込まず結果を標準出力に表示する
- `--limit <n>`: 1回の実行で処理する上限（既定20。APIコストの暴走防止）
- `--model <id>`: Vision呼び出しのモデルID（既定 `claude-sonnet-5`）

`SUPABASE_SERVICE_ROLE_KEY` は RLS を bypass する強い権限、`ANTHROPIC_API_KEY` は課金が発生する
鍵なので、どちらもリポジトリに置かず `.env`（.gitignore 済み）から読む。雛形は `.env.example`。

プロキシ必須の環境（Claude Code on the web のリモート実行環境など）では、Node の組み込み fetch
が `HTTPS_PROXY` を見ないため `NODE_USE_ENV_PROXY=1` を付けて起動する
（`scripts/detect-mask-pcts.mjs` と同じ注意点）。

## 実行後にすること

- `git diff src/data/questionText/<chapter>.ts` で追加された問題文・解説を一度は目で確認する
  （Visionの書き起こしは基本的に正確だが、電気系の記号・添字は誤読の余地があるため）。
- 数問だけ怪しければ `--question <id> --force` でその問題だけ再実行する。
- 章を1つ処理し終えたら、他章と混ぜずにその章単独でコミット・PRにする
  （CLAUDE.md「変更は狭く・小さく・単機能に閉じる」。このファイルの唯一の書き手は本スクリプト
  なので、章をまたいだ同時実行以外でコンフリクトは起きない）。

## 仕組み

1. `src/data/denken3/riron/ohmsha-bunya/<chapter>.ts` から `studyMode: 'memory'` の問題IDを
   集める（TypeScriptコンパイラは使わず、型注釈を除けば有効なJSであることを利用して軽量に読む。
   `scripts/lib/ocr-lines.mjs` と同じ「Node標準機能だけで完結させる」方針）。
2. 既に `src/data/questionText/<chapter>.ts` にある問題は `--force` が無ければスキップする。
3. `denken_question_assets` から該当画像の `storage_path` を取得し、service role キーで
   ダウンロードする（署名URLを介さない。`scripts/lib/ocr-lines.mjs` の `downloadImage`）。
4. 画像をそのまま（切り出し加工はしない）Claude の Vision に渡し、問題文・選択肢・正解・解説を
   JSON で書き起こさせる。2問同居の画像（`region: top/bottom`）では、どちらの問題を書き起こす
   かをプロンプトで指定する。
5. 検証（選択肢の数・正解番号の範囲・文字列の非空）を通ったものだけ採用し、章ファイルを
   丸ごと再生成する（問題番号順・末尾カンマ付き）。
