// 電気計測（オーム社 分野別過去問・理論）
import type { MasterQuestion } from '../../../../domain/types'

export const MEAS_QUESTIONS: MasterQuestion[] = [
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
