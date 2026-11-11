// 令和3年度 試験問題B No.1〜4（共通工学）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B01' の形。検証は src/lib/doboku1/explain.ts。
// B03 は DB の図（dbk_figures）で、土が右側（背面）にある L 型擁壁・①背面／④前面／③上面／②下面の配置を確認。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R03_B_KYOUTSU: Explains = {
  B01: {
    explain: {
      point: 'TS の水平角観測は、1対回内の観測方向数を5方向以下とする。10方向では多すぎる。',
      figures: [{
        type: 'rule',
        title: 'TS 観測の決まり（作業規程の準則）',
        rows: [
          { label: '鉛直角観測', value: '1視準1読定、望遠鏡正・反で1対回' },
          { label: '水平角観測', value: '1対回内の観測方向数は5方向以下', trap: '「10方向以下」は誤り' },
          { label: '観測の記録', value: 'データコレクタ。用いないときは観測手簿' },
          { label: '気温・気圧の測定', value: '距離測定の開始直前または終了直後' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '1視準1読定、望遠鏡正・反の1対回とする。' },
        { label: '⑵', ok: false, note: '対回内の観測方向数は5方向以下とする。' },
        { label: '⑶', ok: true, note: 'データコレクタを用い、用いないときは観測手簿に記載する。' },
        { label: '⑷', ok: true, note: '気象補正の気温・気圧は測定の開始直前か終了直後に測る。' },
      ],
      basis: '国土交通省 作業規程の準則',
    },
  },
  B02: {
    explain: {
      point: '設計図書と現場の不一致などを発見したら、受注者は直ちに監督員に「書面」で通知し、確認を請求する。口頭ではない。',
      figures: [{
        type: 'rule',
        title: '公共工事標準請負契約約款の要点',
        rows: [
          { label: '条件変更（18条）', value: '不一致等を発見 → 直ちに書面で監督員に通知', trap: '「口頭」は誤り' },
          { label: '引渡し（32条）', value: '完成確認後の申出 → 発注者は直ちに受ける' },
          { label: '臨機の措置（27条）', value: '災害防止等のため受注者が措置をとる' },
          { label: '一時中止（20条）', value: '受注者の責めによらず施工できない → 中止させる' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '通知は口頭ではなく書面で行い、確認を請求する。' },
        { label: '⑵', ok: true, note: '完成確認後に引渡しの申出があれば、直ちに受ける。' },
        { label: '⑶', ok: true, note: '災害防止等のため必要なときは臨機の措置をとる。' },
        { label: '⑷', ok: true, note: '受注者の責めによらず施工できないときは一時中止させる。' },
      ],
      basis: '公共工事標準請負契約約款 第18条・第20条・第27条・第32条',
    },
  },
  B03: {
    explain: {
      point: '土がある側が引っ張られる。たて壁は土圧で前へ押され背面側（①）が引張、かかと版は上の土の重さで下へ曲げられ上面側（③）が引張。',
      figures: [{
        type: 'svg',
        title: 'L 型擁壁の引張側（模式図）',
        alt: 'L 型擁壁の断面。右側に背面の土。たて壁の背面側（①）とかかと版の上面側（③）を赤で示し引張側、たて壁の前面（④）と底版の下面（②）を破線で示し圧縮側とした図。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 250" font-family="sans-serif" font-size="12"><path d="M190 40 L250 40" stroke="#8a6d3b" stroke-width="2"/><rect x="190" y="40" width="150" height="150" fill="#f3e6c8"/><text x="265" y="120" fill="#8a6d3b" text-anchor="middle">背面の土</text><text x="265" y="136" fill="#8a6d3b" text-anchor="middle">（土圧・土の重さ）</text><path d="M150 40 H190 V190 H340 V220 H110 V190 H150 Z" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/><line x1="185" y1="48" x2="185" y2="196" stroke="#d62728" stroke-width="4"/><line x1="183" y1="195" x2="334" y2="195" stroke="#d62728" stroke-width="4"/><line x1="155" y1="48" x2="155" y2="185" stroke="#999" stroke-width="2" stroke-dasharray="4 3"/><line x1="116" y1="215" x2="334" y2="215" stroke="#999" stroke-width="2" stroke-dasharray="4 3"/><text x="200" y="60" fill="#d62728">① たて壁の背面側</text><text x="215" y="182" fill="#d62728">③ かかと版の上面側</text><text x="146" y="70" fill="#666" text-anchor="end">④ 前面</text><text x="118" y="240" fill="#666">② 底版の下面</text><text x="10" y="20" fill="#d62728">赤＝引張側（主鉄筋）</text><text x="200" y="20" fill="#666">破線＝圧縮側</text></svg>',
      }],
      checks: [
        { label: '⑴', ok: false, note: '②は底版の下面。かかと版は上面側が引張になる。' },
        { label: '⑵', ok: true, note: 'たて壁は背面側の①、かかと版は上面側の③が引張鉄筋。' },
        { label: '⑶', ok: false, note: '②（下面）・④（前面）はいずれも圧縮側。' },
        { label: '⑷', ok: false, note: '④はたて壁の前面で圧縮側。背面側の①が引張。' },
      ],
      basis: '鉄筋コンクリート擁壁の構造（片持ちばりとしての曲げ）',
    },
  },
  B04: {
    explain: {
      point: '可搬式の電動機械器具の感電防止は「感電防止用漏電しゃ断装置」。自動電撃防止装置は交流アーク溶接機に付けるもの。',
      figures: [{
        type: 'compare',
        title: '感電防止の装置',
        columns: ['付ける機器', '防ぐもの'],
        rows: [
          { label: '感電防止用漏電しゃ断装置', cells: ['水中ポンプ・バイブレータ等の可搬式電動機械', '漏電による感電'] },
          { label: '自動電撃防止装置', cells: ['交流アーク溶接機', '無負荷電圧による感電'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '可搬式電動機械には感電防止用漏電しゃ断装置を接続する。' },
        { label: '⑵', ok: true, note: 'ホルダーは絶縁効力と耐熱性のあるものを使う。' },
        { label: '⑶', ok: true, note: '車両の通過等で被覆が損傷しない状態で使用する。' },
        { label: '⑷', ok: true, note: '操作部分に必要な照度を保持する。' },
      ],
      basis: '労働安全衛生規則第333条・第332条・第331条・第338条・第335条',
    },
  },
}
