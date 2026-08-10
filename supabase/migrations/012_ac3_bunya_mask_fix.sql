-- 分野別過去問の解答マスクを answer_x_pct（1画像ごとの横マスク位置）で統一する。
-- ビューアは従来「sort=0=問題見開き（右マスク）／sort>0=解答続き（解答を見るまで非表示）」と
-- sort で表示を決めていたが、B問題（見開き2枚構成）を正しく表現できず、
-- 三相交流の問15/20/21/24 で問題文まで隠れていた。
-- 表示判定を answer_x_pct に変更するのに合わせ、既存データを実レイアウトへ是正する。
--
-- 規約（新）:
--   answer_x_pct = 50  → 見開き標準（左=問題／右=解答）。右半分を解答マスク。
--   answer_x_pct = 100 → 画像全体が問題。マスクなし・常時表示。
--   answer_x_pct = 0   → 見開き丸ごと解答。「解答を見る」まで非表示。
--
-- 冪等（値の再設定のみ）なので複数回実行しても安全。

-- 1) 続きページ(sort>0)は既定で「見開き丸ごと解答」として非表示扱いに揃える
--    （従来の sort>0=解答続きの挙動を answer_x_pct=0 で再現）。
UPDATE denken_question_assets
  SET answer_x_pct = 0
  WHERE sort > 0;

-- 2) 三相交流 問15/20/21 は小問(a)(b)が別々の見開きにある標準レイアウト。
--    2枚目(sort=1)も「左=問題／右=解答」なので右半分マスク（=50）に戻し、(b)の問題文を表示する。
UPDATE denken_question_assets
  SET answer_x_pct = 50
  WHERE question_id IN ('ac3_15', 'ac3_20', 'ac3_21')
    AND sort = 1;

-- 3) 三相交流 問24 の1枚目(sort=0)は問題見開き丸ごと（右ページに図1・図2）。
--    右半分マスクだと図が隠れるため、全面問題(=100)にしてマスクを外す。
UPDATE denken_question_assets
  SET answer_x_pct = 100
  WHERE question_id = 'ac3_24'
    AND sort = 0;
