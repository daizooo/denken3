// 年度ごとの問の索引の registry。年度を足すときは import と配列の末尾に1行ずつ追加する（CLAUDE.md）。
import type { DbkMaster } from './types.ts'
import { R08_MASTERS } from './r08.ts'
import { R07_MASTERS } from './r07.ts'
import { R06_MASTERS } from './r06.ts'
import { R05_MASTERS } from './r05.ts'
import { R04_MASTERS } from './r04.ts'
import { R03_MASTERS } from './r03.ts'
import { R02_MASTERS } from './r02.ts'
import { R01_MASTERS } from './r01.ts'

export const DOBOKU1_MASTERS: DbkMaster[] = [
  ...R08_MASTERS,
  ...R07_MASTERS,
  ...R06_MASTERS,
  ...R05_MASTERS,
  ...R04_MASTERS,
  ...R03_MASTERS,
  ...R02_MASTERS,
  ...R01_MASTERS,
]
