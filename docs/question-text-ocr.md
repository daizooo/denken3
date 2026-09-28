# 会社向けテキスト転記の生成（`npm run fetch-question-images` / `save-question-text`）

## 背景・目的

denken3 は問題文・選択肢・解説を画像（非公開バケット `denken-problems`）でのみ保持しており、
テキストのデータは持っていなかった。会社（周囲の目がある場所）では画像を開けないため、
暗記・概念問題（`studyMode: 'memory'`）だけをテキスト化し、メモ帳などに貼り付けて解ける形に
する。

書き起こし自体は、有料のAnthropic APIキーは使わない。**このコマンドを実行している
Claude Code セッション自身が画像を読んで書き起こす**（Claude Codeのサブスクリプション内で
完結し、追加の従量課金を発生させない）。

- 生成物: `src/data/questionText/<chapter>.ts`（`src/lib/questionText.ts` が読む）
- 表示側: `QuestionCard` の「テキストをコピー」ボタン（転記が無い問題ではボタン自体が出ない）
- 絞り込み: `FilterBar` の「テキスト対応のみ」

## 図が必要な問題は対象外にする

「図をまじまじと見なければ解けない問題は会社では解けない」という制約に合わせ、図（回路図・
グラフ・波形図）が無いと解けない問題は書き起こし対象から外す（テキスト化しない＝ボタンが
出ない＝自宅で画像を見て解く運用に残る）。書き起こしに自信が持てない場合も同様に対象外にし、
誤った問題文・解答を混入させるより「対象外」を選ぶ。

## 使い方（2ステップ）

### 1. 画像を取得する（`fetch-question-images`。ここではVisionを呼ばない）

```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run fetch-question-images -- --chapter ac1
```

- `--chapter <code>`: 対象の章（`dc` / `ac1` / `trans` / `ac3` / `elec` / `mag` / `meas` /
  `etheory` / `ecircuit`。`src/lib/assets.ts` の `CHAPTER_ASSET_MAPS` と同じキー）
- `--question <id>`: 特定の問題だけ取得（複数指定可）。省略時はその章の `memory` 問題全部
- `--force`: 既にテキスト化済みの問題も対象にする
- `--limit <n>`: 1回で取得する上限（既定20）
- `--out <dir>`: 画像の保存先（既定: OSの一時ディレクトリ配下）

画像とその一覧（`manifest.json`：問題ごとの画像パス・見開きのどちら半分かのヒント）が
`--out`（既定は一時ディレクトリ）に保存される。**非公開の問題画像なので、リポジトリ配下には
保存しない・絶対にコミットしない。**

`SUPABASE_SERVICE_ROLE_KEY` は RLS を bypass する強い権限の鍵なので、リポジトリに置かず
`.env`（.gitignore 済み）から読む。雛形は `.env.example`。

プロキシ必須の環境（Claude Code on the web のリモート実行環境など）では、Node の組み込み fetch
が `HTTPS_PROXY` を見ないため `NODE_USE_ENV_PROXY=1` を付けて起動する
（`scripts/detect-mask-pcts.mjs` と同じ注意点）。

### 2. Claude Code が画像を読んで書き起こす

`manifest.json` の各問題について、`images` に列挙された画像ファイルを読み、次の方針で
JSONを組み立てる（`fetch-question-images` の実行後に出力されるガイドと同じ内容）。

- 数式・単位・ギリシャ文字は文字表記にする（例: Ω, μF, 10^-3, √3, cosθ, R1）。
- 選択肢は画像にある順序のまま書き出す。`answer` は正答の選択肢番号（1始まり）。
- `explanation` は解説文を要約せず書き起こす。
- 図が無いと解けない問題・書き起こしに自信が持てない問題は、その問題IDをJSONに含めない
  （保存対象から外す）。

```json
{
  "ac1_3": {
    "prompt": "...",
    "choices": ["...", "...", "...", "...", "..."],
    "answer": 3,
    "explanation": "..."
  }
}
```

このJSONをファイルに保存し、`save-question-text` で章ファイルへ書き込む。

```
node scripts/save-question-text.mjs --chapter ac1 --data /path/to/ac1-text.json
```

- `--dry-run`: ファイルへ書き込まず、検証結果だけ表示する
- 選択肢数・正解番号の範囲・文字列の非空などを検証し、通ったものだけ既存データにマージして
  `src/data/questionText/<chapter>.ts` を書き直す（問題番号順・末尾カンマ付き）。

## 実行後にすること

- `git diff src/data/questionText/<chapter>.ts` で追加された問題文・解説を一度は目で確認する。
- 数問だけ怪しければ、該当問題だけ `--question <id> --force` で再取得し、書き起こし直す。
- 章を1つ処理し終えたら、他章と混ぜずにその章単独でコミット・PRにする
  （CLAUDE.md「変更は狭く・小さく・単機能に閉じる」。このファイルの唯一の書き手は
  `save-question-text.mjs` なので、章をまたいだ同時実行以外でコンフリクトは起きない）。
