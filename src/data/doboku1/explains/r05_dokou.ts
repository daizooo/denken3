// 令和5年度 試験問題A No.1〜5（土工）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A01' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R05_DOKOU: Explains = {
  A01: {
    explain: {
      point: '試験ごとに「何が分かり、何に使うか」を対応させる。CBR は舗装の厚さ設計や路床の評価に使い、地盤の許容支持力の算定には使わない。',
      figures: [{
        type: 'compare',
        title: '土質試験 → 分かること → 使い道',
        columns: ['分かること', '使い道'],
        rows: [
          { label: '含水比試験', cells: ['含水比', '乾燥密度と組み合わせて締固め曲線'] },
          { label: 'CBR 試験', cells: ['CBR（貫入抵抗の比）', '舗装厚の設計・路床の評価'] },
          { label: '圧密試験', cells: ['圧密係数・体積圧縮係数', '粘性土の沈下量・沈下時間'] },
          { label: '一軸圧縮試験', cells: ['一軸圧縮強さ→非排水せん断強さ', '土圧・斜面安定・支持力の強度定数'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '含水比と乾燥密度の関係から締固め曲線を描く。' },
        { label: '⑵', ok: false, note: 'CBR は舗装の厚さ設計などに使う。地盤の許容支持力の算定には用いない。' },
        { label: '⑶', ok: true, note: '圧密係数・体積圧縮係数から沈下量と沈下時間を推定する。' },
        { label: '⑷', ok: true, note: '非排水せん断強さ（c）を土圧・斜面安定の検討に使う。' },
      ],
      basis: '地盤材料試験の方法と解説（地盤工学会）',
    },
  },
  A02: {
    explain: {
      point: 'ブロック積擁壁は胴込めコンクリートを用いる練積が原則。目地が通らない谷積で積むのは正しい。',
      figures: [{
        type: 'rule',
        title: '法面保護工の施工の要点',
        rows: [
          { label: '植生土のう工（法枠の中詰）', value: '沈下・はらみ出しが起きないよう表面を平滑に' },
          { label: '種子散布工', value: '水→木質材料→浸食防止材→肥料→種子の順に投入し攪拌' },
          { label: 'モルタル吹付工', value: '浮石・泥を清掃→菱形金網をアンカーピンで固定' },
          { label: 'ブロック積擁壁工', value: '胴込めコンクリートを用いる練積・谷積', trap: '「空積」は誤り' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '中詰の土のうは表面を平滑にして沈下・はらみ出しを防ぐ。' },
        { label: '⑵', ok: true, note: '投入順は水・木質材料・浸食防止材・肥料・種子。' },
        { label: '⑶', ok: true, note: '清掃後に金網を張り、アンカーピンで固定する。' },
        { label: '⑷', ok: false, note: '原則は胴込めコンクリートを設ける練積。空積ではない。' },
      ],
      basis: '道路土工－切土工・斜面安定工指針（日本道路協会）',
    },
  },
  A03: {
    explain: {
      point: 'TS・GNSS による締固め管理は「工法規定」。材料・まき出し厚・締固め回数が規定どおりなら、現場密度試験（品質規定）は原則不要。',
      figures: [{
        type: 'flow',
        title: 'TS・GNSS による盛土の締固め管理',
        steps: ['システムの機能をカタログ等で確認', '座標既知点を複数観測して精度確認', '試験施工でまき出し厚・締固め回数を決定', '本施工で走行軌跡から回数を管理', '規定どおりなら現場密度試験は省略'],
        branches: [
          { from: 4, label: '規定どおりでも必ず密度試験', to: '誤り', bad: true },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '選定段階で判定・表示機能や範囲分割機能を確認する。' },
        { label: '⑵', ok: true, note: '既知点の座標と計測座標が合うことを複数箇所で確かめる。' },
        { label: '⑶', ok: true, note: '締固めによる沈下量を試験施工で確認して決める。' },
        { label: '⑷', ok: false, note: '工法規定で管理するので、規定どおりなら現場密度試験は原則不要。' },
      ],
      basis: '国土交通省「TS・GNSSを用いた盛土の締固め管理要領」',
    },
  },
  A04: {
    explain: {
      point: 'しゃ断排水層は「下から上がる地下水」を断つ層。路盤の下に置き、毛管上昇などで路床・路盤に水が入るのを防ぐ。',
      figures: [{
        type: 'compare',
        title: '地下排水工の役割',
        columns: ['位置', '目的'],
        rows: [
          { label: 'しゃ断排水層', cells: ['路盤の下', '地下水の上昇（毛管水）をしゃ断'] },
          { label: '水平排水層', cells: ['盛土の内部', '間隙水圧を下げて安定を高める'] },
          { label: '基盤排水層', cells: ['地山の表面', '地山から盛土への浸透を防ぐ'] },
          { label: '地下排水溝', cells: ['旧沢地形に沿う', '盛土内の地下水・浸透水を排水'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '降雨の浸透水ではなく、地下水の上昇を路盤の下でしゃ断するための層。' },
        { label: '⑵', ok: true, note: '透水性の良い材料で排水勾配と層厚を確保する。' },
        { label: '⑶', ok: true, note: '地山表面に透水性が高く強い材料を敷く。' },
        { label: '⑷', ok: true, note: '沢埋め盛土では旧沢地形に沿って設ける。' },
      ],
      basis: '道路土工－盛土工指針（日本道路協会）',
    },
  },
  A05: {
    explain: {
      point: '軟弱地盤上の盛土は、局部破壊を防ぐため法尻側から中央へ向かって施工する。中央から外へは逆。',
      figures: [{
        type: 'svg',
        title: '軟弱地盤上の盛土の施工順序',
        alt: '盛土断面。両側の法尻から先に盛り、中央へ向かって施工する。矢印は法尻から中央を指す。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 150"><rect width="320" height="150" fill="#fff"/><rect x="0" y="100" width="320" height="50" fill="#d9e4ec"/><text x="8" y="140" font-size="12" fill="#335">軟弱地盤</text><rect x="0" y="90" width="320" height="10" fill="#e8dcc0" stroke="#8a7a55"/><text x="214" y="122" font-size="11" fill="#555">サンドマット</text><line x1="240" y1="112" x2="252" y2="99" stroke="#555"/><path d="M40 90 L110 46 L210 46 L280 90 Z" fill="#efe6d2" stroke="#8a7a55"/><text x="146" y="62" font-size="12" fill="#222">盛土</text><g stroke="#c33" stroke-width="2" fill="none"><path d="M58 80 L136 80 m-8 -5 l8 5 l-8 5"/><path d="M262 80 L184 80 m8 -5 l-8 5 l8 5"/></g><g fill="#c33" font-size="12" font-weight="bold"><text x="14" y="36">①法尻から</text><text x="236" y="36">①法尻から</text><text x="138" y="36">②中央へ</text></g><g stroke="#c33" stroke-dasharray="3 3"><line x1="44" y1="40" x2="56" y2="80"/><line x1="276" y1="40" x2="264" y2="80"/></g></svg>',
      }],
      checks: [
        { label: '⑴', ok: true, note: 'せん断変形（沈下・隆起・側方変位）と圧密沈下からなる。' },
        { label: '⑵', ok: true, note: '動態観測で地盤の挙動を確認しながら施工する。' },
        { label: '⑶', ok: true, note: '数％の横断勾配をつけ平滑に仕上げて雨水の浸透を防ぐ。' },
        { label: '⑷', ok: false, note: '中央からではなく、法尻から中央に向かって施工する。' },
      ],
      basis: '道路土工－軟弱地盤対策工指針（日本道路協会）',
    },
  },
}
