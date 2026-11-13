// 回ごとの問の索引の registry。回を足すときは import と配列の末尾に1行ずつ追加する（CLAUDE.md）。
import type { Kk2Master } from './types.ts'
import { K39_MASTERS } from './k39.ts'

export const KENKEI2_MASTERS: Kk2Master[] = [
  ...K39_MASTERS,
]
