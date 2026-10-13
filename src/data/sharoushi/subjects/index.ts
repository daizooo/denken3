// 学習科目ID → 論点グループ（章）の registry（licensehub-expansion.md §4.5）。
// 科目ファイル（<学習科目>.ts）は scripts/license/build-master.mjs が DB から生成し、
// ここへ import と1行を末尾に追記する（手書きしない。既存行の並び替え・削除をしない。CLAUDE.md）。
// スクリプト（Node）からも読むため、科目ファイルの import は拡張子 .ts 付きで書く。
import type { Chapter } from '../../../domain/types'

export const SHAROUSHI_SUBJECT_CHAPTERS: Record<string, Chapter[]> = {
}
