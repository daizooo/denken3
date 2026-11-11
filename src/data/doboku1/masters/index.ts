// 年度ごとの問の索引の registry。年度を足すときは import と配列の末尾に1行ずつ追加する（CLAUDE.md）。
import type { DbkMaster } from './types.ts'
import { R08_MASTERS } from './r08.ts'

export const DOBOKU1_MASTERS: DbkMaster[] = [
  ...R08_MASTERS,
]
