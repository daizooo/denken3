// 令和4年度 試験問題B No.1〜4（共通工学：測量・契約・設計図・電気）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B01' の形。検証は src/lib/doboku1/explain.ts。
// B03 の鉄筋径・間隔は dbk_figures（D1_R04_B_03）のボックスカルバート配筋図から読み取り。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R04_B_KYOUTSU: Explains = {
  B01: {
    explain: {
      point: 'TS 観測では、器械高・反射鏡高・目標高はミリメートル位まで測定する。センチメートル位では精度が足りない。',
      figures: [{
        type: 'rule',
        title: 'TS による観測の決まり',
        rows: [
          { label: '距離測定の気象観測', value: '測定開始直前または終了直後に気温・気圧' },
          { label: '目盛変更ができない機器', value: '1対回の繰返し観測' },
          { label: '器械高・反射鏡高・目標高', value: 'ミリメートル位まで測定', trap: '「センチメートル位」は誤り' },
          { label: '距離の測定値', value: '水平角の対回数に合わせて取得し、平均値を使う' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '気温・気圧は測定開始直前か終了直後に測る。' },
        { label: '⑵', ok: true, note: '目盛変更できない機器は1対回の繰返し観測を行う。' },
        { label: '⑶', ok: false, note: '器械高・反射鏡高・目標高はミリメートル位まで測る。' },
        { label: '⑷', ok: true, note: '対回数に合わせて得た距離測定値は平均値を用いる。' },
      ],
      basis: '作業規程の準則（国土交通省）',
    },
  },
  B02: {
    explain: {
      point: '検査で不合格と決定した工事材料は、所定の期日以内に工事現場外へ搬出する。現場内に保管すると誤って使われるおそれがある。',
      figures: [{
        type: 'rule',
        title: '約款の要点',
        rows: [
          { label: '不合格の工事材料', value: '所定の期日以内に工事現場外へ搬出', trap: '「現場内に保管」は誤り' },
          { label: '天災等による損害', value: '発生後直ちに発注者に通知' },
          { label: '工期の変更', value: '働き方（労働時間など）を考慮して日数を定める' },
          { label: '設計図書の変更', value: '必要なら工期・請負代金額を変更' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '不合格材料は所定の期日以内に工事現場外へ搬出する。' },
        { label: '⑵', ok: true, note: '不可抗力による損害は、発生後直ちに発注者に通知する。' },
        { label: '⑶', ok: true, note: '労働条件の適正確保のため、実施困難な日数などを考慮する。' },
        { label: '⑷', ok: true, note: '設計図書を変更し必要があれば工期・代金額を変更する。' },
      ],
      basis: '公共工事標準請負契約約款 第13条・第18条〜第21条・第30条',
    },
  },
  B03: {
    explain: {
      point: '配筋図は記号の頭文字で部材を読む（S＝頂版、W＝側壁、F＝底版）。側壁の内面主鉄筋は W₁ の D13。D22 は底版から外面に立ち上がる F₁。',
      figures: [{
        type: 'compare',
        title: '配筋図の読み取り（図より）',
        columns: ['鉄筋', '間隔'],
        rows: [
          { label: '頂版の主鉄筋（S₁）', cells: ['D19', '250mm'] },
          { label: '側壁の内面主鉄筋（W₁）', cells: ['D13', '250mm'] },
          { label: '側壁の外面主鉄筋', cells: ['S₁ D19・F₁ D22 が回り込む', '250mm'] },
          { label: '配力鉄筋（S₅・W₃・F₅）', cells: ['D13', '250mm'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '頂版の主鉄筋は S₁ の D19。' },
        { label: '⑵', ok: true, note: '頂版の下面主鉄筋は軸方向に 250mm 間隔。' },
        { label: '⑶', ok: false, note: '側壁の内面主鉄筋は W₁ の D13。D22 は外面の F₁。' },
        { label: '⑷', ok: true, note: '側壁の外面主鉄筋も軸方向に 250mm 間隔で配置されている。' },
      ],
      basis: '設計図（配筋図）の読み方',
    },
  },
  B04: {
    explain: {
      point: '変電設備は負荷の中心にできるだけ近い位置に置く。遠いと配電線が長くなり、電圧降下と損失が大きくなる。',
      figures: [{
        type: 'rule',
        title: '工事用電力設備の要点',
        rows: [
          { label: '受電容量', value: '月別の負荷合計の最大値で決める' },
          { label: '50kW 未満', value: '低圧で受電' },
          { label: '高圧受電', value: '責任分界点に保護施設付きの受電設備' },
          { label: '変電設備の位置', value: '負荷の中心にできるだけ近く', trap: '「遠い位置」は誤り' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '月別の電力合計の最大値に対して容量不足にならないよう決める。' },
        { label: '⑵', ok: true, note: '契約電力50kW 未満は低圧で受電する。' },
        { label: '⑶', ok: true, note: '責任分界点に保護施設を備えた受電設備を設ける。' },
        { label: '⑷', ok: false, note: '電圧降下・損失を減らすため、負荷の中心に近い位置を選ぶ。' },
      ],
      basis: '電気設備の技術基準・工事用電力設備の一般的な計画',
    },
  },
}
