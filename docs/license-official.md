# 社労士の公式PDF（本試験）の取り込み手順（PR-D）

`docs/design/licensehub-expansion.md` §4.2・§4.4・§8・§13・§14・§16 の取り込み経路。
**PDF → 抽出テキスト → 構造化 → 検証ゲート → DB保存** を1本のスクリプトで通す。書籍（一問一答）の取り込みは `docs/license-ingest.md`。

| 段階 | モジュール / スクリプト |
|---|---|
| 抽出 | `pdftotext -enc UTF-8`（poppler）。PDF・抽出テキスト・中間JSONは**リポジトリの外**に置き、コミットしない（§4.1） |
| 構造化 | `src/lib/license/official/parseTaku.ts`・`parseSentaku.ts`・`parseAnswers.ts`（純関数・vitest） |
| 検証ゲート・DB行 | `src/lib/license/official/build.ts`（truth の導出・温存グループ・分割位置の検証） |
| 書籍との突き合わせ | `src/lib/license/official/merge.ts`（列ごとの規則。JS の upsert と SQL の両方に使う） |
| SQL の生成 | `src/lib/license/official/sql.ts` |
| 実行 | `scripts/license/ingest-official.mjs` |

## 1. 検証ゲート（保存前の自動チェック。失敗したら保存しない）

年度 × 式（択一・選択式）の単位で判定し、1つでも失敗があれば**その単位を丸ごと保存しない**（理由つきの一覧を出し、終了コード 1）。

- 択一 70問 / 350肢（7科目 × 問1〜10 × 肢A〜E）、選択式 8科目 / 40空欄（空欄A〜Eが各1つ、語群あり）
- 正答の充足率 100%（問題誤りで `excluded` にした問・空欄を除く）、ID重複なし
- 問型（1つ選ぶ・組合せ・個数）と「誤っている／正しい」の方向が読めること。組合せ・個数は選択肢 A〜E が5つ読めること
- ○×の組合せ（「正しいものには○、誤っているものには×を付した場合の組合せ」。R6 労基 問2 はア〜ウの3肢）は、肢がアから連続する2〜5個で、選択肢 A〜E の ○× が肢の数だけ読めること。件数は 350 から足りない肢の数を引いて判定する
- 文字化けの検出（§13）: 添字・上付きの数字（₁₂₃）、私用領域の文字・置換文字（�）・`(cid:N)`（÷× などの崩れ）、ラテン文字の記号、制御文字、
  ASCII に化けた算式の記号（R6/R8 で × → `#`、÷ → `'`、≒ → `]` を確認）
  - R7/R8 は数字の書体が下付き数字（`第 ₁₂ 条`）として抽出される。通常の数字と混ざらない下付き数字の並びは半角数字に戻す（`１₂５` は崩れとして残す）
- 労一・社一（IP）の分割位置（§4.3・§16）: 既定は問1〜5＝労一・問6〜10＝社一。本文に片方の科目の法令名だけが現れる問が既定と食い違えば失敗（`studySplit.IP` で上書きする）。労基/安衛（問8〜）・労災/雇用の徴収法（問8〜）の食い違いは警告

警告（保存はする）: 個数の問で truth を導出できない、語群が20語でない、正答の補正・除外、分割位置の食い違い（IP 以外）。

## 2. 保存する値

| 項目 | 値 |
|---|---|
| `lic_questions` | `source='honshiken'`。`stem`（組合せ・個数は選択肢の行を付ける。選択式は空欄を ［A］ にした本文）・`answer_spec`（`AnswerSpec`）は**公式を正本**として上書き |
| `lic_items` | `truth_source='derived'`、`law_status='unchecked'`（§9。確認は PR-K）、`explanation_source='none'`、`origin_statement`＝公式の原文 |
| truth（§13） | 1つ選べ・組合せは全肢を導出。個数は 0個・5個のときだけ導出し、他は null（書籍から補う）。選択式の空欄は null（正答は `answer_spec.blanks`） |
| ○×の組合せ | `answer_spec` は `{ kind: 'marks', correct }`。選んだ選択肢の ○× がそのまま全肢の truth。肢は数だけ（A〜C など）作る |
| 複数正答 | 問題誤りの公表で2つを正解とした問（R6 労災 問6・R8 一般常識 問9）は `answer_spec.accepted`（正答の全部）を持ち、正解とされた肢がすべて方向どおりの truth になる。`law_note` に公表の内容 |
| 空欄ごとの語群 | R8 の一部科目は空欄ごとに4語。`wordbank` は通し番号（A の①〜④ → 1〜4 …）にそろえ、`answer_spec.groups`（空欄 → 番号）を持つ。正答表の ①〜④ は通し番号に直して `blanks` に入れる |
| 温存（§8） | R7 択一 労基・安衛＝`pilot-r7-rk`、R8 全部＝`gate-r8`（`holdoutGroupOf`） |

書籍の肢（`truth_source='book'`）が同じ座標に既にあれば、statement・truth・解説・論点・重要度・law_status は**上書きせず**、公式の原文を `origin_statement` に入れる。truth・学習科目の食い違い、個数の問で書籍の ○ の数が正答と合わないもの、座標が公式に無い書籍の肢は一覧にする（書籍の値を残す）。
公式由来の既存行（再実行）は本文・truth を公式で更新し、`law_status`・`law_note`（PR-K の確認結果）は据え置く。冪等。

## 3. 手順（SQL を生成し、Claude Code が Supabase MCP で本番に実行する。licensehub-expansion.md §4.1）

```sh
W=/tmp/official   # リポジトリの外
pdftotext -enc UTF-8 -raw 令和8年度択一式.pdf $W/r08-taku.txt      # -raw（PDF の描画順）。既定の並びだと改ページで問番号と選択肢の順が崩れる
pdftotext -enc UTF-8 -raw 令和8年度選択式.pdf $W/r08-sentaku.txt
pdftotext -enc UTF-8 -layout 社会保険労務士試験の合格基準及び正答について_2026.pdf $W/r08-answers.txt   # 正答表は列の位置で読む

# 1) 検証ゲートと件数（Supabase に触れない）。--dump-json で構造化結果を確認できる
node scripts/license/ingest-official.mjs --year R08 \
  --taku $W/r08-taku.txt --sentaku $W/r08-sentaku.txt --answers $W/r08-answers.txt \
  --dump-json $W/r08.json --dry-run
# 抽出の崩れでゲートを通らない問は、$W/r08.json を直して --json $W/r08.json で読み戻す（無理に通さない）

# 2) SQL を生成（DB に触れない）→ Claude Code が check → 本体 の順に実行（Supabase MCP の execute_sql）
node scripts/license/ingest-official.mjs --year R08 ... --sql $W/r08
#   $W/r08.check.sql  読み出しのみ（書籍の肢との食い違いの一覧）
#   $W/r08.sql        保存（BEGIN〜COMMIT。最後に expected / stored の件数を確認）
```

- R6 の問題PDFは ToUnicode の無い Adobe-Japan1 のフォントで、poppler に `poppler-data`（`/usr/share/poppler/cidToUnicode/Adobe-Japan1`）が無いと1字も抽出できない。
  入れられない環境では pdfminer.six 同梱の対応表から作れる（対応の無い CID は U+FFFD にして、文字化けの検出で止める。空白にすると字が黙って消える）。
- 正答表（R6〜R8）は選択式と択一式が1つの表で、見出し「Ａ Ｂ Ｃ Ｄ Ｅ 1 2 … 10」の列の位置で読む。上下に積まれた複数の正答（R6 労災 問6 の C／D など）は null と警告になるので、公表どおり `multi` で補正する。
- 正答が表から読めないとき（表の向き・セル結合）は、正答JSON `{"taku":{"RK":"ACEBDABCDE",…},"sentaku":{"RK":[3,12,5,18,9],…}}` を `--answers x.json` で渡せる。
- service key がある環境では `--sql` を付けずに実行すると、DB の既存行と突き合わせて直接 upsert する（`.env` の `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`、利用者は `--user` → `LICENSE_USER_ID` → 1人ならその人）。
- 生成した SQL は、022 を適用した PostgreSQL で EXPLAIN（と、使い捨ての DB での実行）により型・構文を確かめてから渡す。

### 補正（`--corrections x.json`。R6 の問題誤りの公表など。判断は利用者）

```json
{
  "studySplit": { "IP": 5 },
  "questions": {
    "R06_T_XX_NN": { "action": "excluded", "note": "公表: 全員正解" },
    "R06_T_YY_MM": { "action": "correct", "correct": "B", "note": "公表: 正答をBに訂正" },
    "R06_S_ZZ_C":  { "action": "correct", "correct": "12", "note": "公表: 空欄Cの正答を⑫に訂正" },
    "R06_T_RS_06": { "action": "multi", "correct": ["C", "D"], "note": "公表: C及びDを正答（先頭が本来の正答）" }
  }
}
```

労一・社一（IP）の分割位置: R6〜R8 は問5が社会保険労務士法令（社一）のため、いずれも `"studySplit": { "IP": 4 }` で取り込んだ。

`excluded` の肢は `law_status='excluded'`（既存の書籍の肢も excluded にする）。後から補正を外しても excluded は自動では戻らない（戻すときは SQL で `law_status` を更新する）。

## 4. フィクスチャ（架空の年度。本物の年度の本文・正答はリポジトリに置かない）

`scripts/license/fixtures/` の `official-r99-*.txt`（ゲートを通る1年度ぶん。架空の内容）と `official-r98-invalid-*.txt`（失敗の見本）。

```sh
F=scripts/license/fixtures
node scripts/license/ingest-official.mjs --year R99 --fixture \
  --taku $F/official-r99-taku.txt --sentaku $F/official-r99-sentaku.txt --answers $F/official-r99-answers.txt \
  --book $F/ippon-fixture.json --dry-run
node scripts/license/ingest-official.mjs --year R98 --fixture \
  --taku $F/official-r98-invalid-taku.txt --sentaku $F/official-r98-invalid-sentaku.txt --answers $F/official-r98-invalid-answers.txt --dry-run
```

R99 の労基・安衛は書籍フィクスチャ（`ippon-fixture.json` の R99）と座標が重なり、突き合わせの一覧（truth・学習科目の食い違い）が出る。
フィクスチャを DB に入れた場合は `scripts/license/delete-fixture.mjs`（R98・R99 の行だけ消す）で戻せる。
