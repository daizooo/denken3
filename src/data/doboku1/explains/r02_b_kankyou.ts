// 令和2年度 試験問題B No.32〜35（環境保全）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B32' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R02_B_KANKYOU: Explains = {
  B32: {
    explain: {
      point: '既製杭は、騒音・振動対策として静的に貫入させる埋込み工法を採用することが「多い」。',
      figures: [{
        type: 'compare',
        title: '既製杭工法と騒音・振動',
        columns: ['貫入の方法', '騒音・振動'],
        rows: [
          { label: '打込み工法', cells: ['動的（打撃・振動）', '大きい'] },
          { label: '埋込み工法', cells: ['静的（掘削・圧入）', '小さい → 対策として多用'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '騒音・振動対策として埋込み工法を採用することが多い。' },
        { label: '⑵', ok: true, note: '不必要な操作・走行を避け、振動の少ない操作を行う。' },
        { label: '⑶', ok: true, note: '発生振動レベル値の小さい機械を選定する。' },
        { label: '⑷', ok: true, note: '対策は発生源・伝搬経路が中心で、受音点対策は一般的でない。' },
      ],
      basis: '建設工事に伴う騒音振動対策技術指針（国土交通省）',
    },
  },
  B33: {
    explain: {
      point: '工事の濁水処理は、SSの除去と、セメントによるアルカリ性の中和が主となる。',
      figures: [{
        type: 'flow',
        title: '濁水処理の流れ',
        steps: ['濁水（土砂・セメント）', '凝集剤でSSを凝集・沈殿', '中和（アルカリ性を下げる）', '放流', '沈殿汚泥は脱水処理'],
      }],
      checks: [
        { label: '⑴', ok: false, note: '過剰投資にならないよう、必要能力に見合った設備を選ぶ。' },
        { label: '⑵', ok: false, note: 'SSが高くなるので脱水設備は大型になる。' },
        { label: '⑶', ok: true, note: 'SSの除去とアルカリ性分の中和が主となる。' },
        { label: '⑷', ok: false, note: '凝集剤の添加量はSSの成分や水質にも影響される。' },
      ],
      basis: '土木工事の濁水処理の教本類',
    },
  },
  B34: {
    explain: {
      point: '伐採木・伐根材・梱包材は建設資材ではないので、建設リサイクル法の分別解体等・再資源化等の義務の対象外。',
      figures: [{
        type: 'compare',
        title: '建設リサイクル法の対象',
        columns: ['義務の対象'],
        rows: [
          { label: 'コンクリート塊・アスファルト塊', cells: ['対象（特定建設資材）'] },
          { label: '建設発生木材・木材の端材', cells: ['対象（特定建設資材）'] },
          { label: '伐採木・伐根材', cells: ['対象外（建設資材でない）'] },
          { label: '梱包材', cells: ['対象外（建設資材でない）'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '解体・新設で生じたコンクリート塊や木材の端材などが建設資材廃棄物。' },
        { label: '⑵', ok: false, note: '伐採木・伐根材・梱包材は建設資材でなく、義務の対象外。' },
        { label: '⑶', ok: true, note: '解体工事業者は技術管理者を選任しなければならない。' },
        { label: '⑷', ok: true, note: '建設業者は発生抑制と再資源化費用の低減に努める。' },
      ],
      basis: '建設工事に係る資材の再資源化等に関する法律 2条・5条・9条・31条',
    },
  },
  B35: {
    explain: {
      point: '多量排出事業者の産業廃棄物処理計画の提出先は「都道府県知事」。環境大臣ではない。',
      figures: [{
        type: 'rule',
        title: '廃棄物処理法の要点',
        rows: [
          { label: '運搬までの保管', value: '技術上の基準に従って保管' },
          { label: '運搬・処分の委託', value: '受託者にマニフェストを交付' },
          { label: '非常災害時', value: '国・自治体・事業者等が役割分担・連携' },
          { label: '多量排出事業者の処理計画', value: '都道府県知事に提出', trap: '環境大臣に提出' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '運搬されるまでの間、技術上の基準に従って保管する。' },
        { label: '⑵', ok: true, note: '委託する場合は受託者にマニフェストを交付する。' },
        { label: '⑶', ok: true, note: '非常災害時は関係者が役割分担し、連携・協力に努める。' },
        { label: '⑷', ok: false, note: '処理計画の提出先は都道府県知事。環境大臣ではない。' },
      ],
      basis: '廃棄物の処理及び清掃に関する法律 2条の5・12条・12条の3',
    },
  },
}
