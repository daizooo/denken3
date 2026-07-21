-- 問題画像アセット(denken_question_assets)の行を削除したとき、
-- 参照されなくなった Storage オブジェクト(バケット denken-problems)を自動削除する。
--
-- 背景:
--   Supabase では DB 行を消しても Storage 実体は残るため、
--   denken_question_assets を削除しても画像ファイルが孤児として残り続ける。
--   これを DELETE トリガーで自動的に片付ける。
--
-- 注意（storage_path の共有）:
--   「2問同居」(1画像↔複数問) では同一 storage_path を region=top/bottom の複数行が参照する。
--   よって、同じ (user_id, storage_path) を参照する行が他に残っている間は実体を消してはいけない。
--   最後の1件が消えたときだけ Storage オブジェクトを削除する。

CREATE OR REPLACE FUNCTION delete_orphan_problem_object()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- 同じ画像を参照する他の行が残っていれば実体は消さない
  IF NOT EXISTS (
    SELECT 1
    FROM public.denken_question_assets
    WHERE user_id = OLD.user_id
      AND storage_path = OLD.storage_path
  ) THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'denken-problems'
      AND name = OLD.storage_path;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS denken_question_assets_storage_cleanup ON denken_question_assets;

CREATE TRIGGER denken_question_assets_storage_cleanup
  AFTER DELETE ON denken_question_assets
  FOR EACH ROW EXECUTE FUNCTION delete_orphan_problem_object();
