# 法改正フラグと要確認の判定手順（PR-K）

`docs/design/licensehub-expansion.md` §9 の運用手順。公式PDF（本試験）由来の肢は法改正前の正答を含みうるため、
**確認が済むまで出題・集計に入れない**。この文書は、自動判定（スクリプト）→ Claude Code による判定 → 反映の手順を定める。

## 1. 仕組みの全体

| 段階 | 誰が | 何をする | law_status |
|---|---|---|---|
| 取り込み（PR-D） | スクリプト | 公式PDF由来の肢を保存 | `unchecked`（問題誤りで除外した肢は `excluded`） |
| 自動判定 | `scripts/license/flag-law-risk.mjs` の SQL | 数値・期間・金額・年齢・割合・時間・人数・改正/施行の語を含む肢を候補にする | `unchecked` → `review` |
| 判定 | Claude Code（根拠は e-Gov 法令検索と2027年版の教材） | 根拠条文で確かめ、`law_note` に根拠を追記 | → `ok` / `review` / `excluded` |
| 反映 | Claude Code（Supabase MCP）または要確認一覧の画面 | 判定を DB に入れる | |
| 出題 | アプリ | `ok` の肢だけを出題・集計する | |

- `unchecked` / `review` / `excluded` の肢は、肢モード・一括コピー・一括記録（`isAskableItem`）と、
  復習キュー・集計（マスター索引。`build-master.mjs` が `ok` 以外を載せない）のどちらにも入らない（`src/lib/license/lawStatus.ts`）。
- `ok` にした肢が復習キュー・集計・肢モードに現れるのは、**索引を再生成するPR（`build-master.mjs`）がデプロイされた後**（DB の状態は即時に変わる）。
- 書籍（2027年版）由来の肢は、出版社の補正基準を信頼して取り込み時から `ok`（§9）。ここでの対象外。
- `law_note` は**追記のみ**。問題誤りの公表（複数正答・正答の補正）の注記を消さない。自動判定・判定の行は先頭の見出し（`[法改正の自動判定]`・`[判定 …]`）で区別する。

## 2. 法令基準日（`law_base_date`）

- 官報公告日。令和8年は **2026-04-10**（既定値。`src/lib/license/lawRisk.ts` の `DEFAULT_LAW_BASE_DATE`）。
- 保存先は `denken_settings.law_base_date`（migration 023。NULL・行なしは既定値）。要確認一覧の画面の上部で変更できる。
- 2027年4月の公告後に更新し、§6 の再照合を行う。

## 3. 自動判定（Claude Code が本番に実行）

Claude Code が SQL を生成し、ローカルの PostgreSQL で確かめてから、Supabase MCP（`execute_sql`）で本番に流す（licensehub-expansion.md §4.1。削除系は無い）。判定は DB 上の本文に対して SQL の正規表現で行い、
**規則は `src/lib/license/lawRisk.ts` の `LAW_RISK_RULES` だけに置く**（JS と PostgreSQL で同じ正規表現。SQL には本文を含まない）。

```sh
# 生成（DB に触れない。--user を付けない場合、SQL は「Auth の利用者が1人」であることを確かめてから実行される）
node scripts/license/flag-law-risk.mjs --sql /tmp/work/law-risk [--base-date 2026-04-10]
```

| ファイル | 内容 | 実行 |
|---|---|---|
| `law-risk.check.sql` | 読み出しのみ。年度・科目別の件数（unchecked / 候補）と候補の一覧（ID・当たった規則・本文の先頭80字） | 先に流して件数を確認・報告 |
| `law-risk.sql` | 本体。`unchecked` の候補を `review` にし、`law_note` に `[法改正の自動判定] 法令基準日 … 時点で要確認（期間・金額…）` を追記 | 確認後に実行。冪等（2回目は `UPDATE 0`） |
| `law-risk.rollback.sql` | 自動判定で `review` にし、まだ `review` のままの肢を `unchecked` に戻し、自動判定の行だけを消す | 戻すときだけ |

- 対象は `lic_questions.source='honshiken'` かつ `law_status='unchecked'` の肢（フィクスチャの年度 R98・R99 は除く）。
  R6 択一（未投入）など、後から取り込んだ年度も、同じ SQL をもう一度流せば対象になる。
- 選択式の空欄は、空欄入りの文に**正答の語句**を足して判定する（数値は空欄側にあることが多い）。
- 候補に当たらなかった肢は `unchecked` のまま（出題しない）。判定は `review` を先に、`unchecked` を後に行う（§4）。

`--dry-run` は DB を変えずに、候補の件数（年度・式・科目別、規則別）と一覧を出す。入力は次のどれか。

```sh
node scripts/license/flag-law-risk.mjs --dry-run --json /tmp/work/r08.json   # 公式PDFの中間JSON（ingest-official.mjs --dump-json）
node scripts/license/flag-law-risk.mjs --dry-run --items /tmp/work/items.json # 肢の行の配列（execute_sql の結果の書き出し）
node --env-file-if-exists=.env scripts/license/flag-law-risk.mjs --dry-run    # DB から読み出す（service key）
```

## 4. Claude Code による判定（運用）

1 セッションで扱うのは **1年度・1採点科目（択一50肢＋選択式5空欄）程度**。判定ごとに根拠を残す。

1. **対象を受け取る**: 利用者が要確認一覧の画面（年度・科目で絞り込み）か、`law-risk.check.sql` の一覧から、対象の肢（ID・本文・既存の `law_note`）を渡す。
2. **根拠条文を確かめる**: [e-Gov 法令検索](https://laws.e-gov.go.jp/) で、肢が前提とする条文（法・施行令・施行規則）の**法令基準日時点の規定**を確認する。
   - 改正履歴（「改正履歴」タブ・附則）で、試験の年度の基準日から法令基準日までに改正がないかを見る。
   - 告示・通達で決まる数値（率・額）は、厚生労働省の公表資料で年度の値を確認する。
3. **2027年版の教材と照らす**: 食い違いは **2027年版の教材 ＞ 公式PDF** の順で優先する（§9）。教材が手元にない論点は「教材未確認」と注記する。
4. **判定する**:

   | 判定 | 条件 | 出題 |
   |---|---|---|
   | `ok` | 法令基準日の規定で、公式の正答（`truth`）がそのまま成り立つ | する |
   | `excluded` | 改正で正答が変わった・肢の前提が成り立たない。直すより外す方が安全なもの | しない |
   | `review` | 判断がつかない（通達待ち・教材未確認など） | しない |

   - 改正で正答が変わる肢は、`truth` や本文を書き換えずに `excluded` にする（書籍の取り込みで同じ座標の肢が入れば、書籍の版が正本になる。§14）。
5. **注記を書く**: `[判定 YYYY-MM-DD 基準日 YYYY-MM-DD] 確認済み|要確認|除外: 根拠`（`lawDecisionNote` と同じ形）。根拠は「労基法第32条（改正なし）」「教材p.123」のように短く。
   公表の注記（`問題誤りの公表により…`）は消さずに、その下に追記する。
6. **反映する**: 少数なら利用者が要確認一覧の画面で入力してもよい。まとまった件数は、下の SQL を Claude Code が作り、ローカルで確かめてから本番に流す（実行したSQLの全文と件数を報告する）。

```sql
-- 判定の反映（Claude Code が VALUES を埋めて渡す）。追記のみ・冪等（同じ注記が既にある行と、確認待ちでない行は触らない）
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM auth.users) <> 1 THEN RAISE EXCEPTION '利用者が1人ではありません'; END IF;
END $$;
UPDATE lic_items i
SET law_status = v.status,
    law_note = CASE WHEN COALESCE(btrim(i.law_note, E' \n'), '') = '' THEN v.note
                    ELSE btrim(i.law_note, E' \n') || E'\n' || v.note END
FROM (VALUES
  ('R08_T_RK_01_A', 'ok', '[判定 2026-10-20 基準日 2026-04-10] 確認済み: 根拠')
) AS v(id, status, note)
WHERE i.user_id = (SELECT id FROM auth.users)
  AND i.id = v.id
  AND i.law_status IN ('unchecked', 'review')
  AND v.status IN ('ok', 'review', 'excluded')
  AND position(v.note IN COALESCE(i.law_note, '')) = 0;
COMMIT;
```

7. **報告する**: 年度・科目ごとに `ok / review / excluded` の件数と、`excluded` にした肢の理由を一覧で残す。

## 5. 要確認一覧の画面

社労士の復習タブの「要確認一覧（法改正）」（`src/features/license/LawReview.tsx`）。

- `unchecked` / `review` の肢を、年度・採点科目のボタン（未確認 / 要確認の件数つき）で絞り込んで見る。「要確認だけ」で `review` に限る。
- 各肢に根拠を入力し、「確認済み（ok）」「要確認（review）」「除外（excluded）」を押す。`law_note` には判定の行が追記される。
- 読み込んだ後に別の場所（SQL・別の端末）で状態が変わった肢は更新しない（開き直す）。
- 更新した肢は、その端末の本文キャッシュ（IndexedDB）も新しい状態にする。**他の端末のキャッシュは古い状態のまま残る**ことがある
  （`ok` → `review` に戻した肢が、その端末では出題され続ける）。再照合で戻した場合は、他の端末でもこの画面を開くか、キャッシュを消す。

## 6. 法令基準日の更新と再照合（2027年4月の公告後）

1. 要確認一覧の画面で法令基準日を更新する。
2. `--base-date <新しい基準日>` で SQL を作り直す（新しい注記の基準日が変わるだけで、規則は同じ）。
3. 前の基準日で `ok` にした肢のうち、改正があった法令の肢を Claude Code が洗い出し、§4 の反映 SQL で `review` に戻す
   （`law_status IN ('unchecked','review')` の条件を `('ok')` に替えた版を使う。戻した肢は §4 の手順で判定し直す）。
4. `build-master.mjs` で索引を再生成する。

## 7. ローカルでの確認（SQL を変えたとき）

`/usr/lib/postgresql/16/bin` の PostgreSQL に、auth スキーマのスタブ（`auth.users`・`auth.uid()`）、migration 001 の
`update_denken_updated_at`、002・016・022・023 を適用し、フィクスチャ（`ingest-official.mjs --fixture --sql`）を入れて確かめる。

- `--fixture` 付きで SQL を作り、`check` → `apply` を2回（2回目が `UPDATE 0`、内容が同じ）→ `rollback` を2回（同じ）→ 再 `apply` が1回目と同じになること。
- `EXPLAIN` で `lic_items_law_status` のインデックスが使われること。
- `--dry-run --items`（DB から書き出した行）の候補と、`check.sql` の一覧が一致すること（JS と SQL の正規表現の一致）。
