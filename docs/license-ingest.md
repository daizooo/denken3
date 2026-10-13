# 社労士の書籍（一問一答）の取り込み手順（PR-J1a）

`docs/design/licensehub-expansion.md` §4.2・§4.5・§12.2 の3・§14 の取り込み経路。
**書き起こしJSON → 検証 → DB保存 → 索引生成** の順に、同じスクリプトで本番もフィクスチャも通す。

| 段階 | スクリプト / モジュール | DB |
|---|---|---|
| 検証・DB行への変換・件数 | `src/lib/license/ingest/schema.ts`（純関数・vitest） | ― |
| DB保存 | `scripts/license/ingest.mjs` | `lic_questions` / `lic_items` へ upsert |
| 索引生成 | `scripts/license/build-master.mjs`（`src/lib/license/ingest/master.ts`） | `lic_items` を読む |
| フィクスチャ削除 | `scripts/license/delete-fixture.mjs` | 年度 R98・R99 の行だけ消す |

- service key は `.env`（.gitignore 済み）の `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` から読む（既存スクリプトと同じ `assertSupabaseCredentials`）。`--dry-run` は Supabase に触れず、認証情報も要らない（削除スクリプトの `--dry-run` だけは対象を数えるために読み出す）。
- 書き込み先の `user_id` は `--user <uuid>` → 環境変数 `LICENSE_USER_ID` → Auth の利用者が1人ならその人、の順に決まる。
- **作業用ファイル（スクリーンショット・書き起こしJSONの実データ）はリポジトリ配下に置かず、コミットしない**（§4.1）。

## 1. 書き起こしJSON

肢の配列。1肢の形（§14）:

```json
{ "source_ref": "R03-RK-05-C", "statement": "…", "truth": false,
  "explanation": "…", "topic": "01 労働条件の原則", "importance": "A", "study_subject": "rouki" }
```

| 項目 | 必須 | 内容 |
|---|---|---|
| `source_ref` | ○ | 本試験の座標 `{年度}-{採点科目}-{問2桁}-{肢}`。肢は ア〜オ / A〜E（A〜E に正規化、元の表記は `label_raw`）。択一式の科目（RK RS KY IP KH KO KN）・問1〜10 |
| `statement` | ○ | 肢の本文（空は不可） |
| `truth` | ○ | `true`（○）/ `false`（×）。文字列は不可 |
| `explanation` | | 解説（無ければ `explanation_source='none'`） |
| `topic` | | 論点名。索引の章になる。**目次番号を先頭に書くと目次順に並ぶ** |
| `importance` | | `A` / `B` / `C` |
| `study_subject` | | 学習科目（`rouki` など）。省略時は `--subject`。採点科目に含まれない組合せ（例 RK×kenpo）は失敗 |

検証に失敗した肢は理由つきの一覧にして保存しない（他の肢は保存する。失敗が1件でもあれば終了コード 1）。
肢IDの重複（`A` と `ア` の表記違いを含む）と、同じ問で学習科目が食い違う肢は、該当の全肢を失敗にする。
書籍の肢は `truth_source='book'`・`law_status='ok'`（§9）で入り、R07 労基・安衛は `pilot-r7-rk`、R08 は `gate-r8` の温存グループが付く（§8）。

## 2. 本番の取り込み（J1b 以降）

```sh
# 1) 検証と件数（Supabase に触れない）
node --env-file-if-exists=.env scripts/license/ingest.mjs --data /path/to/rouki-batch1.json --subject rouki --dry-run
# 2) DB保存（冪等。再実行可）
node --env-file-if-exists=.env scripts/license/ingest.mjs --data /path/to/rouki-batch1.json --subject rouki
# 3) 索引の再生成 → src/data/sharoushi/subjects/rouki.ts と registry の1行をPRにする
node --env-file-if-exists=.env scripts/license/build-master.mjs --subject rouki
```

`lic_questions` は既にある問を上書きしない（公式PDF（PR-D）の問題文・正答を守る）。`lic_items` は `origin_statement` を送らない。

## 3. フィクスチャでの通し確認（§12.2 の3）

フィクスチャは `scripts/license/fixtures/` に置く（テスト用に例外としてコミットするもの。**架空の内容**で、実在しない年度 R98・R99 だけを使う）。

- `ippon-fixture.json`: 架空の肢 100件（労基60・安衛40、R98/R99 の RK 問1〜10）。vitest でも全件が検証を通ることを確かめる。
- `ippon-fixture-invalid.json`: 失敗の一覧を確かめるための見本（1肢だけ通る）。

```sh
node --env-file-if-exists=.env scripts/license/ingest.mjs --data scripts/license/fixtures/ippon-fixture.json --fixture --dry-run
node --env-file-if-exists=.env scripts/license/ingest.mjs --data scripts/license/fixtures/ippon-fixture.json --fixture
# 索引（フィクスチャ入り）をローカルにだけ作る。コミットしない
node --env-file-if-exists=.env scripts/license/build-master.mjs --include-fixture
npm run dev   # 社労士 → 労基・安衛 で 解く・コピー・一括採点・記録・復習予定・オフライン送信 を確認
```

`--fixture` を付けないと R98・R99 は失敗し、`--fixture` を付けるとそれ以外の年度が失敗する（混入を防ぐ）。
`build-master.mjs` は既定でフィクスチャを索引から除く。

## 4. フィクスチャの削除

```sh
node --env-file-if-exists=.env scripts/license/delete-fixture.mjs --dry-run   # 消す範囲（件数とID）を確認
node --env-file-if-exists=.env scripts/license/delete-fixture.mjs --yes
git checkout -- src/data/sharoushi/subjects   # フィクスチャ入りの索引を作っていた場合
```

対象は同じ `user_id` の `lic_items` / `lic_questions` の R98・R99 の行と、その肢の `denken_reviews`（`exam_id='sharoushi'`）だけ。
読み出した ID を1件ずつ年度で確かめてから ID 指定で消す（フィクスチャ以外が混じれば中止する）。
