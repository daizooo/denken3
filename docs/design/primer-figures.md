# 入門ノートの図解（作り方と規約）

- 作成日: 2026-11-13
- 関連: `docs/design/kenkei2-primer.md`・`docs/design/doboku1-primer.md`
- 部品: `src/data/kenkei2/primer/types.ts`（`PrimerFigure`）、描画: `src/features/kenkei2/PrimerFigureView.tsx`、検査: `src/data/primerFigures.test.ts`

## 1. 図解の入れ方

`PrimerSection.figures` に `PrimerFigure` の配列を書く（本文の後・表の前に出る）。**分野（テーマ）のファイルだけを編集する**。部品（`types.ts`・`PrimerFigureView.tsx`）・共通テストは触らない（並行する他の作業とコンフリクトするため）。足りない部品が出たら、自分の分野では既存の部品で表現し、部品の追加は別PRで相談する。

| kind | 用途 | 例 |
|---|---|---|
| `flow` | 箱を矢印でつなぐ（手順・計算式。`next` に ×・÷ など） | 施工の手順、締固めの管理の流れ |
| `funnel` | 複数の箱が1つに集まり、さらに分かれる | 荷重 → 構造物 → 地盤 |
| `sides` | 左右2つの囲みで対比 | 長所／短所、A工法／B工法 |
| `grid` | 見出しをグループ化した表（数値例・比較表）。`hi` で強調 | 規格値の比較、数値例 |
| `draw` | 断面図・構造図・配置図などの線画 | 擁壁の断面、土留め支保工、舗装の層構成 |

## 2. `draw`（線画）の書き方

`{ kind: 'draw', caption, width, height, shapes }`。座標は 0〜width／0〜height の中（**はみ出すとテストが落ちる**）。横長（width 400 × height 160〜260 程度）に収める。

| 部品 | 主な指定 |
|---|---|
| `rect` | x, y, w, h, fill, stroke, dash |
| `circle` | cx, cy, r, fill, stroke |
| `poly` | points（3点以上）, fill, stroke, dash |
| `line` | x1, y1, x2, y2, stroke, dash, arrow（終点に矢印）, both（両端に矢印＝寸法線）, width |
| `text` | x, y, s, size（既定11）, anchor（start/middle/end）, bold, color |

色は名前だけ（任意の色は不可）: `soil`（土）・`water`（水）・`concrete`（コンクリート）・`steel`（鋼）・`accent`（強調・寸法）・`warn`（力・危険）・`gray`（線・文字）・`white`・`none`。

描き方の規約:
- 土・水・コンクリートなど**素材は色で塗り分け**、構造物の名前・寸法記号・力の矢印は `text`／`line` で書き込む。
- 図は**本文が説明している内容だけ**を描く。本文にない数値を図に書かない（数値例は本文と一致させる）。
- 文字は日本語。重なりを避けるため、`text` は図形から 8px 以上離して置く。
- 描いたら実際に画面で確認する（一時の確認ページを作って Playwright で撮り、**コミットしない**）。

## 3. 内容の規約

- 図解は本文（`body`）と矛盾しないこと。根拠が不明な数値（規格値など）は本文にある値だけを使う。
- 数値例は検算する（合計・割合が合うこと）。
- 1節に図解を詰め込みすぎない（1節あたり 1〜2 個）。**図が理解を助ける節だけ**に付ける（全節に付けない）。
- 図解は Claude 作成・根拠未確認（ノートの末尾にその旨と根拠が出る）。

## 4. 分野を足す／並行して進める

- 担当する分野ファイル（`src/data/doboku1/primer/topics/<id>.ts`）以外は編集しない。
- 分野ごと・まとまりごとに別の PR にする。
