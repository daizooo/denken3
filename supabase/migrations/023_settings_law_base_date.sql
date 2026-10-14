-- 法令の基準日（licensehub-expansion.md §9・PR-K）。
--
-- 社労士の公式PDF由来の肢を、どの時点の法令で確認したかの基準（官報公告日。令和8年は 2026-04-10）。
-- 2027年4月の公告後に利用者が更新し、法改正フラグ（scripts/license/flag-law-risk.mjs）で再照合する。
-- 既存の設定テーブル denken_settings（migration 002・016）に列を足す。
--
-- NULL = 未設定（アプリ・スクリプトの既定値 2026-04-10 を使う。src/lib/license/lawRisk.ts DEFAULT_LAW_BASE_DATE）。
-- 行なし = 未設定と同じ。
--
-- ■ 安全性
-- 追加のみ（ADD COLUMN IF NOT EXISTS）。既存の列・制約・データは変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（この列の値だけが消える）
--   ALTER TABLE denken_settings DROP COLUMN IF EXISTS law_base_date;
ALTER TABLE denken_settings
  ADD COLUMN IF NOT EXISTS law_base_date DATE;
