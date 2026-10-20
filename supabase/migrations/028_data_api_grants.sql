-- Data API（supabase-js / PostgREST / GraphQL）用の明示 GRANT。
--
-- Supabase は 2026-10-30 以降、既存プロジェクトでも「public スキーマの新規テーブルに Data API 権限を
-- 自動付与」しなくなる。既存テーブルは現行の権限を保つが、新規プロジェクト・プレビューブランチ・
-- ローカルの `supabase db reset` のようにマイグレーションからスキーマを作り直す場合は、
-- GRANT が無いと API が "permission denied" を返す。001〜027 は GRANT を持たないため、ここでまとめて付与する。
--
-- ■ 付与するロール（最小権限）
--   authenticated: select / insert / update / delete
--     ブラウザと api/optimize.ts は anon キー + ログイン JWT で呼ぶ＝ロールは authenticated。
--     行の絞り込みは各表の RLS（auth.uid() = user_id）が担う。
--   service_role: select / insert / update / delete
--     保守スクリプト（scripts/ 配下）が SUPABASE_SERVICE_ROLE_KEY で使う。
--   anon: 付与しない。全表が本人行限定の RLS で、未ログインから読み書きする経路が無い。
--
-- ■ 今後の新規テーブル
--   テーブルを作る同じマイグレーションに GRANT を書くこと（CLAUDE.md §4）。
--
-- ■ 安全性
-- 権限の追加のみ。表・列・制約・データ・RLS ポリシーは変更しない。GRANT は再実行しても結果は同じ。
-- 既存の本番テーブルには既に同等の権限があるため、本番への適用で挙動は変わらない。
--
-- ■ ロールバック
--   REVOKE select, insert, update, delete ON <表名> FROM authenticated, service_role;
--   （既存テーブルでは元々の権限も消えるため、通常は戻さない）

GRANT SELECT, INSERT, UPDATE, DELETE ON public.denken_reviews        TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denken_settings       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denken_question_assets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denken_exam_plans     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denken_mock_sessions  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denken_fsrs_params    TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lic_questions         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lic_items             TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lic_external_scores   TO authenticated, service_role;
