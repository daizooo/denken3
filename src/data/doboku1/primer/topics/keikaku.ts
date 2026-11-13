// 入門6: 施工計画（事前調査・仮設・建設機械の選定と組合せ）。Claude 作成・根拠未確認。
import type { D1PrimerTopic } from '../types.ts'

export const KEIKAKU: D1PrimerTopic = {
  id: 'keikaku',
  name: '施工計画',
  sections: [
    {
      heading: '施工計画の基本姿勢',
      figures: [
        {
          kind: 'flow',
          caption: '複数案から選ぶ流れ',
          steps: [
            { label: '複数案を立てる', sub: '新しい工法・技術も含む' },
            { label: '比較検討する', sub: '工期内で安全・確実・経済的か\n外部の意見も聞く' },
            { label: '案を選ぶ', sub: '設計図書にない施工方法は\n受注者の責任で決める' },
          ],
        },
      ],
      body: [
        '設計図書に定めのない施工方法（仮設・工法・手順）は、受注者が自分の責任で決める（自主施工の原則）。',
        '過去の実績にとらわれず、新しい工法・技術も含めて複数の案を比べ、工期内で安全・確実・経済的な案を選ぶ。社内だけでなく外部の意見も聞く。',
      ],
    },
    {
      heading: '事前調査：契約条件と現場条件',
      body: ['どちらの調査項目かの入替えがよく出る。'],
      table: {
        columns: ['区分', '主な項目'],
        rows: [
          ['契約条件', '請負代金・工期・支払条件、設計図書の内容と数量、不可抗力や設計変更の扱い'],
          ['現場条件', '地形・地質・地下水・気象、用地・近隣の状況、交通、地下埋設物・架空線、電力・用水'],
        ],
      },
    },
    {
      heading: '仮設：指定仮設と任意仮設',
      body: [],
      table: {
        columns: ['区分', '内容', '契約上の扱い'],
        rows: [
          ['指定仮設', '発注者が設計図書で構造・方法を指定する仮設', '変更が必要なら発注者の承諾が要り、設計変更の対象になる'],
          ['任意仮設', '受注者が自分で計画する仮設', '受注者の裁量。原則として設計変更の対象にならない'],
        ],
      },
    },
    {
      heading: '建設機械の選定',
      figures: [
        {
          kind: 'draw',
          caption: '運搬距離による土工機械の選び方（目安）',
          width: 400,
          height: 214,
          shapes: [
            { t: 'text', x: 8, y: 16, s: '運搬距離（m）と土工機械の目安', anchor: 'start', bold: true },
            { t: 'line', x1: 216.9, y1: 26, x2: 216.9, y2: 168, stroke: 'gray', dash: true },
            { t: 'line', x1: 250, y1: 26, x2: 250, y2: 168, stroke: 'gray', dash: true },
            { t: 'line', x1: 326.9, y1: 26, x2: 326.9, y2: 168, stroke: 'gray', dash: true },
            { t: 'line', x1: 360, y1: 26, x2: 360, y2: 168, stroke: 'gray', dash: true },
            { t: 'text', x: 8, y: 46, s: 'ブルドーザ', anchor: 'start' },
            { t: 'rect', x: 140, y: 32, w: 85.6, h: 20, fill: 'concrete', stroke: 'steel' },
            { t: 'text', x: 182.8, y: 46, s: '60以下', color: 'gray' },
            { t: 'text', x: 8, y: 73, s: 'スクレープドーザ', anchor: 'start' },
            { t: 'rect', x: 206.2, y: 59, w: 87.5, h: 20, fill: 'concrete', stroke: 'steel' },
            { t: 'text', x: 250, y: 73, s: '40〜250', color: 'gray' },
            { t: 'text', x: 8, y: 100, s: '被けん引式スクレーパ', anchor: 'start' },
            { t: 'rect', x: 225.6, y: 86, w: 90.6, h: 20, fill: 'concrete', stroke: 'steel' },
            { t: 'text', x: 270.9, y: 100, s: '60〜400', color: 'gray' },
            { t: 'text', x: 8, y: 127, s: '自走式スクレーパ', anchor: 'start' },
            { t: 'rect', x: 283.1, y: 113, w: 85.6, h: 20, fill: 'concrete', stroke: 'steel' },
            { t: 'text', x: 325.9, y: 127, s: '200〜1,200', color: 'gray' },
            { t: 'text', x: 8, y: 154, s: 'ショベル系＋ダンプ', anchor: 'start' },
            { t: 'rect', x: 250, y: 140, w: 143.1, h: 20, fill: 'concrete', stroke: 'steel' },
            { t: 'text', x: 321.6, y: 154, s: '100以上', color: 'gray' },
            { t: 'line', x1: 140, y1: 168, x2: 392, y2: 168, stroke: 'gray' },
            { t: 'text', x: 216.9, y: 184, s: '50' },
            { t: 'text', x: 250, y: 184, s: '100' },
            { t: 'text', x: 326.9, y: 184, s: '500' },
            { t: 'text', x: 360, y: 184, s: '1,000' },
            { t: 'text', x: 134, y: 184, s: '(m)', anchor: 'end', color: 'gray' },
            { t: 'text', x: 8, y: 206, s: '横軸は対数目盛。ブルドーザは左端から、ショベル系＋ダンプは右へ続く', anchor: 'start', color: 'gray' },
          ],
        },
        {
          kind: 'flow',
          caption: '走行に必要なコーン指数の目安（kN/m²）：軟らかい地盤 → 硬い地盤',
          steps: [
            { label: '湿地ブルドーザ', sub: '300 以上' },
            { label: '普通ブルドーザ', sub: '21t級\n700 以上' },
            { label: '自走式スクレーパ', sub: '小型\n1,000 以上' },
            { label: 'ダンプトラック', sub: '1,200 以上' },
          ],
        },
      ],
      body: [
        '地盤の軟らかさ（コーン指数 qc）で走行できる機械が決まる。軟らかい地盤ほど接地圧の小さい機械が必要。',
        '運搬距離で土工機械を選ぶ（目安）：ブルドーザ 60m以下、スクレープドーザ 40〜250m、被けん引式スクレーパ 60〜400m、自走式スクレーパ 200〜1,200m、ショベル系＋ダンプトラック 100m以上。',
      ],
      table: {
        columns: ['機械', '必要なコーン指数（目安 kN/m²）'],
        rows: [
          ['湿地ブルドーザ', '300 以上'],
          ['普通ブルドーザ（21t級）', '700 以上'],
          ['自走式スクレーパ（小型）', '1,000 以上'],
          ['ダンプトラック', '1,200 以上'],
        ],
      },
    },
    {
      heading: '機械の組合せ',
      figures: [
        {
          kind: 'draw',
          caption: '組み合わせた機械全体の能力は、もっとも能力の小さい機械で決まる',
          width: 400,
          height: 190,
          shapes: [
            { t: 'text', x: 8, y: 16, s: '例：各機械の作業能力（m³/h）', anchor: 'start', bold: true },
            { t: 'line', x1: 30, y1: 160, x2: 260, y2: 160, stroke: 'gray' },
            { t: 'rect', x: 20, y: 60, w: 40, h: 100, fill: 'concrete', stroke: 'steel' },
            { t: 'text', x: 40, y: 54, s: '50', bold: true },
            { t: 'text', x: 40, y: 178, s: '掘削' },
            { t: 'rect', x: 100, y: 80, w: 40, h: 80, fill: 'accent', stroke: 'steel' },
            { t: 'text', x: 120, y: 74, s: '40', bold: true },
            { t: 'text', x: 120, y: 178, s: '運搬' },
            { t: 'rect', x: 180, y: 40, w: 40, h: 120, fill: 'concrete', stroke: 'steel' },
            { t: 'text', x: 200, y: 34, s: '60', bold: true },
            { t: 'text', x: 200, y: 178, s: '締固め' },
            { t: 'line', x1: 30, y1: 80, x2: 380, y2: 80, stroke: 'warn', dash: true },
            { t: 'text', x: 272, y: 72, s: '全体の能力 ＝ 40', anchor: 'start', color: 'warn', bold: true },
            { t: 'text', x: 272, y: 96, s: '（最小の機械で決まる）', anchor: 'start', color: 'warn' },
          ],
        },
      ],
      body: [
        '組み合わせた機械全体の作業能力は、もっとも能力の小さい機械で決まる。',
        '主作業（例：掘削）の能力を十分に発揮させるため、従作業（例：運搬）の機械の能力は主作業より少し大きめにする。',
      ],
    },
  ],
  quizzes: [
    {
      title: '複数案の比較',
      statement: '施工計画の立案では、過去の実績にとらわれず、新しい工法・技術も含めて複数の案を比較検討する。',
      answer: true,
      explain: '経験だけに頼らず、複数案を比べて安全・確実・経済的な案を選ぶのが基本。',
    },
    {
      title: '指定仮設',
      statement: '指定仮設は受注者の裁量で自由に変更でき、原則として設計変更の対象にならない。',
      answer: false,
      explain: 'これは任意仮設の説明。指定仮設は発注者が指定するもので、変更には発注者の承諾が要り、設計変更の対象になる。',
    },
    {
      title: '組合せの作業能力',
      statement: '組み合わせた建設機械全体の作業能力は、もっとも能力の大きい機械で決まる。',
      answer: false,
      explain: 'もっとも能力の小さい機械が全体のボトルネックになり、その能力で決まる。',
    },
    {
      title: '従作業の能力',
      statement: '機械を組み合わせるときは、従作業の機械の能力を主作業の機械の能力より少し大きめにする。',
      answer: true,
      explain: '主作業の機械が待たされないようにするため。',
    },
    {
      title: 'ダンプトラックのコーン指数',
      statement: 'ダンプトラックが走行するのに必要なコーン指数は、湿地ブルドーザより小さい。',
      answer: false,
      explain: 'ダンプトラックはタイヤで接地圧が大きく、目安 1,200 以上が必要。湿地ブルドーザは 300 以上で、より軟らかい地盤を走れる。',
    },
    {
      title: '短距離の運搬',
      statement: '運搬距離が60m以下の短い土工には、ブルドーザが適している。',
      answer: true,
      explain: 'ブルドーザは掘削と押し運搬を1台でこなし、60m以下の短距離に向く。長くなるとスクレーパやダンプトラックを使う。',
    },
    {
      title: '契約条件の調査',
      statement: '事前調査のうち契約条件の調査には、近隣の状況や地下埋設物の確認が含まれる。',
      answer: false,
      explain: '近隣の状況・地下埋設物は現場条件。契約条件は工期・請負代金・設計図書の内容など。',
    },
  ],
  basis: '公共工事標準請負契約約款（仮設・施工方法等は受注者が定める旨）、日本道路協会「道路土工要綱」（運搬距離と機械、コーン指数の目安）',
}
