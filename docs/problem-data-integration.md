# 問題データ統合 設計書（案2：Supabase 一元化）

## 0. 背景と目的

denken3 は「問題の理解度データ蓄積」に特化しており、実際に解く問題は紙ベースで管理している
（① 過去問書籍（電子）のスクショを Google Drive に保管 → ② 各問題を紙に印刷 → ③ 理解度別にファイリング）。

本設計は、**問題画像そのものをアプリに統合**し、印刷・物理ファイリングを廃止することを目的とする。
理解度別の管理は既存の `status`／FSRS が担うため、統合の本体は「**各問題の見開き画像をアプリ内で閲覧できるようにする**」ことである。

### 採用方針
- **案2：Supabase Storage への一元化**（認証・進捗・画像を1システムに統合）。
- Google Drive のスクショを Supabase の**非公開バケット**へ移行し、MASTER の `question_id` に紐付ける。

### 前提（DC章での実測に基づく）
理論・直流回路（73枚）を全画像実読して突合した結果:
- 自動マッチ率 **100%**（69問、出典コードまで一致）。
- 変則3類型が実在：**2問同居**（1枚に問19+問20）、**解答またがり**（問48/49の解答が次画像に継続）、**捨て問**（問31/37/72＝MASTER未登録）。
- 突合キーは `問番号`（主）＋`出典コード`（確認）。画像連番からの位置推論は不可（実読が正）。

---

## 1. 著作権・プライバシー制約（必須要件）

対象は購入した過去問書籍のスクショ。個人の学習用に**非公開・単一利用者**で保管する範囲を厳守する。

- バケットは **private**。閲覧は**署名付きURL（短期TTL）**のみ。公開URL・共有リンク化は禁止。
- 画像は**利用者ごとに own**（`user_id` で RLS 分離）。他ユーザーへ画像を共有する機能は作らない。
  - 将来マルチユーザー化しても、各自が自分の書籍から取り込む前提（コピーを共有しない）＝私的複製の範囲を保つ。

---

## 2. データモデル

### 2.1 既存との関係
- `denken_reviews (user_id, question_id, ...)`：**利用者ごとの進捗**（PK: user_id, question_id）。
- MASTER 問題メタ（`id`, `number`, `title`, `difficulty`, `importance`）：**アプリコード**（`src/App.tsx`）。
- `question_id`（例 `dc_8`）が全体の結合キー。

### 2.2 新規テーブル `question_assets`

問題画像とMASTER問題の対応を表す。**1問↔複数画像**（またがり）と **1画像↔複数問**（2問同居）の
両方を単一テーブルで表現する。

```sql
-- supabase/migrations/004_question_assets.sql
CREATE TABLE IF NOT EXISTS denken_question_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT auth.uid(),
  question_id   TEXT NOT NULL,                 -- MASTER id 例 'dc_8'
  storage_path  TEXT NOT NULL,                 -- 非公開バケット内パス
  region        TEXT CHECK (region IN ('top','bottom')),  -- NULL=画像全体
  answer_x_pct  NUMERIC NOT NULL DEFAULT 50,   -- 解答が始まる横位置(%)。解答マスクの分割位置
  sort          INTEGER NOT NULL DEFAULT 0,    -- 同一問の複数画像の並び（0=主, 1..=解答続き）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id, storage_path, sort)
);

ALTER TABLE denken_question_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_assets"
  ON denken_question_assets FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS denken_question_assets_qid_idx
  ON denken_question_assets (user_id, question_id, sort);
```

> 上記は初回（migration 004）の定義。以降のマイグレーションで**マスク表現用の列を追加**している。
> いずれも既定値付きの追加のみで、既存行の意味は変えていない。
>
> | 列 | migration | 意味（既定） |
> |---|---|---|
> | `answer_y_pct` | 006 | 左ページで解答が始まる縦位置(%)（既定100＝左ページ全体が問題） |
> | `answer_right_y_pct` | 013 | 右ページのマスクを縦にずらす位置(%)（既定0＝右ページ全体が解答） |
> | `region_y_pct` | 013 | 2問同居画像の上下分割位置(%)（既定50＝画像の半分） |

### 2.3 変則3類型の表現（DC実データ）

| ケース | 画像 | 行の持ち方 |
|---|---|---|
| 標準（1問1画像） | dc_8 = newIMG_0290 | `(dc_8, path, region=NULL, sort=0)` 1行 |
| 2問同居 | newIMG_0301 = 問19+問20 | `(dc_19, path0301, top, 0)` / `(dc_20, path0301, bottom, 0)` |
| 解答またがり | 問48 = 0329+0330 | `(dc_48, path0329, NULL, 0)` / `(dc_48, path0330, NULL, 1)` |
| 捨て問 | 問31/37/72 | **登録しない**（アプリに出さない） |

> 同居画像は物理的に1回だけアップロードし、2行が同じ `storage_path` を参照（重複保存しない）。

---

## 3. Storage 設計

- バケット：`denken-problems`（**private**）。
- パス規約：`{user_id}/theory/{chapter}/{sourceImageName}`
  - 例 `…/theory/dc/newIMG_0290.png`、同居画像 `…/theory/dc/newIMG_0301.png`（dc_19/dc_20 が共有）。
  - **ソース画像名基準**にすることで、2問同居のアップロード重複を自然に防ぐ。
- Storage RLS：オブジェクトの先頭フォルダ（`user_id`）が本人のときのみ許可（Supabase 標準パターン）。

```sql
-- 例：storage.objects へのポリシー（バケット作成後に適用）
CREATE POLICY "own_problem_objects"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'denken-problems'
         AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'denken-problems'
         AND (storage.foldername(name))[1] = auth.uid()::text);
```

- 閲覧：アプリは `createSignedUrl(path, ttl)` で短期署名URLを都度発行して `<img>` に渡す。
- 容量見積り：理論 ~440枚 × 平均~90KB ≒ **約40MB**。4科目でも ~170MB で無料枠1GB内。
  - 任意最適化：PNG→WebP 変換で ~40% 削減可能（第2フェーズ以降の検討事項）。

---

## 4. 画像ビューア／解答マスク（UI仕様）

問題カード（一覧タブ）に「**問題を見る**」ボタンを追加し、全画面ビューア（ライトボックス）を開く。

### 4.1 表示ロジック（`answer_x_pct` 駆動）
指定 `question_id` の `question_assets` を取得し、**表示の振り分けは `sort` ではなく `answer_x_pct`（1画像ごとの解答マスク横位置）で行う**。各行を署名URL化して描画する。

`answer_x_pct` の規約（分野別・年度別ともこの1軸で表現する）:

| `answer_x_pct` | 意味 | 表示 |
|---|---|---|
| `50` | 見開き標準（左=問題／右=解答） | 常時表示・右半分を解答マスク |
| `100` | 画像全体が問題（右ページまで図など） | 常時表示・マスクなし |
| `0` | 見開き丸ごと解答（解答の続きページ含む） | 「解答を見る」まで非表示 |

- **問題ページ**（`answer_x_pct>0`）＝**常時表示**。`sort` 昇順に並べ、各画像を `answer_x_pct`（右）と `answer_y_pct`（左ページ下部）で個別にマスク。
- **解答ページ**（`answer_x_pct=0`）＝**「解答を見る」タップ後**に `sort` 昇順で続けて表示（マスクなし）。
- **region 適用**：`NULL`=画像全体、`top`=上側を切り出し、`bottom`=下側を切り出し（2問同居の行を分離）。
  切り出し位置は `region_y_pct`（既定50＝ちょうど半分）。
- **右ページ途中から解答が始まる見開き**：`answer_right_y_pct`（既定0）で右マスクの上端を下げる。
  右ページの上部が問題の続き（小問(b)や選択肢）で、その下から解答が始まるレイアウト用。
  ← `answer_x_pct` だけでは「右ページ全体＝解答」しか表現できず、小問(b)まで隠れる
  （静電気 問47 で発生。migration `013` で追加）。
- **2問同居で2問目の見出しが中央より上にある画像**：`region_y_pct` を実レイアウトの境界へ寄せる。
  既定の50%分割のままだと2問目の見出しが上下に割れて切れる
  （静電気 問38/39 = 2問目が y=782/1640 から始まる。`region_y_pct=45` で是正。migration `013`）。
- **B問題（見開き2枚構成）**：小問(a)(b)が別の見開きに分かれる場合は**両方とも問題ページ**（各 `answer_x_pct=50`）。問題が丸ごと1見開き＋解答が別見開きの場合は問題側 `100`／解答側 `0`。
  - ← `sort>0` を一律「解答続き」とみなす旧ロジックは、この(a)(b)分割型で問題文を隠してしまうため廃止（三相交流 問15/20/21/24 で発生。migration `012` で既存データも是正）。
  - 同じ理由で、**2枚組の1枚目が「見開き丸ごと問題」**（右ページが選択肢の表・小問(a)(b)）の型も
    `answer_x_pct=100` が必要（静電気 問13/45/49/71）。2枚組だからといって
    「1枚目＝左問題/右解答」と決めつけず、**1枚ずつ実画像を見て値を決める**。
- 操作：ピンチズーム／パン（回路図の細部確認用）。スマホ／タブレット前提のフルスクリーン。

> **取り込み時の既定**（`lib/assets.ts#defaultAnswerXPct`）：`ASSET_MAP` の各行に `answerXPct` を明示すればそれを採用。無指定なら `sort=0→50`（問題見開き）／`sort>0→0`（解答続き）を既定とする。`answerYPct`（既定100）・`answerRightYPct`（既定0）・`regionYPct`（既定50）も同様に行ごとに明示できる。分野別インポートはこれらの値をそのまま `answer_x_pct` / `answer_y_pct` / `answer_right_y_pct` / `region_y_pct` として登録するので、**次回以降の取り込みにもそのまま適用される**。

### 4.2 実装スケッチ（React/CSS）
```tsx
// region 切り出し＋解答マスクの container
// img を wrapper で overflow:hidden にし、region で transform、右側に mask div を重ねる
<div className="viewer" style={{ position:'relative', overflow:'hidden' }}>
  <img src={signedUrl} style={{
    width:'100%',
    // region: top→translateY(0)/clip上半分, bottom→下半分（実装は object-position or clip-path）
  }}/>
  {!answerShown && (
    <div className="answer-mask" style={{
      position:'absolute', top:0, bottom:0,
      left:`${answerXPct}%`, right:0,
      background:'var(--mask)'
    }}/>
  )}
</div>
```
> `region` の上下切り出しは `clip-path` もしくは `aspect-ratio` + `object-position` で実現。詳細は実装時に確定。

### 4.3 資産が無い問題
`question_assets` が0件の問題は「問題を見る」ボタンを非活性（または非表示）。移行前・捨て問はこれに該当。

---

## 5. 移行パイプライン（章単位バッチ）

各章について以下を繰り返す。DC で確立した型をそのまま横展開する。

1. **マッピング生成**：サブエージェントが章フォルダの全画像を「左列全高で全ヘッダー走査」して
   `{chapter}_mapping.json` を出力（DC の `dc_mapping.json` と同スキーマ）。
   - 出力：`mapping[]`（question_id, fileId, region, sort, sourceCode）／`two_in_one`／`spanning`／`sutemon`／`audit`。
   - **ヘッダー走査だけでマスク値を決めない**。見開きのどこから解答が始まるかは画像ごとに違うため、
     変則（2問同居・またがり・B問題）に該当する画像は**見開き全体を目視**して
     `answerXPct` / `answerRightYPct` / `regionYPct` を確定する（§4.1）。
2. **アップロード＋登録**：移行スクリプト（Node、Supabase service role 使用、`user_id` は既知の単一利用者に固定）が
   - Drive から取得済みの PNG を `denken-problems/{uid}/theory/{chapter}/{name}` へ put（既存はスキップ）。
   - `denken_question_assets` に mapping 行を insert（region/sort/answer_x_pct/answer_y_pct/answer_right_y_pct/region_y_pct）。
   - 捨て問はスキップ。
3. **検証**：`audit` の生ヘッダーと MASTER の出典コードが一致することを確認（DCは矛盾ゼロ実績）。

> service key はリポジトリに置かず、ローカル環境変数で扱う。スクリプトは1回限りの取り込み用。

### 5.1 章一覧（理論）と現状
`src/App.tsx` の CHAPTERS 準拠。DC はマッピング確定済み。

| chapter | 章名 | MASTER件数(目安) | 状態 |
|---|---|---|---|
| dc | 直流回路 | 69 | **マッピング確定** |
| trans | 過渡現象 | 14 | **マッピング確定**（20枚実読／2問同居1・解答またがり2・捨て問5） |
| ac1 | 単相交流 | 69 | **マッピング確定**（71枚実読／2問同居2・解答またがり1・捨て問3） |
| ac3 | 三相交流 | 22 | **マッピング確定**（30枚実読／2問同居0・解答またがり4・捨て問4） |
| elec | 静電気 | 72 | **マッピング確定＋マスク是正済**（79枚実読／2問同居4・解答またがり6・捨て問4。問13/38/39/45/47/48/49/71 を実画像視認で是正・migration `013`） |
| mag | 電磁気 | 55 | **マッピング確定**（56枚実読／2問同居2・解答またがり1・捨て問1） |
| meas | 電気計測 | 42 | **マッピング確定**（59枚実読／2問同居1・解答またがり4・捨て問9） |
| etheory | 電子理論 | 42 | **マッピング確定・未投入**（50枚実読／2問同居0・解答またがり4・捨て問4。分野別取り込みが完全一致のみで不成立だった。経路は修正済みで、あとは取り込み操作のみ＝`docs/etheory-ecircuit-import-investigation.md`） |
| ecircuit | 電子回路 | 52 | **マッピング確定・未投入**（82枚実読／2問同居0・解答またがり17・捨て問6＋奥付1除外。理由・状況は同上） |

> 電力・機械・法規は MASTER 自体が未登録。将来 MASTER 追加時に同パイプラインで取り込む。

---

## 6. フェーズ計画

| Phase | 内容 | 成果 |
|---|---|---|
| P0 | `004_question_assets.sql` 適用＋バケット/Storage RLS 作成 | スキーマ確定 |
| P1 | 移行スクリプト作成＋**DC 69資産を投入**（パイロット） | 実データ1章 |
| P2 | 画像ビューア（region切り出し＋解答マスク＋ズーム）実装 | 閲覧体験の完成 |
| P3 | 残り8章のマッピング生成→投入 | 理論全問統合 |
| P4（将来） | 電力/機械/法規、必要なら MASTER の DB化（案3） | 全科目・管理UI |

---

## 7. 未決事項（要判断）

1. ~~**`answer_x_pct` の既定値**：見開き標準は50%で検証済み。章ごとにばらつく問題があれば個別上書きUI（または mapping に列追加）を用意するか。~~
   → **決着**：ばらつきは実在した（三相交流 問15/20/21/24、静電気 問13/38/39/45/47/48/49/71）。
   UI は設けず、`ASSET_MAP` の行ごとに `answerXPct` / `answerYPct` / `answerRightYPct` / `regionYPct` を
   明示する方式に統一（取り込み時にそのまま列へ登録され、再取り込みでも維持される）。
   既存データの是正は章単位のマイグレーション（`012`＝三相交流、`013`＝静電気）で行う。
2. **画像最適化**：PNG のまま保管か、WebP 変換で軽量化するか（P2以降）。
3. **MASTER 表記揺れの是正**：`dc_12` タイトル「抵抗直並列回路」↔画像「抵抗直列回路」など。突合には無影響だが、この機会に MASTER を画像ヘッダーに合わせて直すか。
4. **取り込み実行主体**：service role スクリプト（推奨）か、アプリ内取り込み画面か。

---

## 付録：DC マッピング実測サマリー

- 画像73枚 ＝ 標準67 ＋ 2問同居1（問19/20）＋ またがり継続2（0330,0332）＋ 捨て問3（0312,0318,0355）。
- 69問すべて自動確定（要目視0）。突合キー：問番号＋出典コード。
- 成果物スキーマは本設計の `question_assets` にそのまま投入可能。
