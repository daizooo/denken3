-- 実施日履歴（review_history）と初回実施日（first_reviewed）を追加
-- review_history はアプリコードで参照されていたが当初マイグレーションが無く、
-- first_reviewed もコードから書き込まれていなかった。
-- リポジトリとDBスキーマを一致させるために明示的に追記する。

ALTER TABLE denken_reviews
  ADD COLUMN IF NOT EXISTS review_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS first_reviewed DATE;

-- 既存データ：履歴が実施日ではなく登録日で記録されていたため、
-- 単一エントリの場合は実施日（last_reviewed）に合わせ、初回日も設定する。
UPDATE denken_reviews
SET review_history = jsonb_build_array(
      jsonb_build_object('date', to_char(last_reviewed, 'YYYY-MM-DD'), 'status', status)
    ),
    first_reviewed = last_reviewed::date
WHERE last_reviewed IS NOT NULL
  AND jsonb_array_length(review_history) = 1
  AND first_reviewed IS NULL;
