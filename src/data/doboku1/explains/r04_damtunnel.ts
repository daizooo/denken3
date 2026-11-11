// 令和4年度 試験問題A No.33〜36（ダム・トンネル）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A33' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

const NS = 'xmlns="http://www.w3.org/2000/svg"'

// ダム基礎グラウチングの位置（左：コンクリートダム、右：ロックフィルダム）
const GROUT = `<svg ${NS} viewBox="0 0 360 220" font-family="sans-serif" font-size="12">
<rect x="0" y="110" width="360" height="110" fill="#e0e0e0"/><path d="M0 110H360" stroke="#555"/>
<path d="M40 110L48 20H68L140 110z" fill="#cfd8dc" stroke="#455a64"/><text x="90" y="14" text-anchor="middle" font-weight="bold">コンクリートダム</text>
<path d="M45 112V200M52 112V200" stroke="#c62828" stroke-width="2"/><text x="40" y="214" fill="#c62828">カーテン</text>
<path d="M65 112V138M80 112V138M95 112V138M110 112V138" stroke="#1565c0" stroke-width="2"/><text x="62" y="156" fill="#1565c0">コンソリデーション</text>
<path d="M190 110L260 30H280L350 110z" fill="#fff3e0" stroke="#8d6e63"/><path d="M235 110L262 40H278L305 110z" fill="#bcaaa4" stroke="#6d4c41"/>
<text x="270" y="22" text-anchor="middle" font-weight="bold">ロックフィルダム</text><text x="270" y="90" text-anchor="middle">コア</text>
<path d="M245 112V128M260 112V128M280 112V128M295 112V128" stroke="#2e7d32" stroke-width="2"/><text x="262" y="146" text-anchor="end" fill="#2e7d32">ブランケット</text>
<path d="M267 130V200M273 130V200" stroke="#c62828" stroke-width="2"/><text x="280" y="190" fill="#c62828">カーテン</text>
</svg>`

export const R04_DAMTUNNEL: Explains = {
  A33: {
    explain: {
      point: 'ブランケットグラウチングは、ロックフィルダムのコア着岩部付近の遮水性を改良するもの。コンクリートダムの着岩部を対象とするのはコンソリデーショングラウチング。',
      figures: [{ type: 'svg', title: 'グラウチングの位置', svg: GROUT, alt: '左のコンクリートダムでは、上流側の深いカーテングラウチングと、堤体直下の浅いコンソリデーショングラウチング。右のロックフィルダムでは、コアの着岩部に浅いブランケットグラウチング、その中央に深いカーテングラウチング。' }],
      checks: [
        { label: '⑴', ok: true, note: '上位から下位へ削孔と注入を交互に行うのがステージ注入工法。' },
        { label: '⑵', ok: false, note: 'ブランケットはロックフィルダムのコア着岩部。コンクリートダムではない。' },
        { label: '⑶', ok: true, note: 'コンソリデーションは着岩部付近の遮水性をカーテンとあいまって改良する。' },
        { label: '⑷', ok: true, note: 'カーテンは基礎地盤とリム部の高透水部の遮水性を改良する。' },
      ],
      basis: 'グラウチング技術指針・同解説（国土交通省）',
    },
  },
  A34: {
    explain: {
      point: '表面水率の変動が問題になるのは細骨材。上屋を設けて7日以上の水切りを確保するのは、粗骨材ではなく細骨材。',
      figures: [{
        type: 'rule',
        title: 'ダムコンクリートの数値',
        rows: [
          { label: 'RCD の敷均し', value: '0.75mリフト3層・1mリフト4層の薄層' },
          { label: '打込み中止の降雨', value: '有スランプ 4mm/h 以上・RCD 2mm/h 以上' },
          { label: 'RCD の練混ぜ〜締固め', value: '夏季3時間・冬季4時間程度' },
          { label: '骨材の水切り', value: '特に細骨材を上屋で7日以上', trap: '「粗骨材」は誤り' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: 'ブルドーザで薄層に敷き均し、振動ローラで締め固める。' },
        { label: '⑵', ok: true, note: '有スランプは4mm/h、RCD は2mm/h 以上で中止することが多い。' },
        { label: '⑶', ok: true, note: '夏季3時間・冬季4時間程度が標準。' },
        { label: '⑷', ok: false, note: '表面水率が変動しやすいのは細骨材。水切りが特に必要なのは細骨材。' },
      ],
      basis: 'ダム工事の施工技術（国土交通省・RCD工法技術指針）',
    },
  },
  A35: {
    explain: {
      point: '全断面工法は、地質が安定した地山で採用する。地山条件の変化への順応性は低く、変化が予想されるなら分割掘削を選ぶ。',
      figures: [{
        type: 'compare',
        title: '山岳トンネルの掘削工法',
        columns: ['適する地山', '特徴'],
        rows: [
          { label: '全断面工法', cells: ['安定した地山', '大型機械で効率的。条件変化への順応性は低い'] },
          { label: '補助ベンチ付き全断面', cells: ['比較的安定〜やや不安定', 'ベンチで切羽を安定。早期の一次インバートも'] },
          { label: 'ベンチカット工法', cells: ['幅広く適用', '上半・下半に分割。地山でベンチ長を決める'] },
          { label: '導坑先進工法', cells: ['不良地山・地質確認', '前方の地質確認・水抜き'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '導坑は前方の地質確認・水抜きに役立ち、位置で名前が変わる。' },
        { label: '⑵', ok: true, note: '上半・下半に分け、地山の良否でベンチ長を決める。' },
        { label: '⑶', ok: true, note: 'ベンチで切羽を安定させ、変位抑制に一次インバートを早期施工する。' },
        { label: '⑷', ok: false, note: '全断面工法は安定した地山向けで、条件変化への順応性は低い。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
  A36: {
    explain: {
      point: '切羽安定対策は「どこを守るか」で分ける。サイドパイルは脚部の沈下防止対策で、天端部の対策ではない。',
      figures: [{
        type: 'compare',
        title: '切羽安定対策の分類',
        columns: ['目的', '主な工法'],
        rows: [
          { label: '天端部', cells: ['崩落防止', 'フォアポーリング・長尺鋼管フォアパイリング'] },
          { label: '鏡面', cells: ['崩壊防止', '鏡吹付け・鏡ボルト・注入'] },
          { label: '脚部', cells: ['沈下防止', '仮インバート・レッグパイル・サイドパイル・ウィングリブ'] },
          { label: '地下水', cells: ['湧水による不安定化防止', '水抜きボーリング・水抜き坑・ウェルポイント'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'サイドパイルは脚部の沈下防止対策。天端部の対策ではない。' },
        { label: '⑵', ok: true, note: '鏡吹付け・鏡ボルト・注入で鏡面の崩壊を防ぐ。' },
        { label: '⑶', ok: true, note: '仮インバート・レッグパイル・ウィングリブで脚部の沈下を防ぐ。' },
        { label: '⑷', ok: true, note: '水抜きボーリング・水抜き坑・ウェルポイントで湧水を抑える。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
}
