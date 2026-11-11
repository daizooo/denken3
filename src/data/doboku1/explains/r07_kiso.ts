// 令和7年度 試験問題A No.1〜5（基礎：土質・力学・水理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A01' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const ARROW = '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#333"/></marker><marker id="r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c62828"/></marker></defs>'

// 土の三相図（体積は左、質量は右）。間隙 Vv を強調
const SOIL_PHASES = `<svg ${NS} viewBox="0 0 340 210" font-family="sans-serif" font-size="13">${ARROW}
<rect x="120" y="20" width="100" height="36" fill="#fff" stroke="#333"/><text x="170" y="43" text-anchor="middle">空気</text>
<rect x="120" y="56" width="100" height="44" fill="#bbdefb" stroke="#333"/><text x="170" y="83" text-anchor="middle">水</text>
<rect x="120" y="100" width="100" height="90" fill="#d7ccc8" stroke="#333"/><text x="170" y="150" text-anchor="middle">土粒子</text>
<text x="108" y="43" text-anchor="end">Va</text><text x="108" y="83" text-anchor="end">Vw</text><text x="108" y="150" text-anchor="end">Vs</text>
<path d="M78 22V98" stroke="#c62828" marker-start="url(#r)" marker-end="url(#r)"/><text x="72" y="64" text-anchor="end" fill="#c62828">Vv</text>
<path d="M40 22V188" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="34" y="110" text-anchor="end" font-weight="bold">V</text>
<text x="232" y="43">ma＝0</text><text x="232" y="83">mw</text><text x="232" y="150">ms</text>
<path d="M300 22V188" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="308" y="110" font-weight="bold">m</text>
<text x="170" y="206" text-anchor="middle" fill="#1565c0">ρt＝m／V　　n＝Vv／V×100</text></svg>`

// コンシステンシー限界（含水比の数直線）
const CONSISTENCY = `<svg ${NS} viewBox="0 0 340 150" font-family="sans-serif" font-size="12">${ARROW}
<path d="M20 70H325" stroke="#333" marker-end="url(#a)"/><text x="325" y="92" text-anchor="end">含水比 w →</text>
<rect x="20" y="40" width="60" height="30" fill="#efebe9"/><text x="50" y="60" text-anchor="middle">固体</text>
<rect x="80" y="40" width="70" height="30" fill="#d7ccc8"/><text x="115" y="60" text-anchor="middle">半固体</text>
<rect x="150" y="40" width="90" height="30" fill="#ffe0b2"/><text x="195" y="60" text-anchor="middle">塑性</text>
<rect x="240" y="40" width="80" height="30" fill="#bbdefb"/><text x="280" y="60" text-anchor="middle">液状</text>
<path d="M80 34V76M150 34V76M240 34V76" stroke="#c62828" stroke-width="2"/>
<text x="80" y="28" text-anchor="middle" fill="#c62828">収縮限界</text><text x="150" y="28" text-anchor="middle" fill="#c62828">塑性限界 wP</text><text x="240" y="28" text-anchor="middle" fill="#c62828">液性限界 wL</text>
<path d="M152 112H238" stroke="#1565c0" stroke-width="2" marker-start="url(#a)" marker-end="url(#a)"/>
<text x="195" y="132" text-anchor="middle" fill="#1565c0">塑性指数 IP＝wL－wP</text></svg>`

// 単純梁に L／3 点の2荷重 → 台形の曲げモーメント図
const TWO_LOADS = `<svg ${NS} viewBox="0 0 340 220" font-family="sans-serif" font-size="12">${ARROW}
<rect x="30" y="60" width="270" height="8" fill="#eee" stroke="#333"/>
<path d="M30 68L22 82H38Z" fill="#fff" stroke="#333"/><circle cx="300" cy="74" r="6" fill="#fff" stroke="#333"/>
<path d="M120 22V58" stroke="#c62828" stroke-width="2" marker-end="url(#r)"/><path d="M210 22V58" stroke="#c62828" stroke-width="2" marker-end="url(#r)"/><text x="120" y="18" text-anchor="middle" fill="#c62828">P</text><text x="210" y="18" text-anchor="middle" fill="#c62828">P</text>
<text x="75" y="98" text-anchor="middle">L／3</text><text x="165" y="98" text-anchor="middle">L／3</text><text x="255" y="98" text-anchor="middle">L／3</text>
<text x="20" y="54">反力 P</text><text x="270" y="54">反力 P</text>
<path d="M30 120H300" stroke="#333"/><path d="M30 120L120 185H210L300 120Z" fill="#c8e6c9" stroke="#2e7d32" stroke-width="2"/>
<text x="165" y="202" text-anchor="middle" fill="#2e7d32">最大 M＝P×L／3（荷重点の間は一定）</text></svg>`

// 半分満たした円管（動水半径 R＝A／S）
const HALF_PIPE = `<svg ${NS} viewBox="0 0 340 200" font-family="sans-serif" font-size="12">${ARROW}
<circle cx="110" cy="100" r="70" fill="none" stroke="#333" stroke-width="2"/>
<path d="M40 100A70 70 0 0 0 180 100Z" fill="#bbdefb" stroke="#1565c0"/>
<path d="M40 100A70 70 0 0 0 180 100" fill="none" stroke="#c62828" stroke-width="3"/>
<path d="M40 22H180" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="110" y="16" text-anchor="middle">D</text>
<text x="110" y="135" text-anchor="middle">水深 D／2</text><text x="110" y="190" text-anchor="middle" fill="#c62828">潤辺 S＝πD／2</text>
<text x="200" y="70">A＝πD²／8</text><text x="200" y="95" fill="#c62828">S＝πD／2</text><text x="200" y="120" fill="#1565c0">R＝A／S＝D／4</text>
<text x="200" y="150">Q＝A×(1／n)</text><text x="214" y="168">×R^(2／3)×I^(1／2)</text></svg>`

export const R07_KISO: Explains = {
  A01: {
    explain: {
      point: '湿潤密度は「全体の質量÷全体の体積」。間隙率は「間隙の体積÷全体の体積」。どちらも分母は全体の V。',
      figures: [{ type: 'svg', title: '土の三相図（左が体積、右が質量）', svg: SOIL_PHASES, alt: '上から空気・水・土粒子の三層。空気と水を合わせた部分が間隙 Vv。体積の合計 V、質量の合計 m。' }],
      checks: [
        { label: '⑴', ok: true, note: 'ρt＝m／V、n＝Vv／V×100。' },
        { label: '⑵', ok: false, note: 'mw／V は水だけの質量。Vw／Vv×100 は飽和度 Sr。' },
        { label: '⑶', ok: false, note: '湿潤密度は正しいが、Vw／Vv×100 は飽和度。' },
        { label: '⑷', ok: false, note: '間隙率は正しいが、湿潤密度は全体の質量 m を使う。' },
      ],
      basis: '土の基本的な物理量の定義（土質力学）',
    },
  },
  A02: {
    explain: {
      point: '含水比が増えると 固体→半固体→塑性→液状 と変わる。塑性と液状の境が液性限界、塑性と半固体の境が塑性限界、その差が塑性指数。',
      figures: [{ type: 'svg', title: 'コンシステンシー限界', svg: CONSISTENCY, alt: '含水比の数直線上に左から固体・半固体・塑性・液状。境界は収縮限界・塑性限界・液性限界。液性限界と塑性限界の差が塑性指数。' }],
      checks: [
        { label: '⑴', ok: false, note: 'イとロが逆。液状との境が液性限界。差は塑性指数。' },
        { label: '⑵', ok: false, note: 'イ・ロは正しいが、幅は液性指数ではなく塑性指数。' },
        { label: '⑶', ok: true, note: 'イ＝液性限界、ロ＝塑性限界、ハ＝塑性指数。' },
        { label: '⑷', ok: false, note: 'イとロが逆。' },
      ],
      basis: 'JIS A 1205（土の液性限界・塑性限界試験方法）',
    },
  },
  A03: {
    explain: {
      point: '集中荷重だけの単純梁のモーメント図は直線の折れ線。対称な2荷重なら両端0から荷重点まで直線で増え、荷重点の間は一定（台形）。',
      figures: [{ type: 'svg', title: 'L／3 点の2荷重と曲げモーメント図', svg: TWO_LOADS, alt: 'スパンLの単純梁の両端からL/3の点に荷重P。反力は各P。モーメント図は台形で、荷重点の間は一定値PL/3。' }],
      checks: [
        { label: '⑴', ok: false, note: '放物線は等分布荷重のときの形。集中荷重では直線になる。' },
        { label: '⑵', ok: true, note: '両端0→荷重点で PL／3、その間は一定の台形。' },
        { label: '⑶', ok: false, note: '単純梁に下向き荷重だけなら全区間正。負は張出しや固定端で出る。' },
        { label: '⑷', ok: false, note: 'モーメント図は連続して変わる。段差（階段状）はせん断力図の特徴。' },
      ],
      basis: '構造力学（単純梁の曲げモーメント）',
    },
  },
  A04: {
    explain: {
      point: '引張応力＝引張力÷断面積。直径 D の円の断面積は πD²／4 なので、σt＝P÷(πD²／4)＝4P／πD²。',
      figures: [{
        type: 'flow',
        title: '引張応力の求め方',
        steps: ['引張力 P（部材の軸方向）', '断面積 A＝πD²／4（円）', 'σt＝P／A', 'σt＝4P／πD²'],
      }],
      checks: [
        { label: '⑴', ok: false, note: '分母が πD（円周）で、面積になっていない。' },
        { label: '⑵', ok: false, note: '円周 πD で割っており、面積でも 4 倍でもない。' },
        { label: '⑶', ok: true, note: 'P÷(πD²／4)＝4P／πD²。' },
        { label: '⑷', ok: false, note: '面積を πD² としており、正しい πD²／4 の4倍になっている。' },
      ],
      basis: '材料力学（軸方向応力 σ＝P／A）',
    },
  },
  A05: {
    explain: {
      point: 'マニング式 Q＝A×(1／n)×R^(2/3)×I^(1/2)。半分満たした円管は A＝πD²／8、潤辺 S＝πD／2、径深 R＝A／S＝D／4。',
      figures: [{ type: 'svg', title: '半分満たした円管の A・S・R', svg: HALF_PIPE, alt: '内径Dの円管の下半分に水。流水断面積A=πD²/8、潤辺S=πD/2（赤い半円弧）、径深R=A/S=D/4。' }],
      checks: [
        { label: '⑴', ok: false, note: 'πD／8 は面積ではない。A は πD²／8。' },
        { label: '⑵', ok: true, note: 'A＝πD²／8、R＝D／4 をマニング式に入れた形。' },
        { label: '⑶', ok: false, note: 'A も R も誤り（R＝D／4）。' },
        { label: '⑷', ok: false, note: 'A は正しいが、径深は D／8 ではなく D／4。' },
      ],
      basis: '水理学（マニングの平均流速公式・径深）',
    },
  },
}
