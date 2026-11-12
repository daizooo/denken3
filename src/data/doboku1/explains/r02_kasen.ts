// 令和2年度 試験問題A No.21〜26（河川・砂防）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A21' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R02_KASEN: Explains = {
  A21: {
    explain: {
      point: '施工中は雨水を集中させないよう横断方向に3〜5％の勾配を付ける。締固めは法線方向、仕上り厚は30cm以下。',
      figures: [{
        type: 'rule',
        title: '築堤盛土の施工の数値',
        rows: [
          { label: '締固めの方向', value: '堤防法線方向（縦断方向）', trap: '横断方向' },
          { label: '施工中の排水勾配', value: '横断方向に3〜5％' },
          { label: '1層の仕上り厚', value: '30cm以下（まき出し35〜45cm）', trap: '50cm以下' },
          { label: '高含水比粘性土', value: '接地圧の小さい湿地ブルドーザで運搬', trap: '接地圧の大きいブルドーザ' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '締固めは堤防の法線方向に行う。幅の重複に留意する点は正しい。' },
        { label: '⑵', ok: true, note: '雨水の集中を防ぐため横断方向に3〜5％の勾配を付ける。' },
        { label: '⑶', ok: false, note: '締固め後の仕上り厚は30cm以下。50cmでは高まきになる。' },
        { label: '⑷', ok: false, note: '高含水比粘性土は接地圧の小さい湿地ブルドーザで運ぶ。' },
      ],
      basis: '河川土工マニュアル（国土技術研究センター）',
    },
  },
  A22: {
    explain: {
      point: '段階載荷工法は圧密の進行で地盤のせん断強度が「増加」するのを待ちながら盛り上げる工法。減少ではない。',
      figures: [{
        type: 'compare',
        title: '軟弱地盤対策工の仕組み',
        columns: ['仕組み'],
        rows: [
          { label: '段階載荷工法', cells: ['ゆっくり盛り、圧密でせん断強度を増加させる'] },
          { label: '押え盛土工法', cells: ['側方の盛土で抵抗モーメントを増やす'] },
          { label: '掘削置換工法', cells: ['良質材に置き換え、強度増・沈下減'] },
          { label: 'サンドマット工法', cells: ['上部排水の促進・トラフィカビリティー確保'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '圧密が進むとせん断強度は増加する。その増加を期待する工法。' },
        { label: '⑵', ok: true, note: '押え盛土ですべりに抵抗するモーメントを増やす。' },
        { label: '⑶', ok: true, note: '置き換えた分だけせん断抵抗が増え、沈下も小さくなる。' },
        { label: '⑷', ok: true, note: 'サンドマットは上部排水層と施工機械の足場を兼ねる。' },
      ],
      basis: '河川土工マニュアル、道路土工－軟弱地盤対策工指針',
    },
  },
  A23: {
    explain: {
      point: 'かご系護岸はかごの上に現場発生土を覆土すれば植生の復元が期待できる。「期待できない」は誤り。',
      figures: [{
        type: 'compare',
        title: '多自然川づくりの護岸の留意点',
        columns: ['留意点'],
        rows: [
          { label: '石系（現地採取）', cells: ['大きな石だけ採ると河床低下の原因'] },
          { label: '石系（空積み・石張り）', cells: ['石のかみ合わせが安定の要'] },
          { label: 'かご系', cells: ['屈とう性・空げきあり。覆土で植生が回復'] },
          { label: 'コンクリート系', cells: ['明度が高い → 周辺との明度差に注意'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '径の大きい石を選んで採ると河床が動きやすくなり、河床低下を招く。' },
        { label: '⑵', ok: true, note: '空積み・石張りは石のかみ合わせが不備だと不安定になる。' },
        { label: '⑶', ok: false, note: 'かごの上に現場発生土を覆土すれば植生の復元が期待できる。' },
        { label: '⑷', ok: true, note: 'コンクリートは明度が高く、周辺との明度差に注意する。' },
      ],
      basis: '多自然川づくりポイントブックIII（国土交通省）',
    },
  },
  A24: {
    explain: {
      point: '砂礫基礎の大転石は、その2/3以上が地下にもぐっていると予想される場合に存置してよい。1/2では取り除く。',
      figures: [{
        type: 'rule',
        title: '砂防えん堤の基礎の施工',
        rows: [
          { label: '基礎掘削の目的', value: '支持・滑動・洗掘への抵抗力を改善' },
          { label: '漏水・湧水', value: '水セメント比が変わらないよう処理してから打込み' },
          { label: '仕上げ面付近', value: '0.5m程度は人力掘削（重機で乱さない）' },
          { label: '大転石の存置', value: '2/3以上が地下にもぐっている場合', trap: '1/2以上' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '基礎掘削で支持・滑動・洗掘への抵抗力を高める。' },
        { label: '⑵', ok: true, note: '漏水・湧水を処理してからコンクリートを打ち込む。' },
        { label: '⑶', ok: true, note: '重機の履帯で乱さないよう、仕上げ面付近0.5m程度は人力で掘る。' },
        { label: '⑷', ok: false, note: '存置できるのは2/3以上が地下にもぐっている場合。1/2では足りない。' },
      ],
      basis: '砂防技術指針、土木工事共通仕様書（砂防えん堤）',
    },
  },
  A25: {
    explain: {
      point: '杭工は地すべりブロックの中央部より「下部」に計画する。基盤が強固で地盤反力が期待できる位置に打つ。',
      figures: [{
        type: 'svg',
        title: '地すべり防止工の配置',
        alt: '斜面の地すべりブロック。頭部で排土工、中央部より下部に杭工、末端に押え盛土を置く。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 170"><rect width="340" height="170" fill="#fff"/><path d="M10 30 L330 150 L330 165 L10 165 Z" fill="#e8dcc0" stroke="#8a7a55"/><path d="M60 49 Q170 130 290 135" fill="none" stroke="#b03030" stroke-width="2" stroke-dasharray="6 4"/><text x="150" y="128" font-size="11" fill="#b03030">すべり面</text><path d="M60 49 L95 62 L95 49 Z" fill="#cfd8e8" stroke="#3a5a8a"/><text x="40" y="22" font-size="12" fill="#222">頭部：排土工</text><line x1="80" y1="26" x2="80" y2="50" stroke="#222"/><g stroke="#333" stroke-width="4"><line x1="200" y1="100" x2="200" y2="150"/><line x1="222" y1="108" x2="222" y2="155"/></g><text x="170" y="74" font-size="12" fill="#222">中央部より下部：杭工</text><line x1="210" y1="78" x2="210" y2="98" stroke="#222"/><path d="M290 135 L330 150 L300 150 Z" fill="#cfd8e8" stroke="#3a5a8a"/><text x="244" y="112" font-size="12" fill="#222">末端：押え盛土</text><line x1="305" y1="116" x2="305" y2="142" stroke="#222"/></svg>',
      }],
      checks: [
        { label: '⑴', ok: true, note: '排土は頭部域でほぼ水平に大きく切る。吸水膨潤による劣化範囲を抑える。' },
        { label: '⑵', ok: true, note: '水路工は掘込み水路が原則。合流点・屈曲部・勾配変化点に集水ます。' },
        { label: '⑶', ok: false, note: '杭工はブロックの中央部より下部に計画する。上部ではない。' },
        { label: '⑷', ok: true, note: '遮水壁の背後に地下水がたまり地すべりを誘発しないか事前に確認する。' },
      ],
      basis: '河川砂防技術基準（計画編・設計編）、地すべり防止技術指針',
    },
  },
  A26: {
    explain: {
      point: '落石対策は「予防工＝落とさない」「防護工＝落ちてきたものを止める」に大別される。',
      figures: [{
        type: 'compare',
        title: '急傾斜地崩壊防止工の要点',
        columns: ['使う場面・構造'],
        rows: [
          { label: 'もたれ式擁壁', cells: ['背面の地山が比較的良好な場合'] },
          { label: '落石予防工', cells: ['転石の除去・固定で未然に防ぐ'] },
          { label: '落石防護工', cells: ['落石を斜面の下部・中部で止める'] },
          { label: '切土工', cells: ['切土後の斜面に法面保護工が必要'] },
          { label: '現場打ちコンクリート枠工', cells: ['湧水・急勾配の切土面。鉄筋コンクリート'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'もたれ式は背面の地山が比較的良好な場合に用いる。不良な地山ではない。' },
        { label: '⑵', ok: true, note: '予防工は転石の除去など、防護工は落石を下部・中部で止める。' },
        { label: '⑶', ok: false, note: '切土した斜面は風化・侵食するので法面保護工が必要。' },
        { label: '⑷', ok: false, note: '現場打ちコンクリート枠工の梁は一般に鉄筋コンクリート。' },
      ],
      basis: '新・斜面崩壊防止工事の設計と実例（全国治水砂防協会）',
    },
  },
}
