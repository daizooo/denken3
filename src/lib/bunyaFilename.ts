// 分野別取り込みのファイル名解決。
//
// ASSET_MAP のキー（`newIMG_0538.png` 等）は、章フォルダを撮り溜めた当時の
// 連番そのままの命名である。取り込み元(GoogleDrive)は後から章ローカルの
// `問N.png` 形式へ整理されたため、完全一致だけでは1件もヒットしなくなった。
// 年度別モードは PR #56 で同じ問題（元ファイル名が imageFile と一致せず全件
// スキップ）を「問N からの逆引き」で解決済みで、ここはその分野別版にあたる。
//
// 対応する命名:
//   問13.png      -> その章の問13（sort 0）
//   問13-1.png    -> 同上（解答またがりの1枚目 = sort 0）
//   問13-2.png    -> 問13の解答続きページ（sort 1）
//   問31,32.png   -> 2問同居画像。先頭の番号(31)で引くと当該画像に解決される
//   newIMG_0550.png -> 従来どおり完全一致（既存7章の再取り込み互換）
//
// 章ローカルな `問N` は章をまたぐと一意でないため、必ず章コードを伴って引く。
import { CHAPTER_ASSET_MAPS, type AssetRef } from './assets'

export interface ResolvedBunyaFile {
  /** ASSET_MAP 上の正規ファイル名。Storage へはこの名前で保存する。 */
  canonicalName: string
  refs: AssetRef[]
}

/** `{questionId}#{sort}` -> 正規ファイル名。章ごとに一度だけ組んで使い回す。 */
const indexCache = new Map<string, Map<string, string>>()

function refIndexOf(chapter: string): Map<string, string> | undefined {
  const cached = indexCache.get(chapter)
  if (cached) return cached
  const map = CHAPTER_ASSET_MAPS[chapter]
  if (!map) return undefined
  const index = new Map<string, string>()
  for (const [filename, refs] of Object.entries(map)) {
    // 2問同居画像は複数の questionId から同じファイルへ解決されてよい。
    for (const r of refs) index.set(`${r.questionId}#${r.sort}`, filename)
  }
  indexCache.set(chapter, index)
  return index
}

/**
 * ドロップされたファイル名を、指定章の正規ファイル名と紐付け先へ解決する。
 * 解決できない場合（捨て問・奥付・章違い・想定外の命名）は undefined を返し、
 * 呼び出し側でスキップ扱いにする。
 */
export function resolveBunyaFile(chapter: string, filename: string): ResolvedBunyaFile | undefined {
  const map = CHAPTER_ASSET_MAPS[chapter]
  if (!map) return undefined

  // 1) 従来どおりの完全一致（既存7章を旧命名のまま再取り込みする場合）
  const exact = map[filename]
  if (exact) return { canonicalName: filename, refs: exact }

  // 2) 「問N」逆引き。枝番(-M)は解答またがりの通し番号で、sort は M-1。
  //    `問31,32.png` のような2問同居は先頭番号で引く（カンマは枝番と紛れないよう別扱い）。
  const number = filename.match(/問\s*(\d+)/)
  if (!number) return undefined
  const part = filename.match(/問\s*\d+(?:\s*[,、]\s*\d+)*\s*-\s*(\d+)\s*\./)
  const sort = part ? Number(part[1]) - 1 : 0
  if (!Number.isFinite(sort) || sort < 0) return undefined

  const canonicalName = refIndexOf(chapter)?.get(`${chapter}_${Number(number[1])}#${sort}`)
  if (!canonicalName) return undefined
  return { canonicalName, refs: map[canonicalName] }
}
