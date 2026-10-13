-- 社労士（exam_id='sharoushi'）の試験日程の初期行（licensehub-expansion.md §10.1・PR-B）。
-- 学習10科目それぞれに denken_exam_plans の行を作る（タブが科目別のため）。
-- subject_id は src/data/sharoushi/index.ts の SHAROUSHI_SUBJECTS と一致させる。
--
-- ■ 値
--   exam_date        2027-08-22（推定。例年8月第4日曜付近。公式発表後に設定画面で更新する）
--   申込期間          未発表のため NULL
--   bunya_target_date NULL（目標日は本試験からの逆算で別PRが書き込む。固定値で持たない）
--
-- ■ 安全性
-- 追加のみ。既存行（電験・利用者が設定画面で作った社労士の行）は ON CONFLICT DO NOTHING で変えない。
-- 個人利用（RLSで本人のみ）のため、既存の全ユーザーに初期行を作る。再実行しても結果は同じ。
-- ロールバック: DELETE FROM denken_exam_plans WHERE exam_id = 'sharoushi';

INSERT INTO denken_exam_plans (user_id, exam_id, subject_id, label, exam_date)
SELECT u.id, 'sharoushi', s.subject_id, '2027年 第59回 本試験（推定）', DATE '2027-08-22'
FROM auth.users u
CROSS JOIN (VALUES
  ('rouki'),
  ('anei'),
  ('rousai'),
  ('koyou'),
  ('choushu'),
  ('kenpo'),
  ('kokunen'),
  ('kounen'),
  ('rouippan'),
  ('shaippan')
) AS s(subject_id)
ON CONFLICT (user_id, exam_id, subject_id) DO NOTHING;
