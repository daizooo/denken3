// ==============================
// ステルス（擬装）モードの設定値
// 会社PCで学習内容を同僚に見られないための「業務ソフト擬装」の各種定数。
// アプリの学習ロジックからは完全に独立している（src/features/stealth 配下で自己完結）。
// ==============================

// localStorage のキー。'on' で擬装モードを記憶する（次回以降も擬装で起動）。
export const STEALTH_STORAGE_KEY = 'denken.stealth'

// URL に ?work=1 が付いていれば擬装モードで起動する。
// 会社PCではこのURLをブックマークしておけば、開いた瞬間から擬装＋パニックカバー状態になる。
export const STEALTH_URL_PARAM = 'work'

// パニックカバーを発動する画面隅。マウスカーソルがこの隅に触れた瞬間に内容を隠す。
// 左上はブラウザのタブ/戻る付近で、閉じるボタン（右上）と違い誤操作しても無害。
export const PANIC_CORNER = { x: 'left', y: 'top' } as const
// 隅と判定する許容ピクセル。小さいほど誤発動しにくい。
export const CORNER_THRESHOLD_PX = 6

// 擬装時にブラウザのタブに表示するタイトル（＝履歴・タブ一覧でも無害に見せる）。
export const DISGUISE_TITLE = '無題 - ドキュメント'

// 擬装時のファビコン（地味な文書アイコン）。lucide の FileText 相当の SVG を data URI 化。
export const DISGUISE_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpath d='M14 2v6h6'/%3E%3C/svg%3E"

// 擬装時にアプリのヘッダーに出す無害な名称（記者の業務らしく「取材メモ」）。
export const DISGUISE_APP_TITLE = '取材メモ'
