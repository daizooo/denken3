// 令和元年度 試験問題B No.1〜4（共通工学）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B01' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R01_B_KYOUTSU: Explains = {
  B01: {
    explain: {
      point: 'TS の距離測定にともなう気温・気圧の測定は、TS を整置した測点（器械点）で行う。反射鏡の測点だけで測るのは誤り。',
      figures: [{
        type: 'rule',
        title: 'TS 観測の決まり',
        rows: [
          { label: '距離測定', value: '1視準2読定を1セット' },
          { label: '鉛直角観測', value: '1視準1読定、望遠鏡正・反で1対回' },
          { label: '気温・気圧の測定', value: 'TS を整置した測点で行う', trap: '反射鏡の測点のみは誤り' },
          { label: '鉛直角・距離の観測値', value: '水平角の対回数に合わせ、全て採用して平均' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '距離測定は1視準2読定で1セット。' },
        { label: '⑵', ok: true, note: '鉛直角は1視準1読定、正・反で1対回。' },
        { label: '⑶', ok: false, note: '気温・気圧は TS を整置した測点で測る。' },
        { label: '⑷', ok: true, note: '取得した鉛直角・距離はすべて採用し平均値を使える。' },
      ],
      basis: '作業規程の準則（国土交通省）',
    },
  },
  B02: {
    explain: {
      point: '受注者が監督員に通知して確認を求めるのは、設計図書の不一致・誤謬脱漏・不明確、施工条件の相違、予期できない特別な状態など。建設機械の明示がないことは含まれない。',
      figures: [{
        type: 'rule',
        title: '条件変更等で通知・確認を請求する事項（約款）',
        rows: [
          { label: '1', value: '図面・仕様書などが一致しない' },
          { label: '2', value: '設計図書に誤謬・脱漏がある' },
          { label: '3', value: '設計図書の表示が明確でない' },
          { label: '4', value: '施工条件が実際と一致しない' },
          { label: '5', value: '予期できない特別な状態が生じた' },
          { label: '建設機械の明示がない', value: '該当しない（施工方法は受注者が定める）', trap: '通知事項ではない' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '誤謬・脱漏は通知して確認を求める事項（該当する）。' },
        { label: '⑵', ok: false, note: '予期できない特別な状態は通知事項（該当する）。' },
        { label: '⑶', ok: false, note: '図面と仕様書の不一致は通知事項（該当する）。' },
        { label: '⑷', ok: true, note: '建設機械の明示がないことは通知事項ではない（これが答え）。' },
      ],
      basis: '公共工事標準請負契約約款 第18条（条件変更等）',
    },
  },
  B03: {
    explain: {
      point: '頂版の内側主鉄筋は S1 D19。側壁の内側（E-E）には頂版からの S1 D19 と底版からの F1 D22 が入り、同じ太さとはいえない。土かぶり2.0m・間隔250mm・部材厚400mm は図のとおり。',
      figures: [{
        type: 'rule',
        title: '図から読み取る値',
        rows: [
          { label: '頂版の内側主鉄筋', value: 'S1 D19' },
          { label: '側壁の内側（E-E）', value: 'S1 D19 と F1 D22', trap: '頂版内側と同じ太さではない' },
          { label: '側壁の外側（D-D）', value: 'W1 D13' },
          { label: '土かぶり', value: '2,000mm（2.0m）' },
          { label: '主鉄筋の間隔', value: '延長方向に250mm（4×250＝1,000）' },
          { label: '部材厚（頂版・側壁・底版）', value: 'いずれも400mm（ハンチを除く）' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '側壁の内側には D22（F1）も入り、頂版内側の D19 と同じ太さではない。' },
        { label: '⑵', ok: true, note: '一般図の土かぶりは2,000mm。' },
        { label: '⑶', ok: true, note: '主鉄筋は延長方向に250mm 間隔。' },
        { label: '⑷', ok: true, note: '頂版・側壁・底版とも厚さ400mm。' },
      ],
      basis: '問題の一般図・配筋図（側壁 D-D・E-E、頂版 A-A・B-B）',
    },
  },
  B04: {
    explain: {
      point: '受電容量は、月別の負荷設備容量の合計のうち最大の月に対して不足しないように決める。',
      figures: [{
        type: 'rule',
        title: '工事用電力設備の要点',
        rows: [
          { label: '契約電力50kW 未満', value: '低圧で受電', trap: '100kW 未満は誤り' },
          { label: '契約電力50kW 以上', value: '高圧（6kV）で受電', trap: '3kV は誤り' },
          { label: '自家用変電設備の位置', value: '負荷の中心に近い所' },
          { label: '受電容量', value: '月別合計の最大負荷に対して不足しないよう決定' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '低圧で受電するのは50kW 未満。' },
        { label: '⑵', ok: false, note: '変電設備はできるだけ負荷の中心に近い位置に置く。' },
        { label: '⑶', ok: false, note: '高圧受電は6kV（6.6kV）で供給される。' },
        { label: '⑷', ok: true, note: '月別の電力合計の最大に合わせて受電容量を決める。' },
      ],
      basis: '電気設備技術基準／電力会社の電気需給約款',
    },
  },
}
