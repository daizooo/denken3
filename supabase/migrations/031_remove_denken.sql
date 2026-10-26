-- 電験（exam_id='denken3'）のデータと、電験専用の問題画像テーブルを撤去する。
--
-- DELETE / DROP を含むため、Claude は実行せず、利用者が SQL Editor で実行する（CLAUDE.md）。
-- 社労士（exam_id='sharoushi'）の行・denken_* テーブルそのものには触れない
-- （テーブル名は互換のため旧名のまま据え置く。README 参照）。
--
-- 前提: Storage のバケット denken-problems は Dashboard の Delete bucket で削除済み
-- （storage.objects は SQL では消せない。protect_objects_delete トリガーが拒否する）。
-- 戻し方: 画像と学習履歴は復元できない（Free プランに PITR は無い）。

-- 学習記録・日程・模試・FSRS パラメータの電験分（社労士の行は exam_id が異なるので残る）。
DELETE FROM denken_reviews       WHERE exam_id = 'denken3';
DELETE FROM denken_exam_plans    WHERE exam_id = 'denken3';
DELETE FROM denken_mock_sessions WHERE exam_id = 'denken3';
DELETE FROM denken_fsrs_params   WHERE exam_id = 'denken3';

-- exam_id を省略した書き込みが電験の行を作らないよう、既定値を社労士にする（アプリは常に明示する）。
ALTER TABLE denken_reviews ALTER COLUMN exam_id SET DEFAULT 'sharoushi';

-- 問題画像の座標表。画像バケットの削除済みで行は 0 件、コードからの参照も無くなった。
DROP TABLE IF EXISTS denken_question_assets;
