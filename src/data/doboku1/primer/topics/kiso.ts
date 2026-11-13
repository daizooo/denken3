// 入門8: 基礎（土質・構造力学・水理）。令和6年度から問題Aの冒頭5問が必須。Claude 作成・根拠未確認。
import type { D1PrimerTopic } from '../types.ts'

export const KISO: D1PrimerTopic = {
  id: 'kiso',
  name: '基礎（土質・力学・水理）',
  sections: [
    {
      heading: '粘性土と砂質土の違い',
      body: ['土質の問題の多くは、この表の性質を入れ替えた誤りで作られる。'],
      table: {
        columns: ['性質', '粘性土', '砂質土'],
        rows: [
          ['水の通しやすさ（透水性）', '小さい', '大きい'],
          ['圧密沈下', '起こり、長期間続く', 'ほとんど問題にならない（すぐ終わる）'],
          ['強さの主な要素', '粘着力 c', '内部摩擦角 φ'],
          ['液状化', '起きにくい', '緩く、水で飽和した砂で起きやすい'],
        ],
      },
    },
    {
      heading: '土の強さ',
      figures: [
        {
          kind: 'draw',
          caption: 'クーロンの式：τ ＝ c ＋ σ tanφ（c は縦軸との交点、φ は直線の傾き角）',
          width: 400,
          height: 235,
          shapes: [
            { t: 'line', x1: 60, y1: 180, x2: 385, y2: 180, arrow: true },
            { t: 'line', x1: 60, y1: 180, x2: 60, y2: 20, arrow: true },
            { t: 'line', x1: 60, y1: 120, x2: 340, y2: 50, stroke: 'steel', width: 2.5 },
            { t: 'line', x1: 60, y1: 120, x2: 340, y2: 120, dash: true },
            { t: 'line', x1: 44, y1: 180, x2: 44, y2: 120, both: true, stroke: 'accent' },
            { t: 'text', x: 36, y: 154, s: 'c', anchor: 'end', bold: true, color: 'accent' },
            { t: 'text', x: 175, y: 113, s: 'φ', bold: true, color: 'accent' },
            { t: 'line', x1: 220, y1: 80, x2: 220, y2: 180, dash: true },
            { t: 'circle', cx: 220, cy: 80, r: 4, fill: 'warn', stroke: 'warn' },
            { t: 'text', x: 228, y: 72, s: 'τ', anchor: 'start', bold: true },
            { t: 'text', x: 220, y: 198, s: 'σ' },
            { t: 'text', x: 52, y: 16, s: 'τ（せん断強さ）', anchor: 'start' },
            { t: 'text', x: 385, y: 198, s: 'σ（垂直応力）', anchor: 'end' },
            { t: 'text', x: 200, y: 224, s: 'τ ＝ c ＋ σ tanφ', bold: true, size: 13 },
          ],
        },
      ],
      body: [
        'せん断強さ τ ＝ c ＋ σ tanφ（クーロンの式）。c は粘着力、σ は面に働く垂直応力、φ は内部摩擦角。',
        '粘性土の一軸圧縮試験で一軸圧縮強さ qu を求めると、φ＝0 とみなせる場合の粘着力は c ＝ qu ÷ 2。',
      ],
    },
    {
      heading: '構造力学：つり合いと曲げモーメント',
      figures: [
        {
          kind: 'draw',
          caption: '単純ばり・中央に集中荷重 P：反力は P/2 ずつ、中央で最大 PL/4',
          width: 400,
          height: 270,
          shapes: [
            { t: 'line', x1: 60, y1: 70, x2: 340, y2: 70, stroke: 'steel', width: 4 },
            { t: 'poly', points: [[60, 74], [49, 92], [71, 92]], fill: 'concrete' },
            { t: 'poly', points: [[340, 74], [329, 92], [351, 92]], fill: 'concrete' },
            { t: 'line', x1: 200, y1: 22, x2: 200, y2: 66, arrow: true, stroke: 'warn', width: 2 },
            { t: 'text', x: 212, y: 36, s: 'P', anchor: 'start', bold: true, color: 'warn' },
            { t: 'line', x1: 60, y1: 128, x2: 60, y2: 96, arrow: true, stroke: 'accent', width: 2 },
            { t: 'line', x1: 340, y1: 128, x2: 340, y2: 96, arrow: true, stroke: 'accent', width: 2 },
            { t: 'text', x: 60, y: 146, s: 'P/2', bold: true, color: 'accent' },
            { t: 'text', x: 340, y: 146, s: 'P/2', bold: true, color: 'accent' },
            { t: 'line', x1: 60, y1: 165, x2: 340, y2: 165, both: true },
            { t: 'text', x: 200, y: 183, s: '支間 L' },
            { t: 'text', x: 60, y: 208, s: '曲げモーメント図', anchor: 'start' },
            { t: 'poly', points: [[60, 215], [340, 215], [200, 250]], fill: 'water' },
            { t: 'text', x: 200, y: 266, s: '中央で最大 M ＝ P/2 × L/2 ＝ PL/4', bold: true },
          ],
        },
      ],
      body: [
        '静止している構造物では、水平方向の力の和＝0、鉛直方向の力の和＝0、ある点まわりのモーメントの和＝0 が成り立つ。これで支点の反力を求める。',
      ],
      table: {
        columns: ['はり・荷重', '最大曲げモーメント', '生じる位置'],
        rows: [
          ['単純ばり（支間 L）・中央に集中荷重 P', 'PL/4', '中央'],
          ['単純ばり（支間 L）・全体に等分布荷重 w', 'wL²/8', '中央'],
          ['片持ばり（長さ L）・先端に集中荷重 P', 'PL', '固定端'],
        ],
      },
    },
    {
      heading: '水理：静水圧と流れ',
      figures: [
        {
          kind: 'draw',
          caption: '静水圧は水深に比例し、壁に垂直に働く（三角形に分布）',
          width: 400,
          height: 210,
          shapes: [
            { t: 'rect', x: 40, y: 40, w: 160, h: 140, fill: 'water' },
            { t: 'rect', x: 200, y: 40, w: 24, h: 140, fill: 'concrete' },
            { t: 'rect', x: 20, y: 180, w: 240, h: 14, fill: 'soil' },
            { t: 'poly', points: [[200, 40], [200, 180], [74, 180]], stroke: 'warn', dash: true },
            { t: 'line', x1: 173, y1: 70, x2: 198, y2: 70, arrow: true, stroke: 'warn' },
            { t: 'line', x1: 146, y1: 100, x2: 198, y2: 100, arrow: true, stroke: 'warn' },
            { t: 'line', x1: 119, y1: 130, x2: 198, y2: 130, arrow: true, stroke: 'warn' },
            { t: 'line', x1: 92, y1: 160, x2: 198, y2: 160, arrow: true, stroke: 'warn' },
            { t: 'text', x: 90, y: 58, s: '水深に比例して' },
            { t: 'text', x: 90, y: 74, s: '大きくなる' },
            { t: 'line', x1: 252, y1: 40, x2: 252, y2: 180, both: true },
            { t: 'text', x: 260, y: 114, s: '水深 h', anchor: 'start' },
            { t: 'text', x: 335, y: 60, s: 'p ＝ ρgh', bold: true, size: 13 },
          ],
        },
        {
          kind: 'draw',
          caption: '連続の式 Q ＝ A × v：流量が一定なら、断面積が小さいところほど流速は大きい',
          width: 400,
          height: 185,
          shapes: [
            { t: 'poly', points: [[30, 50], [150, 50], [210, 75], [370, 75], [370, 105], [210, 105], [150, 130], [30, 130]], fill: 'water' },
            { t: 'line', x1: 60, y1: 90, x2: 100, y2: 90, arrow: true, stroke: 'accent', width: 2 },
            { t: 'line', x1: 240, y1: 90, x2: 340, y2: 90, arrow: true, stroke: 'accent', width: 2 },
            { t: 'text', x: 90, y: 40, s: '断面積 A 大' },
            { t: 'text', x: 290, y: 65, s: '断面積 A 小' },
            { t: 'text', x: 90, y: 152, s: '流速 v 小' },
            { t: 'text', x: 290, y: 127, s: '流速 v 大' },
            { t: 'text', x: 200, y: 176, s: 'Q（流量）は一定', bold: true },
          ],
        },
      ],
      body: [
        '静水圧 p ＝ ρgh：水深 h に比例し、面に垂直に働く。同じ深さならどの向きにも同じ大きさ。',
        '連続の式 Q ＝ A × v：流量 Q が一定なら、断面積 A が小さいところほど流速 v は大きい。',
        'ベルヌーイの定理：位置水頭＋圧力水頭＋速度水頭＝一定（損失を無視した場合）。',
        'マニングの式 v ＝（1/n）R^(2/3) I^(1/2)：n は粗度係数（大きいほど流れにくい）、R は径深（断面積÷潤辺）、I は勾配。',
      ],
    },
  ],
  quizzes: [
    {
      title: '粘性土の性質',
      statement: '粘性土は砂質土に比べて透水性が小さく、圧密沈下が長期間にわたって続く。',
      answer: true,
      explain: '水が抜けにくいので、荷重をかけてから沈下が終わるまで時間がかかる。',
    },
    {
      title: '液状化',
      statement: '液状化は、締まった粘性土の地盤で起きやすい。',
      answer: false,
      explain: '液状化は、緩く、水で飽和した砂質土で起きやすい。粘性土は起きにくい。',
    },
    {
      title: '一軸圧縮強さと粘着力',
      statement: '一軸圧縮強さ qu の粘性土（φ＝0 とみなせる）の粘着力 c は 2qu である。',
      answer: false,
      explain: 'c ＝ qu ÷ 2。一軸圧縮強さの半分が粘着力。',
    },
    {
      title: '単純ばりの曲げモーメント',
      statement: '支間 L の単純ばりの中央に集中荷重 P が作用するとき、最大曲げモーメントは PL/4 で、中央に生じる。',
      answer: true,
      explain: '反力は両支点とも P/2。中央の曲げモーメントは P/2 × L/2 ＝ PL/4。',
    },
    {
      title: '静水圧',
      statement: '静水圧は水深に比例して大きくなり、壁などの面に垂直に作用する。',
      answer: true,
      explain: 'p ＝ ρgh。同じ深さではどの向きにも同じ大きさで、面に垂直に働く。',
    },
    {
      title: '連続の式',
      statement: '一定の流量が流れる管で、断面積が半分になると流速も半分になる。',
      answer: false,
      explain: 'Q ＝ A × v で Q が一定なので、A が半分なら v は2倍になる。',
    },
    {
      title: 'マニングの式',
      statement: 'マニングの式では、粗度係数 n が大きいほど流速は大きくなる。',
      answer: false,
      explain: 'v ＝（1/n）R^(2/3) I^(1/2) で、n は分母。n が大きい（ざらざらで流れにくい）ほど流速は小さい。',
    },
  ],
  basis: '地盤工学会「土質試験の方法と解説」、構造力学・水理学の基本式（一般的な教科書の内容）',
}
