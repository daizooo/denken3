-- Phase 1: 試験日程（denken_exam_plans）
-- 資格×科目ごとに試験日・申込期間・分野別完走目標・年度別開始予定を保持する。
-- これを起点に、適応型ペース分析（§7.2）・申込リマインド（§7.1）・
-- FSRS の試験日クリップ（§7.3）を行う。
--
-- 休止期間を事前宣言するテーブルは設けない（設計 §6.2）。
-- 産後等のキャパ変動は日々の実績からの適応推定（EWMA）で吸収する。
--
-- すべて追加のみ・破壊的変更なし。ロールバックはテーブル削除で可能。

CREATE TABLE IF NOT EXISTS denken_exam_plans (
  user_id            UUID NOT NULL,
  exam_id            TEXT NOT NULL,             -- 'denken3'
  subject_id         TEXT NOT NULL,             -- 'riron'
  label              TEXT NOT NULL DEFAULT '',  -- '2027年2月 下期CBT' など
  exam_date          DATE NOT NULL,
  application_start  DATE,                      -- 申込開始（例 2026-11-09）
  application_end    DATE,                      -- 申込締切（例 2026-11-26）※リマインド対象
  bunya_target_date  DATE,                      -- 分野別完走の目標日（未設定時は exam_date - 90日）
  nendo_start_date   DATE,                      -- 年度別演習の開始予定日
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, exam_id, subject_id)
);

-- RLS（denken_reviews と同形：本人のみ操作可）
ALTER TABLE denken_exam_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_exam_plans"
  ON denken_exam_plans
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新（001 で定義した関数を再利用）
CREATE TRIGGER denken_exam_plans_updated_at
  BEFORE UPDATE ON denken_exam_plans
  FOR EACH ROW EXECUTE FUNCTION update_denken_updated_at();
