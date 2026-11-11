import type { StudyMode } from '../../../domain/types'

/** 1問ぶんの索引（本文を含まない）。 */
export interface DbkMaster { id: string; title: string; studyMode: StudyMode }
