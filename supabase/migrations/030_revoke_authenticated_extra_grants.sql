-- authenticated ロールから、アプリが使わない権限（truncate / references / trigger）を外す。
--
-- 本番の既存9テーブルには、Supabase の旧自動付与で authenticated にも全権限が残っている。
-- 028 は select / insert / update / delete だけを付与するため、このままだと
-- 「マイグレーションから再現した環境」と本番で権限がずれる。
-- 029 で anon を外した続き。
--
-- ■ 外してよい根拠
--   アプリ（ブラウザ・api/optimize.ts）が authenticated で行うのは select / insert / update / delete / upsert のみ。
--   truncate を使うコードは無い。truncate は RLS の対象外なので、持たせない方が安全（PostgREST は公開しないが、最小権限にそろえる）。
--
-- ■ service_role は変更しない
--   RLS を迂回する管理用ロールで、Supabase の標準権限をそのまま残す。
--
-- ■ 安全性
-- 権限の削除のみ。表・列・制約・データ・RLS ポリシーは変更しない。REVOKE は再実行しても結果は同じ。
-- authenticated の select / insert / update / delete は残る。
--
-- ■ ロールバック
--   GRANT truncate, references, trigger ON <表名> TO authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.denken_reviews         FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.denken_settings        FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.denken_question_assets FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.denken_exam_plans      FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.denken_mock_sessions   FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.denken_fsrs_params     FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.lic_questions          FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.lic_items              FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.lic_external_scores    FROM authenticated;
