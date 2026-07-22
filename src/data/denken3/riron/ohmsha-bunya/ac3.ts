// 三相交流（オーム社 分野別過去問・理論）
import type { MasterQuestion } from '../../../../domain/types'

export const AC3_QUESTIONS: MasterQuestion[] = [
  { id: 'ac3_1',  number: 1,  title: 'Y結線：相電圧・線間電圧・電力の関係',                    difficulty: 1 },
  { id: 'ac3_2',  number: 2,  title: 'Y結線：平衡三相回路の全消費電力',                         difficulty: 1 },
  { id: 'ac3_3',  number: 3,  title: 'Y結線：各相電圧から線間電圧の大きさを求める',              difficulty: 1 },
  { id: 'ac3_4',  number: 4,  title: 'Y結線：RLC負荷の電源電流と有効電力',                      difficulty: 2 },
  { id: 'ac3_5',  number: 5,  title: 'Δ結線：平衡三相回路の線電流',                             difficulty: 1 },
  { id: 'ac3_6',  number: 6,  title: 'Δ結線：全消費電力と線電流からRとXを求める',               difficulty: 2 },
  { id: 'ac3_7',  number: 7,  title: 'Δ結線：平衡三相負荷の線電流の大きさ',                     difficulty: 2 },
  { id: 'ac3_8',  number: 8,  title: 'Δ結線：単相接続時の電力から三相接続時の電力を計算',       difficulty: 2 },
  // 問9 捨て問（1線断線）
  { id: 'ac3_10', number: 10, title: 'Δ結線：不平衡負荷の力率とRを求める',                      difficulty: 2 },
  { id: 'ac3_11', number: 11, title: 'Y-Δ混合：平衡三相回路の相電圧の大きさ',                   difficulty: 1 },
  { id: 'ac3_12', number: 12, title: 'Y-Δ混合：平衡三相回路の線電流',                           difficulty: 1 },
  { id: 'ac3_13', number: 13, title: 'Y-Δ混合：抵抗のΔ結線負荷の線間電圧と線電流',             difficulty: 1 },
  { id: 'ac3_14', number: 14, title: 'Y-Δ混合：RとCの平衡三相回路の力率',                       difficulty: 2 },
  { id: 'ac3_15', number: 15, title: 'Y結線/Y-Δ混合：RとXの平衡三相負荷のリアクタンスと消費電力', difficulty: 2 },
  { id: 'ac3_16', number: 16, title: 'Y-Δ混合：各リアクタンスに流れる電流',                     difficulty: 3 },
  // 問17 捨て問（力率=1になる条件）
  { id: 'ac3_18', number: 18, title: 'Y-Δ混合：混合負荷の抵抗と消費電力',                       difficulty: 3 },
  { id: 'ac3_19', number: 19, title: 'Y-Δ混合：RとLの負荷にCを接続して力率を1にする',           difficulty: 2 },
  { id: 'ac3_20', number: 20, title: 'Y結線/Y-Δ混合：RとLの負荷の電流と力率1にするコンデンサ',  difficulty: 2 },
  { id: 'ac3_21', number: 21, title: 'Y結線/Y-Δ混合：RとLの負荷の有効電力・力率とコンデンサ',   difficulty: 2 },
  { id: 'ac3_22', number: 22, title: 'Y-Δ混合：複素インピーダンス負荷の電流計算',               difficulty: 3 },
  { id: 'ac3_23', number: 23, title: 'Y-Δ混合：LとRの負荷の有効電力とコンデンサ',               difficulty: 2 },
  { id: 'ac3_24', number: 24, title: 'Y結線/Y-Δ混合：RとLの並列負荷の電力とコンデンサ',         difficulty: 2 },
  // 問25,26 捨て問（V結線・電源直列）
]
