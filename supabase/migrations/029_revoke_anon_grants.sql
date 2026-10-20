-- anon ロールから public の全テーブル権限を外す。
--
-- 本番の既存9テーブルには、Supabase の旧自動付与で anon に全権限（select / insert / update / delete に加え
-- truncate / references / trigger）が残っている。028 は anon に付与しないため、このままだと
-- 「マイグレーションから再現した環境」と本番で権限がずれる。
--
-- ■ 外してよい根拠
--   全表が本人行限定の RLS（auth.uid() = user_id）で、未ログインから読み書きする経路が無い。
--   アプリの DB 呼び出しはすべて `if (!user) return` の内側にあり、ログイン画面は auth のみを使う。
--   ブラウザ・api/optimize.ts は ログイン JWT を載せる＝ロールは authenticated。保守スクリプトは service_role。
--
-- ■ 副作用
--   anon から表が API（PostgREST / GraphQL）に見えなくなる。ログインが切れた状態で呼ぶと、
--   空配列ではなく permission denied（401/403）が返る。
--
-- ■ 安全性
-- 権限の削除のみ。表・列・制約・データ・RLS ポリシーは変更しない。REVOKE は再実行しても結果は同じ。
--
-- ■ ロールバック
--   GRANT select, insert, update, delete ON <表名> TO anon;
--   （RLS が本人行に絞るため、戻しても他人の行は見えない）

REVOKE ALL ON public.denken_reviews         FROM anon;
REVOKE ALL ON public.denken_settings        FROM anon;
REVOKE ALL ON public.denken_question_assets FROM anon;
REVOKE ALL ON public.denken_exam_plans      FROM anon;
REVOKE ALL ON public.denken_mock_sessions   FROM anon;
REVOKE ALL ON public.denken_fsrs_params     FROM anon;
REVOKE ALL ON public.lic_questions          FROM anon;
REVOKE ALL ON public.lic_items              FROM anon;
REVOKE ALL ON public.lic_external_scores    FROM anon;
