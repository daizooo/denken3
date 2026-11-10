-- 1級土木 第一次検定の「問題の図」（dbk_figures）。docs/design/doboku1-ichiji.md §6.5。
--
-- ■ 方針
-- 問題文中の図（R08 なら A1・A3〜A5・A39・B3・B6・B7・B32）は試験問題の一部。リポジトリや公開の場所には置かない。
-- 利用者が演習画面から画像（公式PDFのスクリーンショット）を登録し、本人だけが読めるこの表に持つ。
-- Storage は使わない: このプロジェクトにはバケットが無く（031 で denken-problems を削除済み）、新設すると
-- 他アプリと共用の storage.objects にポリシーを足すことになる（CLAUDE.md: denken3 専任）。
-- 画像はブラウザで縮小（長辺 1280px・JPEG）してから base64 で保存する。1枚 1.5MB（base64 長）を上限にする。
-- question_id は dbk_questions.id（'D1_R08_A_01'）。
--
-- ■ 安全性
-- 追加のみ（新規テーブル1つ）。既存テーブル・制約は変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（データごと消える。利用者が実行する）
--   DROP TABLE IF EXISTS denken3.dbk_figures;

CREATE TABLE IF NOT EXISTS denken3.dbk_figures (
  user_id      UUID NOT NULL DEFAULT auth.uid(),
  question_id  TEXT NOT NULL,                                   -- 'D1_R08_A_01'
  mime         TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  data         TEXT NOT NULL CHECK (length(data) BETWEEN 1 AND 1500000),   -- base64（data: の接頭辞なし）
  width        INTEGER CHECK (width > 0),
  height       INTEGER CHECK (height > 0),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- RLS（既存と同形：本人のみ操作可）
ALTER TABLE denken3.dbk_figures ENABLE ROW LEVEL SECURITY;

-- DROP を含めない（CLAUDE.md）。存在しないときだけ作って冪等にする。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'denken3' AND tablename = 'dbk_figures'
                   AND policyname = 'users_manage_own_dbk_figures') THEN
    CREATE POLICY "users_manage_own_dbk_figures"
      ON denken3.dbk_figures
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER dbk_figures_updated_at
  BEFORE UPDATE ON denken3.dbk_figures
  FOR EACH ROW EXECUTE FUNCTION denken3.update_denken_updated_at();

-- Data API 権限（CLAUDE.md §4・028 参照）。anon は付与しない。
GRANT SELECT, INSERT, UPDATE, DELETE ON denken3.dbk_figures TO authenticated, service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON denken3.dbk_figures FROM authenticated;
