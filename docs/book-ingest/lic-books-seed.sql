-- lic_books の初期データ（出る順社労士 一問一答過去10年問題集 ①〜④）。034_lic_books.sql の適用後に流す。
-- 発売日は利用者の申告（2026-10-26）。②〜④の対象科目は licensehub-expansion.md §2 の表記に基づく暫定値で、
-- 現物の目次を確認したら UPDATE で直す（徴収法の収録巻は未確認）。冪等（ON CONFLICT で上書き）。
-- user_id は既存の lic_items 行の持ち主（個人利用で 1 ユーザーのみ）。
WITH me AS (SELECT DISTINCT user_id FROM denken3.lic_items LIMIT 1)
INSERT INTO denken3.lic_books (user_id, id, series, title, volume, edition, publisher, study_subjects, release_date, ingest_status, memo)
SELECT me.user_id, v.id, v.series, v.title, v.volume, v.edition, 'LEC', v.subjects, v.release_date::date, v.ingest_status, v.memo
FROM me, (VALUES
  ('ippon-1', '出る順社労士 一問一答過去10年問題集', '2027年版 出る順社労士 一問一答過去10年問題集 ① 労働基準法 労働安全衛生法 労働者災害補償保険法', 1, '2027年版 第11版 第1刷', ARRAY['rouki','anei','rousai'], '2026-10-23', 'ingested', '取り込み仕様: docs/book-ingest-lec-ippon-1.md'),
  ('ippon-2', '出る順社労士 一問一答過去10年問題集', '2027年版 出る順社労士 一問一答過去10年問題集 ②（雇用・労一等）', 2, '2027年版', ARRAY['koyou','rouippan'], '2026-11-16', 'planned', '対象科目は暫定'),
  ('ippon-3', '出る順社労士 一問一答過去10年問題集', '2027年版 出る順社労士 一問一答過去10年問題集 ③（健保・国年）', 3, '2027年版', ARRAY['kenpo','kokunen'], '2026-12-14', 'planned', '対象科目は暫定'),
  ('ippon-4', '出る順社労士 一問一答過去10年問題集', '2027年版 出る順社労士 一問一答過去10年問題集 ④（厚年・社一）', 4, '2027年版', ARRAY['kounen','shaippan'], '2026-12-18', 'planned', '対象科目は暫定')
) AS v(id, series, title, volume, edition, subjects, release_date, ingest_status, memo)
ON CONFLICT (user_id, id) DO UPDATE SET
  series = EXCLUDED.series, title = EXCLUDED.title, volume = EXCLUDED.volume, edition = EXCLUDED.edition,
  study_subjects = EXCLUDED.study_subjects, release_date = EXCLUDED.release_date,
  ingest_status = EXCLUDED.ingest_status, memo = EXCLUDED.memo;
