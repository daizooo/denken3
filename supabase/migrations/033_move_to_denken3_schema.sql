-- このアプリの表を public から denken3 スキーマへ移す（同一プロジェクト内のスキーマ分離）。
--
-- ■ 対象（2026-10-30 時点の本番 public を pg_class / pg_proc で全件確認。public にはこのアプリの物しか無い）
--   表 8: denken_exam_plans / denken_fsrs_params / denken_mock_sessions / denken_reviews /
--         denken_settings / lic_external_scores / lic_items / lic_questions
--   関数 1: update_denken_updated_at（上記の updated_at トリガが呼ぶ）
--   ビュー・シーケンス・外部キー・Realtime publication の対象表は無い。
--
-- ■ SET SCHEMA で一緒に移る物
--   列・データ・インデックス・制約・RLS（有効化の状態とポリシー）・トリガ・表の権限（ACL）。
--   トリガは関数を OID で参照するため、関数を先に/後に移しても切れない。
--
-- ■ 権限
--   表の ACL は移動で引き継がれる（authenticated = select/insert/update/delete、service_role = 全権、anon = 無し。029/030 の状態）。
--   下の GRANT は「引き継ぎ漏れがあっても動く」ための再宣言で、再実行しても結果は同じ。
--   anon には USAGE だけを与え、表の権限は与えない（未ログインの DB 経路が無い。029 の方針）。
--
-- ■ 事前・事後の作業（SQL では出来ない）
--   Dashboard → Project Settings → Data API → Exposed schemas に denken3 を追加する。
--   追加しないと PostgREST が PGRST106（schema must be one of ...）を返し、アプリが一切読めない。
--
-- ■ ロールバック
--   ALTER TABLE denken3.<表名> SET SCHEMA public;（8表とも）
--   ALTER FUNCTION denken3.update_denken_updated_at() SET SCHEMA public;
--   とクライアントの db.schema 指定を戻す。データは移動で失われない。

BEGIN;

CREATE SCHEMA IF NOT EXISTS denken3;

ALTER TABLE public.denken_exam_plans    SET SCHEMA denken3;
ALTER TABLE public.denken_fsrs_params   SET SCHEMA denken3;
ALTER TABLE public.denken_mock_sessions SET SCHEMA denken3;
ALTER TABLE public.denken_reviews       SET SCHEMA denken3;
ALTER TABLE public.denken_settings      SET SCHEMA denken3;
ALTER TABLE public.lic_external_scores  SET SCHEMA denken3;
ALTER TABLE public.lic_items            SET SCHEMA denken3;
ALTER TABLE public.lic_questions        SET SCHEMA denken3;

ALTER FUNCTION public.update_denken_updated_at() SET SCHEMA denken3;
-- 移動ついでに search_path を固定（advisor の function_search_path_mutable 対策。本体は NOW() のみ）
ALTER FUNCTION denken3.update_denken_updated_at() SET search_path = '';

GRANT USAGE ON SCHEMA denken3 TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA denken3 TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA denken3 TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA denken3 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION denken3.update_denken_updated_at() TO authenticated, service_role;

COMMIT;

-- PostgREST のスキーマキャッシュを即時更新
NOTIFY pgrst, 'reload schema';
