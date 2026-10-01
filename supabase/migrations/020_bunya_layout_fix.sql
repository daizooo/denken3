-- 分野別（見開きスキャン）画像のうち、複数ページ表示（panesOf）の前提とずれていた切り出し設定の是正。
-- 単相交流29（右ページの図2・図3と選択肢が「解答側」に回り、問題表示で見えなかった）を契機に、
-- 全章の登録画像（472枚）を「右ページ上端に解答見出しの帯があるか」で走査して洗い出した。
--
-- 類型と是正（値はいずれも画像の見出し帯・本文の空白帯を画素から測った実測。
--  scripts/peek-asset.mjs で現物を開いて目視確認済み）:
--   A) 見開き全面が問題なのに answer_x_pct=50 のまま（右ページが解答側に回っていた）  → 100
--   B) 解答またがりの続き画像に問題の続き（小問(b)）が左ページにある（x=0=丸ごと解答扱い）→ 50
--   C) 左ページの下から解答が始まる問題で answer_y_pct が既定100（解答が問題側に出ていた）→ 見出し直上
--   D) 右ページの途中から解答が始まる問題で answer_right_y_pct が既定0                  → 見出し直上
--   E) 2問同居の上下境界(region_y_pct)が本文の行を貫いていた                               → 空白帯へ
--   F) 2問同居で、左右ページの境界が一致しない画像（上の問題の解答が長い）          → answer_region_y_pct（新設）
--
-- 既存カラムの変更・削除は無く、追加（ADD COLUMN）と値の再設定のみ。冪等。
-- 取り込み時の初期値は src/data/*Assets.ts 側にも同じ値を入れてある（再取り込みで巻き戻らない）。

-- F) 解答ページ（右ページ）だけ上下境界が違うときの値。NULL＝region_y_pct と同じ。
ALTER TABLE denken_question_assets
  ADD COLUMN IF NOT EXISTS answer_region_y_pct NUMERIC;

-- A) 全面問題（右ページも問題）
UPDATE denken_question_assets
  SET answer_x_pct = 100
  WHERE sort = 0
    AND question_id IN ('ac1_29', 'ecircuit_10', 'ecircuit_11', 'ecircuit_12', 'ecircuit_17', 'ecircuit_18', 'ecircuit_19', 'ecircuit_23', 'ecircuit_26', 'ecircuit_32', 'ecircuit_50', 'ecircuit_57', 'ecircuit_9', 'etheory_13', 'etheory_35', 'etheory_40', 'etheory_46', 'mag_51', 'meas_34', 'meas_45', 'meas_46', 'trans_10', 'trans_11');

-- B) 解答続き画像の左ページは問題の続き
UPDATE denken_question_assets
  SET answer_x_pct = 50
  WHERE sort = 1
    AND question_id IN ('ecircuit_26', 'ecircuit_33', 'ecircuit_45', 'ecircuit_53', 'ecircuit_55', 'ecircuit_56', 'meas_28', 'meas_46', 'meas_51');

-- C) 左ページ下から解答が始まる
UPDATE denken_question_assets
  SET answer_y_pct = 57
  WHERE sort = 0
    AND question_id IN ('etheory_36');
UPDATE denken_question_assets
  SET answer_y_pct = 60
  WHERE sort = 0
    AND question_id IN ('ecircuit_3');
UPDATE denken_question_assets
  SET answer_y_pct = 62
  WHERE sort = 0
    AND question_id IN ('ecircuit_22');

-- D) 右ページの途中から解答が始まる
UPDATE denken_question_assets
  SET answer_right_y_pct = 32
  WHERE sort = 0
    AND question_id IN ('ac1_46');
UPDATE denken_question_assets
  SET answer_right_y_pct = 42
  WHERE sort = 0
    AND question_id IN ('ecircuit_35');

-- E)/F) 2問同居の上下境界
UPDATE denken_question_assets
  SET answer_region_y_pct = 52, region_y_pct = 42.5
  WHERE sort = 0
    AND question_id IN ('mag_38', 'mag_39');
UPDATE denken_question_assets
  SET answer_region_y_pct = 60
  WHERE sort = 0
    AND question_id IN ('dc_19', 'dc_20');
UPDATE denken_question_assets
  SET region_y_pct = 43
  WHERE sort = 0
    AND question_id IN ('meas_31', 'meas_32');
UPDATE denken_question_assets
  SET region_y_pct = 48
  WHERE sort = 0
    AND question_id IN ('elec_26', 'elec_27');
UPDATE denken_question_assets
  SET region_y_pct = 62
  WHERE sort = 0
    AND question_id IN ('trans_4', 'trans_5');
