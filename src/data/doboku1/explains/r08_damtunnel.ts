// 令和8年度 試験問題A No.38〜41（ダム・トンネル）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A38' の形。検証は src/lib/doboku1/explain.ts。
// A39 の図は公式PDF（20260706d_mondaia.pdf p.19）で配置（Ⓐ外部・Ⓑ内部・Ⓒ構造用・Ⓓ着岩）を確認して作図。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R08_DAMTUNNEL: Explains = {
  A38: {
    explain: {
      point: '基礎掘削は「所要の強度の岩盤に着く」のが目的。計画面より上で良い岩盤が出れば、掘削線を変更してそこで止められる。',
      figures: [{
        type: 'rule',
        title: 'ダムの基礎掘削',
        rows: [
          { label: '粗掘削（計画面から3 m付近）', value: '小ベンチ発破で損傷を少なく' },
          { label: '仕上げ掘削', value: '残り50 cm程度を火薬なしで（ブレーカ・人力）' },
          { label: '断層などが出た', value: '掘削線の変更・基礎処理' },
          { label: '良い岩盤が上で出た', value: '掘削線を変更できる', trap: '必ず計画面まで掘る' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '計画面付近は小ベンチ発破で基礎の損傷を抑える。' },
        { label: '⑵', ok: false, note: '所要強度の地盤が上で現れれば掘削線を変更する。計画面に固執しない。' },
        { label: '⑶', ok: true, note: '残り50cm程度は火薬を使わずに仕上げる。' },
        { label: '⑷', ok: true, note: '堤敷外の法面は安定性・経済性・景観を考えて決める。' },
      ],
      basis: '多目的ダムの建設（ダム技術センター）、コンクリート標準示方書［ダムコンクリート編］',
    },
  },
  A39: {
    explain: {
      point: '重力式ダムは場所ごとに配合を変える。内部コンクリートに要るのは重さ・強度と発熱の小ささで、化学的侵食への抵抗性ではない。',
      figures: [
        {
          type: 'svg',
          title: '重力式コンクリートダムの配合区分（模式図）',
          alt: '重力式ダムの断面。表面の帯が外部コンクリート、中央が内部コンクリート、底面の岩盤に接する層が着岩コンクリート、監査廊や天端の周りが構造用コンクリート。',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#fff"/><path d="M10 172 L310 172" stroke="#6d6248" stroke-width="2"/><path d="M60 172 L60 20 L95 20 L250 172 Z" fill="#cfd8e3" stroke="#334" stroke-width="1.5"/><path d="M70 164 L70 34 L90 34 L228 164 Z" fill="#eef1f5" stroke="#556" stroke-dasharray="4 3"/><rect x="60" y="164" width="190" height="8" fill="#b9a77e"/><rect x="62" y="20" width="31" height="14" fill="#f2d49b" stroke="#a07a30"/><rect x="86" y="140" width="14" height="14" fill="#f2d49b" stroke="#a07a30"/><text x="120" y="120" font-size="12" fill="#222">内部</text><text x="160" y="80" font-size="12" fill="#222">外部</text><line x1="158" y1="84" x2="140" y2="96" stroke="#222"/><text x="106" y="14" font-size="12" fill="#222">構造用（天端）</text><text x="108" y="152" font-size="12" fill="#222">構造用（監査廊）</text><line x1="106" y1="148" x2="100" y2="148" stroke="#222"/><text x="150" y="190" font-size="12" fill="#222">着岩（岩盤に接する層）</text><line x1="160" y1="180" x2="160" y2="172" stroke="#222"/><text x="14" y="100" font-size="11" fill="#2a5db0">上流</text><text x="270" y="160" font-size="11" fill="#2a5db0">下流</text></svg>',
        },
        {
          type: 'compare',
          title: '配合区分と要求される品質',
          columns: ['要求される品質'],
          rows: [
            { label: '外部', cells: ['水密性・すりへり抵抗・凍結融解抵抗'] },
            { label: '内部', cells: ['単位容積質量・強度、発熱が小さく施工性が良い'] },
            { label: '構造用', cells: ['RCとしての強度・付着・狭い所への施工性'] },
            { label: '着岩', cells: ['岩盤との付着・不陸への打ち込みやすさ'] },
          ],
        },
      ],
      checks: [
        { label: '⑴', ok: true, note: '表面は水・摩耗・凍結融解を受けるので、これらへの抵抗性が要る。' },
        { label: '⑵', ok: false, note: '内部に要るのは単位容積質量と強度。化学的侵食への抵抗性は求められない。' },
        { label: '⑶', ok: true, note: '鉄筋との付着や狭い所での施工性が要る。' },
        { label: '⑷', ok: true, note: '岩盤との付着と、凹凸のある面への打ち込みやすさが要る。' },
      ],
      basis: 'コンクリート標準示方書［ダムコンクリート編］（土木学会）',
    },
  },
  A40: {
    explain: {
      point: '地山が悪いほど「小さく分けて、早く閉じる」。ベンチは短く、全断面は地山の変化に弱く、中壁分割は大断面向け。',
      figures: [{
        type: 'compare',
        title: '山岳トンネルの掘削工法',
        columns: ['向く地山・断面', '特徴'],
        rows: [
          { label: '全断面', cells: ['安定した地山', '地山の変化への順応性は低い'] },
          { label: 'ベンチカット', cells: ['一般的な地山', '不良地山ではベンチを短く'] },
          { label: '中壁分割', cells: ['大断面・不良地山', '左右を分けて掘る'] },
          { label: '導坑先進', cells: ['地質確認・水抜きが要るとき', '頂設・中央・底設などがある'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '断面内の導坑で前方の地質確認や水抜きができる。' },
        { label: '⑵', ok: false, note: '全断面工法は地山条件の変化への順応性が低い。' },
        { label: '⑶', ok: false, note: '中壁分割工法は大断面の掘削に多く用いる。' },
        { label: '⑷', ok: false, note: '地山が不良なときはベンチ長を短くして早く閉合する。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
  A41: {
    explain: {
      point: '覆工コンクリートは、吹付けとロックボルトで地山が落ち着いた（内空変位が収束した）後に打ち込むのが原則。',
      figures: [{
        type: 'flow',
        title: '山岳トンネルの施工順序',
        steps: ['掘削', '支保工（吹付け・ロックボルト・鋼製支保工）', '計測：内空変位の収束を確認', '覆工コンクリートの打込み', '養生・脱型'],
        branches: [
          { from: 1, label: '収束前に覆工', to: '原則として誤り', bad: true },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '覆工は内空変位が収束した後に打ち込むのが原則。収束前ではない。' },
        { label: '⑵', ok: true, note: 'ワーカビリティーが落ちないうちに上下層を一体に締め固める。' },
        { label: '⑶', ok: true, note: '自重などに耐える強度に達してから型枠を外す。' },
        { label: '⑷', ok: true, note: '温度・湿度を保ち、有害な作用から守って養生する。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
}
