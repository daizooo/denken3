// 令和3年度 試験問題A No.33〜36（ダム・トンネル）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A33' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R03_DAMTUNNEL: Explains = {
  A33: {
    explain: {
      point: 'ステージ注入は「上から順に、掘っては注入」を繰り返す工法。最終深度まで一度に掘って下から注入するのはパッカー注入。',
      figures: [{
        type: 'compare',
        title: 'グラウチングの注入方式',
        columns: ['削孔', '注入の順序'],
        rows: [
          { label: 'ステージ注入', cells: ['ステージごとに削孔', '上位→下位へ交互に繰り返す'] },
          { label: 'パッカー注入', cells: ['最終深度まで一度に削孔', '下位→上位へ'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '記述はパッカー注入。ステージ注入は上から削孔と注入を繰り返す。' },
        { label: '⑵', ok: true, note: '特殊な注入工法として二重管式注入工法がある。' },
        { label: '⑶', ok: true, note: '規定孔を格子状に配置し中央内挿法で施工する。' },
        { label: '⑷', ok: true, note: '浸透路長の短い部分や水みちとなる高透水部の遮水性を改良する。' },
      ],
      basis: 'グラウチング技術指針・同解説（国土交通省）',
    },
  },
  A34: {
    explain: {
      point: 'RCD 工法の横継目は振動目地切機で設け、間隔はダム軸方向に 15 m が標準。',
      figures: [{
        type: 'rule',
        title: 'RCD 工法の数値',
        rows: [
          { label: '敷均し厚さ', value: '締固め後25cm程度 ← 敷均し27cm程度' },
          { label: '練混ぜ〜締固めの許容時間', value: '夏季3時間・冬季4時間程度' },
          { label: '止水版', value: '横継目の上流端付近に主副2枚' },
          { label: '横継目の間隔', value: 'ダム軸方向15m', trap: '「30m」は誤り' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '締固め後25cm程度になるよう27cm程度に敷き均す。' },
        { label: '⑵', ok: true, note: '夏季3時間程度、冬季4時間程度が標準。' },
        { label: '⑶', ok: true, note: '漏水経路となるため上流端付近に主副2枚の止水版を設ける。' },
        { label: '⑷', ok: false, note: '横継目の間隔はダム軸方向15mが標準。' },
      ],
      basis: 'RCD工法技術指針・ダムコンクリート標準示方書',
    },
  },
  A35: {
    explain: {
      point: '孔から水を抜いて水圧・水位を下げるのは水抜きボーリング・ウェルポイントなどの排水工法。止水注入工法は水の通り道を塞ぐ工法。',
      figures: [{
        type: 'compare',
        title: '山岳トンネルの補助工法',
        columns: ['工法の例'],
        rows: [
          { label: '切羽安定（天端）', cells: ['フォアポーリング・長尺フォアパイリング'] },
          { label: '地下水（排水）', cells: ['水抜きボーリング・ウェルポイント・ディープウェル'] },
          { label: '地下水（止水）', cells: ['止水注入工法・圧気'] },
          { label: '地表面沈下', cells: ['パイプルーフ'] },
          { label: '近接構造物', cells: ['遮断壁工法'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '天端の安定対策にフォアポーリング・長尺フォアパイリングがある。' },
        { label: '⑵', ok: false, note: '孔で水を抜くのは水抜きボーリング等。止水注入は水を止める工法。' },
        { label: '⑶', ok: true, note: 'パイプルーフは鋼管の剛性で地山を補強する。' },
        { label: '⑷', ok: true, note: '遮断壁で変位の伝搬や地下水低下を抑える。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
  A36: {
    explain: {
      point: '鋼製支保工は、吹付けコンクリートが硬化するまでの早期の支持が必要な「地山条件が悪い」場合に用いる。',
      figures: [{
        type: 'rule',
        title: '山岳トンネルの支保工の要点',
        rows: [
          { label: '施工時期', value: '掘削後速やかに、地山と密着・一体化' },
          { label: '吹付けコンクリート', value: 'ノズルは吹付け面に直角、距離・速度を適正に' },
          { label: '鋼製支保工', value: '地山条件が悪い場合に用い、吹付けと一体化', trap: '「良好な場合」は誤り' },
          { label: 'ロックボルト', value: 'プレートを面に密着させナットで固定' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '掘削後速やかに施工し、地山と密着・一体化させる。' },
        { label: '⑵', ok: true, note: 'ノズルを直角に保ち、距離と衝突速度を適正にする。' },
        { label: '⑶', ok: false, note: '鋼製支保工は地山条件が悪い場合に用いる。' },
        { label: '⑷', ok: true, note: 'プレートを密着させてナット等で固定する。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
}
