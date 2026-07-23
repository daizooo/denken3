-- Phase 2a: 年度別演習（CBT模試）のセッション（denken_mock_sessions / 設計 §6.3）
-- CBT模試はアプリ内で解答するため、受験1回=1セッションとして解答内容を保存する。
-- 中断・再開（端末をまたぐ場合を含む）に対応するため、解答のたびに autosave する。
--
-- 採点は PaperDefinition の正答・配点と answers から導出できるが、正答データの改訂に
-- 影響されないよう finished 時点のスコアを確定値として score/section_scores に保存する。
-- 移行判定「60点×2回連続」は status='finished' かつ mode='cbt' を finished_at 降順で
-- 見て導出する（アプリ側の純関数・DBには持たない）。
--
-- すべて追加のみ・破壊的変更なし。ロールバックはテーブル削除で可能。

CREATE TABLE IF NOT EXISTS denken_mock_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  exam_id           TEXT NOT NULL,                       -- 'denken3'
  subject_id        TEXT NOT NULL,                       -- 'riron'
  paper_id          TEXT NOT NULL,                       -- 'r8-1'（PaperDefinition.id）
  mode              TEXT NOT NULL DEFAULT 'cbt'
                    CHECK (mode IN ('cbt', 'free')),     -- cbt: 90分計測 / free: 時間無制限
  status            TEXT NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'finished', 'abandoned')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  remaining_seconds INTEGER,                             -- 中断時の残り時間（cbtモードのみ）
  answers           JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { "r8-1_a05": {"selected": [3], "flagged": true, "seconds": 187}, ... }
    -- selected は parts の並び順に対応（A問題は1要素、B問題は(a)(b)の2要素）
    -- seconds はその問題を表示していた累積秒数（§7.6）
  score             INTEGER,                             -- 採点確定時に格納（100点換算）
  section_scores    JSONB,                               -- {"A": 55, "B": 20}
  memo              TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS denken_mock_sessions_lookup
  ON denken_mock_sessions (user_id, exam_id, subject_id, started_at);

-- RLS（denken_reviews / denken_exam_plans と同形：本人のみ操作可）
ALTER TABLE denken_mock_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_mock_sessions"
  ON denken_mock_sessions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新（001 で定義した関数を再利用）
CREATE TRIGGER denken_mock_sessions_updated_at
  BEFORE UPDATE ON denken_mock_sessions
  FOR EACH ROW EXECUTE FUNCTION update_denken_updated_at();
