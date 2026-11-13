# 2級建設業経理士の取り込み手順（K2）

`docs/design/kenkei2.md` §3 の取り込み経路。**解答PDF → 構造化JSON → 検証ゲート → （K3）DB保存**。
作業用ファイル（PDF・JSON）はリポジトリ配下に置かず、コミットしない（問題・正答は DB のみ）。

| 段階 | スクリプト | 内容 |
|---|---|---|
| 抽出 | `scripts/kenkei2/extract_answers.py`（部品: `pdfwords.py`） | 解答PDFの文字・罫線・網掛けから第1問（仕訳）・第2問（金額）・第5問（精算表と採点マス）を読む |
| 抽出 | `scripts/kenkei2/extract_sheets.py` | 第3・4問の解答用紙を座標つきで複製し、解答欄（網掛け・¥の金額・記号）を採点単位（units）に切り出す |
| 抽出 | `scripts/kenkei2/extract_problems.py` | 問題PDFの文字。化けた字形はフォントの `/Differences` から復元（`c2690〜c2699` = 0〜9）。復元できない字形は `〔?…〕` の印を残す |
| 組立 | `scripts/kenkei2/build_cards.py` | 上の3つの JSON → 設問ごとのカード（仕訳1組・金額1問・第3問・第4問・精算表）。記号↔科目名の突き合わせ・問題文・配点100を検証 |
| 出力 | `scripts/kenkei2/cards_sql.py` | カード → `INSERT … ON CONFLICT DO UPDATE`（追加と更新のみ） |
| 照合 | `scripts/kenkei2/hashes.py` | 投入後に DB の `md5(stem)`・`md5(frame::text)`・`md5(key::text)` と突き合わせる |
| 検証 | `scripts/kenkei2/check.mjs`（本体は `src/lib/kenkei2/validate.ts`） | 仕訳の借貸一致、精算表の行・列・当期純利益の整合、印字された合計との一致、採点マス×2点=30点、第3・4問の配点合計 38点（14と24）と正答の読み取り |

```sh
pip install pdfplumber
python3 scripts/kenkei2/extract_answers.py /path/to/39_kaitou.pdf /path/to/a39.json
python3 scripts/kenkei2/extract_sheets.py  /path/to/39_kaitou.pdf /path/to/s39.json
python3 scripts/kenkei2/extract_problems.py /path/to/q39.pdf /path/to/p39.json
node scripts/kenkei2/check.mjs /path/to/a39.json /path/to/s39.json   # 通らなければ終了コード 1（保存しない）
python3 scripts/kenkei2/build_cards.py /path/to/dir 39               # dir に a39.json s39.json p39.json → cards39.json
python3 scripts/kenkei2/cards_sql.py /path/to/dir/cards39.json <user_id> > insert39.sql
# insert39.sql を DB に流す（denken3.kk2_questions。migration 037 が先）。その後:
python3 scripts/kenkei2/hashes.py /path/to/dir/cards39.json         # 下の DB の結果と全行一致すること
#   select id, left(md5(stem),8), left(md5(frame::text),8), left(md5(key::text),8) from denken3.kk2_questions where exam_no = 39 order by id;
```

- 精算表の採点マスは、解答PDFの網掛け（グレー）の矩形から取る。表の線は「勘定科目」列を横切る罫線で行に分ける（整理記入に複数行ある勘定は科目のマスが結合されている）。
- PDF の誤植（第39回の `47.800` は `47,800`）は `pdfwords.num` が桁区切りとして読む。直し漏れは精算表の整合チェックが止める。
- 第34回は「当期（純利益）」の見出し自体が解答欄。見出し＋金額を1単位として数える（要確認。`check.mjs` の `scoredUnits`）。
- 問題PDFの丸数字（①②③）は NFKC で普通の数字になるため退避して戻す。中黒が「茜」に化ける字形（`氏名・受験番号` など）は「・」に直す。
- 解説ページは読まない（資格スクール大栄の著作物。設計書 §3.1）。
- 第3・4問は形が回ごとに違う（T勘定・原価報告書・部門費振替表・工事別原価計算表・金額・記号）ため、解答ページの文字・罫線をそのまま写し、解答欄だけを入力欄にする。
  採点単位（unit）は、網掛けのマス（括弧や1桁ずつの枠でつながった矩形は1マス。「G ( 1,700,000 )」のように記号＋金額が入るマスは1単位）、
  ¥の金額、「記号（…）」の英字、番号の行の下の記号の表。配点は網掛け=2点、記号の表=回ごと（34・35回は2点、他は1点）、
  金額・記号の問ごとの点は `extract_sheets.py` の `POINTS`（凡例を読んで書いたもの。配点は大栄の予想）。
