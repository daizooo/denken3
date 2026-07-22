import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { User } from '@supabase/supabase-js'
import { BookOpen, TrendingUp, Save, LogOut, Upload, Image as ImageIcon } from 'lucide-react'
import { hasKnownAsset } from './lib/assets'
import ProblemViewer from './components/ProblemViewer'
import ImportPanel from './components/ImportPanel'
import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs'
import type { Card, Grade } from 'ts-fsrs'

// ==============================
// TYPES
// ==============================
type Status = 'A' | 'B' | 'C' | '未着手'

interface MasterQuestion {
  id: string
  number: number
  title: string
  difficulty: 1 | 2 | 3
  importance?: 1 | 2 | 3
}

interface Chapter {
  code: string
  name: string
  subject: Subject
  totalCount: number   // オーム社原本の問題数（捨て問含む）
  questions: MasterQuestion[]
}

type Subject = '理論' | '電力' | '機械' | '法規'

// 記録直前のFSRS状態のスナップショット。
// 履歴エントリを取り消したとき、スケジューラで再計算するのではなく
// この値へ正確に巻き戻すために使う（アルゴリズム変更の影響を受けない）。
interface ReviewSnapshot {
  status: Status
  stability: number
  difficulty_fsrs: number
  repetitions: number
  lapses: number
  due_date: string | null
  last_reviewed: string | null
  fsrs_state: number
}

interface ReviewHistoryEntry {
  date: string
  status: Status
  // 記録時に付与。取消時にこの状態へ戻す。旧データには無いのでオプショナル。
  prev?: ReviewSnapshot
}

interface Review {
  question_id: string
  status: Status
  stability: number
  difficulty_fsrs: number
  due_date: string | null
  repetitions: number
  lapses: number
  last_reviewed: string | null
  fsrs_state: number
  tags: string[]
  memo: string
  review_history: ReviewHistoryEntry[]
  first_reviewed: string | null
}

// ==============================
// MASTER DATA
// 問題を解いた章から順次追加する
// id命名規則: {chapter_code}_{original_book_number}
// 捨て問はそもそもMASTERに載せない
// ==============================

const DC_QUESTIONS: MasterQuestion[] = [
  { id: 'dc_1',  number: 1,  title: '抵抗直列回路（H10-A5）',                              difficulty: 1, importance: 3 },
  { id: 'dc_2',  number: 2,  title: '抵抗直列回路（H18-A5）',                              difficulty: 1, importance: 3 },
  { id: 'dc_3',  number: 3,  title: '抵抗直列回路（H30-A6）',                              difficulty: 1, importance: 3 },
  { id: 'dc_4',  number: 4,  title: '抵抗並列回路（H25-A5）',                              difficulty: 1, importance: 3 },
  { id: 'dc_5',  number: 5,  title: '抵抗直列回路／抵抗並列回路（H10-B11）',               difficulty: 2, importance: 3 },
  { id: 'dc_6',  number: 6,  title: '抵抗直列回路／抵抗並列回路（H21-A6）',               difficulty: 2, importance: 3 },
  { id: 'dc_7',  number: 7,  title: '抵抗直並列回路（H29-A5）',                            difficulty: 1, importance: 3 },
  { id: 'dc_8',  number: 8,  title: '抵抗直並列回路（H10-A4）',                            difficulty: 2, importance: 3 },
  { id: 'dc_9',  number: 9,  title: '抵抗直並列回路（H25-A8）',                            difficulty: 2, importance: 3 },
  { id: 'dc_10', number: 10, title: '抵抗直並列回路（H7-A4）',                             difficulty: 2, importance: 3 },
  { id: 'dc_11', number: 11, title: '抵抗直並列回路（R1-A5）',                             difficulty: 2, importance: 3 },
  { id: 'dc_12', number: 12, title: '抵抗直並列回路（H16-A4/R6下-A7）',                   difficulty: 1, importance: 3 },
  { id: 'dc_13', number: 13, title: '抵抗直並列回路（H24-A6）',                            difficulty: 1, importance: 3 },
  { id: 'dc_14', number: 14, title: '抵抗直並列回路（H26-A6）',                            difficulty: 1, importance: 3 },
  { id: 'dc_15', number: 15, title: '抵抗直並列回路（H23-A7）',                            difficulty: 2, importance: 3 },
  { id: 'dc_16', number: 16, title: '抵抗直並列回路（H13-A3）',                            difficulty: 1, importance: 3 },
  { id: 'dc_17', number: 17, title: '抵抗直並列回路（H18-A6）',                            difficulty: 2, importance: 3 },
  { id: 'dc_18', number: 18, title: '抵抗直並列回路（H9-A4）',                             difficulty: 1, importance: 3 },
  { id: 'dc_19', number: 19, title: '抵抗直並列回路（H22-A5）',                            difficulty: 1, importance: 3 },
  { id: 'dc_20', number: 20, title: '抵抗直並列回路（H26-A7）',                            difficulty: 1, importance: 3 },
  { id: 'dc_21', number: 21, title: '抵抗直並列回路（R1-A6/R5下-5）',                     difficulty: 1, importance: 3 },
  { id: 'dc_22', number: 22, title: '抵抗直並列回路（R2-A6）',                             difficulty: 1, importance: 3 },
  { id: 'dc_23', number: 23, title: '抵抗直列回路／抵抗並列回路（R4上-A5）',               difficulty: 1, importance: 3 },
  { id: 'dc_24', number: 24, title: '抵抗直列回路／抵抗並列回路（H8-A5/R7上-A7）',         difficulty: 1, importance: 3 },
  { id: 'dc_25', number: 25, title: '抵抗直列回路／抵抗並列回路（H20-A6/R5下-A7）',        difficulty: 1, importance: 3 },
  { id: 'dc_26', number: 26, title: '抵抗直列回路／抵抗並列回路（H22-A6/R7上-A6）',        difficulty: 2, importance: 3 },
  { id: 'dc_27', number: 27, title: '抵抗直並列回路（H17-A5）',                            difficulty: 2, importance: 3 },
  { id: 'dc_28', number: 28, title: '抵抗直並列回路（H24-A5）',                            difficulty: 2, importance: 2 },
  { id: 'dc_29', number: 29, title: '抵抗直列回路／抵抗並列回路（H14-B12）',               difficulty: 2, importance: 3 },
  { id: 'dc_30', number: 30, title: '抵抗直並列回路（H17-B15）',                           difficulty: 2, importance: 3 },
  // 問31 捨て問（抵抗直並列回路）
  { id: 'dc_32', number: 32, title: '抵抗直並列回路／最大供給電力（H19-A5/R6上-A7）',      difficulty: 2, importance: 2 },
  { id: 'dc_33', number: 33, title: '抵抗直並列回路／最大供給電力（R3-A7）',               difficulty: 2, importance: 2 },
  { id: 'dc_34', number: 34, title: 'はしご回路（H15-A6）',                                difficulty: 2, importance: 3 },
  { id: 'dc_35', number: 35, title: 'はしご回路（H27-A4）',                                difficulty: 2, importance: 3 },
  { id: 'dc_36', number: 36, title: 'はしご回路（H28-A6）',                                difficulty: 2, importance: 3 },
  // 問37 捨て問（ブリッジ回路）
  { id: 'dc_38', number: 38, title: 'ブリッジ回路（H27-A6）',                              difficulty: 1, importance: 3 },
  { id: 'dc_39', number: 39, title: '抵抗直並列回路／ブリッジ回路（R4上-A7）',             difficulty: 1, importance: 3 },
  { id: 'dc_40', number: 40, title: 'ブリッジ回路（H14-A5）',                              difficulty: 1, importance: 3 },
  { id: 'dc_41', number: 41, title: 'ブリッジ回路（H19-A6）',                              difficulty: 2, importance: 3 },
  { id: 'dc_42', number: 42, title: 'ブリッジ回路（H9-B12）',                              difficulty: 2, importance: 3 },
  { id: 'dc_43', number: 43, title: '抵抗直並列回路／ブリッジ回路（H16-A5/R4下-A5）',      difficulty: 1, importance: 3 },
  { id: 'dc_44', number: 44, title: 'ブリッジ回路（H12-A10）',                             difficulty: 1, importance: 3 },
  { id: 'dc_45', number: 45, title: '抵抗並列回路／ブリッジ回路（H23-A6）',                difficulty: 2, importance: 3 },
  { id: 'dc_46', number: 46, title: '抵抗直並列回路／ブリッジ回路（H8-A4）',               difficulty: 2, importance: 3 },
  { id: 'dc_47', number: 47, title: 'ブリッジ回路（R2-A7）',                               difficulty: 2, importance: 2 },
  { id: 'dc_48', number: 48, title: '抵抗直並列回路／ブリッジ回路（H18-B16/R6下-B16）',    difficulty: 2, importance: 3 },
  { id: 'dc_49', number: 49, title: '2電源回路（電圧源）（H13-A10）',                      difficulty: 2, importance: 3 },
  { id: 'dc_50', number: 50, title: '2電源回路（電圧源）（H15-A5/R5下-A6）',               difficulty: 2, importance: 3 },
  { id: 'dc_51', number: 51, title: '2電源回路（電圧源）（H20-A7/R6下-A6）',               difficulty: 2, importance: 3 },
  { id: 'dc_52', number: 52, title: '2電源回路（電圧源と電流源）（H9-A5/R5上-A6）',        difficulty: 2, importance: 3 },
  { id: 'dc_53', number: 53, title: '2電源回路（電流源）（H11-A7）',                       difficulty: 2, importance: 3 },
  { id: 'dc_54', number: 54, title: '2電源回路（電圧源と電流源）（H30-A7）',               difficulty: 2, importance: 3 },
  { id: 'dc_55', number: 55, title: '2電源回路（電圧源）（H25-A6/R5上-A5/R6上-A5）',       difficulty: 2, importance: 3 },
  { id: 'dc_56', number: 56, title: '多電源回路（電圧源）（R6上-A6）',                     difficulty: 2, importance: 3 },
  { id: 'dc_57', number: 57, title: '多電源回路（電圧源）（H28-A5）',                      difficulty: 2, importance: 3 },
  { id: 'dc_58', number: 58, title: '抵抗並列回路／LとCの定常特性（H27-A7）',              difficulty: 1, importance: 3 },
  { id: 'dc_59', number: 59, title: 'LとCの定常特性（R1-A7）',                             difficulty: 1, importance: 3 },
  { id: 'dc_60', number: 60, title: 'Lの定常特性（H29-A10）',                              difficulty: 1, importance: 3 },
  { id: 'dc_61', number: 61, title: 'Cの定常特性（H13-A5）',                               difficulty: 1, importance: 3 },
  { id: 'dc_62', number: 62, title: 'Cの定常特性（H22-A10）',                              difficulty: 2, importance: 3 },
  { id: 'dc_63', number: 63, title: 'Cの定常特性（R6下-A10）',                             difficulty: 2, importance: 3 },
  { id: 'dc_64', number: 64, title: 'LとCの定常特性（H11-A6）',                            difficulty: 1, importance: 3 },
  { id: 'dc_65', number: 65, title: 'LとCの定常特性（H19-A7/R7上-A5）',                    difficulty: 2, importance: 3 },
  { id: 'dc_66', number: 66, title: 'LとCの定常特性（H29-A6/R6下-A5）',                    difficulty: 2, importance: 3 },
  { id: 'dc_67', number: 67, title: '直流電流・直流抵抗（H30-A5）',                        difficulty: 1, importance: 3 },
  { id: 'dc_68', number: 68, title: '直流抵抗（R2-A5）',                                   difficulty: 1, importance: 3 },
  { id: 'dc_69', number: 69, title: '直流抵抗（H7-A3）',                                   difficulty: 1, importance: 2 },
  { id: 'dc_70', number: 70, title: '直流抵抗（H23-A5/R4下-A7）',                         difficulty: 2, importance: 3 },
  { id: 'dc_71', number: 71, title: '直流電流・直流抵抗（R5上-A7）',                       difficulty: 2, importance: 2 },
  // 問72 捨て問
]

const AC3_QUESTIONS: MasterQuestion[] = [
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

const TRANS_QUESTIONS: MasterQuestion[] = [
  { id: 'trans_1',  number: 1,  title: 'RL直列回路（H20-A10）',                      difficulty: 1, importance: 3 },
  { id: 'trans_2',  number: 2,  title: 'RL直列回路（H17-A9）',                        difficulty: 1, importance: 3 },
  { id: 'trans_3',  number: 3,  title: 'RC直列回路（H28-A10/R5下-A10）',              difficulty: 2, importance: 3 },
  { id: 'trans_4',  number: 4,  title: 'RC直列回路（H18-A10）',                       difficulty: 1, importance: 3 },
  { id: 'trans_5',  number: 5,  title: 'RC直列回路（H30-A10）',                       difficulty: 1, importance: 3 },
  { id: 'trans_6',  number: 6,  title: 'RC直列回路 ほか（R1-A10）',                   difficulty: 1, importance: 3 },
  { id: 'trans_7',  number: 7,  title: 'RC直列回路／RC直並列回路（H19-A10）',          difficulty: 1, importance: 3 },
  { id: 'trans_8',  number: 8,  title: 'RC直列回路（H15-A9）',                        difficulty: 2, importance: 3 },
  { id: 'trans_9',  number: 9,  title: 'RL直列回路（H21-A10）',                       difficulty: 2, importance: 3 },
  { id: 'trans_10', number: 10, title: 'RL直列回路／RC直列回路（H27-A10）',            difficulty: 2, importance: 3 },
  { id: 'trans_11', number: 11, title: 'RL直列回路（R3-A10）',                        difficulty: 2, importance: 3 },
  // 問12 捨て問（RL直並列回路）
  { id: 'trans_13', number: 13, title: 'RC直列回路（H23-A10）',                       difficulty: 2, importance: 3 },
  { id: 'trans_14', number: 14, title: 'RL直列回路／RL直並列回路（H24-A9）',           difficulty: 2, importance: 3 },
  { id: 'trans_15', number: 15, title: 'RC直列回路／RC直並列回路（H26-A11）',          difficulty: 2, importance: 3 },
  // 問16 捨て問（RL直列回路／RLC直並列回路）
  // 問17 捨て問（RL直列回路／RLC直並列回路）
  // 問18 捨て問（RC直並列回路）
  // 問19 捨て問（RC直列回路 ほか）
]

const ELEC_QUESTIONS: MasterQuestion[] = [
  { id: 'elec_1',  number: 1,  title: '基本概念：クーロン力・電界・電気力線・コンデンサの総合', difficulty: 1 },
  { id: 'elec_2',  number: 2,  title: '静電誘導と電気力線・電束の基本',                         difficulty: 1 },
  { id: 'elec_3',  number: 3,  title: '点電荷の電位・電界と電気力線・静電容量',                 difficulty: 1 },
  { id: 'elec_4',  number: 4,  title: '静電誘導と静電遮へいの性質',                             difficulty: 1 },
  { id: 'elec_5',  number: 5,  title: '仕事と静電エネルギーの基本',                             difficulty: 1 },
  { id: 'elec_6',  number: 6,  title: '仕事と静電エネルギー（応用）',                           difficulty: 2 },
  { id: 'elec_7',  number: 7,  title: 'クーロンの法則：2点間の静電力',                         difficulty: 1 },
  { id: 'elec_8',  number: 8,  title: 'クーロンの法則：力の計算',                               difficulty: 1 },
  { id: 'elec_9',  number: 9,  title: 'クーロンの法則：3点配置の合力',                         difficulty: 1 },
  { id: 'elec_10', number: 10, title: 'クーロンの法則：3電荷の力の釣合い',                     difficulty: 2 },
  { id: 'elec_11', number: 11, title: 'クーロンの法則：直角配置の合力',                         difficulty: 2 },
  { id: 'elec_12', number: 12, title: 'クーロンの法則：力の合成（応用）',                       difficulty: 2 },
  { id: 'elec_13', number: 13, title: 'クーロンの法則（難問）',                                 difficulty: 3 },
  { id: 'elec_14', number: 14, title: 'クーロンの法則：力の釣合い（発展）',                     difficulty: 2 },
  { id: 'elec_15', number: 15, title: 'クーロンの法則：懸架電荷の釣合い',                       difficulty: 2 },
  { id: 'elec_16', number: 16, title: 'クーロンの法則：非対称配置の合力',                       difficulty: 2 },
  // 問17 捨て問（運動エネルギーと静電エネルギーの複合）
  { id: 'elec_18', number: 18, title: '点電荷による電位の計算',                                 difficulty: 2 },
  { id: 'elec_19', number: 19, title: '点電荷による電位（2電荷）',                              difficulty: 2 },
  { id: 'elec_20', number: 20, title: '点電荷による電位（応用）',                               difficulty: 2 },
  // 問21 捨て問（点電荷による電位・難問）
  { id: 'elec_22', number: 22, title: '点電荷による電界の大きさ',                               difficulty: 2 },
  { id: 'elec_23', number: 23, title: '点電荷による電界と絶縁耐力',                             difficulty: 2 },
  { id: 'elec_24', number: 24, title: '点電荷による電位と静電容量',                             difficulty: 2 },
  { id: 'elec_25', number: 25, title: '点電荷による電界・絶縁耐力の計算',                       difficulty: 2 },
  { id: 'elec_26', number: 26, title: '電気力線の性質と本数',                                   difficulty: 1 },
  { id: 'elec_27', number: 27, title: '電気力線の基本法則',                                     difficulty: 1 },
  { id: 'elec_28', number: 28, title: '電気力線：ガウスの法則の適用',                           difficulty: 1 },
  { id: 'elec_29', number: 29, title: '電気力線（応用）',                                       difficulty: 2 },
  { id: 'elec_30', number: 30, title: '静電誘導・電気力線・平行板コンデンサ（難問）',           difficulty: 3 },
  // 問31 捨て問（電気力線・電位・静電エネルギーの複合）
  { id: 'elec_32', number: 32, title: '平行板コンデンサ：電界・電位・静電容量',                 difficulty: 1 },
  { id: 'elec_33', number: 33, title: '平行板コンデンサ：誘電体と静電容量',                     difficulty: 1 },
  { id: 'elec_34', number: 34, title: '平行板コンデンサと静電エネルギー',                       difficulty: 1 },
  { id: 'elec_35', number: 35, title: '平行板コンデンサ：極板間距離と静電エネルギー',           difficulty: 1 },
  { id: 'elec_36', number: 36, title: '平行板コンデンサ：充電後の極板移動と静電エネルギー',     difficulty: 1 },
  { id: 'elec_37', number: 37, title: '平行板コンデンサ（応用）',                               difficulty: 2 },
  { id: 'elec_38', number: 38, title: '平行板コンデンサ：基本計算',                             difficulty: 1 },
  { id: 'elec_39', number: 39, title: '静電エネルギーの基本',                                   difficulty: 1 },
  { id: 'elec_40', number: 40, title: '平行板コンデンサ：面積・間隔と静電容量',                 difficulty: 1 },
  { id: 'elec_41', number: 41, title: '平行板コンデンサ：接続時の静電エネルギー変化',           difficulty: 1 },
  { id: 'elec_42', number: 42, title: '平行板コンデンサ（複合）',                               difficulty: 2 },
  { id: 'elec_43', number: 43, title: '平行板コンデンサ：誘電体挿入',                           difficulty: 2 },
  { id: 'elec_44', number: 44, title: '平行板コンデンサ：電荷保存と静電エネルギー',             difficulty: 1 },
  { id: 'elec_45', number: 45, title: '電気力線・電束と平行板コンデンサ（難問）',               difficulty: 3 },
  { id: 'elec_46', number: 46, title: '平行板コンデンサ：分割誘電体',                           difficulty: 2 },
  { id: 'elec_47', number: 47, title: '平行板コンデンサ：部分誘電体',                           difficulty: 2 },
  { id: 'elec_48', number: 48, title: '平行板コンデンサ：導体板挿入',                           difficulty: 2 },
  { id: 'elec_49', number: 49, title: '平行板コンデンサと静電エネルギーの計算',                 difficulty: 2 },
  { id: 'elec_50', number: 50, title: 'コンデンサの直並列接続',                                 difficulty: 2 },
  { id: 'elec_51', number: 51, title: 'コンデンサの接続と静電エネルギー',                       difficulty: 1 },
  { id: 'elec_52', number: 52, title: 'コンデンサの接続：電荷配分と静電エネルギー',             difficulty: 1 },
  { id: 'elec_53', number: 53, title: 'コンデンサの接続：3素子回路',                           difficulty: 1 },
  { id: 'elec_54', number: 54, title: 'コンデンサの接続（複雑な回路）',                         difficulty: 2 },
  { id: 'elec_55', number: 55, title: 'コンデンサの接続と静電エネルギー（橋絡回路）',           difficulty: 2 },
  { id: 'elec_56', number: 56, title: 'コンデンサの接続：キルヒホッフ的解法',                   difficulty: 2 },
  { id: 'elec_57', number: 57, title: 'コンデンサの接続：複雑回路の静電エネルギー',             difficulty: 2 },
  { id: 'elec_58', number: 58, title: 'コンデンサの接続：合成容量の計算',                       difficulty: 2 },
  { id: 'elec_59', number: 59, title: 'コンデンサの接続：初期電荷あり',                         difficulty: 2 },
  { id: 'elec_60', number: 60, title: 'コンデンサの接続：スイッチ切り替え',                     difficulty: 2 },
  { id: 'elec_61', number: 61, title: 'コンデンサの接続（応用）',                               difficulty: 2 },
  { id: 'elec_62', number: 62, title: 'コンデンサの接続と応用',                                 difficulty: 2 },
  { id: 'elec_63', number: 63, title: 'コンデンサの接続（マルチパート問題）',                   difficulty: 2 },
  { id: 'elec_64', number: 64, title: '平行板コンデンサの基本と接続',                           difficulty: 1 },
  { id: 'elec_65', number: 65, title: '平行板コンデンサの接続：誘電体あり',                     difficulty: 1 },
  { id: 'elec_66', number: 66, title: '平行板コンデンサと接続：静電容量の変化',                 difficulty: 1 },
  { id: 'elec_67', number: 67, title: '平行板コンデンサと接続の組合せ',                         difficulty: 1 },
  { id: 'elec_68', number: 68, title: '電気力線・平行板コンデンサ・接続の総合',                 difficulty: 2 },
  { id: 'elec_69', number: 69, title: '平行板コンデンサの接続（応用）',                         difficulty: 2 },
  // 問70 捨て問（コンデンサ接続と静電エネルギーの複合）
  { id: 'elec_71', number: 71, title: '平行板コンデンサと接続：スイッチと電荷保存',             difficulty: 1 },
  { id: 'elec_72', number: 72, title: '平行板コンデンサと接続：分割問題',                       difficulty: 2 },
  { id: 'elec_73', number: 73, title: '平行板コンデンサと接続（マルチパート）',                  difficulty: 2 },
  { id: 'elec_74', number: 74, title: '平行板コンデンサと接続：電荷保存',                       difficulty: 2 },
  { id: 'elec_75', number: 75, title: '平行板コンデンサと接続（応用マルチパート）',              difficulty: 2 },
  { id: 'elec_76', number: 76, title: '平行板コンデンサ・接続・静電エネルギーの総合（難問）',   difficulty: 3 },
]

const AC1_QUESTIONS: MasterQuestion[] = [
  { id: 'ac1_1',  number: 1,  title: '瞬時値を表す式／波形（H9-A6）',                                       difficulty: 1, importance: 3 },
  { id: 'ac1_2',  number: 2,  title: '瞬時値を表す式／波形（R3-A8）',                                       difficulty: 1, importance: 3 },
  { id: 'ac1_3',  number: 3,  title: '瞬時値を表す式／RC並列回路（H7-A5）',                                 difficulty: 2, importance: 3 },
  { id: 'ac1_4',  number: 4,  title: '瞬時値を表す式／力率（H7-A7）',                                       difficulty: 2, importance: 3 },
  { id: 'ac1_5',  number: 5,  title: '瞬時値を表す式／RL直列回路（H12-A9）',                                difficulty: 1, importance: 3 },
  { id: 'ac1_6',  number: 6,  title: '瞬時値を表す式／合成電圧（H18-A8/R6下-A8）',                         difficulty: 2, importance: 3 },
  { id: 'ac1_7',  number: 7,  title: '瞬時値を表す式（H21-A9/R7上-A8）',                                    difficulty: 1, importance: 3 },
  { id: 'ac1_8',  number: 8,  title: '瞬時値を表す式（H17-A6）',                                            difficulty: 2, importance: 2 },
  { id: 'ac1_9',  number: 9,  title: '瞬時値を表す式（H17-B16/R6上-B15）',                                  difficulty: 2, importance: 3 },
  { id: 'ac1_10', number: 10, title: '瞬時値を表す式／ひずみ波（H10-A9）',                                  difficulty: 1, importance: 2 },
  { id: 'ac1_11', number: 11, title: '瞬時値を表す式／ひずみ波（H8-A11/R5下-A9/R6上-A9）',                 difficulty: 1, importance: 3 },
  { id: 'ac1_12', number: 12, title: '瞬時値を表す式／ひずみ波（H29-A9）',                                  difficulty: 1, importance: 3 },
  { id: 'ac1_13', number: 13, title: 'ひずみ波／RC並列回路（R1-A8）',                                       difficulty: 2, importance: 2 },
  { id: 'ac1_14', number: 14, title: '実効値・平均値（H12-A5）',                                            difficulty: 1, importance: 2 },
  { id: 'ac1_15', number: 15, title: '波形率・波高率（R4下-A8）',                                           difficulty: 1, importance: 2 },
  { id: 'ac1_16', number: 16, title: 'RL直列回路（H8-A6）',                                                 difficulty: 1, importance: 2 },
  { id: 'ac1_17', number: 17, title: 'RL直列回路（H27-A8）',                                                difficulty: 1, importance: 3 },
  { id: 'ac1_18', number: 18, title: 'RL直列回路（H8-A7）',                                                 difficulty: 1, importance: 3 },
  { id: 'ac1_19', number: 19, title: 'RL直列回路（H10-A7）',                                                difficulty: 1, importance: 3 },
  { id: 'ac1_20', number: 20, title: 'RL直列回路／力率（H14-A6/R5上-A9）',                                 difficulty: 1, importance: 3 },
  { id: 'ac1_21', number: 21, title: 'RL直列回路（H20-A9/R4上-A8）',                                       difficulty: 2, importance: 3 },
  { id: 'ac1_22', number: 22, title: 'RL直列回路（H21-A8）',                                                difficulty: 2, importance: 3 },
  { id: 'ac1_23', number: 23, title: 'RL直列回路／力率（H10-B12）',                                        difficulty: 2, importance: 3 },
  { id: 'ac1_24', number: 24, title: 'RL直列回路（H24-A8）',                                                difficulty: 1, importance: 3 },
  { id: 'ac1_25', number: 25, title: 'RL直列回路（H30-A8）',                                                difficulty: 2, importance: 3 },
  { id: 'ac1_26', number: 26, title: 'RL直列回路（H18-A9）',                                                difficulty: 2, importance: 3 },
  { id: 'ac1_27', number: 27, title: 'RL直列回路（H16-A8）',                                                difficulty: 2, importance: 3 },
  { id: 'ac1_28', number: 28, title: 'RL直列回路（H12-B12）',                                               difficulty: 1, importance: 3 },
  { id: 'ac1_29', number: 29, title: 'RL直列回路（H15-B16）',                                               difficulty: 2, importance: 3 },
  { id: 'ac1_30', number: 30, title: 'RL直並列回路（H13-A4）',                                              difficulty: 1, importance: 3 },
  { id: 'ac1_31', number: 31, title: 'RL直並列回路（H29-A8）',                                              difficulty: 2, importance: 3 },
  { id: 'ac1_32', number: 32, title: 'RL並列回路（H23-A8）',                                                difficulty: 2, importance: 3 },
  { id: 'ac1_33', number: 33, title: 'RL直並列回路（R7上-A9）',                                             difficulty: 2, importance: 3 },
  { id: 'ac1_34', number: 34, title: 'RL直並列回路（H12-B11）',                                             difficulty: 1, importance: 3 },
  { id: 'ac1_35', number: 35, title: 'RL並列回路 ほか（H26-B15）',                                         difficulty: 2, importance: 3 },
  { id: 'ac1_36', number: 36, title: 'RC直列回路（R2-A8）',                                                 difficulty: 1, importance: 3 },
  { id: 'ac1_37', number: 37, title: 'RC直列回路／力率（H19-A8）',                                         difficulty: 1, importance: 3 },
  { id: 'ac1_38', number: 38, title: 'RC直列回路（H25-A7/R6下-A9）',                                       difficulty: 1, importance: 3 },
  { id: 'ac1_39', number: 39, title: 'RC直列回路（H23-A9）',                                                difficulty: 1, importance: 3 },
  { id: 'ac1_40', number: 40, title: 'RC直並列回路（H16-A7/R4下-A9）',                                     difficulty: 2, importance: 3 },
  { id: 'ac1_41', number: 41, title: 'RL直列回路／RLC直列回路／力率（H22-A8）',                            difficulty: 2, importance: 3 },
  // 問42 捨て問（RLC直列回路）
  { id: 'ac1_43', number: 43, title: 'RLC並列回路（H19-A9）',                                               difficulty: 1, importance: 3 },
  { id: 'ac1_44', number: 44, title: 'RLC並列回路（H9-A7）',                                                difficulty: 1, importance: 3 },
  { id: 'ac1_45', number: 45, title: 'RLC並列回路（R1-A9）',                                                difficulty: 2, importance: 3 },
  { id: 'ac1_46', number: 46, title: 'RLC並列回路（H25-A9）',                                               difficulty: 2, importance: 3 },
  { id: 'ac1_47', number: 47, title: 'RLC並列回路／実効値・平均値・波高値（H15-A8）',                       difficulty: 2, importance: 3 },
  { id: 'ac1_48', number: 48, title: 'RLC直並列回路（H7-B12）',                                             difficulty: 2, importance: 3 },
  // 問49 捨て問（RLC直並列回路）
  { id: 'ac1_50', number: 50, title: 'RLC直並列回路／力率（H26-A8）',                                      difficulty: 1, importance: 3 },
  // 問51 捨て問（コンデンサ直並列回路）
  { id: 'ac1_52', number: 52, title: 'コンデンサ直並列回路（H27-A9）',                                     difficulty: 2, importance: 2 },
  { id: 'ac1_53', number: 53, title: '瞬時値を表す式／RLC直列回路／力率／平均値・最大値／共振（H26-A10）', difficulty: 1, importance: 3 },
  { id: 'ac1_54', number: 54, title: 'RLC直列回路／共振（H24-A7/R5上-A8）',                                difficulty: 1, importance: 3 },
  { id: 'ac1_55', number: 55, title: 'RLC並列回路／共振（H30-A9）',                                         difficulty: 1, importance: 3 },
  { id: 'ac1_56', number: 56, title: 'RLC直列回路／RLC並列回路／共振（R3-A9）',                            difficulty: 1, importance: 3 },
  { id: 'ac1_57', number: 57, title: 'RLC直列回路／RLC並列回路／共振（R2-A9）',                            difficulty: 1, importance: 3 },
  { id: 'ac1_58', number: 58, title: 'LC並列回路／共振（H20-A8）',                                          difficulty: 1, importance: 3 },
  { id: 'ac1_59', number: 59, title: 'LC直列回路／共振（H17-A8）',                                          difficulty: 1, importance: 3 },
  { id: 'ac1_60', number: 60, title: 'LC直列回路／共振（H26-A9/R6上-A8）',                                 difficulty: 1, importance: 3 },
  { id: 'ac1_61', number: 61, title: 'RLC直列回路／共振（H18-A7）',                                         difficulty: 1, importance: 3 },
  { id: 'ac1_62', number: 62, title: 'RLC直列回路／共振（H9-A8/R5下-A8）',                                 difficulty: 1, importance: 3 },
  { id: 'ac1_63', number: 63, title: 'RLC直並列回路／共振（H14-A8）',                                      difficulty: 1, importance: 3 },
  { id: 'ac1_64', number: 64, title: 'RLC直列回路／共振（R4上-A9）',                                        difficulty: 2, importance: 3 },
  { id: 'ac1_65', number: 65, title: 'RLC直列回路／共振（H16-A6）',                                         difficulty: 2, importance: 3 },
  { id: 'ac1_66', number: 66, title: 'RLC直並列回路／共振（H24-A10）',                                     difficulty: 2, importance: 3 },
  { id: 'ac1_67', number: 67, title: 'RLC直並列回路／共振（H28-A9）',                                      difficulty: 2, importance: 3 },
  { id: 'ac1_68', number: 68, title: 'RLC並列回路／RLC直並列回路／共振（H22-A13/R6上-A13）',               difficulty: 3, importance: 2 },
  { id: 'ac1_69', number: 69, title: '交流ブリッジ（H15-A14）',                                            difficulty: 1, importance: 2 },
  { id: 'ac1_70', number: 70, title: '交流ブリッジ（H29-B15）',                                            difficulty: 1, importance: 2 },
  { id: 'ac1_71', number: 71, title: '単相3線式（H21-A7）',                                                difficulty: 2, importance: 2 },
  { id: 'ac1_72', number: 72, title: '単相3線式（H22-A7）',                                                difficulty: 2, importance: 2 },
]

const MAG_QUESTIONS: MasterQuestion[] = [
  { id: 'mag_1',  number: 1,  title: '点磁荷による磁界（H30-A3）',                                   difficulty: 2, importance: 2 },
  { id: 'mag_2',  number: 2,  title: '電流による磁界（H15-A3/R6上-A4）',                             difficulty: 1, importance: 3 },
  { id: 'mag_3',  number: 3,  title: '電流による磁界（H12-A4）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_4',  number: 4,  title: '電流による磁界（H21-A4）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_5',  number: 5,  title: '電流による磁界（H28-A3）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_6',  number: 6,  title: '電流による磁界（H19-A1/R7上-A4）',                             difficulty: 1, importance: 3 },
  { id: 'mag_7',  number: 7,  title: '電流による磁界（H23-A4）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_8',  number: 8,  title: '電流による磁界（H26-A4）',                                     difficulty: 2, importance: 3 },
  { id: 'mag_9',  number: 9,  title: '電流による磁界（H30-A4）',                                     difficulty: 2, importance: 2 },
  { id: 'mag_10', number: 10, title: '電磁力（H23-A3）',                                             difficulty: 1, importance: 3 },
  { id: 'mag_11', number: 11, title: '電磁力（H10-A3）',                                             difficulty: 1, importance: 3 },
  { id: 'mag_12', number: 12, title: '電磁力ほか（H14-A4）',                                         difficulty: 2, importance: 2 },
  { id: 'mag_13', number: 13, title: '電磁力ほか（R2-A3）',                                          difficulty: 2, importance: 2 },
  { id: 'mag_14', number: 14, title: '電磁力（R4下-A4）',                                            difficulty: 1, importance: 3 },
  { id: 'mag_15', number: 15, title: '電流による磁界／電磁力／磁気回路ほか（H25-A3/R5上-A4）',       difficulty: 1, importance: 3 },
  { id: 'mag_16', number: 16, title: '磁力線（R2-A4）',                                              difficulty: 1, importance: 3 },
  { id: 'mag_17', number: 17, title: '電流による磁界／磁力線（H17-A3/R4下-A3）',                     difficulty: 1, importance: 3 },
  { id: 'mag_18', number: 18, title: '電流による磁界／電磁力（H22-A4/R6下-A4）',                     difficulty: 1, importance: 3 },
  { id: 'mag_19', number: 19, title: '電流による磁界／電磁力（H7-A2）',                               difficulty: 1, importance: 3 },
  { id: 'mag_20', number: 20, title: '電流による磁界／電磁力（H24-A4）',                              difficulty: 1, importance: 3 },
  { id: 'mag_21', number: 21, title: '電流による磁界／電磁力（H17-A4）',                              difficulty: 1, importance: 3 },
  { id: 'mag_22', number: 22, title: '電流による磁界／電磁力（H25-A4/R5下-A4）',                     difficulty: 2, importance: 3 },
  { id: 'mag_23', number: 23, title: '誘導起電力・誘導電流（H8-A2）',                                 difficulty: 1, importance: 3 },
  { id: 'mag_24', number: 24, title: '誘導起電力（H13-A1）',                                         difficulty: 1, importance: 3 },
  { id: 'mag_25', number: 25, title: '誘導起電力・誘導電流（H22-A3）',                                difficulty: 1, importance: 3 },
  { id: 'mag_26', number: 26, title: '誘導起電力（H16-A3/R4上-A4）',                                 difficulty: 1, importance: 3 },
  { id: 'mag_27', number: 27, title: '誘導起電力（H9-A2/R6下-A3）',                                  difficulty: 1, importance: 3 },
  { id: 'mag_28', number: 28, title: '磁束／誘導起電力・誘導電流（R3-A4）',                            difficulty: 1, importance: 3 },
  { id: 'mag_29', number: 29, title: '誘導起電力（H16-A9/R5上-A10）',                                difficulty: 2, importance: 3 },
  // 問30 捨て問（誘導起電力）
  { id: 'mag_31', number: 31, title: '磁束／磁気誘導（R3-A3/R5下-A3）',                              difficulty: 1, importance: 3 },
  { id: 'mag_32', number: 32, title: '磁束／磁気誘導（H28-A4）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_33', number: 33, title: '磁気誘導ほか（H19-A2）',                                       difficulty: 1, importance: 3 },
  { id: 'mag_34', number: 34, title: '磁気抵抗（H10-A2/R5上-A3）',                                   difficulty: 1, importance: 3 },
  { id: 'mag_35', number: 35, title: '磁気抵抗／磁気回路（H26-A3）',                                 difficulty: 1, importance: 3 },
  { id: 'mag_36', number: 36, title: 'インダクタンス（H24-A3）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_37', number: 37, title: '磁束／インダクタンス／磁気エネルギー（H21-A3）',                 difficulty: 1, importance: 3 },
  { id: 'mag_38', number: 38, title: 'インダクタンス（H8-A3）',                                      difficulty: 1, importance: 3 },
  { id: 'mag_39', number: 39, title: 'インダクタンス／磁気回路（H14-A3）',                            difficulty: 1, importance: 3 },
  { id: 'mag_40', number: 40, title: '誘導起電力／インダクタンス（H18-A4）',                          difficulty: 1, importance: 3 },
  { id: 'mag_41', number: 41, title: '磁束／インダクタンス（H20-A4/R7上-A3）',                       difficulty: 1, importance: 3 },
  { id: 'mag_42', number: 42, title: 'インダクタンス／磁気回路（H9-A3）',                             difficulty: 1, importance: 3 },
  { id: 'mag_43', number: 43, title: 'インダクタンス（H11-A2）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_44', number: 44, title: 'インダクタンス／磁気回路（H15-A4）',                            difficulty: 1, importance: 3 },
  { id: 'mag_45', number: 45, title: 'インダクタンス（H29-A3）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_46', number: 46, title: 'インダクタンス（R4上-A3）',                                    difficulty: 1, importance: 2 },
  { id: 'mag_47', number: 47, title: '磁束／磁気回路（H20-A3）',                                     difficulty: 1, importance: 3 },
  { id: 'mag_48', number: 48, title: '磁束／磁気回路（R1-A4）',                                      difficulty: 1, importance: 3 },
  { id: 'mag_49', number: 49, title: '磁気抵抗／磁気回路（H7-B11）',                                 difficulty: 2, importance: 3 },
  { id: 'mag_50', number: 50, title: '磁束／磁気抵抗／磁気回路（H16-B15）',                           difficulty: 2, importance: 3 },
  { id: 'mag_51', number: 51, title: '磁気抵抗／磁気回路（H29-B17）',                                difficulty: 3, importance: 2 },
  { id: 'mag_52', number: 52, title: '磁化特性（H12-A2）',                                           difficulty: 1, importance: 3 },
  { id: 'mag_53', number: 53, title: '磁化特性（H29-A4）',                                           difficulty: 1, importance: 3 },
  { id: 'mag_54', number: 54, title: '磁化特性ほか（R1-A3）',                                        difficulty: 3, importance: 2 },
  { id: 'mag_55', number: 55, title: '磁化特性ほか（H18-A3）',                                       difficulty: 2, importance: 2 },
  { id: 'mag_56', number: 56, title: '磁化特性（H27-A3）',                                           difficulty: 2, importance: 2 },
]

const MEAS_QUESTIONS: MasterQuestion[] = [
  { id: 'meas_1',  number: 1,  title: '測定法（R4上）',                                                difficulty: 1, importance: 2 },
  // 問2 捨て問（測定法／ブリッジ回路）
  { id: 'meas_3',  number: 3,  title: '指示電気計器（R6上）',                                          difficulty: 1, importance: 3 },
  { id: 'meas_4',  number: 4,  title: '指示電気計器（熱電形計器）（H7）',                               difficulty: 1, importance: 3 },
  { id: 'meas_5',  number: 5,  title: '指示電気計器（H10）',                                           difficulty: 2, importance: 3 },
  { id: 'meas_6',  number: 6,  title: '指示電気計器（H12）',                                           difficulty: 1, importance: 3 },
  { id: 'meas_7',  number: 7,  title: '指示電気計器（H16）',                                           difficulty: 2, importance: 3 },
  { id: 'meas_8',  number: 8,  title: '指示電気計器 ほか（H24）',                                      difficulty: 2, importance: 3 },
  { id: 'meas_9',  number: 9,  title: '指示電気計器（R1）',                                            difficulty: 1, importance: 2 },
  { id: 'meas_10', number: 10, title: '指示電気計器 ほか（H17）',                                      difficulty: 2, importance: 3 },
  { id: 'meas_11', number: 11, title: '指示電気計器 ほか（H8）',                                       difficulty: 2, importance: 2 },
  { id: 'meas_12', number: 12, title: '指示電気計器 ほか（H27）',                                      difficulty: 2, importance: 2 },
  { id: 'meas_13', number: 13, title: '指示電気計器（H17）',                                           difficulty: 2, importance: 1 },
  { id: 'meas_14', number: 14, title: 'ディジタル計器（H25）',                                         difficulty: 2, importance: 2 },
  { id: 'meas_15', number: 15, title: 'ディジタル計器（H28）',                                         difficulty: 1, importance: 2 },
  { id: 'meas_16', number: 16, title: 'データ変換（R4下）',                                            difficulty: 1, importance: 2 },
  { id: 'meas_17', number: 17, title: '電圧計・倍率器（H11）',                                         difficulty: 1, importance: 3 },
  { id: 'meas_18', number: 18, title: '電圧計・倍率器（H16）',                                         difficulty: 2, importance: 2 },
  { id: 'meas_19', number: 19, title: '電圧計・倍率器（H24）',                                         difficulty: 2, importance: 3 },
  { id: 'meas_20', number: 20, title: '電流計・分流器（R6上）',                                        difficulty: 2, importance: 3 },
  { id: 'meas_21', number: 21, title: '電圧計・倍率器（R2）',                                          difficulty: 2, importance: 3 },
  // 問22 捨て問（電圧計／ディジタル計器 ほか）
  { id: 'meas_23', number: 23, title: '電流計（回路計）（H13）',                                       difficulty: 2, importance: 2 },
  { id: 'meas_24', number: 24, title: '指示電気計器／電流計（H21）',                                   difficulty: 2, importance: 2 },
  { id: 'meas_25', number: 25, title: '電流計・分流器（H22）',                                         difficulty: 2, importance: 3 },
  { id: 'meas_26', number: 26, title: '電流計・分流器（R4下）',                                        difficulty: 2, importance: 3 },
  { id: 'meas_27', number: 27, title: '電圧計・倍率器／電流計（H15）',                                 difficulty: 2, importance: 3 },
  { id: 'meas_28', number: 28, title: '指示電気計器／電圧計・倍率器／電流計・分流器（H19）',            difficulty: 2, importance: 2 },
  // 問29 捨て問（指示電気計器／電圧計・倍率器／電流計・分流器）
  { id: 'meas_30', number: 30, title: '電流計 ほか（R3）',                                             difficulty: 2, importance: 3 },
  { id: 'meas_31', number: 31, title: '電流計／測定誤差（H20）',                                       difficulty: 1, importance: 2 },
  { id: 'meas_32', number: 32, title: '電圧計／測定誤差（H9）',                                        difficulty: 2, importance: 3 },
  { id: 'meas_33', number: 33, title: '電流計／電圧計／測定誤差（H11）',                               difficulty: 2, importance: 3 },
  { id: 'meas_34', number: 34, title: '電流計／電圧計／測定誤差（H19）',                               difficulty: 2, importance: 3 },
  { id: 'meas_35', number: 35, title: '測定誤差／ブリッジ回路（R3）',                                  difficulty: 3, importance: 2 },
  { id: 'meas_36', number: 36, title: '測定誤差 ほか（H28）',                                          difficulty: 1, importance: 3 },
  { id: 'meas_37', number: 37, title: '電流計／電圧計／測定誤差（R3／R5下）',                          difficulty: 2, importance: 3 },
  { id: 'meas_38', number: 38, title: '電圧計／測定誤差（H30／R5上）',                                 difficulty: 2, importance: 3 },
  // 問39 捨て問（電力量計 ほか）
  { id: 'meas_40', number: 40, title: '電力計 ほか（H15／R5上）',                                     difficulty: 2, importance: 3 },
  { id: 'meas_41', number: 41, title: '電力計 ほか（H26）',                                           difficulty: 2, importance: 3 },
  { id: 'meas_42', number: 42, title: '電力計 ほか（R2）',                                            difficulty: 2, importance: 3 },
  { id: 'meas_43', number: 43, title: '電流計／電力量計 ほか（H13）',                                  difficulty: 2, importance: 2 },
  // 問44 捨て問（指示電気計器／電力計）
  { id: 'meas_45', number: 45, title: '指示電気計器／電力量計／測定誤差（H22）',                       difficulty: 3, importance: 2 },
  { id: 'meas_46', number: 46, title: '指示電気計器／電力計 ほか（H23）',                              difficulty: 3, importance: 2 },
  { id: 'meas_47', number: 47, title: '電位差計 ほか（H27）',                                          difficulty: 2, importance: 3 },
  // 問48 捨て問（電位差計 ほか）
  // 問49,50,51 捨て問（オシロスコープ ほか）
]

const ETHEORY_QUESTIONS: MasterQuestion[] = [
  { id: 'etheory_1',  number: 1,  title: '電界中の電子（H15-A11）',                        difficulty: 1, importance: 3 },
  { id: 'etheory_2',  number: 2,  title: '電界中の電子（H9-A9/R6上-A12）',                 difficulty: 1, importance: 3 },
  { id: 'etheory_3',  number: 3,  title: '電界中の電子（H23-A12/R5下-A12）',               difficulty: 1, importance: 3 },
  { id: 'etheory_4',  number: 4,  title: '電界中の電子（R1-A12）',                         difficulty: 2, importance: 3 },
  // 問5 捨て問（電界中の電子）
  { id: 'etheory_6',  number: 6,  title: '磁界中の電子（H16-A11）',                        difficulty: 1, importance: 3 },
  { id: 'etheory_7',  number: 7,  title: '磁界中の電子（H28-A12）',                        difficulty: 1, importance: 3 },
  { id: 'etheory_8',  number: 8,  title: '電界中の電子／磁界中の電子（H21-A12）',           difficulty: 1, importance: 3 },
  // 問9 捨て問（電界中の電子／磁界中の電子）
  { id: 'etheory_10', number: 10, title: '電界中の電子／磁界中の電子（R3-A12）',            difficulty: 1, importance: 3 },
  { id: 'etheory_11', number: 11, title: '磁界中の電子（R4下-A12）',                       difficulty: 2, importance: 3 },
  { id: 'etheory_12', number: 12, title: '磁界中の電子（H19-A13）',                        difficulty: 1, importance: 3 },
  { id: 'etheory_13', number: 13, title: '磁界中の電子（H24-A12）',                        difficulty: 1, importance: 3 },
  { id: 'etheory_14', number: 14, title: '磁界中の電子（H30-A12）',                        difficulty: 2, importance: 3 },
  { id: 'etheory_15', number: 15, title: '電子放出（H13-A7）',                             difficulty: 1, importance: 3 },
  { id: 'etheory_16', number: 16, title: '電子放出（H22-A12）',                            difficulty: 1, importance: 3 },
  { id: 'etheory_17', number: 17, title: '電子放出（H20-A12/R4上-A12）',                   difficulty: 1, importance: 3 },
  { id: 'etheory_18', number: 18, title: '電子放出（H18-A12/R7上-A12）',                   difficulty: 1, importance: 3 },
  { id: 'etheory_19', number: 19, title: '箔検電器 ほか（R2-A12）',                        difficulty: 3, importance: 2 },
  // 問20 捨て問（紫外線ランプ）
  { id: 'etheory_21', number: 21, title: '熱電効果（H17-A11/R5上-A12）',                  difficulty: 1, importance: 2 },
  { id: 'etheory_22', number: 22, title: '熱電効果（R3-A5）',                             difficulty: 1, importance: 2 },
  { id: 'etheory_23', number: 23, title: '熱電効果 ほか（R2-A14）',                       difficulty: 1, importance: 2 },
  { id: 'etheory_24', number: 24, title: '半導体（H10-A1）',                              difficulty: 1, importance: 3 },
  { id: 'etheory_25', number: 25, title: '半導体（H18-A11）',                             difficulty: 1, importance: 3 },
  { id: 'etheory_26', number: 26, title: '半導体（H25-A11）',                             difficulty: 1, importance: 3 },
  { id: 'etheory_27', number: 27, title: '半導体（H21-A11）',                             difficulty: 1, importance: 3 },
  { id: 'etheory_28', number: 28, title: '半導体（H28-A11）',                             difficulty: 1, importance: 3 },
  { id: 'etheory_29', number: 29, title: '半導体（R3-A11）',                              difficulty: 1, importance: 3 },
  { id: 'etheory_30', number: 30, title: '半導体素子（H17-A10）',                         difficulty: 1, importance: 3 },
  { id: 'etheory_31', number: 31, title: '半導体素子（H30-A11）',                         difficulty: 1, importance: 3 },
  { id: 'etheory_32', number: 32, title: '半導体素子（pn接合）（H26-A12）',                difficulty: 2, importance: 3 },
  { id: 'etheory_33', number: 33, title: '半導体素子（LED）（H13-A6）',                   difficulty: 2, importance: 3 },
  { id: 'etheory_34', number: 34, title: '半導体素子（pn接合）（H29-A11）',                difficulty: 2, importance: 3 },
  { id: 'etheory_35', number: 35, title: '半導体素子（pn接合）（H14-A10）',                difficulty: 1, importance: 3 },
  { id: 'etheory_36', number: 36, title: 'FET（H11-A3/R5下-A11）',                       difficulty: 1, importance: 3 },
  { id: 'etheory_37', number: 37, title: 'FET（H16-A10/R6下-A11）',                      difficulty: 1, importance: 3 },
  { id: 'etheory_38', number: 38, title: 'FET ほか（H15-A10/R6上-A11）',                 difficulty: 2, importance: 3 },
  { id: 'etheory_39', number: 39, title: 'FET（R4上-A11）',                              difficulty: 2, importance: 3 },
  { id: 'etheory_40', number: 40, title: 'FET（H23-A11）',                               difficulty: 2, importance: 3 },
  { id: 'etheory_41', number: 41, title: '太陽電池（H20-A11）',                           difficulty: 1, importance: 2 },
  { id: 'etheory_42', number: 42, title: '太陽電池（R1-A11）',                            difficulty: 1, importance: 2 },
  { id: 'etheory_43', number: 43, title: 'ダイオード（H19-A11/R4下-A11）',                difficulty: 1, importance: 2 },
  { id: 'etheory_44', number: 44, title: 'ダイオード（R2-A11）',                          difficulty: 2, importance: 2 },
  // 問45 捨て問（ダイオード）
  { id: 'etheory_46', number: 46, title: 'ホール素子（H22-A11/R5上-A11/R7上-A11）',      difficulty: 2, importance: 2 },
]

const ECIRCUIT_QUESTIONS: MasterQuestion[] = [
  { id: 'ecircuit_1',  number: 1,  title: 'トランジスタ増幅回路（H8-B13）',                            difficulty: 1, importance: 3 },
  { id: 'ecircuit_2',  number: 2,  title: 'トランジスタ増幅回路（H11-B13）',                           difficulty: 1, importance: 3 },
  { id: 'ecircuit_3',  number: 3,  title: 'トランジスタ増幅回路（H17-A12）',                           difficulty: 1, importance: 3 },
  { id: 'ecircuit_4',  number: 4,  title: 'トランジスタ増幅回路（H7-B13）',                            difficulty: 1, importance: 3 },
  { id: 'ecircuit_5',  number: 5,  title: '電圧利得（H12-A7/R5下-A13）',                               difficulty: 1, importance: 3 },
  { id: 'ecircuit_6',  number: 6,  title: 'トランジスタ増幅回路／電圧利得（H28-A13）',                  difficulty: 2, importance: 3 },
  { id: 'ecircuit_7',  number: 7,  title: 'トランジスタ増幅回路／電力利得（H10-B13）',                  difficulty: 1, importance: 3 },
  { id: 'ecircuit_8',  number: 8,  title: 'トランジスタ増幅回路（H13-B13）',                           difficulty: 1, importance: 3 },
  { id: 'ecircuit_9',  number: 9,  title: 'トランジスタ増幅回路（H14-B13）',                           difficulty: 2, importance: 3 },
  { id: 'ecircuit_10', number: 10, title: 'トランジスタ増幅回路（R4上-B18）',                           difficulty: 2, importance: 3 },
  { id: 'ecircuit_11', number: 11, title: 'トランジスタ増幅回路／電圧利得（H16-B18）',                  difficulty: 2, importance: 3 },
  { id: 'ecircuit_12', number: 12, title: 'トランジスタ増幅回路（H18-B18）',                           difficulty: 2, importance: 3 },
  // 問13,14,15 捨て問（トランジスタ増幅回路）
  { id: 'ecircuit_16', number: 16, title: 'トランジスタ増幅回路（H9-B13/R7上-A13）',                   difficulty: 2, importance: 3 },
  { id: 'ecircuit_17', number: 17, title: 'トランジスタ増幅回路（R6下-A13）',                          difficulty: 2, importance: 3 },
  { id: 'ecircuit_18', number: 18, title: 'トランジスタ増幅回路（H29-A13）',                           difficulty: 2, importance: 3 },
  { id: 'ecircuit_19', number: 19, title: 'トランジスタ増幅回路（R2-B18）',                            difficulty: 2, importance: 3 },
  { id: 'ecircuit_20', number: 20, title: 'トランジスタ増幅回路 ほか（H25-A13）',                      difficulty: 1, importance: 3 },
  { id: 'ecircuit_21', number: 21, title: 'トランジスタ増幅回路 ほか（H20-A13）',                      difficulty: 2, importance: 3 },
  { id: 'ecircuit_22', number: 22, title: 'コレクタ接地増幅回路（R5上-A13）',                          difficulty: 1, importance: 3 },
  { id: 'ecircuit_23', number: 23, title: 'コレクタ接地増幅回路（H30-B16/R7上-B18）',                  difficulty: 2, importance: 2 },
  { id: 'ecircuit_24', number: 24, title: '電力増幅回路（H27-A13）',                                   difficulty: 1, importance: 2 },
  { id: 'ecircuit_25', number: 25, title: '電力増幅回路（H15-A12）',                                   difficulty: 2, importance: 2 },
  { id: 'ecircuit_26', number: 26, title: '電力増幅回路（H19-B18）',                                   difficulty: 3, importance: 2 },
  { id: 'ecircuit_27', number: 27, title: 'トランジスタ増幅回路／帰還回路 ほか（H16-A12）',             difficulty: 1, importance: 3 },
  { id: 'ecircuit_28', number: 28, title: 'FET増幅回路（H12-B13）',                                   difficulty: 2, importance: 3 },
  { id: 'ecircuit_29', number: 29, title: 'FET増幅回路（H21-A13）',                                   difficulty: 2, importance: 3 },
  { id: 'ecircuit_30', number: 30, title: 'FET増幅回路（R3-A13）',                                    difficulty: 2, importance: 3 },
  { id: 'ecircuit_31', number: 31, title: 'FET増幅回路（H17-B17）',                                   difficulty: 2, importance: 3 },
  { id: 'ecircuit_32', number: 32, title: 'FET増幅回路（H24-B18/R5下-B18）',                          difficulty: 2, importance: 3 },
  { id: 'ecircuit_33', number: 33, title: '発振回路（R3-B18）',                                       difficulty: 2, importance: 2 },
  { id: 'ecircuit_34', number: 34, title: '帰還回路／発振回路（H18-A13）',                             difficulty: 1, importance: 2 },
  { id: 'ecircuit_35', number: 35, title: '帰還回路／発振回路（R4下-A13）',                            difficulty: 2, importance: 2 },
  { id: 'ecircuit_36', number: 36, title: '帰還回路／発振回路（R1-A13）',                              difficulty: 2, importance: 2 },
  { id: 'ecircuit_37', number: 37, title: '演算増幅器（H8-A9）',                                      difficulty: 1, importance: 3 },
  { id: 'ecircuit_38', number: 38, title: '演算増幅器（H19-A12）',                                    difficulty: 1, importance: 3 },
  { id: 'ecircuit_39', number: 39, title: '演算増幅器（H26-A13）',                                    difficulty: 1, importance: 3 },
  { id: 'ecircuit_40', number: 40, title: '演算増幅器（R2-A13）',                                     difficulty: 1, importance: 3 },
  // 問41 捨て問（演算増幅器）
  { id: 'ecircuit_42', number: 42, title: '演算増幅器（H15-B18）',                                    difficulty: 2, importance: 3 },
  { id: 'ecircuit_43', number: 43, title: '演算増幅器（H22-B18）',                                    difficulty: 2, importance: 3 },
  { id: 'ecircuit_44', number: 44, title: '演算増幅器（R6下-B18）',                                   difficulty: 2, importance: 3 },
  { id: 'ecircuit_45', number: 45, title: '演算増幅器／電圧利得（H27-B18）',                           difficulty: 2, importance: 3 },
  // 問46 捨て問（演算増幅器／発振回路）
  { id: 'ecircuit_47', number: 47, title: 'パルス回路（H24-A13）',                                    difficulty: 2, importance: 3 },
  { id: 'ecircuit_48', number: 48, title: 'パルス回路（H7-A8）',                                      difficulty: 2, importance: 3 },
  { id: 'ecircuit_49', number: 49, title: 'パルス回路（H11-A8）',                                     difficulty: 2, importance: 3 },
  { id: 'ecircuit_50', number: 50, title: 'パルス回路（H30-A13）',                                    difficulty: 2, importance: 3 },
  { id: 'ecircuit_51', number: 51, title: 'パルス回路（H23-A13）',                                    difficulty: 2, importance: 2 },
  { id: 'ecircuit_52', number: 52, title: '集積回路（H24-A11）',                                      difficulty: 1, importance: 2 },
  { id: 'ecircuit_53', number: 53, title: 'パルス回路／集積回路（H25-B18）',                           difficulty: 2, importance: 2 },
  // 問54 捨て問（パルス回路／集積回路）
  { id: 'ecircuit_55', number: 55, title: '変調・復調回路（H20-B18/R6上-B18）',                       difficulty: 2, importance: 2 },
  { id: 'ecircuit_56', number: 56, title: '変調・復調回路（H28-B18/R5上-B18）',                       difficulty: 2, importance: 2 },
  { id: 'ecircuit_57', number: 57, title: '電源回路（H26-B18）',                                      difficulty: 2, importance: 2 },
  { id: 'ecircuit_58', number: 58, title: '直流安定化電源（R3-A6）',                                  difficulty: 2, importance: 2 },
]

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

const CHAPTERS: Chapter[] = [
  { code: 'dc',       name: '直流回路',  subject: '理論', totalCount: 69, questions: DC_QUESTIONS },
  { code: 'trans',    name: '過渡現象',  subject: '理論', totalCount: 14, questions: TRANS_QUESTIONS },
  { code: 'ac1',      name: '単相交流',  subject: '理論', totalCount: 69, questions: AC1_QUESTIONS },
  { code: 'ac3',      name: '三相交流',  subject: '理論', totalCount: 22, questions: AC3_QUESTIONS },
  { code: 'elec',     name: '静電気',    subject: '理論', totalCount: 72, questions: ELEC_QUESTIONS },
  { code: 'mag',      name: '電磁気',    subject: '理論', totalCount: 55, questions: MAG_QUESTIONS },
  { code: 'meas',     name: '電気計測',  subject: '理論', totalCount: 42, questions: MEAS_QUESTIONS },
  { code: 'etheory',  name: '電子理論',  subject: '理論', totalCount: 42, questions: ETHEORY_QUESTIONS },
  { code: 'ecircuit', name: '電子回路',  subject: '理論', totalCount: 52, questions: ECIRCUIT_QUESTIONS },
  // 電力・機械・法規は追加予定
]

const SUBJECTS: Subject[] = ['理論', '電力', '機械', '法規']


const STATUS_BG: Record<Status, string> = {
  'A':    'bg-green-100 text-green-800 border-green-300',
  'B':    'bg-blue-100 text-blue-800 border-blue-300',
  'C':    'bg-red-100 text-red-800 border-red-300',
  '未着手': 'bg-gray-100 text-gray-800 border-gray-300',
}

const STATUS_COLOR: Record<Status, string> = {
  'A': '#22c55e', 'B': '#3b82f6', 'C': '#ef4444', '未着手': '#9ca3af',
}

const STATUS_LABEL: Record<Status, string> = {
  'A': 'A（答えを見ずに解けた）',
  'B': 'B（方向性OK・計算ミス）',
  'C': 'C（答えを見た）',
  '未着手': '未着手',
}

// ==============================
// FSRS (ts-fsrs v5 公式実装)
// enable_short_term=false で日単位スケジューリング
// ==============================
const fsrsScheduler = new FSRS({ enable_short_term: false })

const RATING_MAP: Record<Status, Grade> = {
  A: Rating.Easy,
  B: Rating.Good,
  C: Rating.Again,
  '未着手': Rating.Good,
}

// "YYYY-MM-DD" を UTC正午の Date に変換（TZによる日付ズレを防ぐ）
function dateAtUTCNoon(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`)
}

// 現在の「今日」を JST(UTC+9) 基準の "YYYY-MM-DD" で返す。
// new Date().toISOString() は UTC基準のため、JSTの深夜〜午前9時は
// 前日扱いになってしまう。復習日の判定は必ずこの関数を使う。
function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// "YYYY-MM-DD" に日数を加算して "YYYY-MM-DD" を返す（TZ非依存）
function addDaysStr(dateStr: string, days: number): string {
  const d = dateAtUTCNoon(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// 復習タブの日付タブ数（今日を含む1週間＋1日＝8日分）。
// これ以降（today+REVIEW_WINDOW_DAYS 以降）の問題は「◯/◯以降」タブにまとめる。
const REVIEW_WINDOW_DAYS = 8

// timestamptz / date いずれの文字列でも "YYYY-MM-DD" に正規化する
function toDateStr(v: string | null | undefined): string {
  if (!v) return ''
  return v.slice(0, 10)
}

function toFSRSCard(review: Partial<Review>, now: Date): Card {
  const lastReview = review.last_reviewed ? dateAtUTCNoon(toDateStr(review.last_reviewed)) : now
  const due = review.due_date ? dateAtUTCNoon(toDateStr(review.due_date)) : now
  return {
    due,
    stability: review.stability ?? 0,
    difficulty: review.difficulty_fsrs ?? 5,
    elapsed_days: Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / 86400000)),
    scheduled_days: Math.max(0, Math.floor((due.getTime() - lastReview.getTime()) / 86400000)),
    learning_steps: 0,
    reps: review.repetitions ?? 0,
    lapses: review.lapses ?? 0,
    state: (review.fsrs_state ?? State.New) as State,
    last_review: lastReview,
  }
}

// eventDate = 実施日（過去日でもよい）。未指定なら今日。
function calcFSRS(current: Partial<Review> | null, status: Status, eventDate?: string) {
  if (status === '未着手') return {}
  const rating = RATING_MAP[status]
  // 実施日未指定なら JST基準の「今日」を使う（UTC日付ズレ防止）
  const eDate = eventDate ?? todayJST()
  const now = dateAtUTCNoon(eDate)
  const card = current && (current.repetitions ?? 0) > 0
    ? toFSRSCard(current, now)
    : createEmptyCard(now)
  const newCard = fsrsScheduler.repeat(card, now)[rating].card
  return {
    stability: newCard.stability,
    difficulty_fsrs: newCard.difficulty,
    repetitions: newCard.reps,
    lapses: newCard.lapses,
    due_date: newCard.due.toISOString().split('T')[0],
    last_reviewed: eDate,
    fsrs_state: newCard.state,
  }
}

// review_history を実施日順に再生し、FSRS・初回/実施日・ステータスを一括導出する。
// 記録・取消のどちらでも履歴と各フィールドが常に一致する。
function deriveFromHistory(history: ReviewHistoryEntry[]) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  let acc: Partial<Review> = {
    stability: 0, difficulty_fsrs: 5, repetitions: 0, lapses: 0,
    due_date: null, last_reviewed: null, fsrs_state: State.New,
  }
  for (const e of sorted) {
    acc = { ...acc, ...calcFSRS(acc, e.status, e.date) }
  }
  return {
    stability: acc.stability ?? 0,
    difficulty_fsrs: acc.difficulty_fsrs ?? 5,
    repetitions: acc.repetitions ?? 0,
    lapses: acc.lapses ?? 0,
    due_date: acc.due_date ?? null,
    fsrs_state: acc.fsrs_state ?? State.New,
    review_history: sorted,
    first_reviewed: sorted.length ? sorted[0].date : null,
    last_reviewed: sorted.length ? sorted[sorted.length - 1].date : null,
    status: (sorted.length ? sorted[sorted.length - 1].status : '未着手') as Status,
  }
}

function formatDue(dateStr: string | null): string {
  if (!dateStr) return '未定'
  // 「今日」と予定日を同じ UTC正午基準で比較する。
  // 「今日」は JST基準で求める（UTCのままだと JST深夜〜午前9時に前日扱いになる）。
  const today = dateAtUTCNoon(todayJST())
  const due = dateAtUTCNoon(toDateStr(dateStr))
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}日遅延`
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  return `${diff}日後`
}

// "2026-07-20" → "7/20"
function formatMD(dateStr: string | null): string {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// 次回復習日の緊急度に応じた文字色
function dueColorClass(dateStr: string | null): string {
  const label = formatDue(dateStr)
  if (label.includes('遅延')) return 'text-red-500'
  if (label === '今日') return 'text-orange-500'
  return 'text-emerald-600'
}

function defaultReview(questionId: string): Review {
  return {
    question_id: questionId, status: '未着手',
    stability: 0, difficulty_fsrs: 5,
    due_date: null, repetitions: 0, lapses: 0,
    last_reviewed: null, fsrs_state: State.New,
    tags: [], memo: '',
    review_history: [], first_reviewed: null,
  }
}

// ==============================
// LOGIN SCREEN
// ==============================
function LoginScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4 w-72">
        <BookOpen size={36} className="mx-auto text-blue-600" />
        <h1 className="text-lg font-bold text-gray-800">電験3種 過去問マスター</h1>
        <p className="text-xs text-gray-500">2027/2 理論CBT 合格まで</p>
        <button
          onClick={() => supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          })}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Googleでログイン
        </button>
      </div>
    </div>
  )
}

// ==============================
// MAIN APP
// ==============================
export default function App() {
  const [user, setUser]           = useState<User | null>(null)
  const [reviews, setReviews]     = useState<Record<string, Review>>({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [activeTab, setActiveTab] = useState<'review' | 'list' | 'dashboard'>('list')
  const [selectedDate, setSelectedDate] = useState<string>(() => todayJST())
  const [subject, setSubject]     = useState<Subject>('理論')
  const [chapterCode, setChapterCode] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMemo, setEditMemo]   = useState('')
  // 各問題の記録用「実施日」。未設定なら今日を使う。
  const [recordDate, setRecordDate] = useState<Record<string, string>>({})
  // 実施日ピッカーを開いている問題のID（通常は「今日」なので畳んでおく）
  const [dateOpenId, setDateOpenId] = useState<string | null>(null)
  const [viewerQ, setViewerQ] = useState<{ id: string; title: string } | null>(null)
  const [showImport, setShowImport] = useState(false)
  // 復習タブでこのセッション中に理解度を記録した問題。記録した瞬間に一覧から消すために使う。
  const [reviewedNowIds, setReviewedNowIds] = useState<Set<string>>(() => new Set())
  const todayStr = todayJST()
  const dateFor = (id: string) => recordDate[id] ?? todayStr

  // ---- Auth ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (!session?.user) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setReviews({})
        setLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // TOKEN_REFRESHED では user を更新しない（不要な再フェッチ防止）
        setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null))
        if (!session?.user) setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ---- Fetch reviews ----
  useEffect(() => {
    if (!user) return
    setLoading(true)
    supabase
      .from('denken_reviews')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) console.error(error)
        if (data) {
          const map: Record<string, Review> = {}
          data.forEach(r => {
            map[r.question_id] = {
              ...r,
              review_history: Array.isArray(r.review_history) ? r.review_history : [],
              last_reviewed: r.last_reviewed ? toDateStr(r.last_reviewed) : null,
              first_reviewed: r.first_reviewed ? toDateStr(r.first_reviewed) : null,
              due_date: r.due_date ? toDateStr(r.due_date) : null,
            } as Review
          })
          setReviews(map)
        }
        setLoading(false)
      })
  }, [user])

  // タブ・対象日を切り替えたら「復習済みで消した」記録はリセットする。
  useEffect(() => {
    setReviewedNowIds(new Set())
  }, [activeTab, selectedDate])

  // ---- 共通: Review を1件保存（ローカル即時反映＋DB upsert）----
  const saveReview = useCallback(async (updated: Review) => {
    if (!user) return
    setReviews(prev => ({ ...prev, [updated.question_id]: updated }))
    setSaving(true)
    const { error } = await supabase.from('denken_reviews').upsert({
      user_id: user.id, ...updated,
    })
    if (error) console.error(error)
    setSaving(false)
  }, [user])

  // ---- 共通: 履歴から Review 全体を導出して保存 ----
  const persistReview = useCallback(async (
    current: Review,
    history: ReviewHistoryEntry[],
  ) => {
    const derived = deriveFromHistory(history)
    await saveReview({ ...current, ...derived })
  }, [saveReview])

  // 現在のFSRS状態を「記録直前のスナップショット」として切り出す。
  const snapshotOf = (r: Review): ReviewSnapshot => ({
    status: r.status,
    stability: r.stability,
    difficulty_fsrs: r.difficulty_fsrs,
    repetitions: r.repetitions,
    lapses: r.lapses,
    due_date: r.due_date,
    last_reviewed: r.last_reviewed,
    fsrs_state: r.fsrs_state,
  })

  // ---- 実施日 + 理解度を記録（履歴に蓄積）----
  const updateStatus = useCallback(async (questionId: string, status: Status) => {
    if (!user || status === '未着手') return
    const current = reviews[questionId] ?? defaultReview(questionId)
    const date = dateFor(questionId)
    // 記録直前の状態を prev として保存しておく。取消時にこの状態へ正確に戻せる。
    const history: ReviewHistoryEntry[] = [
      ...(current.review_history ?? []),
      { date, status, prev: snapshotOf(current) },
    ]
    // 復習タブでは、記録した問題を「復習済み」として即座に一覧から消す。
    if (activeTab === 'review') {
      setReviewedNowIds(prev => new Set(prev).add(questionId))
    }
    await persistReview(current, history)
  }, [user, reviews, persistReview, recordDate, activeTab])

  // ---- 履歴エントリを取り消し（誤記録の修正用）----
  // review_history は常に実施日順で保存されるため、index はそのまま時系列順。
  // 末尾（最後に記録した分）で記録直前スナップショットを持つ場合は、
  // スケジューラで再計算せずその状態へ正確に巻き戻す。
  // これによりアルゴリズム変更（旧簡易版→ts-fsrs 等）があっても
  // 「記録前の予定日・理解度」に確実に戻る。
  const deleteEntry = useCallback(async (questionId: string, index: number) => {
    if (!user) return
    const current = reviews[questionId]
    if (!current) return
    const history = current.review_history
    const entry = history[index]
    const remaining = history.filter((_, i) => i !== index)
    const isLast = index === history.length - 1

    if (isLast && entry?.prev) {
      const p = entry.prev
      await saveReview({
        ...current,
        status: p.status,
        stability: p.stability,
        difficulty_fsrs: p.difficulty_fsrs,
        repetitions: p.repetitions,
        lapses: p.lapses,
        due_date: p.due_date,
        last_reviewed: p.last_reviewed,
        fsrs_state: p.fsrs_state,
        review_history: remaining,
        first_reviewed: remaining.length ? remaining[0].date : null,
      })
      return
    }

    // 旧データ（スナップショット無し）や途中エントリの削除は従来どおり再計算。
    await persistReview(current, remaining)
  }, [user, reviews, persistReview, saveReview])

  // ---- メモを保存 ----
  const saveDetails = useCallback(async (questionId: string) => {
    if (!user) return
    const current = reviews[questionId] ?? defaultReview(questionId)
    const updated: Review = { ...current, memo: editMemo }

    setReviews(prev => ({ ...prev, [questionId]: updated }))
    setSaving(true)
    const { error } = await supabase.from('denken_reviews').upsert({
      user_id: user.id, ...updated,
    })
    if (error) console.error(error)
    setSaving(false)
    setEditingId(null)
  }, [user, reviews, editMemo])

  // ---- Derived data ----
  const currentChapters = useMemo(
    () => CHAPTERS.filter(c => c.subject === subject),
    [subject]
  )

  const allQuestions = useMemo(() => {
    const chaps = chapterCode === 'ALL'
      ? currentChapters
      : currentChapters.filter(c => c.code === chapterCode)
    return chaps.flatMap(c =>
      c.questions.map(q => ({ ...q, chapterName: c.name, chapterCode: c.code }))
    )
  }, [currentChapters, chapterCode])

  const reviewSchedule = useMemo(() => {
    const today = todayJST()
    const overflowStart = addDaysStr(today, REVIEW_WINDOW_DAYS)
    // 今日を含む8日分の個別日付タブ
    const days = Array.from({ length: REVIEW_WINDOW_DAYS }, (_, i) => {
      const dStr = addDaysStr(today, i)
      const count = allQuestions.filter(q => {
        const r = reviews[q.id]
        if (i === 0) return !!(r?.due_date && r.due_date <= dStr)
        return reviews[q.id]?.due_date === dStr
      }).length
      const label = i === 0 ? '今日' : i === 1 ? '明日' : formatMD(dStr)
      return { date: dStr, label, count, isOverflow: false }
    })
    // それ以降（overflowStart 以降）をまとめる「◯/◯以降」タブ
    const overflowCount = allQuestions.filter(q => {
      const r = reviews[q.id]
      return !!(r?.due_date && r.due_date >= overflowStart)
    }).length
    days.push({
      date: overflowStart,
      label: `${formatMD(overflowStart)}以降`,
      count: overflowCount,
      isOverflow: true,
    })
    return days
  }, [allQuestions, reviews])

  const filteredQuestions = useMemo(() => {
    const today = todayJST()
    const overflowStart = addDaysStr(today, REVIEW_WINDOW_DAYS)
    return allQuestions.filter(q => {
      const r = reviews[q.id]
      const status = r?.status ?? '未着手'
      if (activeTab === 'review') {
        // 記録した瞬間に「復習済み」として消す（次回復習日が更新される前でも即反映）。
        if (reviewedNowIds.has(q.id)) return false
        if (selectedDate === today) {
          const isDue = r?.due_date && r.due_date <= today
          if (!isDue) return false
        } else if (selectedDate >= overflowStart) {
          // 「◯/◯以降」タブ: overflowStart 以降の予定をすべて表示
          if (!(r?.due_date && r.due_date >= overflowStart)) return false
        } else {
          if (!r?.due_date || r.due_date !== selectedDate) return false
        }
      }
      if (filterStatus !== 'ALL' && status !== filterStatus) return false
      return true
    })
  }, [allQuestions, reviews, activeTab, filterStatus, selectedDate, reviewedNowIds])

  // 復習タブで、記録により選択中の日付の問題がすべて片付いたら、
  // 次に問題が残っている日付タブへ自動で移動する（＝終わった感覚を出す）。
  // 記録した直後（reviewedNowIds が空でない）だけ発火させ、
  // ユーザーが手動で空の日付タブを見ている場合は移動しない。
  useEffect(() => {
    if (activeTab !== 'review') return
    if (reviewedNowIds.size === 0) return
    if (filteredQuestions.length > 0) return
    const idx = reviewSchedule.findIndex(s => s.date === selectedDate)
    if (idx === -1) return
    const next = reviewSchedule.slice(idx + 1).find(s => s.count > 0)
    if (next) setSelectedDate(next.date)
  }, [activeTab, reviewedNowIds, filteredQuestions, reviewSchedule, selectedDate])

  const dashData = useMemo(() => {
    const counts: Record<Status, number> = { A: 0, B: 0, C: 0, '未着手': 0 }
    allQuestions.forEach(q => { counts[reviews[q.id]?.status ?? '未着手']++ })

    const pieData = (Object.entries(counts) as [Status, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k, value: v, color: STATUS_COLOR[k] }))

    const today = todayJST()
    const scheduleData = Array.from({ length: 7 }, (_, i) => {
      const dStr = addDaysStr(today, i)
      const count = allQuestions.filter(q => {
        const due = reviews[q.id]?.due_date
        return i === 0 ? due && due <= dStr : due === dStr
      }).length
      return { date: i === 0 ? '今日' : i === 1 ? '明日' : `${i}日後`, count }
    })
    return { counts, pieData, scheduleData }
  }, [allQuestions, reviews])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">読み込み中...</p>
    </div>
  )
  if (!user) return <LoginScreen />

  const inputChapters = currentChapters.filter(c => c.questions.length > 0)
  const totalQ = allQuestions.length
  const masteredQ = allQuestions.filter(q => reviews[q.id]?.status === 'A').length
  const overflowStart = addDaysStr(todayStr, REVIEW_WINDOW_DAYS)
  const reviewDueCount = (questions: { id: string }[]) =>
    questions.filter(q => {
      const r = reviews[q.id]
      if (selectedDate === todayStr) {
        return r?.status === '未着手' || (r?.due_date && r.due_date <= todayStr)
      }
      if (selectedDate >= overflowStart) {
        return !!(r?.due_date && r.due_date >= overflowStart)
      }
      return r?.due_date === selectedDate
    }).length
  const todayDue = allQuestions.filter(q => {
    const r = reviews[q.id]
    return !!(r?.due_date && r.due_date <= todayStr)
  }).length

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* ===== HEADER ===== */}
        <header className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              <span className="font-bold text-gray-800 text-base">電験3種 過去問マスター</span>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              {saving && <Save size={12} className="animate-pulse text-blue-400" />}
              <span>{saving ? '保存中...' : `今日の復習 ${todayDue}問`}</span>
              <button
                onClick={() => setShowImport(true)}
                title="問題画像の取り込み"
                className="ml-1 p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Upload size={13} />
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                title="ログアウト"
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>

          {/* 科目タブ */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {SUBJECTS.map(s => {
              const count = CHAPTERS.filter(c => c.subject === s)
                .reduce((sum, c) => sum + c.questions.length, 0)
              return (
                <button key={s}
                  onClick={() => { setSubject(s); setChapterCode('ALL') }}
                  className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                    subject === s ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s}
                  {count > 0 && <span className="ml-1 text-gray-400">({count})</span>}
                </button>
              )
            })}
          </div>

          {/* 表示タブ */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'review' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              復習{todayDue > 0 ? ` (${todayDue})` : ''}
            </button>
            {(['list', 'dashboard'] as const).map(t => (
              <button key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'list' ? '全問題' : '分析'}
              </button>
            ))}
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <DashboardView
            data={dashData}
            chapters={inputChapters}
            reviews={reviews}
            totalQ={totalQ}
            masteredQ={masteredQ}
          />
        ) : (
          <>
            {/* ===== CHAPTER FILTER ===== */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setChapterCode('ALL')}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  chapterCode === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >全章 ({activeTab === 'review' ? reviewDueCount(allQuestions) : totalQ}問)</button>

              {inputChapters.map(c => {
                const count = activeTab === 'review' ? reviewDueCount(c.questions) : c.questions.length
                return (
                  <button key={c.code}
                    onClick={() => setChapterCode(c.code)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      chapterCode === c.code
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                )
              })}

              {/* 未入力チャプターのプレースホルダー */}
              {currentChapters.filter(c => c.questions.length === 0).map(c => (
                <span key={c.code}
                  className="px-3 py-1 rounded-full text-xs border border-dashed border-gray-300 text-gray-400 cursor-not-allowed"
                  title={`${c.totalCount}問 - 未入力`}
                >{c.name} (未)</span>
              ))}
            </div>

            {/* ===== DATE STRIP (review only) ===== */}
            {activeTab === 'review' && (
              <div className="overflow-x-auto -mx-0.5 px-0.5">
                <div className="flex gap-1.5 pb-1" style={{ minWidth: 'max-content' }}>
                  {reviewSchedule.map(({ date, label, count }) => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center px-3 py-1.5 rounded-xl border text-xs transition-colors min-w-[52px] ${
                        selectedDate === date
                          ? 'bg-blue-600 text-white border-blue-600'
                          : count > 0
                          ? 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                          : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}
                    >
                      <span className="font-medium whitespace-nowrap">{label}</span>
                      <span className={`mt-0.5 font-bold ${
                        selectedDate === date ? 'text-white' : count > 0 ? 'text-red-500' : 'text-gray-300'
                      }`}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== STATUS FILTER (list only) ===== */}
            {activeTab === 'list' && (
              <div className="flex gap-1.5 flex-wrap">
                {(['ALL', 'A', 'B', 'C', '未着手'] as const).map(s => (
                  <button key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      filterStatus === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >{s === 'ALL' ? 'すべて' : s}</button>
                ))}
              </div>
            )}

            {/* ===== QUESTION LIST ===== */}
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="text-gray-400 text-sm">
                  {activeTab === 'review'
                    ? reviewedNowIds.size > 0
                      ? '🎉 この日の復習を完了しました'
                      : selectedDate === todayJST()
                        ? '今日の復習はありません'
                        : 'この日の復習予定はありません'
                    : '表示できる問題がありません'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map(q => {
                  const review = reviews[q.id] ?? defaultReview(q.id)
                  const isEditing = editingId === q.id

                  return (
                    <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="p-3.5">
                        {/* Meta */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">{q.chapterName} 問{q.number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_BG[review.status]}`}>
                            {review.status}
                          </span>
                          {'difficulty' in q && (
                            <span className="text-xs text-gray-300">{'★'.repeat(q.difficulty as number)}</span>
                          )}
                        </div>

                        {/* Title */}
                        <p className="text-sm font-medium text-gray-800 leading-snug">{q.title}</p>

                        {/* 日付ステータス（ラベル付き） */}
                        {review.status === '未着手' ? (
                          <p className="text-xs text-gray-300 mt-1.5">未学習 · A / B / C で今日の理解度を記録</p>
                        ) : (
                          <div className="flex items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs flex-wrap">
                            {review.last_reviewed && (
                              <span className="text-gray-400">
                                学習日 <span className="text-gray-600 font-medium">{formatMD(review.last_reviewed)}</span>
                              </span>
                            )}
                            {review.due_date && (
                              <span className="flex items-center gap-1">
                                <span className="text-gray-300">/</span>
                                <span className="text-gray-400">次回復習</span>
                                <span className={`font-medium ${dueColorClass(review.due_date)}`}>
                                  {formatMD(review.due_date)}（{formatDue(review.due_date)}）
                                </span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Tags */}
                        {review.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {review.tags.map(t => (
                              <span key={t} className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Memo preview */}
                        {review.memo && !isEditing && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{review.memo}</p>
                        )}

                        {/* 理解度の記録（A/B/Cを押した日が実施日として記録される）*/}
                        {/* 記録済みでも押した状態にはしない（最初からタップして見える紛らわしさを解消）。
                            記録した理解度は上部のステータスバッジと履歴で確認できる。 */}
                        <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
                          {(['A', 'B', 'C'] as Status[]).map(s => (
                            <button key={s}
                              onClick={() => updateStatus(q.id, s)}
                              title={STATUS_LABEL[s]}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600 transition-all"
                            >{s}</button>
                          ))}
                          {hasKnownAsset(q.id) && (
                            <button
                              onClick={() => setViewerQ({ id: q.id, title: `${q.chapterName} 問${q.number}　${q.title}` })}
                              className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 hover:border-blue-400 px-2 py-1.5 rounded-lg transition-colors"
                            >
                              <ImageIcon size={13} /> 問題を見る
                            </button>
                          )}
                          {activeTab === 'list' && (
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingId(null)
                                } else {
                                  setEditingId(q.id)
                                  setEditMemo(review.memo)
                                }
                              }}
                              className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                            >{isEditing ? '閉じる' : 'メモ'}</button>
                          )}
                        </div>

                        {/* 実施日（通常は今日。過去に解いた分だけ日付を変更）*/}
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                          <span className="text-gray-400">実施日</span>
                          {dateOpenId === q.id ? (
                            <>
                              <input
                                type="date"
                                value={dateFor(q.id)}
                                max={todayStr}
                                autoFocus
                                onChange={e => setRecordDate(prev => ({ ...prev, [q.id]: e.target.value }))}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:border-blue-300 bg-white"
                              />
                              <button
                                onClick={() => {
                                  setRecordDate(prev => { const next = { ...prev }; delete next[q.id]; return next })
                                  setDateOpenId(null)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >今日に戻す</button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDateOpenId(q.id)}
                              title="過去に解いた日付で記録したいとき変更します"
                              className={`inline-flex items-center gap-0.5 ${
                                dateFor(q.id) === todayStr ? 'text-gray-500' : 'text-blue-600 font-medium'
                              }`}
                            >
                              {dateFor(q.id) === todayStr ? '今日' : formatMD(dateFor(q.id))}
                              <span className="text-gray-300">▾</span>
                            </button>
                          )}
                        </div>

                        {/* Edit panel（メモのみ・全問題タブ）*/}
                        {isEditing && activeTab === 'list' && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1.5">メモ</p>
                              <textarea
                                value={editMemo}
                                onChange={e => setEditMemo(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 h-24 resize-none focus:outline-none focus:border-blue-300 bg-white"
                                placeholder="公式・間違えたポイントなど..."
                              />
                            </div>
                            <button
                              onClick={() => saveDetails(q.id)}
                              className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >保存</button>
                          </div>
                        )}

                        {/* 学習履歴（初回から蓄積・✕で取り消し）*/}
                        {review.review_history.length > 0 && !isEditing && (
                          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-gray-400 mr-0.5">履歴</span>
                            {review.review_history.map((entry, idx) => {
                              const label = idx === 0 ? '初回' : `${idx}回目`
                              return (
                                <span key={idx} className="text-xs text-gray-300 inline-flex items-center">
                                  {idx > 0 && <span className="mr-1">→</span>}
                                  <span className={`${STATUS_BG[entry.status]} px-1 py-0.5 rounded inline-flex items-center gap-1`}>
                                    {label} {formatMD(entry.date)}
                                    <button
                                      onClick={() => deleteEntry(q.id, idx)}
                                      title="この記録を取り消す"
                                      className="text-gray-400 hover:text-red-500 leading-none"
                                    >×</button>
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>

      {viewerQ && (
        <ProblemViewer questionId={viewerQ.id} title={viewerQ.title} onClose={() => setViewerQ(null)} />
      )}
      {showImport && (
        <ImportPanel userId={user.id} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}

// ==============================
// DASHBOARD
// ==============================
function DashboardView({
  data, chapters, reviews, totalQ, masteredQ
}: {
  data: { counts: Record<Status, number>; pieData: any[]; scheduleData: any[] }
  chapters: Chapter[]
  reviews: Record<string, Review>
  totalQ: number
  masteredQ: number
}) {
  const pct = totalQ > 0 ? Math.round((masteredQ / totalQ) * 100) : 0

  return (
    <div className="space-y-4">

      {/* 概要カード */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'A（完全正答）', value: data.counts.A, color: 'text-green-600' },
          { label: 'B（方向性OK）', value: data.counts.B, color: 'text-blue-600' },
          { label: 'C（要学習）', value: data.counts.C, color: 'text-red-500' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* チャート行 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-500" />理解度分布
            </h3>
            <span className="text-2xl font-bold text-blue-600">{pct}%</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data.pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">今後7日間の復習予定</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.scheduleData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="問題数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 章別進捗 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">章別進捗</h3>
        <div className="space-y-2.5">
          {chapters.map(c => {
            const done = c.questions.filter(q =>
              ['A', 'B'].includes(reviews[q.id]?.status ?? '')
            ).length
            const pct = c.questions.length > 0 ? (done / c.questions.length) * 100 : 0
            const mastered = c.questions.filter(q => reviews[q.id]?.status === 'A').length

            return (
              <div key={c.code}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span className="font-medium">{c.name}</span>
                  <span>{mastered}完答 / {done}習得中 / {c.questions.length}問</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
