-- 1級土木施工管理技士 第一次検定の問題（dbk_questions）。docs/design/doboku1-ichiji.md §5・§6.5。
--
-- ■ 方針
-- 社労士の lic_questions / lic_items とは別テーブルにする。lic_* は exam_id 列を持たず、
-- 年度一覧・足切り集計・法改正レビューなどが user_id だけで読んでいるため、同じ表に入れると社労士の画面に混ざる。
-- FSRS のカード単位は「問」（四肢択一を1問まるごと解く）。復習状態は既存 denken_reviews（exam_id='doboku1'、question_id=id）。
-- 問題本文は公式（全国建設研修センターの試験問題・正答肢）が正本。リポジトリには置かず、このテーブルにだけ持つ。
-- id は 'D1_R08_A_01'（年度・試験問題A/B・問番号）。利用者ごとに同じ値を使うため一意性は (user_id, id)。
-- 図解解説は explain（JSON。型は src/lib/doboku1/types.ts の Explain）。
--
-- ■ 安全性
-- 追加のみ（新規テーブル1つ）。既存テーブル・制約は変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（データごと消える）
--   DROP TABLE IF EXISTS denken3.dbk_questions;

CREATE TABLE IF NOT EXISTS denken3.dbk_questions (
  user_id           UUID NOT NULL DEFAULT auth.uid(),
  id                TEXT NOT NULL,                        -- 'D1_R08_A_01'
  year              TEXT NOT NULL CHECK (year ~ '^[HR][0-9]{2}$'),
  paper             TEXT NOT NULL CHECK (paper IN ('A', 'B')),
  q_no              INTEGER NOT NULL CHECK (q_no BETWEEN 1 AND 99),
  group_label       TEXT NOT NULL,                        -- 選択解答のグループ（'土木一般（15問中12問）' など）
  required          BOOLEAN NOT NULL DEFAULT FALSE,       -- 必須問題か
  category          TEXT NOT NULL,                        -- 学習分野ID（src/data/doboku1）
  topic             TEXT NOT NULL DEFAULT '',             -- 論点名
  kind              TEXT NOT NULL CHECK (kind IN ('single', 'statements', 'fill', 'calc')),
  direction         TEXT NOT NULL CHECK (direction IN ('right', 'wrong')),
  stem              TEXT NOT NULL,
  statements        JSONB NOT NULL DEFAULT '[]',          -- ①〜④（statements 形式のみ）
  choice_header     JSONB NOT NULL DEFAULT '[]',          -- 表形式の選択肢の見出し
  choices           JSONB NOT NULL,                       -- ⑴〜⑷（各要素は列の配列）
  correct           INTEGER NOT NULL CHECK (correct BETWEEN 1 AND 4),
  has_figure        BOOLEAN NOT NULL DEFAULT FALSE,
  figure_path       TEXT,                                 -- 問題の図（非公開ストレージ）。未登録は NULL
  explain           JSONB,                                -- 図解解説（Explain）
  explain_verified  BOOLEAN NOT NULL DEFAULT FALSE,       -- 根拠を確かめたか
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  CHECK (jsonb_typeof(choices) = 'array' AND jsonb_array_length(choices) = 4)
);

CREATE INDEX IF NOT EXISTS dbk_questions_year
  ON denken3.dbk_questions (user_id, year, paper, q_no);
CREATE INDEX IF NOT EXISTS dbk_questions_category
  ON denken3.dbk_questions (user_id, category);

-- RLS（既存と同形：本人のみ操作可）
ALTER TABLE denken3.dbk_questions ENABLE ROW LEVEL SECURITY;

-- DROP を含めない（CLAUDE.md: DROP を含む SQL は利用者が実行する）。存在しないときだけ作って冪等にする。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'denken3' AND tablename = 'dbk_questions'
                   AND policyname = 'users_manage_own_dbk_questions') THEN
    CREATE POLICY "users_manage_own_dbk_questions"
      ON denken3.dbk_questions
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER dbk_questions_updated_at
  BEFORE UPDATE ON denken3.dbk_questions
  FOR EACH ROW EXECUTE FUNCTION denken3.update_denken_updated_at();

-- Data API 権限（CLAUDE.md §4・028 参照）。anon は付与しない。
GRANT SELECT, INSERT, UPDATE, DELETE ON denken3.dbk_questions TO authenticated, service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON denken3.dbk_questions FROM authenticated;
