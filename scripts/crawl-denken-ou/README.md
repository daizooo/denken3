# 電験王クローラー（年度別過去問・理論）

年度別過去問（CBT模試）の問題データを、**手作業ではなく電験王のクロールで**用意するための
一度きりの取り込みツール。アプリ本体（`src/`）とは独立して動く。

- 対象範囲: **2010年度（H22）〜令和8年度上期（R8上）の全約21回**（設計 §4）。
- 取得物: 各問の **問題画像 / 解説画像**（PNG）と、正答・配点を持つ **`PaperDefinition`（.ts）**。
- 位置づけ: 設計 `docs/design/expansion-design.md` §7.4(4) の「取り込みワークフロー」を自動化したもの。

> ⚠️ **まだ実行しないでください。** これは *準備* です。分野別過去問が終わり、あなたが
> 「**データ取り込みを実行**」と指示した時点で、下記「実行」を回します。

---

## 0. 実行前の必須確認（到達性）

このクローラーは `https://denken-ou.com` にアクセスします。**実行する環境が電験王に到達できること**が前提です。

- ⚠️ **現在の Claude Code on the web セッションの egress ポリシーは `denken-ou.com` を許可していません**
  （プロキシが `CONNECT tunnel failed, response 403` を返す）。この環境で実行する場合は、
  環境のネットワークポリシーで `denken-ou.com` を許可する必要があります。
- 制約に触れずに確実なのは、**ネットワーク制限のないローカルPCで実行する**ことです（推奨）。
  生成された `out/<id>/*.png` を後述の ImportPanel からアップロードすればアプリに反映できます。

## 1. 著作権・私的利用（厳守）

電験王の問題・解説は他者の著作物です。設計 §1・§3 の方針に従います。

- **私的な単一利用者の学習目的**にのみ使用し、**再配布・公開しない**。
- 取得画像は非公開バケット（`denken-problems`, private）へ、**利用者ごとに RLS 分離**して保存する。
- 取得物（`out/`, `.cache/`）は **git 追跡外**（`.gitignore` 済み）。リポジトリには「仕組み」だけを置く。
- サーバに負荷をかけない: **同時接続1・リクエスト間隔6秒（+ゆらぎ）・robots.txt 順守・指数バックオフ**。

## 2. セットアップ

```bash
cd scripts/crawl-denken-ou
npm install            # playwright を導入
# ブラウザ本体: この環境は /opt/pw-browsers に導入済み（PLAYWRIGHT_BROWSERS_PATH）。
# ローカルPCで未導入なら:  npx playwright install chromium
```

## 3. 校正（初回だけ・1ページのみ取得）

電験王の HTML 構造に依存する箇所は `config.mjs` の `SELECTORS` / `ANSWER_PATTERNS` /
`explanationHeadingText` の3つだけ。初回は1ページだけ取得して実DOMと突き合わせて確定する。

```bash
node crawl.mjs --calibrate r5-1
```

`out/_calibrate/r5-1/` に以下が出る:

- `index.html` / `index.png` … 年度別インデックスの実DOM（理論リンクの拾い方の確認）
- `links.json` … 抽出できた「理論の問N → 記事URL」（14〜18件になるのが正）
- `article.html` / `article.png` … 先頭問題の記事（問題領域／解説領域の境界の確認）
- `article-meta.json` … 問題/解説の境界 y・抽出テキスト（正答正規表現の確認）

`links.json` が空、または `article-meta.json` の `boundaryTop` が `null` の場合は
`config.mjs` のセレクタ／見出し語を実DOMに合わせて調整し、再度 `--calibrate` する。

## 4. 実行（「データ取り込みを実行」の指示後）

```bash
# まず計画確認（サーバへ問題記事は取りに行かない）
node crawl.mjs --dry-run --all

# 直近回から順に（例: 直近2回だけ先行）
node crawl.mjs --paper r8-1 --paper r7-2

# 全21回（直近回から遡順・所要は間隔6秒×約380リクエスト ≒ 40分〜）
node crawl.mjs --all
```

出力:

- `out/<id>/a01.png … a14.png` `b15.png … b18.png` … 問題画像
- `out/<id>/a01_exp.png …` … 解説画像（結果画面でのみ表示）
- `out/<id>.ts` … `PaperDefinition`（**`draft: true`**・未確定正答は `correct: 0` と TODO コメント）

## 5. 取り込み反映（アプリへ）

設計 §7.4(4) の手順どおり。**正答は必ず公式正答表で確認**してから `draft` を外す。

1. **正答確定**: `out/<id>.ts` の各 `correct` を
   [電気技術者試験センターの正答](https://www.shiken.or.jp/chief/third/qa/) と突合。
   `correct: 0`（未検出）や `// TODO` の付いた問を優先的に埋める。
2. **画像アップロード**: アプリにログイン →「問題画像の取り込み」→ **年度別（CBT模試）** →
   対象回を選択 → `out/<id>/` の PNG をドラッグ。
   `{user_id}/papers/<id>/<file>` へ保存される（`ImportPanel` の nendo モード）。
3. **定義を反映**: `out/<id>.ts` を `src/data/denken3/riron/papers/<id>.ts` へ配置し、
   `papers/index.ts` の `RIRON_PAPERS` に追加。問題数（A14+B4）・配点合計100点を確認し
   `draft` を外す（ビルド時に `validatePaper` が最終検証。不正なら `vite build` が落ちる）。
4. **任意リンク**: `topic` / `sourceQuestionId`（分野別問題への参照）を必要に応じ追記
   （既存タイトルの出典表記から逆引き。誤答→分野別復習の前倒しに使う）。

## 6. 設計との対応

| 本ツール | 設計書 |
|---|---|
| 低速クロール・robots順守・私的利用 | §1 著作権・プライバシー制約 / §3 Storage |
| `out/<id>/*.png`（問題/解説の分離） | §7.4(4)-1（解答画面は問題のみ・解説は採点後） |
| `out/<id>.ts`（正答・配点・選択フラグ・URL） | §7.4(4)-2 `PaperDefinition` |
| `draft:true` 固定＋正答TODO | §7.4(4)-2「公式正答表と突合」/ §9 ビルド時チェック |
| ImportPanel 年度別モードで反映 | §7.4(4)-1（既存 ImportPanel を流用） |

## 7. ファイル

| ファイル | 役割 | 校正要否 |
|---|---|---|
| `catalog.mjs` | 全21回の paperId↔URL・理論構成（**確定**） | 不要 |
| `config.mjs` | レート/画像設定＋**サイト依存セレクタ** | セレクタのみ要校正 |
| `crawl.mjs` | HTTP/robots・Playwright描画・正答抽出・出力 | 不要 |
