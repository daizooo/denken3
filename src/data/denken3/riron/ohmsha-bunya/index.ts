// オーム社「分野別過去問」（理論）の章一覧。
// 問題を解いた章から順次追加する。電力・機械・法規は追加予定。
//
// 捨て問リスト（参照用コメント）:
//   直流回路  : 問31,37,72
//   単相交流  : 問42,49,51
//   三相交流  : 問9,17,25,26
//   過渡現象  : 問12,16,17,18,19
//   静電気    : 問17,21,31,70
//   電磁気    : 問30
//   電気計測  : 問2,22,29,39,44,48,49,50,51
//   電子理論  : 問5,9,20,45
//   電子回路  : 問13,14,15,41,46,54
import type { Chapter } from '../../../../domain/types'
import { DC_QUESTIONS } from './dc'
import { TRANS_QUESTIONS } from './trans'
import { AC1_QUESTIONS } from './ac1'
import { AC3_QUESTIONS } from './ac3'
import { ELEC_QUESTIONS } from './elec'
import { MAG_QUESTIONS } from './mag'
import { MEAS_QUESTIONS } from './meas'
import { ETHEORY_QUESTIONS } from './etheory'
import { ECIRCUIT_QUESTIONS } from './ecircuit'

export const OHMSHA_BUNYA_CHAPTERS: Chapter[] = [
  { code: 'dc',       name: '直流回路',  subject: '理論', totalCount: 69, questions: DC_QUESTIONS },
  { code: 'trans',    name: '過渡現象',  subject: '理論', totalCount: 14, questions: TRANS_QUESTIONS },
  { code: 'ac1',      name: '単相交流',  subject: '理論', totalCount: 69, questions: AC1_QUESTIONS },
  { code: 'ac3',      name: '三相交流',  subject: '理論', totalCount: 22, questions: AC3_QUESTIONS },
  { code: 'elec',     name: '静電気',    subject: '理論', totalCount: 72, questions: ELEC_QUESTIONS },
  { code: 'mag',      name: '電磁気',    subject: '理論', totalCount: 55, questions: MAG_QUESTIONS },
  { code: 'meas',     name: '電気計測',  subject: '理論', totalCount: 42, questions: MEAS_QUESTIONS },
  { code: 'etheory',  name: '電子理論',  subject: '理論', totalCount: 42, questions: ETHEORY_QUESTIONS },
  { code: 'ecircuit', name: '電子回路',  subject: '理論', totalCount: 52, questions: ECIRCUIT_QUESTIONS },
]
