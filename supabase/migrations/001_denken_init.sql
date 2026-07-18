-- 電験3種 過去問マスター: reviews table
-- 問題データはアプリコード(MASTER配列)で管理するため、ここでは進捗データのみ

CREATE TABLE IF NOT EXISTS denken_reviews (
  user_id      UUID        NOT NULL,
  question_id  TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT '未着手'
                           CHECK (status IN ('A', 'A-', 'B', 'C', 'D', '未着手')),

  -- FSRS fields
  stability      FLOAT   NOT NULL DEFAULT 0,
  difficulty_fsrs FLOAT  NOT NULL DEFAULT 5,
  due_date       DATE,
  repetitions    INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  last_reviewed  TIMESTAMPTZ,

  -- User annotations
  tags  TEXT[]  NOT NULL DEFAULT '{}',
  memo  TEXT    NOT NULL DEFAULT '',

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- RLS
ALTER TABLE denken_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_reviews"
  ON denken_reviews
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_denken_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER denken_reviews_updated_at
  BEFORE UPDATE ON denken_reviews
  FOR EACH ROW EXECUTE FUNCTION update_denken_updated_at();
