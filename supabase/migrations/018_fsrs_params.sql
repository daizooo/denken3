-- 学習済み FSRS パラメータ w[]（FSRS-6・21個）の版管理テーブル。
--
-- 既存テーブル・既存列は一切変更しない（CLAUDE.md §4）。追加だけで表現する。
-- 履歴側は ReviewHistoryEntry.policy.w_version（JSONB）に版番号を書くだけなので、
-- denken_reviews へのスキーマ変更も不要。
--
-- ■ 版を持つ理由
-- w[] は忘却曲線そのものを決める。版を記録せずに差し替えると、deriveFromHistory が
-- 履歴を再生するたびに過去の予定日まで書き換わる（adaptive-fsrs-policy.md §3.4 が
-- 「この仕組み無しに実装してはならない」とした禁止事項）。記録時の版を履歴へ残し、
-- 再生時はその版で計算することで、新しい版を採用しても過去の結果は動かない。
--
-- 版 0 は ts-fsrs の既定パラメータを指す予約値で、このテーブルには行を持たない。
-- 版を持たない旧履歴も版 0 として扱われる（後方互換）。
--
-- ■ adopted（採用中）
-- 学習しただけの版は adopted=false で残る。改善が確認できた版だけを adopted=true に
-- するので、「学習は走ったが採用しなかった」も履歴として残り、あとから理由を追える。
-- 部分ユニークインデックスで、採用中は資格ごとに常に1件だけであることを保証する。

CREATE TABLE IF NOT EXISTS denken_fsrs_params (
  user_id      UUID        NOT NULL,
  exam_id      TEXT        NOT NULL,
  version      INTEGER     NOT NULL CHECK (version > 0),
  -- 21個の重み（FSRS-6）。要素数の検証はアプリ側で行う。
  w            JSONB       NOT NULL,
  -- 学習時の設定。スケジューリング側と揃っていないと結果が意味を失うため一緒に残す。
  enable_short_term BOOLEAN NOT NULL DEFAULT FALSE,

  trained_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_count INTEGER     NOT NULL,   -- 学習に使った演習の総数
  item_count   INTEGER     NOT NULL,   -- FSRSItem 数（2回目以降の演習）

  -- 採否の根拠。既定パラメータ（before）と学習後（after）の当てはまりを並べて残す。
  -- log_loss は小さいほど良い。rmse は予測した想起確率と実測のズレ。
  log_loss_before DOUBLE PRECISION,
  log_loss_after  DOUBLE PRECISION,
  rmse_before     DOUBLE PRECISION,
  rmse_after      DOUBLE PRECISION,

  adopted      BOOLEAN     NOT NULL DEFAULT FALSE,
  -- 採用しなかった理由（'not_enough_data' / 'no_improvement' など）。採用時は NULL。
  reason       TEXT,

  PRIMARY KEY (user_id, exam_id, version)
);

-- 採用中の版は資格ごとに1件だけ。
CREATE UNIQUE INDEX IF NOT EXISTS denken_fsrs_params_adopted_unique
  ON denken_fsrs_params (user_id, exam_id)
  WHERE adopted;

ALTER TABLE denken_fsrs_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_fsrs_params"
  ON denken_fsrs_params
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
