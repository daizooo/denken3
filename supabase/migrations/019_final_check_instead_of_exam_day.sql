-- 試験当日に張り付いた復習予定を、試験前の最終確認へ移すデータ是正。
-- 015 と同じ「S を最終確認へ戻す」バックフィルの延長線上にある。
--
-- ■ 何が起きていたか（2026-09-04 の実測）
-- 学習済み FSRS パラメータ（版4）の採用で復習間隔が伸びた結果、232カード中
-- **58件（25%）の due_date がちょうど試験日 2027-02-06 に張り付いた。**
--
-- 原因は `clipDueToExam` が `maxInterval = daysToExam` としていたことで、間隔が残日数
-- 以上のカードは全て試験日ちょうどへ丸められていた。これは2つの意味で成立していない。
--
--   ① 試験当日は受験する日であって、復習日にならない。消化できない予定である。
--   ② 試験日は 分野別 の地平ではない。この枠組みは 分野別 の主軸期間を
--      bunya_target_date（実データ 2026-11-29）までとし、その後は nendo_start_date
--      （同 2026-11-30）から **年度別演習が主軸**になると定めている。
--      試験日に置かれた予定は、年度別が主軸の時期に 分野別 の山を作るだけになる。
--
-- ■ 是正の考え方
-- FSRS の間隔が試験日まで届いた、というのはモデルが「試験まで持つ」と言っていること
-- であり、S（復習不要）とまったく同じ状態である。ならば扱いも S と同じにする ――
-- 通常の復習キューからは外し、試験前の最終確認（試験日の21日前・fsrs.ts の
-- FINAL_CHECK_DAYS_BEFORE_EXAM）だけを残す。新しい概念は増やさない。
--
-- ■ コード側との一致
-- 同じ是正は `fsrs.ts` の `applyExamHorizon` で恒久的に行われる。このマイグレーションは
-- **既に書き込まれてしまった行**を追いつかせるためのもの。試験日に張り付いたカードは
-- その日まで復習されないので、放置すると次回レビューでの自然な再計算が永久に起きない。
--
-- 適用後、履歴を再生した結果と DB の値は一致する（コードが同じ日付を返すため）。
--
-- ■ 影響範囲（適用前に全232カードを新ロジックで再生して確認済み）
--   変化するのは 58件のみ。遷移は 2027-02-06 → 2027-01-16 の1種類だけ。
--   他の174件は不変。試験当日に残るカードは 0件。
--   最終確認日のカードは 17件（S のみ）→ 75件になる。

-- 最終確認日が最終学習日より後にあるカード → 最終確認へ移す。
UPDATE denken_reviews r
SET due_date = r.due_date - 21
WHERE EXISTS (
  SELECT 1 FROM denken_exam_plans p
  WHERE p.user_id = r.user_id
    AND p.exam_id = r.exam_id
    AND p.exam_date = r.due_date
)
AND (r.last_reviewed IS NULL OR (r.due_date - 21) > r.last_reviewed::date);

-- 最終確認日を既に過ぎているカード → 次の復習は無い（S と同じ扱い・fsrs.ts の
-- finalCheckDue が null を返す条件と一致させる）。
UPDATE denken_reviews r
SET due_date = NULL
WHERE EXISTS (
  SELECT 1 FROM denken_exam_plans p
  WHERE p.user_id = r.user_id
    AND p.exam_id = r.exam_id
    AND p.exam_date = r.due_date
)
AND r.last_reviewed IS NOT NULL
AND (r.due_date - 21) <= r.last_reviewed::date;
