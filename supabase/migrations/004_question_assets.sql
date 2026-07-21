-- 問題画像とMASTER問題の対応表（denken_question_assets）
-- 1問↔複数画像（解答またがり）と 1画像↔複数問（2問同居）を単一テーブルで表現する。
-- 進捗データ（denken_reviews）とは独立。問題画像は利用者ごとに own（RLSで分離）。

CREATE TABLE IF NOT EXISTS denken_question_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT auth.uid(),
  question_id   TEXT NOT NULL,                              -- MASTER id 例 'dc_8'
  storage_path  TEXT NOT NULL,                              -- 非公開バケット内パス
  region        TEXT CHECK (region IN ('top', 'bottom')),  -- NULL=画像全体, top/bottom=2問同居の分割
  answer_x_pct  NUMERIC NOT NULL DEFAULT 50,                -- 解答が始まる横位置(%)。解答マスクの分割位置
  sort          INTEGER NOT NULL DEFAULT 0,                 -- 同一問の複数画像の並び（0=主, 1..=解答続き）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id, storage_path, sort)
);

ALTER TABLE denken_question_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_assets"
  ON denken_question_assets
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS denken_question_assets_qid_idx
  ON denken_question_assets (user_id, question_id, sort);
