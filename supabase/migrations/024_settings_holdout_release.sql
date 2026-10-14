-- 温存（hold-out）の解放日（licensehub-expansion.md §7・§8・PR-H）。
--
-- 温存グループ → 解放日（'YYYY-MM-DD'）を JSONB で持つ。例:
--   {"pilot-r7-rk": "2026-11-20", "mock-r06": "2027-03-08", "mock-r07": "2027-03-08", "gate-r8": "2027-05-31"}
-- グループ: pilot-r7-rk（R7 択一 労基・安衛）、gate-r8（R8 全部）、mock-r06 / mock-r07（本番形式模試の年度）。
-- 判定は src/lib/license/holdout.ts の isAvailable 1か所。キーが無い・日付として不正なグループは「解放しない」。
-- グループが増えても列を足さずに済むよう、1列の JSONB にする。既存の設定テーブル denken_settings（migration 002・016・023）に列を足す。
--
-- NULL / 行なし = すべて未設定（温存グループは解放しない）。
--
-- ■ 安全性
-- 追加のみ（ADD COLUMN IF NOT EXISTS）。既存の列・制約・データは変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（この列の値だけが消える）
--   ALTER TABLE denken_settings DROP COLUMN IF EXISTS holdout_release_dates;
ALTER TABLE denken_settings
  ADD COLUMN IF NOT EXISTS holdout_release_dates JSONB;
