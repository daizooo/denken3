-- 使用書籍の台帳（lic_books）と、問から書籍への参照（lic_questions.book_id）。
--
-- ■ 方針
-- 書籍の書名・巻・発売日・対象科目・取り込み状況を DB に持つ。書籍の本文は入れない
-- （問題本文は lic_questions / lic_items 側。licensehub-expansion.md §4.1・§14）。
-- id は利用者が決める短い識別子（例 'ippon-1'）。(user_id, id) で一意。
-- lic_questions.source の CHECK（honshiken | ippon）は変えない。book_id は NULL 可の追加列で、
-- 公式の本試験（source='honshiken'）は NULL のまま。外部キーは張らない
-- （書籍の肢を台帳より先に取り込む経路があるため。lic_items.question_id と同じ理由）。
--
-- ■ 安全性
-- 追加のみ（新規テーブル1つ＋NULL可の列1つ）。既存の制約・データは変更しない。再実行しても結果は同じ。
--
-- ■ ロールバック（lic_books のデータは消える）
--   ALTER TABLE denken3.lic_questions DROP COLUMN IF EXISTS book_id;
--   DROP TABLE IF EXISTS denken3.lic_books;

CREATE TABLE IF NOT EXISTS denken3.lic_books (
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  id              TEXT NOT NULL,                       -- 'ippon-1'
  series          TEXT NOT NULL,                       -- 'LEC 出る順社労士 一問一答過去10年問題集'
  title           TEXT NOT NULL,                       -- 書名（巻・科目名を含む）
  volume          INTEGER CHECK (volume >= 1),         -- 巻（①→1）。巻の無い書籍は NULL
  edition         TEXT,                                -- '2027年版 第11版 第1刷' など
  publisher       TEXT,
  isbn            TEXT,
  study_subjects  TEXT[] NOT NULL DEFAULT '{}',        -- 学習科目コード（rouki / anei / rousai …）
  release_date    DATE,                                -- 発売日
  ingest_status   TEXT NOT NULL DEFAULT 'planned'
                  CHECK (ingest_status IN ('planned', 'ingested')),
  memo            TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

ALTER TABLE denken3.lic_questions ADD COLUMN IF NOT EXISTS book_id TEXT;   -- 書籍由来の問のみ。本試験は NULL

CREATE INDEX IF NOT EXISTS lic_questions_book
  ON denken3.lic_questions (user_id, book_id);

-- RLS（lic_questions と同形：本人のみ操作可）
ALTER TABLE denken3.lic_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_lic_books" ON denken3.lic_books;
CREATE POLICY "users_manage_own_lic_books"
  ON denken3.lic_books
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 自動更新（001 で定義し 033 で denken3 へ移した関数を再利用）
DROP TRIGGER IF EXISTS lic_books_updated_at ON denken3.lic_books;
CREATE TRIGGER lic_books_updated_at
  BEFORE UPDATE ON denken3.lic_books
  FOR EACH ROW EXECUTE FUNCTION denken3.update_denken_updated_at();

-- Data API 権限（CLAUDE.md §4・028 参照）。anon は付与しない。
GRANT SELECT, INSERT, UPDATE, DELETE ON denken3.lic_books TO authenticated, service_role;
-- denken3 の既定権限は authenticated に truncate/references/trigger も付けるため、030 と同じく外す。
REVOKE TRUNCATE, REFERENCES, TRIGGER ON denken3.lic_books FROM authenticated;
