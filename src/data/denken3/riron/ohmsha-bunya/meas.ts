// 電気計測（オーム社 分野別過去問・理論）
import type { MasterQuestion } from '../../../../domain/types'

export const MEAS_QUESTIONS: MasterQuestion[] = [
  { id: 'meas_1',  number: 1,  title: '測定法（R4上-A14）',                                           difficulty: 1, importance: 2, studyMode: 'memory' },
  // 問2 捨て問（測定法／ブリッジ回路）
  { id: 'meas_3',  number: 3,  title: '指示電気計器（R6上-A14）',                                     difficulty: 1, importance: 3, studyMode: 'memory' },
  { id: 'meas_4',  number: 4,  title: '指示電気計器（熱電形計器）（H7-A9）',                          difficulty: 1, importance: 3, studyMode: 'memory' },
  { id: 'meas_5',  number: 5,  title: '指示電気計器（H10-A10）',                                      difficulty: 2, importance: 3, studyMode: 'memory' },
  { id: 'meas_6',  number: 6,  title: '指示電気計器（H12-A1）',                                       difficulty: 1, importance: 3, studyMode: 'memory' },
  { id: 'meas_7',  number: 7,  title: '指示電気計器（H16-A14）',                                      difficulty: 2, importance: 3, studyMode: 'memory' },
  { id: 'meas_8',  number: 8,  title: '指示電気計器 ほか（H24-A14）',                                 difficulty: 2, importance: 3, studyMode: 'memory' },
  { id: 'meas_9',  number: 9,  title: '指示電気計器（R1-A14）',                                       difficulty: 1, importance: 2, studyMode: 'memory' },
  { id: 'meas_10', number: 10, title: '指示電気計器 ほか（H17-A13）',                                 difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_11', number: 11, title: '指示電気計器 ほか（H8-A10）',                                  difficulty: 2, importance: 2, studyMode: 'calc' },
  { id: 'meas_12', number: 12, title: '指示電気計器 ほか（H27-A14）',                                 difficulty: 2, importance: 2, studyMode: 'calc' },
  { id: 'meas_13', number: 13, title: '指示電気計器（H17-A14）',                                      difficulty: 2, importance: 1, studyMode: 'memory' },
  { id: 'meas_14', number: 14, title: 'ディジタル計器（H25-A14）',                                    difficulty: 2, importance: 2, studyMode: 'memory' },
  { id: 'meas_15', number: 15, title: 'ディジタル計器（H28-A14）',                                    difficulty: 1, importance: 2, studyMode: 'memory' },
  { id: 'meas_16', number: 16, title: 'データ変換（R4下-A14）',                                       difficulty: 1, importance: 2, studyMode: 'memory' },
  { id: 'meas_17', number: 17, title: '電圧計・倍率器（H11-A4）',                                     difficulty: 1, importance: 3, studyMode: 'calc' },
  { id: 'meas_18', number: 18, title: '電圧計・倍率器（H16-A13）',                                    difficulty: 2, importance: 2, studyMode: 'calc' },
  { id: 'meas_19', number: 19, title: '電圧計・倍率器（H24-B17）',                                    difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_20', number: 20, title: '電流計・分流器（R6上-B16）',                                   difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_21', number: 21, title: '電圧計・倍率器（R2-B16）',                                     difficulty: 2, importance: 3, studyMode: 'calc' },
  // 問22 捨て問（電圧計／ディジタル計器 ほか）
  { id: 'meas_23', number: 23, title: '電流計（回路計）（H13-A9）',                                   difficulty: 2, importance: 2, studyMode: 'calc' },
  { id: 'meas_24', number: 24, title: '指示電気計器／電流計（H21-A14）',                              difficulty: 2, importance: 2, studyMode: 'calc' },
  { id: 'meas_25', number: 25, title: '電流計・分流器（H22-A14）',                                    difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_26', number: 26, title: '電流計・分流器（R4下-B16）',                                   difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_27', number: 27, title: '電圧計・倍率器／電流計（H15-B17）',                            difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_28', number: 28, title: '指示電気計器／電圧計・倍率器／電流計・分流器（H19-B16）',      difficulty: 2, importance: 2, studyMode: 'calc' },
  // 問29 捨て問（指示電気計器／電圧計・倍率器／電流計・分流器）
  { id: 'meas_30', number: 30, title: '電流計 ほか（R3-B15）',                                        difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_31', number: 31, title: '電流計／測定誤差（H20-A14）',                                  difficulty: 1, importance: 2, studyMode: 'calc' },
  { id: 'meas_32', number: 32, title: '電圧計／測定誤差（H9-A10）',                                   difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_33', number: 33, title: '電流計／電圧計／測定誤差（H11-A10）',                          difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_34', number: 34, title: '電流計／電圧計／測定誤差（H19-A14）',                          difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_35', number: 35, title: '測定誤差／ブリッジ回路（R3-A14）',                             difficulty: 3, importance: 2, studyMode: 'calc' },
  { id: 'meas_36', number: 36, title: '測定誤差 ほか（H28-B16）',                                     difficulty: 1, importance: 3, studyMode: 'calc' },
  { id: 'meas_37', number: 37, title: '電流計／電圧計／測定誤差（R3-B16/R5下-B16）',                  difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_38', number: 38, title: '電圧計／測定誤差（H30-B18/R5上-B16）',                         difficulty: 2, importance: 3, studyMode: 'calc' },
  // 問39 捨て問（電力量計 ほか）
  { id: 'meas_40', number: 40, title: '電力計 ほか（H15-A13/R5上-A14）',                              difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_41', number: 41, title: '電力計 ほか（H26-A14）',                                       difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_42', number: 42, title: '電力計 ほか（R2-B15）',                                        difficulty: 2, importance: 3, studyMode: 'calc' },
  { id: 'meas_43', number: 43, title: '電流計／電力量計 ほか（H13-B12）',                             difficulty: 2, importance: 2, studyMode: 'calc' },
  // 問44 捨て問（指示電気計器／電力計）
  { id: 'meas_45', number: 45, title: '指示電気計器／電力量計／測定誤差（H22-B16）',                  difficulty: 3, importance: 2, studyMode: 'calc' },
  { id: 'meas_46', number: 46, title: '指示電気計器／電力計 ほか（H23-B17）',                         difficulty: 3, importance: 2, studyMode: 'memory' },
  { id: 'meas_47', number: 47, title: '電位差計 ほか（H27-B15）',                                     difficulty: 2, importance: 3, studyMode: 'calc' },
  // 問48 捨て問（電位差計 ほか）
  // 問49-51はオリジナルの捨て問リストに含まれないため収録（暫定値。要レビュー）
  { id: 'meas_49', number: 49, title: 'オシロスコープ（H12-A8）',                                     difficulty: 1, importance: 1, studyMode: 'memory' },
  { id: 'meas_50', number: 50, title: 'オシロスコープ（H25-B16）',                                    difficulty: 2, importance: 1, studyMode: 'calc' },
  { id: 'meas_51', number: 51, title: 'オシロスコープ（H20-B16）',                                    difficulty: 2, importance: 1, studyMode: 'calc' },
]
