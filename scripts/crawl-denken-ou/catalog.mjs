// 電験王クローラー：収録対象カタログ（確定情報）。
//
// アプリの paperId（例 'r8-1'）と電験王の年度別インデックスURLの slug は一致する:
//   r8-1  → https://denken-ou.com/r8-1/   （令和8年度 上期）
//   r7-2  → https://denken-ou.com/r7-2/   （令和7年度 下期）
//   r3    → https://denken-ou.com/r3/     （令和3年度：年1回制）
//   h22   → https://denken-ou.com/h22/    （平成22年度：年1回制）
//
// 収録範囲は設計 §4「2010年度（H22）〜令和8年度上期（R8上）の全約21回分」。
// R4 以降は上期/下期の2回制（-1=上期 / -2=下期）、H22〜R3 は年1回制。
//
// ※ URL slug は 2026-07 時点の検索結果で確認済み（/h22/ … /r5-2/ など）。
//   まだ掲載されていない直近回（例 r8-1）は、実行時にインデックスが 404 なら
//   スキップして後日再取得する（クローラーが自動判定する）。

/** @typedef {{ id: string, name: string, era: 'H'|'R', year: number, session?: 1|2 }} PaperCatalogEntry */

/** @type {PaperCatalogEntry[]} */
export const PAPER_CATALOG = [
  // ---- 令和：上期/下期の2回制（R4〜）----
  { id: 'r8-1', name: '令和8年度 上期', era: 'R', year: 8, session: 1 },
  { id: 'r7-2', name: '令和7年度 下期', era: 'R', year: 7, session: 2 },
  { id: 'r7-1', name: '令和7年度 上期', era: 'R', year: 7, session: 1 },
  { id: 'r6-2', name: '令和6年度 下期', era: 'R', year: 6, session: 2 },
  { id: 'r6-1', name: '令和6年度 上期', era: 'R', year: 6, session: 1 },
  { id: 'r5-2', name: '令和5年度 下期', era: 'R', year: 5, session: 2 },
  { id: 'r5-1', name: '令和5年度 上期', era: 'R', year: 5, session: 1 },
  { id: 'r4-2', name: '令和4年度 下期', era: 'R', year: 4, session: 2 },
  { id: 'r4-1', name: '令和4年度 上期', era: 'R', year: 4, session: 1 },
  // ---- 令和：年1回制（R1〜R3）----
  { id: 'r3', name: '令和3年度', era: 'R', year: 3 },
  { id: 'r2', name: '令和2年度', era: 'R', year: 2 },
  { id: 'r1', name: '令和元年度', era: 'R', year: 1 },
  // ---- 平成：年1回制（H22〜H30）----
  { id: 'h30', name: '平成30年度', era: 'H', year: 30 },
  { id: 'h29', name: '平成29年度', era: 'H', year: 29 },
  { id: 'h28', name: '平成28年度', era: 'H', year: 28 },
  { id: 'h27', name: '平成27年度', era: 'H', year: 27 },
  { id: 'h26', name: '平成26年度', era: 'H', year: 26 },
  { id: 'h25', name: '平成25年度', era: 'H', year: 25 },
  { id: 'h24', name: '平成24年度', era: 'H', year: 24 },
  { id: 'h23', name: '平成23年度', era: 'H', year: 23 },
  { id: 'h22', name: '平成22年度', era: 'H', year: 22 },
]

/** 電験王・年度別インデックスページのURL（この配下に各問の解説記事へのリンクがある）。 */
export function indexUrl(paperId) {
  return `https://denken-ou.com/${paperId}/`
}

// ---- 理論の問題構成（アプリの _skeleton.ts と一致させる）----
// A問題 問1〜14（各5点=70点）
// B問題 問15〜18（各(a)(b) 5点×2）。問17・18 は選択（どちらか1問）＝満点100点。
//
// クローラーは「問N」→ アプリの imageFile 名へ以下で対応付ける:
//   問1〜14  → a01.png … a14.png（A問題）
//   問15〜18 → b15.png … b18.png（B問題）
// 解説画像は同名に _exp を付ける（a01_exp.png / b15_exp.png）。
export const RIRON_STRUCTURE = {
  subjectId: 'riron',
  subjectLabelOnSite: '理論', // 電験王インデックス上の科目見出し
  timeLimitMin: 90,
  aRange: [1, 14], // A問題の問番号レンジ
  bRange: [15, 18], // B問題の問番号レンジ
  selectableFrom: 17, // 問17・18 は選択
  aPoints: 5,
  bPartPoints: 5,
}

const pad2 = (n) => String(n).padStart(2, '0')

/** 問番号 → アプリの imageFile ベース名（拡張子なし）。'a05' / 'b15' */
export function imageBase(number) {
  const [aLo, aHi] = RIRON_STRUCTURE.aRange
  if (number >= aLo && number <= aHi) return `a${pad2(number)}`
  return `b${number}`
}
