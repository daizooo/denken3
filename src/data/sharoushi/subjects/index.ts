// 学習科目ID → 論点グループ（章）の registry（licensehub-expansion.md §4.5）。
// 科目ファイル（<学習科目>.ts）は scripts/license/build-master.mjs が DB から生成し、
// ここへ import と1行を末尾に追記する（手書きしない。既存行の並び替え・削除をしない。CLAUDE.md）。
// スクリプト（Node）からも読むため、科目ファイルの import は拡張子 .ts 付きで書く。
import type { Chapter } from '../../../domain/types'
import { ROUKI_CHAPTERS } from './rouki.ts'
import { ANEI_CHAPTERS } from './anei.ts'
import { ROUSAI_CHAPTERS } from './rousai.ts'
import { KOYOU_CHAPTERS } from './koyou.ts'
import { CHOUSHU_CHAPTERS } from './choushu.ts'
import { KENPO_CHAPTERS } from './kenpo.ts'
import { KOKUNEN_CHAPTERS } from './kokunen.ts'
import { KOUNEN_CHAPTERS } from './kounen.ts'
import { ROUIPPAN_CHAPTERS } from './rouippan.ts'
import { SHAIPPAN_CHAPTERS } from './shaippan.ts'

export const SHAROUSHI_SUBJECT_CHAPTERS: Record<string, Chapter[]> = {
  rouki: ROUKI_CHAPTERS,
  anei: ANEI_CHAPTERS,
  rousai: ROUSAI_CHAPTERS,
  koyou: KOYOU_CHAPTERS,
  choushu: CHOUSHU_CHAPTERS,
  kenpo: KENPO_CHAPTERS,
  kokunen: KOKUNEN_CHAPTERS,
  kounen: KOUNEN_CHAPTERS,
  rouippan: ROUIPPAN_CHAPTERS,
  shaippan: SHAIPPAN_CHAPTERS,
}
