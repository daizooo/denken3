-- ts-fsrs v5: FSRSステートを保存する列を追加
-- State: 0=New, 1=Learning, 2=Review, 3=Relearning

ALTER TABLE denken_reviews
  ADD COLUMN IF NOT EXISTS fsrs_state INTEGER NOT NULL DEFAULT 0;

-- 既存データ：repetitions > 0 の問題は Review ステートに設定
UPDATE denken_reviews SET fsrs_state = 2 WHERE repetitions > 0;
