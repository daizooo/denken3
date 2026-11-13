-- 2級建設業経理士の問題（kk2_questions）。docs/design/kenkei2.md §5・docs/kenkei2-ingest.md。
--
-- ■ 方針
-- 社労士の lic_*、1級土木の dbk_* とは別テーブルにする（資格を混ぜない）。復習状態は既存 denken_reviews（exam_id='kenkei2'、question_id=id）。
-- カードの単位: 第1問の仕訳1組・第2問の1問・第3問・第4問・第5問（精算表）。1回あたり12枚（配点 4×5 + 3×4 + 14 + 24 + 30 = 100）。
-- 問題文・解答欄・正答は DB にだけ持つ（リポジトリには置かない）。id は 'K2_39_1_1'（回・大問・設問）。一意性は (user_id, id)。
--   stem  : 問題文（第3〜5問は表の列の区切りをタブで残す）
--   frame : 解答欄の定義（仕訳=科目群、金額=単位、第3・4問=解答用紙の複製と採点単位、精算表=勘定科目と試算表）
--   key   : 正答（採点マスと同じキー）
--
-- ■ 安全性
-- 追加のみ（新規テーブル1つ）。既存テーブル・制約は変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（データごと消える。DROP を含むので利用者が実行する）
--   DROP TABLE IF EXISTS denken3.kk2_questions;

CREATE TABLE IF NOT EXISTS denken3.kk2_questions (
  user_id     UUID NOT NULL DEFAULT auth.uid(),
  id          TEXT NOT NULL,                        -- 'K2_39_1_1'
  exam_no     INTEGER NOT NULL CHECK (exam_no BETWEEN 1 AND 999),   -- 検定の回（第39回 = 39）
  part        INTEGER NOT NULL CHECK (part BETWEEN 1 AND 5),        -- 大問
  sub         INTEGER NOT NULL CHECK (sub BETWEEN 1 AND 9),         -- 設問（第3〜5問は 1）
  form_kind   TEXT NOT NULL CHECK (form_kind IN ('journal', 'amount', 'sheet', 'settlement')),
  points      INTEGER NOT NULL CHECK (points > 0),  -- 配点（資格スクール大栄の予想）
  stem        TEXT NOT NULL,
  frame       JSONB NOT NULL DEFAULT '{}',
  key         JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS kk2_questions_exam
  ON denken3.kk2_questions (user_id, exam_no, part, sub);

-- RLS（既存と同形：本人のみ操作可）
ALTER TABLE denken3.kk2_questions ENABLE ROW LEVEL SECURITY;

-- DROP を含めない（CLAUDE.md: DROP を含む SQL は利用者が実行する）。存在しないときだけ作って冪等にする。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'denken3' AND tablename = 'kk2_questions'
                   AND policyname = 'users_manage_own_kk2_questions') THEN
    CREATE POLICY "users_manage_own_kk2_questions"
      ON denken3.kk2_questions
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER kk2_questions_updated_at
  BEFORE UPDATE ON denken3.kk2_questions
  FOR EACH ROW EXECUTE FUNCTION denken3.update_denken_updated_at();

-- Data API 権限（CLAUDE.md §4・028 参照）。anon は付与しない。
GRANT SELECT, INSERT, UPDATE, DELETE ON denken3.kk2_questions TO authenticated, service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON denken3.kk2_questions FROM authenticated;
