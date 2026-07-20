-- 端末間で同期するユーザー設定（1日の復習上限など）
-- Android / iPad / Windows など複数端末で同じ設定を共有するためDBに保持する

CREATE TABLE IF NOT EXISTS denken_settings (
  user_id    UUID        NOT NULL,
  daily_cap  INTEGER,               -- NULL = 無制限 / 行なし = 未設定（デフォルト20）
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- RLS
ALTER TABLE denken_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_settings"
  ON denken_settings
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新（001で定義した関数を再利用）
CREATE TRIGGER denken_settings_updated_at
  BEFORE UPDATE ON denken_settings
  FOR EACH ROW EXECUTE FUNCTION update_denken_updated_at();
