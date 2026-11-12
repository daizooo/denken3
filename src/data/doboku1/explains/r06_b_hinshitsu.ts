// 令和6年度 試験問題B No.14〜16・32〜35（品質管理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B14' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R06_B_HINSHITSU: Explains = {
  B14: {
    explain: {
      point: '管理の限界を十分満足できることが明確になれば、試験の「頻度」を減らせる。試験項目そのものを減らすのではない。',
      figures: [{
        type: 'rule',
        title: 'アスファルト舗装の品質管理',
        rows: [
          { label: '組合せを変えたとき', value: '試験頻度を増やし新たな組合せで品質確認' },
          { label: '合理化', value: '非破壊測定機器・同時管理できる機械を活用' },
          { label: '安定が明確', value: '試験の頻度を減らせる', trap: '「試験項目を減らす」は誤り' },
          { label: '異常の兆候', value: '限界外・片寄りは直ちに頻度を増やして確認' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '組合せを変えたら頻度を増して品質を確認する。' },
        { label: '⑵', ok: true, note: '非破壊機器や同時管理できる機械の活用が望ましい。' },
        { label: '⑶', ok: false, note: '減らせるのは試験の頻度。試験項目ではない。' },
        { label: '⑷', ok: true, note: '限界外や片寄りがあれば直ちに頻度を増やす。' },
      ],
      basis: '舗装施工便覧（日本道路協会）',
    },
  },
  B15: {
    explain: {
      point: 'プルーフローリング試験は、締固めが「終わった後」に転圧機械と同等以上の車両を走らせ、たわみの大きい不良箇所を見つける。',
      figures: [{
        type: 'compare',
        title: '路床・路盤の試験',
        columns: ['目的'],
        rows: [
          { label: '平板載荷試験', cells: ['地盤支持力係数K値を求める'] },
          { label: '修正CBR試験', cells: ['路盤材料の強度特性・材料選定'] },
          { label: 'プルーフローリング', cells: ['締固め完了後にたわみを見て不良箇所を発見'] },
          { label: 'RIによる測定', cells: ['現場の密度・含水比'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: 'K値を求めて支持力を把握する。' },
        { label: '⑵', ok: true, note: '所要の締固め度での強度特性を知り材料選定に使う。' },
        { label: '⑶', ok: false, note: 'プルーフローリングは締固めの途中ではなく完了後に行う。' },
        { label: '⑷', ok: true, note: '現場の密度と含水比を求める。' },
      ],
      basis: '舗装調査・試験法便覧（日本道路協会）',
    },
  },
  B16: {
    explain: {
      point: 'スランプ12cm の許容差は±2.5cm（9.5〜14.5cm）なので14.5cm は合格。空気量は±1.5％、塩化物は0.30kg/m³以下、アルカリ総量は3.0kg/m³以下。',
      figures: [{
        type: 'compare',
        title: 'JIS A 5308 受入れ検査の基準',
        columns: ['基準', 'この問の値'],
        rows: [
          { label: 'スランプ（8〜18cm）', cells: ['±2.5cm', '12→14.5 合格'] },
          { label: '空気量', cells: ['±1.5％', '4.5→6.5 不合格'] },
          { label: '塩化物イオン量', cells: ['0.30kg/m³以下', '1.2 不合格'] },
          { label: 'アルカリ総量', cells: ['3.0kg/m³以下', '4.0 不合格'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '12±2.5cm の範囲（14.5cm）なので合格。' },
        { label: '⑵', ok: false, note: '許容差±1.5％を超える（6.0％まで）。不合格。' },
        { label: '⑶', ok: false, note: '塩化物イオン量は0.30kg/m³以下。不合格。' },
        { label: '⑷', ok: false, note: 'アルカリ総量は3.0kg/m³以下。不合格。' },
      ],
      basis: 'JIS A 5308（レディーミクストコンクリート）',
    },
  },
  B32: {
    explain: {
      point: '管理限界内でも、限界線への接近や中心線の片側への偏りは異常のサイン。逆に全点が中心線付近に集まりすぎるのも限界線の見直しが必要。',
      figures: [{
        type: 'compare',
        title: '管理図の点の並び方',
        columns: ['判断'],
        rows: [
          { label: '全点が中心線の近くに集中', cells: ['管理限界・層別を見直す'] },
          { label: '管理限界線への接近がしばしば', cells: ['異常あり'] },
          { label: '連続した上昇・下降なし、限界内', cells: ['安定'] },
          { label: '中心線の片側に連続', cells: ['異常あり'] },
        ],
      }],
      checks: [
        { label: '①', ok: false, note: '中心線付近に集まりすぎるのは限界線の取り方に問題がある。' },
        { label: '②', ok: true, note: '限界線への接近がしばしば現れたら異常と考える。' },
        { label: '③', ok: true, note: '限界内で連続した上昇・下降がなければ安定。' },
        { label: '④', ok: true, note: '片側に並ぶ（連）のは異常と考える。' },
      ],
      basis: 'JIS Z 9020-2（管理図）、品質管理の一般的な知見',
    },
  },
  B33: {
    explain: {
      point: 'TS・GNSSによる締固め管理は、締固め回数で管理する「工法規定方式」。まき出し厚は試験施工の値以下、全面が規定回数の色になるまで締め固める。',
      figures: [{
        type: 'rule',
        title: 'TS・GNSSによる締固め管理',
        rows: [
          { label: 'イ', value: '工法規定方式', trap: '品質規定方式' },
          { label: 'ロ', value: '走行位置から締固め回数を確認', trap: '締固め度' },
          { label: 'ハ', value: 'まき出し厚は試験施工の値以下', trap: '以上' },
          { label: 'ニ', value: '全面が規定回数の色になるまで', trap: '規定時間' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '品質規定方式ではなく工法規定方式。ハは以下。' },
        { label: '⑵', ok: false, note: 'ニは規定時間ではなく規定回数。' },
        { label: '⑶', ok: false, note: '品質規定・締固め度・以上・規定時間はすべて誤り。' },
        { label: '⑷', ok: true, note: '工法規定方式・締固め回数・以下・規定回数。' },
      ],
      basis: 'TS・GNSSを用いた盛土の締固め管理要領（国土交通省）',
    },
  },
  B34: {
    explain: {
      point: '重ね継手の長さは鉄筋径に応じて決まり、焼なまし鉄線は長く巻くと付着を妨げる。ガス圧接は径差7mm以下なら可能。正しいのは④だけ。',
      figures: [{
        type: 'rule',
        title: '鉄筋の継手の要点',
        rows: [
          { label: '①重ね継手の長さ', value: '鉄筋径に応じて定める', trap: '「径に関わらず一定」は誤り' },
          { label: '②焼なまし鉄線', value: '必要以上に長く巻かない（付着を妨げる）', trap: '「長いほど強度向上」は誤り' },
          { label: '③ガス圧接', value: '径の差が7mm以下なら接合できる', trap: '「少しでも異なれば不可」は誤り' },
          { label: '④モルタル充塡継手', value: '排出孔からの排出を確認' },
        ],
      }],
      checks: [
        { label: '①', ok: false, note: '重ね長さは鉄筋径に応じて決める。' },
        { label: '②', ok: false, note: '長く巻くとコンクリートとの付着を妨げる。' },
        { label: '③', ok: false, note: '径の差が7mm以下なら圧接できる。' },
        { label: '④', ok: true, note: '排出孔からモルタルが出ていることで充塡を確認する。' },
      ],
      basis: 'コンクリート標準示方書［施工編］（土木学会）、鉄筋継手工事標準仕様書',
    },
  },
  B35: {
    explain: {
      point: '超音波法は鉄筋があると伝播速度が変わるので、鉄筋の影響を避けた位置で測る。任意の位置で測れるわけではない。',
      figures: [{
        type: 'compare',
        title: '微破壊・非破壊による強度推定',
        columns: ['留意点'],
        rows: [
          { label: 'リバウンドハンマ', cells: ['含水・中性化の影響。材齢が進むと推定困難'] },
          { label: '超音波法', cells: ['鉄筋の影響を受ける。配筋を避けて測定'] },
          { label: '衝撃弾性波法', cells: ['速度と強度の関係を事前に求めておく'] },
          { label: '小径コア', cells: ['φ100コアへの補正方法が確立した方法で'] },
        ],
      }],
      checks: [
        { label: '①', ok: true, note: '含水・中性化の影響で、材齢が進むと精度よく推定しにくい。' },
        { label: '②', ok: false, note: '超音波法は鉄筋の影響を受けるので配筋状況に注意する。' },
        { label: '③', ok: true, note: 'コンクリートごとに速度と強度の関係を事前に求める。' },
        { label: '④', ok: true, note: 'φ100コアに対する補正方法が確立した方法で行う。' },
      ],
      basis: '微破壊・非破壊試験によるコンクリート構造物の強度測定要領（国土交通省）',
    },
  },
}
