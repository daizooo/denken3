// 令和4年度 試験問題A No.12〜15（基礎工・土留め）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A12' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

const NS = 'xmlns="http://www.w3.org/2000/svg"'

// 土留めの4形式（左が背面の地盤、右が掘削側）
const panel = (x: number, y: number, name: string, extra: string) => `<g transform="translate(${x} ${y})">
<rect x="0" y="0" width="170" height="120" fill="#fafafa" stroke="#bbb"/>
<rect x="8" y="28" width="62" height="84" fill="#d7ccc8"/><rect x="74" y="80" width="88" height="32" fill="#d7ccc8"/>
<path d="M8 28H74M74 80H162" stroke="#6d4c41"/>
<rect x="70" y="24" width="5" height="88" fill="#455a64"/>${extra}
<text x="85" y="16" text-anchor="middle" font-weight="bold">${name}</text></g>`
const SHORING = `<svg ${NS} viewBox="0 0 360 270" font-family="sans-serif" font-size="12">
${panel(5, 5, '自立式', '<text x="118" y="56" text-anchor="middle" fill="#c62828">変形が大きい</text>')}
${panel(185, 5, '切梁式', '<path d="M75 44H160M75 64H160" stroke="#1565c0" stroke-width="4"/><text x="118" y="38" text-anchor="middle" fill="#1565c0">切梁</text>')}
${panel(5, 140, 'アンカー式', '<path d="M70 44L20 72" stroke="#1565c0" stroke-width="3"/><circle cx="20" cy="72" r="5" fill="#1565c0"/><text x="118" y="56" text-anchor="middle">定着＋根入れ</text>')}
${panel(185, 140, '控え杭タイロッド式', '<path d="M70 40H24" stroke="#1565c0" stroke-width="3"/><rect x="18" y="30" width="5" height="60" fill="#1565c0"/><text x="118" y="56" text-anchor="middle">掘削側が広い</text>')}
</svg>`

export const R04_KISOKOU: Explains = {
  A12: {
    explain: {
      point: '直接基礎の底面は、支持地盤に密着させて十分なせん断抵抗（滑動抵抗）を発生させる。「発生させない」は真逆。',
      figures: [{
        type: 'compare',
        title: '直接基礎の底面処理（地盤別）',
        columns: ['処理'],
        rows: [
          { label: '共通', cells: ['支持地盤に密着させ、せん断抵抗を確保'] },
          { label: '砂地盤', cells: ['整地して栗石・砕石を敷き、均しコンクリート'] },
          { label: '岩盤', cells: ['ある程度の不陸を残し、均しコンクリート'] },
          { label: '底面に突起', cells: ['均し層を貫いて支持層に十分に貫入'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '密着させて十分なせん断抵抗を発生させる。発生させないは誤り。' },
        { label: '⑵', ok: true, note: '突起は均し層を貫いて支持層に十分に入れる。' },
        { label: '⑶', ok: true, note: '砂地盤は整地のうえ栗石・砕石を敷くのが一般的。' },
        { label: '⑷', ok: true, note: '岩盤は平滑にせず不陸を残してせん断抵抗を確保する。' },
      ],
      basis: '道路橋示方書・同解説 Ⅳ下部構造編（日本道路協会）',
    },
  },
  A13: {
    explain: {
      point: 'プレボーリングの掘削液は、掘削抵抗を減らし、孔内を泥土化して孔壁の崩壊を防ぐためのもの。「抵抗を増大」「孔壁を軟化」は誤り。',
      figures: [{
        type: 'compare',
        title: '既製杭の埋込み工法',
        columns: ['掘削', '先端処理'],
        rows: [
          { label: 'プレボーリング', cells: ['先に掘削（掘削液で抵抗を減らし孔壁を保つ）', '根固め液を注入して杭を建込み'] },
          { label: '中掘り（セメントミルク噴出攪拌）', cells: ['杭の中を掘りながら沈設', '所定深度でミルクを噴出し根固め'] },
          { label: '中掘り（最終打撃）', cells: ['途中まで中掘りで沈設', '打撃に切り替えて打止め'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '掘削速度は地盤に応じ、試験杭で判断する。' },
        { label: '⑵', ok: true, note: '所定深度まで沈設後、セメントミルクを噴出して根固部をつくる。' },
        { label: '⑶', ok: false, note: '掘削液は掘削抵抗を減らし、孔壁の崩壊を防ぐために使う。' },
        { label: '⑷', ok: true, note: '途中から打撃に切り替え、打止め管理を行う。' },
      ],
      basis: '杭基礎施工便覧（日本道路協会）',
    },
  },
  A14: {
    explain: {
      point: '場所打ち杭のコンクリートは泥水中で打ち込むので、水中コンクリートをトレミーで打つ。バケットは急に引き上げるとバキュームが起きる。',
      figures: [{
        type: 'rule',
        title: '場所打ち杭の要点',
        rows: [
          { label: 'コンクリート', value: '水中コンクリートをトレミーで打ち込む' },
          { label: 'バキューム現象', value: 'バケットを急に引き上げると起きる', trap: '「ゆっくり」で起きるは誤り' },
          { label: 'アースドリルの支持層確認', value: 'バケット内の土砂を柱状図・試料と照合' },
          { label: 'ハンマグラブ', value: 'オールケーシング工法の掘削機' },
          { label: '鉄筋かご', value: '径が大きいほど変形しやすく、剛性の大きい補強材' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'バキューム現象は急に引き上げたときに起きる。ゆっくり引き上げる。' },
        { label: '⑵', ok: true, note: '泥水中なので水中コンクリートをトレミーで打ち込む。' },
        { label: '⑶', ok: false, note: 'ハンマグラブはオールケーシング工法。アースドリルはバケットの土砂で確認する。' },
        { label: '⑷', ok: false, note: '鉄筋かごは径が大きくなるほど変形しやすい。' },
      ],
      basis: '杭基礎施工便覧（日本道路協会）',
    },
  },
  A15: {
    explain: {
      point: 'アンカー式土留めは、アンカーの定着と土留め壁の根入れ部の抵抗の両方で壁を支える。「定着のみ」は誤り。',
      figures: [{ type: 'svg', title: '土留めの4形式', svg: SHORING, alt: '4つの断面図。自立式は支保工なしで変形が大きい。切梁式は掘削側に切梁。アンカー式は背面地盤に斜めのアンカーを定着し根入れと合わせて支える。控え杭タイロッド式は背面の控え杭とタイロッドでつなぎ掘削側が広い。' }],
      checks: [
        { label: '⑴', ok: false, note: 'アンカーの定着と土留め壁の根入れ部の抵抗で支持する。定着のみではない。' },
        { label: '⑵', ok: true, note: '掘削面内に切梁がないので機械掘削がしやすい。' },
        { label: '⑶', ok: true, note: '支保工がないので壁の変形が大きくなる。' },
        { label: '⑷', ok: true, note: '支保工の数・配置を現場に合わせて変えられる。' },
      ],
      basis: '道路土工 仮設構造物工指針（日本道路協会）',
    },
  },
}
