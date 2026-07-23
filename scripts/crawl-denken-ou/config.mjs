// 電験王クローラー：動作設定と「サイト依存セレクタ」（校正ポイント）。
//
// ▼ 校正について
// 電験王は WordPress ベースのサイトで、HTML構造（CSSクラス名）は将来変わり得る。
// 本ファイルの SELECTORS / ANSWER_PATTERNS はサイト依存の唯一の箇所であり、
// 初回実行前に `node crawl.mjs --calibrate <paperId>` で1ページだけ取得して
// 実DOMと突き合わせて確定する（README「校正」節を参照）。
// URL構造・レート制御・出力規約（校正不要な確定部分）と分離してある。

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CONFIG = {
  // ---- 低速・低負荷クロール（電験王に負荷をかけない）----
  // 同時接続は必ず1。リクエスト間隔はデフォルト6秒（--delay で変更可）。
  concurrency: 1,
  minDelayMs: 6000, // 連続リクエストの最小間隔
  jitterMs: 2000, // 間隔に足す 0〜jitter のランダム揺らぎ（アクセスパターンの均し）
  maxRetries: 4, // ネットワーク/5xx 時のリトライ回数
  backoffBaseMs: 2000, // 指数バックオフ基準（2s,4s,8s,16s）
  navTimeoutMs: 45000,

  // ---- 礼儀 ----
  // 素性を明かし私的学習利用であることを示す UA。robots.txt は必ず確認・順守する。
  userAgent:
    'denken3-study-crawler/1.0 (private study use; contact: info@s-kumaken.com)',
  respectRobots: true,

  // ---- 画像出力 ----
  imageWidthPx: 1200, // 設計 §7.4(4)「幅1200px程度」
  deviceScaleFactor: 2, // 回路図の細部が潰れないよう2倍でレンダリング
  imageFormat: 'png', // 'png' | 'webp'（軽量化は任意）

  // ---- 入出力パス（すべて git 追跡外＝.gitignore 済み）----
  cacheDir: path.join(__dirname, '.cache'), // 取得HTMLのディスクキャッシュ（再実行で再取得しない）
  outDir: path.join(__dirname, 'out'), // 画像 + PaperDefinition の出力先
}

// ============================================================
// ▼ サイト依存セレクタ（校正ポイント）
// 初回 --calibrate で実DOMを確認し、必要なら書き換える。既定値は
// 電験王の一般的な構造からの推定であり、実行前検証が必須。
// ============================================================
export const SELECTORS = {
  // 年度別インデックス（/r5-1/ 等）で、科目セクション内の各問リンクを拾うための起点。
  // 科目見出し（例「理論」）の近傍にある記事リンク群を対象にする。
  //   - calibrate 時は「全リンク + 見出し構造」をダンプするので、そこから確定する。
  indexContentRoot: 'main, .entry-content, article',
  indexProblemLink: 'a[href*="denken-ou.com"]', // さらに記事URLらしさでフィルタ（crawl.mjs 側）

  // 各問の解説記事ページ内の領域。
  //   problemRegion  : 問題文＋図＋選択肢（＝解答画面に出す画像 a01.png）
  //   explanationRegion: 解説（＝結果画面でのみ出す画像 a01_exp.png）
  // 電験王は1記事内に「問題 → 解説」の順で並ぶことが多い。境界の見出し
  // （「解説」「解答と解説」等）で前後に切る戦略を crawl.mjs で用いる。
  articleContentRoot: '.entry-content, article .post_content, main',
  explanationHeadingText: ['解説', '解答と解説', 'ポイント'], // この見出し以降を解説領域とみなす
}

// 解説テキストから公式正答（1〜5）を読む正規表現。複数候補を上から試す。
// B問題は (a)(b) の2答があるため、ラベル付き抽出も用意する。
export const ANSWER_PATTERNS = {
  // 単答（A問題）例:「答え：(3)」「【答】(3)」「解答 (3)」「正解は(3)」
  single: [
    // マーカー直後に数字（括弧任意）
    /【?\s*(?:答え?|解答|正解)\s*】?\s*[：:]?\s*[（(]?\s*([1-5１-５])\s*[)）]?/,
    // マーカーと括弧数字の間に少数の文字がある表記（例「正解は(2)である」）。
    // 誤検出を避けるため、この寛容版は数字が括弧で囲まれていることを必須にする。
    /(?:答え?|解答|正解)[^\d０-９]{0,8}?[（(]\s*([1-5１-５])\s*[)）]/,
  ],
  // 小問付き（B問題）例:「(a) (3)」「(b) 答え (5)」
  labeled: [
    /[（(]\s*([ab])\s*[)）][^\d１-５]{0,20}?([1-5１-５])/g,
  ],
}

/** 全角数字→半角、'1'..'5' → 1..5 */
export function toDigit(ch) {
  const map = { '１': 1, '２': 2, '３': 3, '４': 4, '５': 5 }
  return map[ch] ?? Number(ch)
}
