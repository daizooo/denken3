-- 本番形式模試の最終期限（licensehub-expansion.md §7）。
--
-- R6〜R8 は模試としていつでも解け、どの年度をいつ解くかは進捗を見て決める。期限だけを持つ。
-- 模試画面は、この日までの残り日数と未受験の年度×式を出す（src/lib/license/textMock.ts の mockProgress）。
-- 既存の設定テーブル denken_settings（migration 002・016・023・024）に列を足す。
--
-- NULL / 行なし = 未設定（既定値 2027-05-31 を使う。src/data/sharoushi/index.ts の SHAROUSHI_MOCK_DEADLINE）。
--
-- ■ 安全性
-- 追加のみ（ADD COLUMN IF NOT EXISTS）。既存の列・制約・データは変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（この列の値だけが消える）
--   ALTER TABLE denken_settings DROP COLUMN IF EXISTS mock_deadline;
ALTER TABLE denken_settings
  ADD COLUMN IF NOT EXISTS mock_deadline DATE;
