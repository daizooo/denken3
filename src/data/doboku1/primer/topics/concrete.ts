// 入門2: コンクリート（材料と配合・フレッシュ性状・施工の時間・養生・劣化）。Claude 作成・根拠未確認。
import type { D1PrimerTopic } from '../types.ts'

export const CONCRETE: D1PrimerTopic = {
  id: 'concrete',
  name: 'コンクリート',
  sections: [
    {
      heading: '材料と配合',
      figures: [
        {
          kind: 'flow',
          caption: '水セメント比の求め方',
          steps: [
            { label: '水の質量 W', next: '÷' },
            { label: 'セメントの質量 C', next: '＝' },
            { label: '水セメント比 W/C' },
          ],
        },
        {
          kind: 'sides',
          caption: '水が少ないか、多いか',
          left: { title: '水セメント比が小さい（水が少ない）', items: ['強度が高い', '耐久性が高い（水密性・中性化への抵抗）'] },
          right: { title: '単位水量が多い', items: ['乾燥収縮が増える', 'ひび割れが増える', 'ブリーディングが増える'] },
        },
      ],
      body: [
        'コンクリート ＝ セメント＋水＋細骨材（砂）＋粗骨材（砂利）＋混和材料。セメントと水が反応（水和）して固まる。',
        '水セメント比（W/C）＝ 水の質量 ÷ セメントの質量。小さいほど強度・耐久性（水密性・中性化への抵抗）が高い。',
        '単位水量（1m³あたりの水）はできるだけ少なくする。多いと乾燥収縮・ひび割れ・ブリーディングが増える（上限は175kg/m³が標準）。',
      ],
    },
    {
      heading: 'まだ固まらないコンクリートの用語',
      figures: [
        {
          kind: 'draw',
          caption: '打込み後のブリーディングとレイタンス（イメージ）',
          width: 400,
          height: 200,
          shapes: [
            { t: 'rect', x: 120, y: 60, w: 160, h: 12, fill: 'water' },
            { t: 'rect', x: 120, y: 72, w: 160, h: 10, fill: 'white', stroke: 'gray' },
            { t: 'rect', x: 120, y: 82, w: 160, h: 98, fill: 'concrete', stroke: 'gray' },
            { t: 'line', x1: 120, y1: 40, x2: 120, y2: 180, stroke: 'steel', width: 3 },
            { t: 'line', x1: 280, y1: 40, x2: 280, y2: 180, stroke: 'steel', width: 3 },
            { t: 'line', x1: 160, y1: 150, x2: 160, y2: 95, stroke: 'accent', arrow: true },
            { t: 'line', x1: 200, y1: 150, x2: 200, y2: 95, stroke: 'accent', arrow: true },
            { t: 'line', x1: 240, y1: 150, x2: 240, y2: 95, stroke: 'accent', arrow: true },
            { t: 'text', x: 200, y: 170, s: '重い材料が沈む', anchor: 'middle' },
            { t: 'text', x: 110, y: 68, s: 'ブリーディング水', anchor: 'end' },
            { t: 'text', x: 110, y: 88, s: 'レイタンス', anchor: 'end', bold: true },
            { t: 'text', x: 110, y: 101, s: '（弱い膜）', anchor: 'end' },
            { t: 'text', x: 290, y: 90, s: '← 打継ぎ前に除去', anchor: 'start' },
          ],
        },
      ],
      body: [],
      table: {
        columns: ['用語', '意味'],
        rows: [
          ['スランプ', 'スランプコーンを抜いたときの下がり量（cm）。大きいほど軟らかい'],
          ['空気量', 'AE剤で入れる微細な気泡の割合（一般に4.5%程度）。凍結融解への抵抗性を高める'],
          ['ブリーディング', '打込み後、重い材料が沈み、水が上面に浮き上がる現象'],
          ['レイタンス', 'ブリーディングで上面にできる弱い膜。打継ぎ前に取り除く'],
          ['コールドジョイント', '先に打った層が固まり始めてから次を打ち、一体にならなかった継目'],
        ],
      },
    },
    {
      heading: '施工の「時間」と「高さ」',
      figures: [
        {
          kind: 'draw',
          caption: '打込みの高さと振動機（縮尺なし）',
          width: 400,
          height: 210,
          shapes: [
            { t: 'rect', x: 120, y: 110, w: 160, h: 40, fill: 'concrete', stroke: 'gray' },
            { t: 'rect', x: 120, y: 150, w: 160, h: 50, fill: 'concrete', stroke: 'gray' },
            { t: 'line', x1: 120, y1: 150, x2: 280, y2: 150, stroke: 'gray', dash: true },
            { t: 'line', x1: 120, y1: 60, x2: 120, y2: 200, stroke: 'steel', width: 3 },
            { t: 'line', x1: 280, y1: 60, x2: 280, y2: 200, stroke: 'steel', width: 3 },
            { t: 'rect', x: 150, y: 12, w: 14, h: 28, fill: 'steel' },
            { t: 'line', x1: 157, y1: 42, x2: 157, y2: 105, stroke: 'accent', arrow: true },
            { t: 'text', x: 172, y: 28, s: 'シュート等の吐出口', anchor: 'start' },
            { t: 'line', x1: 105, y1: 40, x2: 105, y2: 110, stroke: 'accent', both: true },
            { t: 'text', x: 98, y: 70, s: '1.5m以下', anchor: 'end', bold: true },
            { t: 'rect', x: 218, y: 55, w: 8, h: 105, fill: 'steel' },
            { t: 'text', x: 222, y: 46, s: '内部振動機', anchor: 'middle' },
            { t: 'line', x1: 296, y1: 110, x2: 296, y2: 150, stroke: 'accent', both: true },
            { t: 'text', x: 304, y: 126, s: '1層の高さ', anchor: 'start', bold: true },
            { t: 'text', x: 304, y: 142, s: '40〜50cm以下', anchor: 'start', bold: true },
            { t: 'text', x: 304, y: 172, s: '下層に10cm', anchor: 'start' },
            { t: 'text', x: 304, y: 187, s: '程度差し込む', anchor: 'start' },
            { t: 'text', x: 130, y: 176, s: '下層', anchor: 'start' },
            { t: 'text', x: 130, y: 132, s: '新しい層', anchor: 'start' },
          ],
        },
        {
          kind: 'grid',
          caption: '時間の標準（外気温で変わる）',
          groups: [
            { title: '', cols: ['区間'] },
            { title: '外気温', cols: ['25℃以下', '25℃超'] },
          ],
          rows: [
            ['練混ぜ〜打終わり', '2時間以内', '1.5時間以内'],
            ['打重ねまで', '2.5時間', '2.0時間'],
          ],
        },
      ],
      body: [
        '練り混ぜてから打ち終わるまで：外気温25℃以下で2時間以内、25℃を超えるときは1.5時間以内。',
        '打重ね（下層の上に次の層を打つ）までの許容時間：外気温25℃以下で2.5時間、25℃超で2.0時間が標準。',
        '1層の打込み高さは40〜50cm以下。シュート等の吐出口から打込み面までの高さは1.5m以下（材料分離を防ぐ）。',
        '内部振動機は下層に10cm程度差し込み、挿入間隔は50cm以下。引き抜きはゆっくり。横流しに使わない。',
      ],
    },
    {
      heading: '養生と、気温による特別な配慮',
      figures: [
        {
          kind: 'draw',
          caption: '湿潤養生期間の標準（日平均気温15℃以上）',
          width: 400,
          height: 130,
          shapes: [
            { t: 'text', x: 10, y: 28, s: '早強ポルトランドセメント', anchor: 'start' },
            { t: 'rect', x: 190, y: 14, w: 60, h: 20, fill: 'water' },
            { t: 'text', x: 258, y: 29, s: '3日', anchor: 'start', bold: true },
            { t: 'text', x: 10, y: 68, s: '普通ポルトランドセメント', anchor: 'start' },
            { t: 'rect', x: 190, y: 54, w: 100, h: 20, fill: 'water' },
            { t: 'text', x: 298, y: 69, s: '5日', anchor: 'start', bold: true },
            { t: 'text', x: 10, y: 108, s: '混合セメントB種', anchor: 'start' },
            { t: 'rect', x: 190, y: 94, w: 140, h: 20, fill: 'water' },
            { t: 'text', x: 338, y: 109, s: '7日', anchor: 'start', bold: true },
          ],
        },
      ],
      body: [
        '打込み後は湿潤に保ち、急な乾燥・温度変化・振動から守る。湿潤養生期間の標準（日平均気温15℃以上）：普通ポルトランドセメント5日、早強ポルトランドセメント3日、混合セメントB種7日。',
        '暑中コンクリート：日平均気温25℃を超えるとき。寒中コンクリート：日平均気温4℃以下になるおそれがあるとき。',
      ],
    },
    {
      heading: '劣化の種類',
      body: [],
      table: {
        columns: ['劣化', '原因', '起こること'],
        rows: [
          ['中性化', '空気中の二酸化炭素', 'アルカリ性が失われ、中の鉄筋がさびる'],
          ['塩害', '塩化物イオン（海水・凍結防止剤）', '鉄筋の腐食・膨張でひび割れ'],
          ['アルカリシリカ反応（ASR）', '骨材とセメントのアルカリの反応', '骨材が膨張し、亀甲状のひび割れ'],
          ['凍害', '内部の水の凍結・融解の繰返し', '表面のはく離・崩れ'],
        ],
      },
    },
  ],
  quizzes: [
    {
      title: '水セメント比と強度',
      statement: '水セメント比を小さくすると、一般にコンクリートの強度と耐久性は低下する。',
      answer: false,
      explain: '水セメント比が小さい（水が少ない）ほど、強度・耐久性は高くなる。',
    },
    {
      title: 'レイタンス',
      statement: 'ブリーディングによってコンクリート上面にできる弱い膜をレイタンスといい、打継ぎの前に取り除く。',
      answer: true,
      explain: 'レイタンスを残したまま打ち継ぐと、新旧のコンクリートが一体にならない。ワイヤブラシや高圧水で除去する。',
    },
    {
      title: '練混ぜから打終わりまで',
      statement: '練混ぜから打ち終わるまでの時間は、外気温が25℃以下のとき2時間以内を標準とする。',
      answer: true,
      explain: '25℃以下で2時間以内、25℃を超えるときは1.5時間以内。暑いほど早く固まり始めるため短くなる。',
    },
    {
      title: '内部振動機',
      statement: '内部振動機は、下層のコンクリートを乱さないよう、下層には差し込まずに使う。',
      answer: false,
      explain: '上下の層を一体にするため、下層に10cm程度差し込む。差し込まないとコールドジョイントの原因になる。',
    },
    {
      title: '寒中コンクリート',
      statement: '日平均気温が4℃以下になるおそれがあるときは、寒中コンクリートとして施工する。',
      answer: true,
      explain: '寒中コンクリートは日平均4℃以下、暑中コンクリートは日平均25℃超が目安。',
    },
    {
      title: '湿潤養生期間',
      statement: '日平均気温15℃以上のとき、普通ポルトランドセメントの湿潤養生期間は5日を標準とする。',
      answer: true,
      explain: '標準は 早強3日 ＜ 普通5日 ＜ 混合セメントB種7日。固まるのが遅いセメントほど長い。',
    },
    {
      title: 'AE剤の空気',
      statement: 'AE剤によって連行される微細な空気泡は、コンクリートの凍結融解に対する抵抗性を低下させる。',
      answer: false,
      explain: '微細な空気泡は、凍った水の膨張圧を逃がすので凍結融解への抵抗性を高める（ワーカビリティも良くなる）。',
    },
  ],
  basis: '土木学会「コンクリート標準示方書［施工編］」',
}
