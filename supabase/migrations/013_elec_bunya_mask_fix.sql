-- 分野別過去問（静電気）の解答マスクを実画像レイアウトへ是正する。
-- 従来の表現軸（answer_x_pct＝解答マスクの横位置／answer_y_pct＝左ページ下部の食い込み）では
-- 静電気の以下の型を表せず、問題文や選択肢が隠れる／2問目の見出しが切れる状態になっていた。
--
-- 追加する軸:
--   answer_right_y_pct … 右ページのマスクを縦にずらす位置(%)。既定0=右ページ全体が解答。
--                         「左=問題／右上=小問(b)と選択肢／右下=解答」の見開き用（静電気 問47）。
--   region_y_pct      … 2問同居画像(region top/bottom)の上下分割位置(%)。既定50=画像の半分。
--                         2問目の見出しが中央より上にある画像用（静電気 問38/39）。
--
-- 値の再設定のみなので冪等（複数回実行しても安全）。

ALTER TABLE denken_question_assets
  ADD COLUMN IF NOT EXISTS answer_right_y_pct NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE denken_question_assets
  ADD COLUMN IF NOT EXISTS region_y_pct NUMERIC NOT NULL DEFAULT 50;

-- 1) 問13/45/49/71 の1枚目は「見開き丸ごと問題」（右ページが選択肢の表や小問(a)(b)）。
--    右半分マスクだと選択肢まで隠れるため、全面問題(=100)にしてマスクを外す。
UPDATE denken_question_assets
  SET answer_x_pct = 100
  WHERE question_id IN ('elec_13', 'elec_45', 'elec_49', 'elec_71')
    AND sort = 0;

-- 2) 問48 は(a)と(b)が別々の見開きにあるB問題。2枚目(sort=1)も「左=問題／右=解答」なので
--    右半分マスク(=50)へ戻し、(b)の問題文を表示する（従来は解答続き扱いで丸ごと隠れていた）。
UPDATE denken_question_assets
  SET answer_x_pct = 50
  WHERE question_id = 'elec_48'
    AND sort = 1;

-- 3) 問47 は1枚の見開きに「左=問題＋(a)／右上=(b)＋選択肢／右下=解答」が同居する。
--    右ページは24%より下だけをマスクし、小問(b)を表示する。
UPDATE denken_question_assets
  SET answer_x_pct = 50, answer_right_y_pct = 24
  WHERE question_id = 'elec_47';

-- 4) 問38/39 は2問同居。2問目の見出しが画像の45%付近から始まるため、
--    上下の分割位置を45%にして問39の見出しが切れないようにする。
UPDATE denken_question_assets
  SET region_y_pct = 45
  WHERE question_id IN ('elec_38', 'elec_39');
