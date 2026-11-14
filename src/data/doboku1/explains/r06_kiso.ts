// 令和6年度 試験問題A No.1〜5（基礎：土質・力学・水理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A01' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const ARROW = '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#333"/></marker><marker id="r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c62828"/></marker></defs>'

// 土の三相図（体積は左、質量は右）
const SOIL_PHASES = `<svg ${NS} viewBox="0 0 340 230" font-family="sans-serif" font-size="13">${ARROW}
<rect x="120" y="20" width="100" height="36" fill="#fff" stroke="#333"/><text x="170" y="43" text-anchor="middle">空気</text>
<rect x="120" y="56" width="100" height="44" fill="#bbdefb" stroke="#333"/><text x="170" y="83" text-anchor="middle">水</text>
<rect x="120" y="100" width="100" height="90" fill="#d7ccc8" stroke="#333"/><text x="170" y="150" text-anchor="middle">土粒子</text>
<text x="108" y="43" text-anchor="end">Va</text><text x="108" y="83" text-anchor="end">Vw</text><text x="108" y="150" text-anchor="end">Vs</text>
<path d="M78 22V98" stroke="#555" marker-start="url(#a)" marker-end="url(#a)"/><text x="72" y="64" text-anchor="end">Vv</text>
<path d="M40 22V188" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="34" y="110" text-anchor="end" font-weight="bold">V</text>
<text x="232" y="43">ma＝0</text><text x="232" y="83">mw</text><text x="232" y="150">ms</text>
<path d="M300 22V188" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="308" y="110" font-weight="bold">m</text>
<text x="170" y="208" text-anchor="middle" fill="#1565c0">湿潤密度 ρt＝m／V（全体÷全体）</text>
<text x="170" y="226" text-anchor="middle" fill="#c62828">飽和度 Sr＝Vw／Vv×100（水÷すき間）</text></svg>`

// 単純梁（L/3 点に P が2つ）の曲げモーメント図
const BEAM_2P = `<svg ${NS} viewBox="0 0 340 220" font-family="sans-serif" font-size="13">${ARROW}
<rect x="40" y="60" width="260" height="8" fill="#eee" stroke="#333"/>
<path d="M40 68l-8 14h16z" fill="none" stroke="#333"/><path d="M300 68l-8 14h16z" fill="none" stroke="#333"/>
<text x="24" y="66">A</text><text x="308" y="66">B</text>
<path d="M127 20V58" stroke="#333" stroke-width="2" marker-end="url(#a)"/><path d="M213 20V58" stroke="#333" stroke-width="2" marker-end="url(#a)"/>
<text x="133" y="30">P</text><text x="219" y="30">P</text>
<path d="M40 110V88" stroke="#c62828" stroke-width="2" marker-end="url(#r)"/><path d="M300 110V88" stroke="#c62828" stroke-width="2" marker-end="url(#r)"/>
<text x="48" y="106" fill="#c62828">RA＝P</text><text x="292" y="106" fill="#c62828" text-anchor="end">RB＝P</text>
<path d="M40 130H300" stroke="#333"/><path d="M40 130L127 185H213L300 130z" fill="#ffcdd2" stroke="#c62828"/>
<text x="170" y="178" text-anchor="middle" fill="#c62828" font-weight="bold">M＝P×L／3</text>
<text x="84" y="210" text-anchor="middle">L／3</text><text x="170" y="210" text-anchor="middle">L／3</text><text x="256" y="210" text-anchor="middle">L／3</text>
<text x="310" y="150" font-size="11" text-anchor="end">M図</text></svg>`

// 管の連続式（流量一定）
const PIPE = `<svg ${NS} viewBox="0 0 340 170" font-family="sans-serif" font-size="13">${ARROW}
<path d="M20 30H120L220 55H320M20 120H120L220 95H320" fill="none" stroke="#333" stroke-width="2"/>
<rect x="20" y="31" width="100" height="88" fill="#bbdefb"/><path d="M120 31L220 56V94L120 119z" fill="#bbdefb"/><rect x="220" y="56" width="100" height="38" fill="#bbdefb"/>
<path d="M70 32V118" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="76" y="80">d₁</text>
<path d="M300 57V93" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="306" y="80">d₂</text>
<path d="M30 75H62" stroke="#c62828" stroke-width="2" marker-end="url(#r)"/><text x="30" y="68" fill="#c62828">v₁</text>
<path d="M230 75H272" stroke="#c62828" stroke-width="3" marker-end="url(#r)"/><text x="230" y="112" fill="#c62828">v₂（速い）</text>
<text x="170" y="146" text-anchor="middle" fill="#1565c0">Q＝A₁v₁＝A₂v₂（流量は一定）</text>
<text x="170" y="164" text-anchor="middle" fill="#1565c0">A＝πd²／4 → v₂＝(d₁／d₂)²×v₁</text></svg>`

export const R06_KISO: Explains = {
  A01: {
    explain: {
      point: '湿潤密度は「全体の質量÷全体の体積」。飽和度は「すき間（間隙）のうち水が占める割合」で、分母は全体積ではなく間隙の体積 Vv。',
      figures: [{ type: 'svg', title: '土の三相図と2つの式', svg: SOIL_PHASES, alt: '上から空気・水・土粒子の三層。体積は Va・Vw・Vs、空気と水の合計が Vv、全体が V。質量は 0・mw・ms で合計 m。ρt＝m／V、Sr＝Vw／Vv×100。' }],
      checks: [
        { label: '⑴', ok: false, note: '飽和度は正しいが、mw／V は水の質量だけ。湿潤密度は m／V。' },
        { label: '⑵', ok: false, note: '湿潤密度も飽和度も誤り（mw／V、Vw／V）。' },
        { label: '⑶', ok: false, note: '湿潤密度は正しいが、飽和度の分母は V ではなく Vv。' },
        { label: '⑷', ok: true, note: 'ρt＝m／V、Sr＝Vw／Vv×100。' },
      ],
      basis: '土の基本的な物理量の定義（土質力学）',
    },
  },
  A02: {
    explain: {
      point: '砂は粒径0.075〜2mm。粒径加積曲線は「その粒径より細かい土の割合」。三角座標は各辺の目盛りで細粒分・砂分・礫分を読む。',
      figures: [{
        type: 'compare',
        title: '図から読み取る割合（目安）',
        columns: ['読み方', '結果'],
        rows: [
          { label: '曲線Ⓐ', cells: ['0.075mmで約0％、2mmで100％', 'ほぼ全部が砂'] },
          { label: '曲線Ⓑ', cells: ['0.075mmで約10％、2mmで約55％', '砂は約45％（礫も多い）'] },
          { label: 'Ⅰの土', cells: ['細粒分の目盛り約15〜20％', '細粒分まじり礫'] },
          { label: 'Ⅱの土', cells: ['細粒分の目盛り約55％', '細粒土'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'イは正しいが、Ⅰの細粒分（約15〜20％）はⅡ（約55％）より少ない。' },
        { label: '⑵', ok: true, note: 'Ⓐはほぼ砂だけで砂が多い。Ⅰは細粒分が少ない。' },
        { label: '⑶', ok: false, note: 'Ⓐは砂の範囲で一気に立ち上がる＝砂が多い。ロも逆。' },
        { label: '⑷', ok: false, note: 'ロは正しいが、Ⓐの砂の割合はⒷより多い。' },
      ],
      basis: '地盤材料の工学的分類方法（地盤工学会基準 JGS 0051）',
    },
  },
  A03: {
    explain: {
      point: '左右対称なので反力は RA＝RB＝P。最大曲げモーメントは荷重点C（とD）で、M＝RA×L／3＝PL／3。CD間は一定。',
      figures: [{ type: 'svg', title: '反力と曲げモーメント図', svg: BEAM_2P, alt: 'スパンLの単純梁にL／3の点C・Dで集中荷重P。反力はA・BともP。曲げモーメント図は台形で、CD間で最大PL／3。' }],
      checks: [
        { label: '⑴', ok: false, note: 'PL／2 はスパン全体の半分で計算した誤り。腕の長さは L／3。' },
        { label: '⑵', ok: true, note: 'RA＝P、C点で P×L／3＝PL／3。' },
        { label: '⑶', ok: false, note: '反力を P／2 と誤ると P／2×L／3＝PL／6。2つの荷重で反力は各 P。' },
        { label: '⑷', ok: false, note: 'PL／9 は誤り。M＝P×L／3。' },
      ],
      basis: '単純梁の反力と曲げモーメント（構造力学）',
    },
  },
  A04: {
    explain: {
      point: '図心は「断面一次モーメントが0になる直交軸の交点」。図心を通る軸まわりでは、軸の両側の面積×距離がちょうど打ち消し合う。',
      figures: [{
        type: 'flow',
        title: '台形の図心の求め方',
        steps: ['中心が明らかな図形（長方形＋三角形）に分割', '各図形の面積 A と図心座標 x・y を求める', '断面一次モーメント Σ(A×x)・Σ(A×y) を足し合わせる', 'x₀＝Σ(A×x)／ΣA、y₀＝Σ(A×y)／ΣA'],
      }],
      checks: [
        { label: '⑴', ok: true, note: '図心は図形の重心で、座標G（x₀，y₀）で表せる。' },
        { label: '⑵', ok: true, note: '中心が明らかな断面に分割し、各断面一次モーメントを足し合わせる。' },
        { label: '⑶', ok: true, note: '断面一次モーメント＝面積×座標値の和。' },
        { label: '⑷', ok: false, note: '0以外ではなく、ともに0となる直交軸の交点が図心。' },
      ],
      basis: '断面一次モーメントと図心（構造力学）',
    },
  },
  A05: {
    explain: {
      point: '定常流では流量 Q＝断面積×流速 がどの断面でも同じ（連続式）。断面積は直径の2乗に比例するので、細い管ほど速く流れる。',
      figures: [{ type: 'svg', title: '連続式（流量一定）', svg: PIPE, alt: '直径d₁の太い管から直径d₂の細い管へ水が流れる。流量Qは一定で、v₂＝(d₁／d₂)²×v₁、Q₂＝Q₁＝πd₁²／4×v₁。' }],
      checks: [
        { label: '⑴', ok: true, note: 'v₂＝(d₁／d₂)²×v₁、Q₂＝Q₁＝πd₁²／4×v₁。' },
        { label: '⑵', ok: false, note: '流速は正しいが、断面②の面積に v₁ を掛けても Q₂ にならない。' },
        { label: '⑶', ok: false, note: '比が逆（細くなるほど速い）。断面積は πd²／4。' },
        { label: '⑷', ok: false, note: '比が逆で、断面積の式も πd²／4 ではない。' },
      ],
      basis: '連続の式（水理学）',
    },
  },
}
