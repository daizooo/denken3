-- 公開模試の得点入力（licensehub-expansion.md §4.4・§10.2・PR-I）。
--
-- 初見の実力の予測に使う公開模試（LEC・TAC 等）の科目別得点を、1回＝1行で持つ。
-- 本番形式模試（denken_mock_sessions）は既習の肢を含むため別に扱い、その CHECK 制約も変えないよう別表にする。
-- 5月末ゲートの判定（src/lib/license/cutoff.ts の judgeGate）は、この表の最新の得点を本番形式模試より優先する。
--
--   sentaku_scores / taku_scores: 採点科目コード → 得点（例 {"RK":3,"RS":4,...}）。その式を入力しなければ NULL。
--
-- ■ 安全性
-- 新規テーブルの追加のみ（IF NOT EXISTS）。既存の表・列・制約・データは変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（この表の入力がすべて消える）
--   DROP TABLE IF EXISTS lic_external_scores;
CREATE TABLE IF NOT EXISTS lic_external_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  exam_id         TEXT NOT NULL DEFAULT 'sharoushi',
  label           TEXT NOT NULL,
  taken_on        DATE NOT NULL,
  sentaku_scores  JSONB,
  taku_scores     JSONB,
  memo            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lic_external_scores_user_exam
  ON lic_external_scores (user_id, exam_id, taken_on);

-- RLS（lic_questions・lic_items と同形：本人のみ操作可）
ALTER TABLE lic_external_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_lic_external_scores" ON lic_external_scores;
CREATE POLICY "users_manage_own_lic_external_scores"
  ON lic_external_scores
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新（001 で定義した関数を再利用）
DROP TRIGGER IF EXISTS lic_external_scores_updated_at ON lic_external_scores;
CREATE TRIGGER lic_external_scores_updated_at
  BEFORE UPDATE ON lic_external_scores
  FOR EACH ROW EXECUTE FUNCTION update_denken_updated_at();
