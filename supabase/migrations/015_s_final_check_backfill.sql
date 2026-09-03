-- S（復習不要）の試験前最終確認からの取りこぼしを是正する（adaptive-fsrs-policy.md §2.4）。
--
-- 背景:
--   fsrs.ts の finalCheckDue（§6-4・課題4）は、S にした問題を試験21日前に一度だけ
--   復習キューへ戻す。しかしこの実装より前に S を付けた問題は due_date=null のまま残る。
--   deriveFromHistory は次にその問題を記録したときに再導出して直すが、
--   **S は due_date=null のため復習キューに出てこない → 記録される機会が来ない**
--   というデッドロックになり、自己修復が永久に起きない。
--   結果、最も確実な得点源である S の問題が、試験直前に一度も確認されない。
--
-- 是正:
--   試験日を持つ資格について、S かつ due_date が空の行を「試験日 - 21日」へ戻す。
--   その日が既に過去なら対象外（過去日を due にすると毎日 due に居座るため・fsrs.ts と同方針）。
--
-- 注意（科目の解決）:
--   denken_reviews は subject_id を持たず、question_id から科目を引くにはアプリ側の
--   章マスタが要る。そこで同一資格に複数科目の試験日がある場合は最も早い試験日を採り、
--   最終確認が「遅すぎる」側へ倒れないようにする（早い側へ寄せるのは安全側）。
--
-- 冪等（対象は due_date IS NULL の行のみ）なので複数回実行しても安全。

UPDATE denken_reviews r
SET due_date = sub.final_check
FROM (
  SELECT user_id, exam_id, MIN(exam_date) - 21 AS final_check
  FROM denken_exam_plans
  WHERE exam_date IS NOT NULL
  GROUP BY user_id, exam_id
) sub
WHERE r.user_id = sub.user_id
  AND r.exam_id = sub.exam_id
  AND r.status = 'S'
  AND r.due_date IS NULL
  AND sub.final_check > CURRENT_DATE;
