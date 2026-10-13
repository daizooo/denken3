// アプリの表示名（資格に依存しない名前）。TS からは必ずこの定数を参照する。
// 静的ファイル（index.html・manifest.webmanifest）は定数を読めないため、
// 一致は src/config/app.test.ts で検証する。
// 内部識別子（exam_id='denken3'、denken_* テーブル、IndexedDB 名 electricpro-offline、
// Cache 名 electricpro-* など）は旧名のまま据え置く。改名すると既存の進捗・送信待ち・
// キャッシュが失われるため（docs: LicenseHub 改修設計書 §11.1）。表示名とは独立。
export const APP_NAME = 'LicenseHub'
