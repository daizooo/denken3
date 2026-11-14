// 令和7年度 試験問題B No.1〜4（測量・契約・設計図・建設機械）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B01' の形。検証は src/lib/doboku1/explain.ts。
// B03 の図は dbk_figures（D1_R07_B_03）で、背面側（盛土側）が右、②がかかと版上面・③がかかと版下面・④がたて壁背面・①がつま先側であることを確認して作図。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R07_B_KYOUTSU: Explains = {
  B01: {
    explain: {
      point: 'TS の鉛直角観測は「1視準1読定、望遠鏡正及び反の観測を1対回」。2読定・2対回ではない。距離測定の「1視準2読定」と混同しない。',
      figures: [{
        type: 'rule',
        title: 'TS による観測の基準（作業規程の準則）',
        rows: [
          { label: '水平角観測', value: '1視準1読定、正反を2対回。1対回内は5方向以下' },
          { label: '鉛直角観測', value: '1視準1読定、正反を1対回', trap: '1視準2読定・2対回' },
          { label: '距離測定', value: '1視準2読定を1セット' },
          { label: '距離のセット内較差', value: '20mmを標準' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '鉛直角は1視準1読定、正反1対回。2読定・2対回ではない。' },
        { label: '⑵', ok: true, note: '水平角観測の1対回内の観測方向数は5方向以下。' },
        { label: '⑶', ok: true, note: '距離測定は1視準2読定を1セットとする。' },
        { label: '⑷', ok: true, note: '1セット内の測定値の較差は20mmを標準とする。' },
      ],
      basis: '作業規程の準則（国土交通省）',
    },
  },
  B02: {
    explain: {
      point: '受注者が監督員に通知し確認を請求する「条件変更」（約款18条）は5項目。設計図書に定めのない仮設・施工方法は、受注者が自らの責任で定めるもの（1条3項）。',
      figures: [{
        type: 'rule',
        title: '条件変更等（公共工事標準請負契約約款18条1項）',
        rows: [
          { label: '1号', value: '図面・仕様書・現場説明書・質問回答書が一致しない' },
          { label: '2号', value: '設計図書に誤謬・脱漏がある' },
          { label: '3号', value: '設計図書の表示が明確でない' },
          { label: '4号', value: '現場の形状・地質・湧水等が施工条件と一致しない' },
          { label: '5号', value: '予期できない特別な状態が生じた' },
          { label: '該当しない', value: '定めのない仮設・施工方法（受注者が定める）', trap: '確認を請求する' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '設計図書間の不一致は18条1項1号に該当する。' },
        { label: '⑵', ok: false, note: '表示が明確でないことは18条1項3号に該当する。' },
        { label: '⑶', ok: true, note: '定めのない仮設・施工方法は受注者が定める（1条3項）。該当しない。' },
        { label: '⑷', ok: false, note: '現場と施工条件の不一致は18条1項4号に該当する。' },
      ],
      basis: '公共工事標準請負契約約款1条3項・18条',
    },
  },
  B03: {
    explain: {
      point: 'かかと版は上に載る盛土の重さで下向きに曲げられ、上面側が引張になる。上面に配置された主鉄筋 ②D22 が引張鉄筋。',
      figures: [{
        type: 'svg',
        title: '逆T型擁壁の引張側（模式図）',
        alt: '逆T型擁壁の断面。右側が盛土側。たて壁は背面側、かかと版は上面側、つま先版は下面側が引張になり、②D22 がかかと版上面、④D22 がたて壁背面、③D13 がかかと版下面にある。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#fff"/><path d="M150 30 L310 30 L310 150 L170 150 Z" fill="#e9dfc7"/><text x="240" y="60" font-size="12" fill="#6d6248">盛土</text><path d="M60 150 L290 150 L290 178 L60 178 Z" fill="#cfd8e3" stroke="#334"/><path d="M140 20 L170 20 L170 150 L140 150 Z" fill="#cfd8e3" stroke="#334"/><line x1="166" y1="26" x2="166" y2="170" stroke="#d33" stroke-width="3"/><line x1="166" y1="155" x2="286" y2="155" stroke="#d33" stroke-width="3"/><line x1="64" y1="174" x2="140" y2="174" stroke="#d33" stroke-width="3"/><line x1="174" y1="174" x2="286" y2="174" stroke="#888" stroke-dasharray="3 2"/><text x="176" y="95" font-size="12" fill="#d33">④ 背面（引張）</text><text x="174" y="146" font-size="12" fill="#d33">② かかと版上面（引張）</text><text x="196" y="194" font-size="12" fill="#555">③ かかと版下面</text><text x="62" y="194" font-size="12" fill="#d33">つま先版下面（引張）</text><path d="M285 86 L285 122" stroke="#2a5db0" stroke-width="2"/><path d="M285 128 l-5 -8 h10 Z" fill="#2a5db0"/><text x="236" y="80" font-size="11" fill="#2a5db0">土の重さ</text><text x="66" y="140" font-size="11" fill="#334">つま先</text><text x="30" y="80" font-size="11" fill="#555">前面</text></svg>',
      }],
      checks: [
        { label: '⑴', ok: false, note: '①D13 は底版の配力鉄筋（延長方向）。引張鉄筋ではない。' },
        { label: '⑵', ok: true, note: 'かかと版の上面に配置された主鉄筋。上面側が引張になる。' },
        { label: '⑶', ok: false, note: '③D13 はかかと版の下面（圧縮側）の鉄筋。' },
        { label: '⑷', ok: false, note: '④D22 はたて壁の背面側の主鉄筋（たて壁の引張鉄筋）。' },
      ],
      basis: '道路土工 擁壁工指針（日本道路協会）',
    },
  },
  B04: {
    explain: {
      point: '設計との差分をモニタに表示してオペレータを案内するのはマシンガイダンス（MG）。マシンコントロール（MC）は機械を自動制御する。',
      figures: [{
        type: 'compare',
        title: 'マシンガイダンスとマシンコントロール',
        columns: ['仕組み'],
        rows: [
          { label: 'マシンガイダンス（MG）', cells: ['設計との差分を表示し、オペレータの操作を案内'] },
          { label: 'マシンコントロール（MC）', cells: ['設計データに合わせて作業装置を自動制御'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '情報化施工は測位技術と機械制御の自動化などで生産性・品質を高める。' },
        { label: '⑵', ok: false, note: '差分を表示して案内するのはマシンガイダンス。MCは自動制御。' },
        { label: '⑶', ok: true, note: 'ICT 計測機器で計測から結果の取りまとめまで行える。' },
        { label: '⑷', ok: true, note: 'UAV は自律飛行が可能になり、計測・点検に使われている。' },
      ],
      basis: 'ICT 活用工事の各種要領（国土交通省）',
    },
  },
}
