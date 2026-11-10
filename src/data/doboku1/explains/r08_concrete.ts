// 令和8年度 試験問題A No.11〜16（コンクリート）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A11' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R08_CONCRETE: Explains = {
  A11: {
    explain: {
      point: '粗骨材は「吸水が少なく、重く、すりへりにくい」ものが良い。砕石の吸水率は3％以下が目安。',
      figures: [{
        type: 'rule',
        title: '粗骨材の品質の目安と試験',
        rows: [
          { label: '砕石の吸水率', value: '3％以下', trap: '5％以下' },
          { label: '砂利の絶乾密度', value: '2.5 g/cm³ 以上' },
          { label: 'すりへり抵抗', value: 'ロサンゼルス試験（舗装コンクリート）' },
          { label: '凍結融解への抵抗', value: '硫酸ナトリウムによる安定性試験' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '砕石の吸水率は3％以下。5％では吸水が多すぎる。' },
        { label: '⑵', ok: true, note: '砂利の絶乾密度は一般に2.5 g/cm³ 以上。' },
        { label: '⑶', ok: true, note: '舗装用はすりへり減量をロサンゼルス試験で確かめる。' },
        { label: '⑷', ok: true, note: '硫酸ナトリウムの結晶圧で凍結融解の作用を模擬する。' },
      ],
      basis: 'コンクリート標準示方書［施工編］、JIS A 5005（コンクリート用砕石及び砕砂）',
    },
  },
  A12: {
    explain: {
      point: '高炉セメントはスラグの量でA・B・C種に分かれる。B種はスラグ30〜60％で、15％程度ではない。',
      figures: [{
        type: 'compare',
        title: 'セメントの種類と使い道',
        columns: ['特徴', '主な用途'],
        rows: [
          { label: '普通ポルトランド', cells: ['最も一般的', '一般の構造物'] },
          { label: '早強ポルトランド', cells: ['初期強度が大きい', 'PC・寒中・工期短縮'] },
          { label: '中庸熱ポルトランド', cells: ['水和熱が小さい', 'ダム・マスコンクリート'] },
          { label: '高炉B種', cells: ['スラグ30〜60％。長期強度・耐海水性', '下部工・港湾'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '国内生産の大部分は普通と高炉で約9割。' },
        { label: '⑵', ok: false, note: 'B種のスラグは30％を超え60％以下。15％程度ではない。' },
        { label: '⑶', ok: true, note: '早く強度が出るので PC 工事などに使う。' },
        { label: '⑷', ok: true, note: '発熱が小さいのでダムなどに使う。' },
      ],
      basis: 'JIS R 5211（高炉セメント）、コンクリート標準示方書',
    },
  },
  A13: {
    explain: {
      point: '配合は「作業できる範囲で水を少なく」が原則。水セメント比は最小、スランプはできるだけ小さくする。',
      figures: [{
        type: 'rule',
        title: '配合の決め方',
        rows: [
          { label: '強度の目標値', value: '特性値を下回る確率5％以下' },
          { label: '空気量（普通）', value: '荷卸し時 4.5％' },
          { label: '水セメント比', value: '各条件で決まる値のうち最小' },
          { label: 'スランプ', value: '作業できる範囲でできるだけ小さく', trap: 'できるだけ大きく' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '下回る確率5％以下となるよう割増して目標値を決める。' },
        { label: '⑵', ok: true, note: 'JIS A 5308 の普通コンクリートは 4.5％。' },
        { label: '⑶', ok: true, note: '強度・耐久性などから決まる値の最小をとる。' },
        { label: '⑷', ok: false, note: 'スランプは作業に適する範囲で「できるだけ小さく」。大きいと水が増える。' },
      ],
      basis: 'コンクリート標準示方書［施工編］配合設計、JIS A 5308',
    },
  },
  A14: {
    explain: {
      point: '1層の打込み高さは40〜50cm以下。バイブレータを下層に10cm程度差し込んで上下を一体にするため。',
      figures: [{
        type: 'rule',
        title: '打込みの数値',
        rows: [
          { label: '1層の高さ', value: '40〜50 cm 以下', trap: '1 m 程度以下' },
          { label: 'バイブレータの挿入', value: '下層へ 10 cm 程度' },
          { label: '壁・柱の打上がり速度', value: '30分当たり 1.0〜1.5 m 以下' },
          { label: '打重ね時間間隔', value: '遅れも見込み余裕をもって計画' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '到着遅れを見込み、余裕のある計画にする。' },
        { label: '⑵', ok: true, note: '積乱雲の発生など空の変化に注意する。' },
        { label: '⑶', ok: true, note: '30分当たり1.5m程度以下が一般的。' },
        { label: '⑷', ok: false, note: '1層は40〜50cm以下。1mでは下層まで締め固められない。' },
      ],
      basis: 'コンクリート標準示方書［施工編］打込み・締固め',
    },
  },
  A15: {
    explain: {
      point: '膨張材は湿潤状態で水を得てはじめて膨張する。収縮補償用でも湿潤養生は短縮せず、十分に行う。',
      figures: [{
        type: 'compare',
        title: '湿潤養生の考え方',
        columns: ['湿潤養生'],
        rows: [
          { label: '早強ポルトランド', cells: ['短くてよい'] },
          { label: '普通ポルトランド', cells: ['標準'] },
          { label: '混合セメントB種', cells: ['普通より長く'] },
          { label: '膨張材を使用', cells: ['膨張に水が要る → 短縮しない'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '強度の出方が遅いので普通より長く養生する。' },
        { label: '⑵', ok: false, note: '膨張には水が必要。湿潤養生を短縮できるわけではない。' },
        { label: '⑶', ok: true, note: '強度発現と温度降下を待ってから脱型し湿潤養生する。' },
        { label: '⑷', ok: true, note: '面積が広く乾きやすいので、プラスティック収縮ひび割れに注意。' },
      ],
      basis: 'コンクリート標準示方書［施工編］養生、膨張コンクリート',
    },
  },
  A16: {
    explain: {
      point: '暑中コンクリートは日平均気温25℃を超える時期に適用する。30℃ではない。',
      figures: [{
        type: 'rule',
        title: '暑中・寒中コンクリートの数値',
        rows: [
          { label: '暑中の適用', value: '日平均気温 25℃ 超', trap: '30℃ 超' },
          { label: '暑中の練混ぜ〜打終わり', value: '1.5 時間以内' },
          { label: '暑中の混和剤', value: '遅延形（コールドジョイント防止）' },
          { label: '寒中の適用', value: '日平均気温 4℃ 以下' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '日平均気温が25℃を超えるときに暑中コンクリートとする。' },
        { label: '⑵', ok: true, note: '冷たい練混ぜ水でコンクリート温度を下げる。' },
        { label: '⑶', ok: true, note: '凝結を遅らせてコールドジョイントを防ぐ。' },
        { label: '⑷', ok: true, note: '暑中は練混ぜから打終わりまで1.5時間以内が原則。' },
      ],
      basis: 'コンクリート標準示方書［施工編］暑中コンクリート',
    },
  },
}
