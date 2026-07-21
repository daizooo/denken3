-- 過去問画像の非公開ストレージ（バケット denken-problems）と Storage RLS。
-- 著作物のため public=false。閲覧はアプリからの署名付きURLのみ。
-- オブジェクトのパス先頭フォルダ = user_id のときだけ本人が操作可能。
-- パス規約: {user_id}/theory/{chapter}/{sourceImageName}

INSERT INTO storage.buckets (id, name, public)
VALUES ('denken-problems', 'denken-problems', false)
ON CONFLICT (id) DO NOTHING;

-- 本人のオブジェクトのみ 読み取り/追加/更新/削除 を許可
CREATE POLICY "own_problem_objects_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'denken-problems'
         AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own_problem_objects_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'denken-problems'
         AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own_problem_objects_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'denken-problems'
         AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'denken-problems'
         AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own_problem_objects_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'denken-problems'
         AND (storage.foldername(name))[1] = auth.uid()::text);
