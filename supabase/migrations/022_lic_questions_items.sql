-- 社労士のテキスト問題（licensehub-expansion.md §4.4・PR-C）。
-- lic_questions: 問（択一式の1問）／選択式の1科目。
-- lic_items:     肢（択一式）／空欄（選択式）。FSRS のカード単位で、id は §4.2 の肢ID。
--
-- ■ 方針
-- 問題本文はリポジトリに置かず、このテーブルにだけ持つ（§4.1）。
-- RLS は既存（009_exam_plans.sql）と同形で、本人のみ操作可。
-- id は利用者ごとに同じ値を使う（座標がキー）ため、一意性は (user_id, id) で取る。
-- 値の決まっている列は CHECK で限定する。科目コード（scored_subject / study_subject）は
-- 資格ごとに増えるため CHECK にしない（src/domain/license.ts・src/data/sharoushi 側で持つ）。
-- lic_items.question_id には外部キーを張らない（書籍の肢を問より先に取り込む経路があるため。§14）。
--
-- ■ 安全性
-- 追加のみ（新規テーブル2つ）。既存テーブル・制約は変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（データごと消える）
--   DROP TABLE IF EXISTS lic_items;
--   DROP TABLE IF EXISTS lic_questions;

CREATE TABLE IF NOT EXISTS lic_questions (
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  id              TEXT NOT NULL,                       -- 'R08_T_RK_03' / 'R08_S_RK'
  year            TEXT NOT NULL
                  CHECK (year ~ '^[HR][0-9]{2}$'),     -- 'H29'〜'R08'
  format          TEXT NOT NULL
                  CHECK (format IN ('taku', 'sentaku')),
  scored_subject  TEXT NOT NULL,                       -- 採点科目 'RK'
  study_subject   TEXT NOT NULL,                       -- 学習科目 'rouki'（徴収法の判別に使う）
  q_no            INTEGER CHECK (q_no BETWEEN 1 AND 99), -- 科目内の問番号（選択式は NULL）
  stem            TEXT,                                -- 問題文（選択式は空欄入りの本文）
  answer_spec     JSONB,                               -- 正答（AnswerSpec。src/domain/license.ts）
  source          TEXT NOT NULL
                  CHECK (source IN ('honshiken', 'ippon')),
  holdout_group   TEXT,                                -- 温存グループ（§8）'pilot-r7-rk' など
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS lic_questions_year_format
  ON lic_questions (user_id, year, format);

CREATE TABLE IF NOT EXISTS lic_items (
  user_id               UUID NOT NULL DEFAULT auth.uid(),
  id                    TEXT NOT NULL,                 -- 'R08_T_RK_03_C' / 'R08_S_RK_A'
  question_id           TEXT NOT NULL,                 -- 親の問 'R08_T_RK_03'
  label                 TEXT NOT NULL
                        CHECK (label IN ('A', 'B', 'C', 'D', 'E')),
  label_raw             TEXT,                          -- 元の表記 'ア'
  statement             TEXT NOT NULL DEFAULT '',      -- 学習に使う本文（書籍の改題があれば書籍版）
  origin_statement      TEXT,                          -- 公式の原文（改題時のみ）
  truth                 BOOLEAN,                       -- 肢が正しいか。導出不能は NULL
  truth_source          TEXT NOT NULL DEFAULT 'manual'
                        CHECK (truth_source IN ('book', 'derived', 'manual')),
  explanation           TEXT,
  explanation_source    TEXT NOT NULL DEFAULT 'none'
                        CHECK (explanation_source IN ('book', 'ai', 'none')),
  explanation_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  topic_id              TEXT,                          -- 論点（トリセツ目次の項目）
  importance            TEXT
                        CHECK (importance IN ('A', 'B', 'C')),
  law_status            TEXT NOT NULL DEFAULT 'unchecked'
                        CHECK (law_status IN ('ok', 'unchecked', 'review', 'excluded')),
  law_note              TEXT,                          -- 改正の影響メモ（§9）
  study_subject         TEXT NOT NULL,                 -- 集計用
  scored_subject        TEXT NOT NULL,                 -- 集計用
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS lic_items_question
  ON lic_items (user_id, question_id);
CREATE INDEX IF NOT EXISTS lic_items_study_subject
  ON lic_items (user_id, study_subject);
CREATE INDEX IF NOT EXISTS lic_items_law_status
  ON lic_items (user_id, law_status);

-- RLS（denken_exam_plans と同形：本人のみ操作可）
ALTER TABLE lic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lic_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_lic_questions" ON lic_questions;
CREATE POLICY "users_manage_own_lic_questions"
  ON lic_questions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_manage_own_lic_items" ON lic_items;
CREATE POLICY "users_manage_own_lic_items"
  ON lic_items
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新（001 で定義した関数を再利用）
DROP TRIGGER IF EXISTS lic_questions_updated_at ON lic_questions;
CREATE TRIGGER lic_questions_updated_at
  BEFORE UPDATE ON lic_questions
  FOR EACH ROW EXECUTE FUNCTION update_denken_updated_at();

DROP TRIGGER IF EXISTS lic_items_updated_at ON lic_items;
CREATE TRIGGER lic_items_updated_at
  BEFORE UPDATE ON lic_items
  FOR EACH ROW EXECUTE FUNCTION update_denken_updated_at();
