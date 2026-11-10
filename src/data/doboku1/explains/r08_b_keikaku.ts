// 令和8年度 試験問題B No.1〜5・21〜24（測量・契約・設計図・建設機械・施工計画・施工体制・原価）の図解解説。
// Claude 作成・根拠未確認（verified=false）。問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B01' の形。
// B03 の図は公式PDF（20260706d_mondaib.pdf p.2）で、背面側（盛土側）が右、たて壁の①が前面・②が背面、底版の③が上面・④が下面であることを確認して作図。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R08_B_KEIKAKU: Explains = {
  B01: {
    explain: {
      point: 'TS の観測の決まりは数値で覚える。水平角観測の1対回内の観測方向数は5方向以下。',
      figures: [{
        type: 'rule',
        title: 'TS 観測の決まり（作業規程の準則）',
        rows: [
          { label: '気温・気圧の測定', value: '距離測定の開始直前か終了直後' },
          { label: '器械高・反射鏡高・目標高', value: 'mm位まで測る' },
          { label: '水平角：1対回内の方向数', value: '5方向以下', trap: '10方向以下' },
          { label: '鉛直角', value: '1視準1読定、正・反で1対回' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '気温・気圧は距離測定の開始直前か終了直後に測る。' },
        { label: '⑵', ok: true, note: '器械高・反射鏡高・目標高は mm 位まで測る。' },
        { label: '⑶', ok: false, note: '1対回内の観測方向数は5方向以下。' },
        { label: '⑷', ok: true, note: '鉛直角は1視準1読定、望遠鏡正・反で1対回。' },
      ],
      basis: '作業規程の準則（国土地理院）',
    },
  },
  B02: {
    explain: {
      point: '検査で不合格になった工事材料は、所定の期間内に工事現場の外へ搬出する。現場内に保管するのではない。',
      figures: [{
        type: 'rule',
        title: '受注者の主な義務（公共工事標準請負契約約款）',
        rows: [
          { label: '履行報告', value: '設計図書に従い発注者に報告' },
          { label: '不合格の工事材料', value: '期間内に工事現場外へ搬出', trap: '現場内に保管' },
          { label: '不用の支給材料・貸与品', value: '発注者に返還' },
          { label: '臨機の措置', value: '措置をとり監督員に直ちに通知' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '設計図書の定めに従い、契約の履行を発注者に報告する。' },
        { label: '⑵', ok: false, note: '不合格の材料は所定期間内に工事現場外へ搬出する。' },
        { label: '⑶', ok: true, note: '不用になった支給材料・貸与品は発注者に返還する。' },
        { label: '⑷', ok: true, note: '災害防止などで必要なら臨機の措置をとり、監督員に直ちに通知。' },
      ],
      basis: '公共工事標準請負契約約款（工事材料の品質及び検査等・支給材料及び貸与品・臨機の措置）',
    },
  },
  B03: {
    explain: {
      point: '引張鉄筋は「土圧で引っ張られる側」に入れる。たて壁は背面（土側）、かかと版は上面（上の土の重さで下に曲がる）。',
      figures: [{
        type: 'svg',
        title: '逆T型擁壁の引張側（模式図）',
        alt: '逆T型擁壁の断面。右側が盛土。たて壁は土圧で左へ曲げられ、背面（右側）の②が引張側。かかと版（右側の底版）は上の土の重さで下へ曲げられ、上面の③が引張側。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#fff"/><path d="M150 20 L310 20 L310 150 L170 150 Z" fill="#e9dfc7"/><text x="230" y="60" font-size="12" fill="#6d6248">盛土</text><path d="M60 150 L280 150 L280 175 L60 175 Z" fill="#cfd8e3" stroke="#334"/><path d="M140 20 L170 20 L170 150 L140 150 Z" fill="#cfd8e3" stroke="#334"/><line x1="166" y1="26" x2="166" y2="168" stroke="#d33" stroke-width="3"/><line x1="166" y1="155" x2="276" y2="155" stroke="#d33" stroke-width="3"/><line x1="144" y1="26" x2="144" y2="165" stroke="#888" stroke-dasharray="3 2"/><line x1="64" y1="171" x2="276" y2="171" stroke="#888" stroke-dasharray="3 2"/><text x="176" y="100" font-size="12" fill="#d33">② 背面（引張）</text><text x="200" y="146" font-size="12" fill="#d33">③ 上面（引張）</text><text x="70" y="100" font-size="12" fill="#555">① 前面</text><text x="200" y="192" font-size="12" fill="#555">④ 下面</text><path d="M240 110 L200 110" stroke="#2a5db0" stroke-width="2"/><path d="M200 110 l8 -5 v10 Z" fill="#2a5db0"/><text x="236" y="124" font-size="11" fill="#2a5db0">土圧</text><text x="70" y="166" font-size="11" fill="#334">つま先</text><text x="232" y="166" font-size="11" fill="#334">かかと</text></svg>',
      }],
      checks: [
        { label: '⑴', ok: false, note: '①はたて壁の前面。土圧で引っ張られるのは背面の②。' },
        { label: '⑵', ok: false, note: '①（前面）も④（底版下面）も、問われた引張側ではない。' },
        { label: '⑶', ok: true, note: 'たて壁は背面の②、かかと版は上面の③が引張側。' },
        { label: '⑷', ok: false, note: '④は底版の下面。かかと版の引張側は上面の③。' },
      ],
      basis: '道路土工 擁壁工指針（日本道路協会）。配筋位置は公式PDFの図で確認',
    },
  },
  B04: {
    explain: {
      point: 'GX建設機械は、稼働時に「二酸化炭素（CO2）」を出さない（または大幅に減らす）機械。一酸化炭素ではない。',
      figures: [{
        type: 'compare',
        title: '建設機械の新しい技術',
        columns: ['ひとことで'],
        rows: [
          { label: 'GX建設機械', cells: ['電動化などで稼働時のCO2を削減'] },
          { label: 'ICT出来形管理', cells: ['計測から取りまとめまでICTで'] },
          { label: 'MG', cells: ['位置と設計の差をモニタで案内'] },
          { label: 'UAV', cells: ['自律飛行で計測・点検'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '対象は二酸化炭素（CO2）。一酸化炭素（CO）ではない。' },
        { label: '⑵', ok: true, note: 'ICT機器で計測から結果の取りまとめまで行える。' },
        { label: '⑶', ok: true, note: 'MGは設計との差分を表示して操作を案内する。' },
        { label: '⑷', ok: true, note: 'GNSS・慣性センサ等の進歩で自律飛行による計測・点検が可能。' },
      ],
      basis: 'GX建設機械認定制度（国土交通省）',
    },
  },
  B05: {
    explain: {
      point: '資機材の輸送で相談する先は、道路の管理者と所轄警察署。運輸支局ではない。',
      figures: [{
        type: 'rule',
        title: '事前調査の主な項目',
        rows: [
          { label: '契約条件', value: '設計図書・数量・仕様・関連工事' },
          { label: '現場条件', value: '漏れなく・複数人・複数回で精度を上げる' },
          { label: '資機材の輸送', value: '道路管理者・所轄警察署に相談', trap: '運輸支局' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '目的・設計図書・設計変更の可能性・関連工事まで確認する。' },
        { label: '⑵', ok: true, note: '調査項目の漏れを防ぎ、複数人・複数回で精度を上げる。' },
        { label: '⑶', ok: true, note: '不確定要素を把握することは設計変更対応の必須条件。' },
        { label: '⑷', ok: false, note: '輸送の相談先は道路管理者と所轄警察署。運輸支局ではない。' },
      ],
      basis: '施工計画の一般的な手引き（土木施工管理の教本類）',
    },
  },
  B21: {
    explain: {
      point: '仮設は「扱いやすく・人手を減らし・使い回せる」ように計画する。ユニット化・市販品・規格の統一がキーワード。',
      figures: [{
        type: 'rule',
        title: '仮設工事計画の考え方',
        rows: [
          { label: '扱いやすさ', value: 'ユニット化', trap: '分散化' },
          { label: '省力化の理由', value: '作業員不足' },
          { label: '材料', value: '市販品', trap: '特注品' },
          { label: '転用しやすく', value: '規格を統一' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '分散化・特注品は、扱いやすさ・転用の考えに反する。' },
        { label: '⑵', ok: true, note: 'ユニット化・作業員不足・市販品・規格の組合せ。' },
        { label: '⑶', ok: false, note: '分散化ではなくユニット化。統一するのは規格。' },
        { label: '⑷', ok: false, note: '特注品は転用しにくい。統一するのは規格。' },
      ],
      basis: '土木工事の仮設計画の一般原則（教本類）',
    },
  },
  B22: {
    explain: {
      point: '機械は「最大能率」を発揮できる施工方法で選ぶ。組合せでは主機械の能力を生かし、従作業は同等か少し高めにする。',
      figures: [{
        type: 'rule',
        title: '建設機械の選定',
        rows: [
          { label: '作業能率', value: '地形・気象・熟練度などから実績で決める' },
          { label: '単独の機械', value: '最大能率を発揮できる施工方法', trap: '平均能率' },
          { label: '組合せ機械', value: '作業体系を並列化して主機械を生かす' },
          { label: '従作業の能力', value: '主作業と同等か幾分高め' },
        ],
      }],
      checks: [
        { label: '①', ok: true, note: '作業能率は多くの要素で決まるので実績データで選ぶ。' },
        { label: '②', ok: false, note: '機械が最大能率を発揮できる施工方法を選ぶ。平均ではない。' },
        { label: '③', ok: true, note: '並列化で、主機械が止まらずに能力を発揮できる。' },
        { label: '④', ok: true, note: '従作業が足を引っ張らないよう同等か少し高めにする。' },
      ],
      basis: '土木施工管理の教本類（建設機械の選定）',
    },
  },
  B23: {
    explain: {
      point: '公共工事では、下請契約を結べば金額にかかわらず施工体制台帳が要る。施工体系図は現場に掲示する。',
      figures: [{
        type: 'flow',
        title: '施工体制台帳の流れ（公共工事）',
        steps: ['元請が下請契約を結ぶ（金額にかかわらず）', '施工体制台帳を作成（下請負人の名称などを記載）', '施工体系図を作成して見やすい場所に掲示', '下請が再下請したら再下請通知書を元請負人へ'],
        branches: [{ from: 3, label: '誤り', to: '発注者へ提出', bad: true }],
      }],
      checks: [
        { label: '⑴', ok: false, note: '台帳に書くのは下請負人の名称。再下請通知書は元請負人へ。' },
        { label: '⑵', ok: false, note: '公共工事は金額にかかわらず作成。掲示するのは施工体系図。' },
        { label: '⑶', ok: false, note: '金額にかかわらず。掲示は施工体系図、提出先は元請負人。' },
        { label: '⑷', ok: true, note: 'にかかわらず・施工体系図・下請負人の名称・元請負人。' },
      ],
      basis: '建設業法24条の8、公共工事の入札及び契約の適正化の促進に関する法律15条',
    },
  },
  B24: {
    explain: {
      point: '原価管理では、天災など不可抗力の損害も考える必要がある。実行予算と実際の原価を比べ、変更があれば予算を修正して回す。',
      figures: [{
        type: 'flow',
        title: '原価管理のサイクル',
        steps: ['実行予算を作る', '発生原価を把握', '実行予算と対比・評価', '施工改善・設計変更など', '修正実行予算で再び管理'],
      }],
      checks: [
        { label: '①', ok: true, note: '施工担当者は原価を常に把握し、実行予算と対比・評価する。' },
        { label: '②', ok: false, note: '天災その他の不可抗力による損害も考慮する必要がある。' },
        { label: '③', ok: true, note: '重点と原価計算の細かさを先に決めておく。' },
        { label: '④', ok: true, note: '変更があれば修正実行予算を基準に管理サイクルを回す。' },
      ],
      basis: '土木施工管理の教本類（原価管理）',
    },
  },
}
