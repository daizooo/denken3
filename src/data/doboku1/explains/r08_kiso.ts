// 令和8年度 試験問題A No.1〜5（基礎：土質・力学・水理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A01' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const ARROW = '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#333"/></marker><marker id="r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c62828"/></marker></defs>'

// 土の三相図（体積は左、質量は右）
const SOIL_PHASES = `<svg ${NS} viewBox="0 0 340 210" font-family="sans-serif" font-size="13">${ARROW}
<rect x="120" y="20" width="100" height="36" fill="#fff" stroke="#333"/><text x="170" y="43" text-anchor="middle">空気</text>
<rect x="120" y="56" width="100" height="44" fill="#bbdefb" stroke="#333"/><text x="170" y="83" text-anchor="middle">水</text>
<rect x="120" y="100" width="100" height="90" fill="#d7ccc8" stroke="#333"/><text x="170" y="150" text-anchor="middle">土粒子</text>
<text x="108" y="43" text-anchor="end">Va</text><text x="108" y="83" text-anchor="end">Vw</text><text x="108" y="150" text-anchor="end">Vs</text>
<path d="M78 22V98" stroke="#555" marker-start="url(#a)" marker-end="url(#a)"/><text x="72" y="64" text-anchor="end">Vv</text>
<path d="M40 22V188" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="34" y="110" text-anchor="end" font-weight="bold">V</text>
<text x="232" y="43">ma＝0</text><text x="232" y="83">mw</text><text x="232" y="150">ms</text>
<path d="M300 22V188" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="308" y="110" font-weight="bold">m</text>
<text x="170" y="206" text-anchor="middle" fill="#1565c0">ρt＝m／V　　ρd＝ms／V</text></svg>`

// 締固め曲線（頂点＝最大乾燥密度・最適含水比）
const COMPACTION = `<svg ${NS} viewBox="0 0 320 210" font-family="sans-serif" font-size="12">${ARROW}
<path d="M50 170H300" stroke="#333" marker-end="url(#a)"/><path d="M50 170V20" stroke="#333" marker-end="url(#a)"/>
<text x="300" y="190" text-anchor="end">含水比 w →</text><text x="56" y="22">乾燥密度 ρd</text>
<path d="M75 150Q165 10 270 140" fill="none" stroke="#1565c0" stroke-width="2.5"/>
<circle cx="168" cy="80" r="4" fill="#c62828"/>
<path d="M168 80V170M168 80H50" stroke="#c62828" stroke-dasharray="4 3"/>
<text x="168" y="186" text-anchor="middle" fill="#c62828">最適含水比</text>
<text x="46" y="84" text-anchor="end" fill="#c62828" font-size="11">最大</text><text x="46" y="98" text-anchor="end" fill="#c62828" font-size="11">乾燥密度</text>
<text x="230" y="70" fill="#1565c0">締固め曲線</text></svg>`

// 片持梁（左A自由端・右B固定端）と等分布荷重の合力
const CANTILEVER = `<svg ${NS} viewBox="0 0 340 230" font-family="sans-serif" font-size="13">${ARROW}
<path d="M40 60H278" stroke="#333"/><text x="160" y="50" text-anchor="middle">等分布荷重 w</text>
${[42, 71, 100, 130, 160, 190, 220, 249, 276].map(x => `<path d="M${x} 62V98" stroke="#333" marker-end="url(#a)"/>`).join('')}
<rect x="40" y="100" width="240" height="10" fill="#eee" stroke="#333"/>
<rect x="280" y="80" width="12" height="50" fill="#9e9e9e"/><text x="300" y="110">B</text><text x="22" y="110">A</text>
<path d="M160 114V156" stroke="#c62828" stroke-width="2.5" marker-end="url(#r)"/><text x="170" y="142" fill="#c62828">合力 wL（中央に集中）</text>
<path d="M160 182H280" stroke="#c62828" marker-start="url(#r)" marker-end="url(#r)"/><text x="220" y="176" text-anchor="middle" fill="#c62828">腕の長さ L／2</text>
<path d="M40 208H280" stroke="#555" marker-start="url(#a)" marker-end="url(#a)"/><text x="160" y="225" text-anchor="middle">L</text></svg>`

// 水槽のオリフィス（トリチェリの定理）
const ORIFICE = `<svg ${NS} viewBox="0 0 340 210" font-family="sans-serif" font-size="13">${ARROW}
<path d="M40 20V180H200V20" fill="none" stroke="#333" stroke-width="2"/>
<rect x="42" y="50" width="156" height="128" fill="#bbdefb"/><path d="M42 50H198" stroke="#1565c0" stroke-width="2"/>
<text x="120" y="42" text-anchor="middle">① 水面（流速≒0）</text>
<path d="M200 150Q270 152 300 200" fill="none" stroke="#1565c0" stroke-width="3"/>
<path d="M205 150H245" stroke="#c62828" stroke-width="2" marker-end="url(#r)"/><text x="250" y="140" fill="#c62828">② 流速 v</text>
<path d="M70 52V148" stroke="#333" marker-start="url(#a)" marker-end="url(#a)"/><text x="78" y="105" font-weight="bold">H</text>
<text x="120" y="200" text-anchor="middle" fill="#1565c0">H ＝ v²／2g → v ＝ √(2gH)</text></svg>`

export const R08_KISO: Explains = {
  A01: {
    explain: {
      point: '密度＝質量÷体積。湿潤密度は「全体の質量÷全体の体積」、乾燥密度は「土粒子だけの質量÷全体の体積」。',
      figures: [{ type: 'svg', title: '土の三相図（左が体積、右が質量）', svg: SOIL_PHASES, alt: '上から空気・水・土粒子の三層。体積は Va・Vw・Vs で合計 V、質量は 0・mw・ms で合計 m。' }],
      checks: [
        { label: '⑴', ok: false, note: 'ms／Vs は土粒子の密度。Vv／Vs は間隙比（密度ではない）。' },
        { label: '⑵', ok: false, note: '乾燥密度は正しいが、湿潤密度は全体の m／V。' },
        { label: '⑶', ok: true, note: 'ρt＝m／V、ρd＝ms／V。どちらも分母は全体積 V。' },
        { label: '⑷', ok: false, note: '湿潤密度は正しいが、Vv／Vs は間隙比。' },
      ],
      basis: '土の基本的な物理量の定義（土質力学）',
    },
  },
  A02: {
    explain: {
      point: '締固めは「空気」を追い出して密度を上げること。含水比と乾燥密度のグラフが締固め曲線で、頂点が最大乾燥密度・最適含水比。',
      figures: [{ type: 'svg', title: '締固め曲線', svg: COMPACTION, alt: '横軸が含水比、縦軸が乾燥密度の上に凸な曲線。頂点の高さが最大乾燥密度、頂点の横位置が最適含水比。' }],
      checks: [
        { label: '⑴', ok: false, note: '追い出すのは空気。時間-圧密量曲線は圧密試験のグラフ。' },
        { label: '⑵', ok: true, note: '空気・締固め曲線・最大乾燥密度・最適含水比。' },
        { label: '⑶', ok: false, note: '追い出すのは水分ではなく空気。頂点は飽和密度ではない。' },
        { label: '⑷', ok: false, note: '時間-圧密量曲線・自然含水比は締固めとは別の用語。' },
      ],
      basis: 'JIS A 1210（突固めによる土の締固め試験方法）',
    },
  },
  A03: {
    explain: {
      point: '等分布荷重は「合計 wL が真ん中に集中している」と置き換える。固定端Bの曲げモーメント＝力 wL × 腕の長さ L／2。',
      figures: [{ type: 'svg', title: '等分布荷重を合力に置き換える', svg: CANTILEVER, alt: '左端A自由・右端B固定の長さLの片持梁に等分布荷重w。合力wLが中央に下向きに働き、Bまでの腕の長さはL/2。' }],
      checks: [
        { label: '⑴', ok: false, note: '腕の長さを L にしている。合力は中央なので L／2。' },
        { label: '⑵', ok: false, note: 'wL は力（荷重の合計）。長さを掛けていないのでモーメントでない。' },
        { label: '⑶', ok: true, note: 'wL × L／2 ＝ wL²／2。符号は問題の約束（反時計回りが正）で負。' },
        { label: '⑷', ok: false, note: '長さを1回しか掛けておらず、力の単位のまま。' },
      ],
      basis: '構造力学（片持梁の曲げモーメント）',
    },
  },
  A04: {
    explain: {
      point: '応力 σ＝P／A。荷重 P が同じなら、断面積 A が大きいほど応力は小さい。断面積の大きい順に並べればよい。',
      figures: [{
        type: 'compare',
        title: '各部材の断面積（a＝200mm、中空の厚さ t＝10mm）',
        columns: ['断面', '断面積 A', 'σ'],
        rows: [
          { label: 'ア', cells: ['正方形（中実）', '200×200＝40,000mm²', '最小'] },
          { label: 'ウ', cells: ['三角形（中実）', '200×200÷2＝20,000mm²', '2番目'] },
          { label: 'イ', cells: ['正方形の中空', '200²－180²＝7,600mm²', '3番目'] },
          { label: 'エ', cells: ['三角形の中空', '約6,000mm²（イより小さい）', '最大'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '断面積 ア＞ウ＞イ＞エ なので、σ は ア→ウ→イ→エ の順に大きくなる。' },
        { label: '⑵', ok: false, note: '大きい順に並べている。さらにウとイの順も逆。' },
        { label: '⑶', ok: false, note: '中空のイは中実の三角形ウより断面積が小さく、σ は大きい。' },
        { label: '⑷', ok: false, note: '⑴の逆（σ の大きい順）。' },
      ],
      basis: '材料力学（軸方向応力 σ＝P／A）',
    },
  },
  A05: {
    explain: {
      point: '水面とオリフィスでベルヌーイの定理を立てると、水面の高さ H の位置エネルギーがすべて流速に変わる。H＝v²／2g より v＝√(2gH)。',
      figures: [{ type: 'svg', title: 'オリフィスからの流出（トリチェリの定理）', svg: ORIFICE, alt: '水槽の水面①から深さHの側面の孔②から水が流速vで噴き出す。H＝v²/2g から v＝√(2gH)。' }],
      checks: [
        { label: '⑴', ok: false, note: '√ がなく、単位も速度にならない。' },
        { label: '⑵', ok: false, note: '2 が抜けている。速度水頭は v²／2g。' },
        { label: '⑶', ok: true, note: 'v²／2g＝H を解いて v＝√(2gH)。' },
        { label: '⑷', ok: false, note: '3 の係数には根拠がない。' },
      ],
      basis: '水理学（ベルヌーイの定理・トリチェリの定理）',
    },
  },
}
