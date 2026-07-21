-- 解答マスクのL字対応。
-- 短い問題は「左ページ上=問題／左ページ下=解答の始まり／右ページ=解答の続き」となるため、
-- 右半分(answer_x_pct)だけでは左下の解答を隠せない。
-- answer_y_pct: 左ページで解答が始まる縦位置(%)。100=左ページ全体が問題（標準レイアウト）。
ALTER TABLE denken_question_assets
  ADD COLUMN IF NOT EXISTS answer_y_pct NUMERIC NOT NULL DEFAULT 100;
