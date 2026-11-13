// 回ごとの問の索引の registry。回を足すときは import と配列の末尾に1行ずつ追加する（CLAUDE.md）。
import type { Kk2Master } from './types.ts'
import { K39_MASTERS } from './k39.ts'
import { K38_MASTERS } from './k38.ts'
import { K37_MASTERS } from './k37.ts'
import { K36_MASTERS } from './k36.ts'
import { K35_MASTERS } from './k35.ts'
import { K34_MASTERS } from './k34.ts'

export const KENKEI2_MASTERS: Kk2Master[] = [
  ...K39_MASTERS,
  ...K38_MASTERS,
  ...K37_MASTERS,
  ...K36_MASTERS,
  ...K35_MASTERS,
  ...K34_MASTERS,
]
