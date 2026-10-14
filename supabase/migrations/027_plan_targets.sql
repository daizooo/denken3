-- 目標日の逆算の設定と上書きの印（licensehub-expansion.md §10.1・§15の9・§17）。
--
-- 社労士の各科目の目標日（denken_exam_plans.bunya_target_date）を、本試験日と基準点から
-- src/lib/license/plan.ts の computeTargets で逆算して書く。その入力を設定として持つ。
--
-- ■ denken_settings（migration 002・016・023〜025）に足す列。NULL / 行なし = 未設定（既定値を使う。
--   src/data/sharoushi/plan.ts）。保存値は項目ごとに既定値へ重ねる（resolvePlanSettings）。
--   plan_anchors  jsonb  基準点 {startDate, gateDate, finalPhaseWeeks, throughWeeks, minPracticeDays, releaseDates}
--   plan_weights  jsonb  科目の重み {科目ID: 数値}
--   plan_order    jsonb  学習順 [科目ID, ...]
--
-- ■ denken_exam_plans（migration 009）に足す列。
--   target_overridden boolean  true = 利用者が目標日を上書きした（再計算で bunya_target_date を変えない）。
--   既定 false。電験の行は使わない（電験の目標日・未設定時の exam_date - 90日 の扱いは変わらない）。
--
-- ■ 安全性
-- 追加のみ（ADD COLUMN IF NOT EXISTS）。既存の列・制約・データは変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（これらの列の値だけが消える）
--   ALTER TABLE denken_settings DROP COLUMN IF EXISTS plan_anchors;
--   ALTER TABLE denken_settings DROP COLUMN IF EXISTS plan_weights;
--   ALTER TABLE denken_settings DROP COLUMN IF EXISTS plan_order;
--   ALTER TABLE denken_exam_plans DROP COLUMN IF EXISTS target_overridden;
ALTER TABLE denken_settings
  ADD COLUMN IF NOT EXISTS plan_anchors JSONB,
  ADD COLUMN IF NOT EXISTS plan_weights JSONB,
  ADD COLUMN IF NOT EXISTS plan_order JSONB;

ALTER TABLE denken_exam_plans
  ADD COLUMN IF NOT EXISTS target_overridden BOOLEAN NOT NULL DEFAULT false;
