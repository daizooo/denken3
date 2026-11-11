// 令和5年度 試験問題B No.1〜4（共通工学）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B01' の形。検証は src/lib/doboku1/explain.ts。
// B03 は dbk_figures（D1_R05_B_03）の擁壁配筋図（底版上面 ①D22・下面 ②D13、たて壁背面 ③D22、④D13）を確認して作成。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R05_B_KYOUTSU: Explains = {
  B01: {
    explain: {
      point: 'TS の鉛直角観測は「1視準1読定、望遠鏡正・反の観測を1対回」。2対回ではない。水平角・距離の回数と区別して覚える。',
      figures: [{
        type: 'rule',
        title: 'TS 観測の基本（公共測量）',
        rows: [
          { label: '鉛直角観測', value: '1視準1読定、正・反を1対回', trap: '「2対回」は誤り' },
          { label: '水平角観測', value: '対回内の観測方向数は5方向以下' },
          { label: '距離測定', value: '1視準2読定を1セット' },
          { label: '観測の同時性', value: '水平角・鉛直角・距離は1視準で同時に' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '鉛直角観測は正・反の観測を1対回とする。2対回ではない。' },
        { label: '⑵', ok: true, note: '対回内の観測方向数は5方向以下とする。' },
        { label: '⑶', ok: true, note: '距離測定は1視準2読定を1セットとする。' },
        { label: '⑷', ok: true, note: '水平角・鉛直角・距離は1視準で同時に観測するのが原則。' },
      ],
      basis: '作業規程の準則（国土交通省）',
    },
  },
  B02: {
    explain: {
      point: '現場代理人の常駐を不要にできるのは発注者の判断。受注者が自分で決めることはできない。',
      figures: [{
        type: 'compare',
        title: '公共工事標準請負契約約款のだれが決めるか',
        columns: ['決める人'],
        rows: [
          { label: '工期の変更（協議不調時）', cells: ['発注者が定めて通知'] },
          { label: '設計図書の変更', cells: ['発注者が通知して変更'] },
          { label: '現場代理人の常駐不要', cells: ['発注者（受注者の判断ではない）'] },
          { label: '不可抗力による損害', cells: ['受注者が請求→発注者が確認'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '協議が整わなければ発注者が定めて受注者に通知する。' },
        { label: '⑵', ok: true, note: '発注者は変更内容を通知して設計図書を変更できる。' },
        { label: '⑶', ok: false, note: '常駐を要しないとできるのは発注者。受注者の判断ではない。' },
        { label: '⑷', ok: true, note: '発注者が確認・通知すれば、受注者は費用負担を請求できる。' },
      ],
      basis: '公共工事標準請負契約約款 第10条・第19条・第24条・第30条',
    },
  },
  B03: {
    explain: {
      point: '逆T型擁壁のかかと（背面側の底版）は上に載る土の重さで下に曲げられ、上面が引張になる。だから引張鉄筋は底版上面の ①D22。',
      figures: [{
        type: 'svg',
        title: 'かかと部の曲げと引張側',
        alt: '逆T型擁壁の断面。背面側の底版（かかと）に土の重さが下向きに作用し、上面が引張側になる。上面の鉄筋が①D22。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 170"><rect width="320" height="170" fill="#fff"/><path d="M130 20 L150 20 L150 112 L300 112 L300 140 L80 140 L80 112 L130 112 Z" fill="#e6e6e6" stroke="#444"/><path d="M150 20 L300 20 L300 112 L150 112 Z" fill="#efe6d2" opacity="0.7"/><text x="200" y="44" font-size="12" fill="#6a5a3a">背面の土</text><g stroke="#2a6fb0" stroke-width="2" fill="none"><path d="M220 60 v40 m-5 -8 l5 8 l5 -8"/><path d="M250 60 v40 m-5 -8 l5 8 l5 -8"/><path d="M280 60 v40 m-5 -8 l5 8 l5 -8"/></g><line x1="156" y1="117" x2="294" y2="117" stroke="#c33" stroke-width="3"/><text x="178" y="162" font-size="12" fill="#c33" font-weight="bold">①D22 上面＝引張</text><line x1="86" y1="135" x2="294" y2="135" stroke="#666" stroke-width="1.5" stroke-dasharray="4 3"/><text x="84" y="160" font-size="11" fill="#555">②D13 下面</text><text x="158" y="107" font-size="11" fill="#333">かかと部</text><text x="84" y="106" font-size="11" fill="#333">つま先</text><text x="6" y="50" font-size="11" fill="#333">たて壁</text><line x1="44" y1="46" x2="128" y2="46" stroke="#999"/></svg>',
      }],
      checks: [
        { label: '⑴', ok: true, note: 'かかとは土の重さで上面が引張になる。底版上面の ①D22 が引張鉄筋。' },
        { label: '⑵', ok: false, note: '②D13 は底版下面の鉄筋。かかとでは圧縮側にあたる。' },
        { label: '⑶', ok: false, note: '③D22 はたて壁背面の主鉄筋。底版の鉄筋ではない。' },
        { label: '⑷', ok: false, note: '④D13 は底版の配力（横方向）鉄筋。' },
      ],
      basis: '道路土工－擁壁工指針（日本道路協会）',
    },
  },
  B04: {
    explain: {
      point: 'タイヤローラは空気圧で「接地圧」を、バラストで「輪荷重」を調整する。両者の入れ替えが誤り。',
      figures: [{
        type: 'compare',
        title: '締固め機械の特徴',
        columns: ['特徴', '主な用途'],
        rows: [
          { label: '振動ローラ', cells: ['自重＋振動。小型でも効果大', '路床・路盤・混合物'] },
          { label: 'タイヤローラ', cells: ['空気圧で接地圧、バラストで輪荷重を調整', '路床・路盤・混合物'] },
          { label: 'ロードローラ', cells: ['鉄輪（マカダム型・タンデム型）', '混合物・路盤・路床仕上げ'] },
          { label: 'タンピングローラ', cells: ['突起に荷重を集中し破砕・締固め', '土塊・岩塊、厚層の転圧'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '転圧輪の振動で、小型でも高い締固め効果が得られる。' },
        { label: '⑵', ok: false, note: '空気圧で接地圧、バラストで輪荷重を調整する。逆になっている。' },
        { label: '⑶', ok: true, note: '鉄輪のローラで、混合物や路盤、路床の仕上げに使う。' },
        { label: '⑷', ok: true, note: '突起で荷重を集中させ、厚層の土の転圧に向く。' },
      ],
      basis: '道路土工－盛土工指針・舗装施工便覧（日本道路協会）',
    },
  },
}
