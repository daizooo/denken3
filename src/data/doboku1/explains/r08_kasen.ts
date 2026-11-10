// 令和8年度 試験問題A No.26〜31（河川・砂防）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A26' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R08_KASEN: Explains = {
  A26: {
    explain: {
      point: '築堤土は粒度がほどよく混ざった土が良い。高有機質土は締め固まらず腐って沈下するので使わない。',
      figures: [{
        type: 'rule',
        title: '築堤盛土の決まり',
        rows: [
          { label: '築堤土', value: '粒度配合のよい土。高有機質土は不可' },
          { label: '表腹付け（川表）', value: '既設より透水性の小さい材料' },
          { label: '裏腹付け（川裏）', value: '既設より透水性の大きい材料' },
          { label: '段切り', value: '水平部に横断勾配をつけ排水' },
          { label: '締固め', value: '堤防法線に平行、幅を重複させる' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '高有機質土は築堤に不適。締固めが十分にできない。' },
        { label: '⑵', ok: true, note: '川表は水を通しにくく、川裏は水を抜きやすい材料にする。' },
        { label: '⑶', ok: true, note: '段切りでなじませ、水平部に勾配をつけて排水する。' },
        { label: '⑷', ok: true, note: '法線に平行に、締固め幅を重ねて施工する。' },
      ],
      basis: '河川土工マニュアル（国土技術研究センター）',
    },
  },
  A27: {
    explain: {
      point: '捨石工は表面ほど流れの力を受けるので、表層に大きな石、内側に小さな石（栗石・砂礫）を使う。',
      figures: [{
        type: 'svg',
        title: '捨石工の断面（石の大きさの配置）',
        alt: '捨石工の断面。表層に大きな石、その内側に栗石や砂礫などの小さな石を詰める。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 150"><rect width="320" height="150" fill="#fff"/><path d="M20 130 L300 130 L300 40 Z" fill="#e8dcc0" stroke="#8a7a55"/><text x="22" y="145" font-size="11" fill="#555">地盤</text><path d="M60 128 L270 128 L270 66 Z" fill="#d6cbb0"/><g fill="#bfb293" stroke="#6d6248"><circle cx="150" cy="118" r="4"/><circle cx="170" cy="120" r="4"/><circle cx="190" cy="116" r="4"/><circle cx="210" cy="120" r="4"/><circle cx="230" cy="114" r="4"/><circle cx="250" cy="118" r="4"/><circle cx="200" cy="104" r="4"/><circle cx="225" cy="100" r="4"/><circle cx="250" cy="98" r="4"/></g><g fill="#9a8f78" stroke="#4d4636"><circle cx="90" cy="118" r="11"/><circle cx="125" cy="104" r="12"/><circle cx="160" cy="92" r="12"/><circle cx="195" cy="82" r="12"/><circle cx="230" cy="72" r="12"/><circle cx="262" cy="62" r="11"/></g><text x="70" y="70" font-size="12" fill="#222">表層：大きな石</text><line x1="110" y1="74" x2="150" y2="88" stroke="#222"/><text x="170" y="146" font-size="12" fill="#222">内側：栗石・砂礫</text><line x1="210" y1="135" x2="210" y2="124" stroke="#222"/></svg>',
      }],
      checks: [
        { label: '⑴', ok: true, note: 'かご系は屈撓性・多孔質で、水際の多様化にも向く。' },
        { label: '⑵', ok: false, note: '表層は大きな石、内側に栗石や砂礫。小さな石を表層にすると流される。' },
        { label: '⑶', ok: true, note: 'ふとんかごは施工が簡単・安価で、浅い所でよく使う。' },
        { label: '⑷', ok: true, note: '層積みは河床整正が要るので、水深が深いと難しい。' },
      ],
      basis: '河川砂防技術基準、護岸の力学設計法（国土技術研究センター）',
    },
  },
  A28: {
    explain: {
      point: '堤防開削で荷重が抜けると床付け面は緩む。乱さないように掘り、緩んだ面は転圧して締め固める。',
      figures: [{
        type: 'compare',
        title: '樋門・樋管の施工の要点',
        columns: ['正しい扱い'],
        rows: [
          { label: '堤防の開削', cells: ['河川管理上は極力小さく'] },
          { label: '床付け面', cells: ['乱さず施工し、転圧を行う'] },
          { label: '柔構造樋門の沈下', cells: ['定期的に計測し動態を記録'] },
          { label: '盛土の盛り方', cells: ['函軸に沿って水平に盛り上げる'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '施工性と河川管理の両面から開削の大きさを考える。' },
        { label: '⑵', ok: false, note: '緩んだ床付け面は転圧するのが望ましい。転圧しないのは誤り。' },
        { label: '⑶', ok: true, note: '施工中に沈下が進むので、計測して記録する。' },
        { label: '⑷', ok: true, note: '函軸に沿って水平に盛り、想定の沈下形状に近づける。' },
      ],
      basis: '柔構造樋門設計の手引き（国土技術研究センター）',
    },
  },
  A29: {
    explain: {
      point: '砂防堰堤の基礎はドライな状態で施工する。砂礫は泥で汚さず、岩盤は乾かさずに湿らせてから打ち込む。',
      figures: [{
        type: 'compare',
        title: '基礎の種類と打込み前の処理',
        columns: ['打込み前の処理'],
        rows: [
          { label: '砂礫基礎', cells: ['転石の泥を洗い、十分に水切り'] },
          { label: '岩盤基礎', cells: ['清掃・湧水処理のうえ表面を湿潤に'] },
          { label: '掘削', cells: ['水中掘削は避け、ドライで施工'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '泥でコンクリートが汚れないよう洗浄・水切りする。' },
        { label: '⑵', ok: false, note: '岩盤は乾燥させると水を吸うので、湿った状態にして打ち込む。' },
        { label: '⑶', ok: false, note: '水中掘削は基礎を乱すので避け、排水してドライで掘る。' },
        { label: '⑷', ok: false, note: '正答は⑴のみ。⑷は透水・パイピング対策の組合せが基準の記述と異なる（根拠確認中）。' },
      ],
      basis: '砂防技術指針、土木工事共通仕様書（砂防）',
    },
  },
  A30: {
    explain: {
      point: '川を横切るのが「横工」（床固工・帯工）で渓床の変動を抑え、川に沿うのが「縦工」（護岸・水制）で側岸の侵食を防ぐ。',
      figures: [{
        type: 'compare',
        title: '渓流保全工の横工と縦工',
        columns: ['向き', '役割'],
        rows: [
          { label: '横工（床固工・帯工）', cells: ['流れを横切る', '渓床高の変動・乱流を抑える'] },
          { label: '縦工（護岸工・水制工）', cells: ['流れに沿う', '側岸の侵食を防ぐ'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '縦工と横工が逆。渓床変動は横工、側岸侵食は縦工で防ぐ。' },
        { label: '⑵', ok: true, note: '柔軟性が要る所は枠工や蛇かごで床固工をつくる。' },
        { label: '⑶', ok: true, note: '床固工の間隔が大きい所に帯工を入れ河床を保つ。' },
        { label: '⑷', ok: true, note: 'ひび割れ防止に一定間隔で伸縮目地を設ける。' },
      ],
      basis: '河川砂防技術基準 計画編（渓流保全工）',
    },
  },
  A31: {
    explain: {
      point: '落石対策は「予防工＝落ちる前に止める（除去・固定）」「防護工＝落ちてきた石を受け止める」。名前の順に覚える。',
      figures: [{
        type: 'compare',
        title: '急傾斜地崩壊防止工の役割',
        columns: ['役割'],
        rows: [
          { label: '落石予防工', cells: ['転石の除去・固定で発生を防ぐ'] },
          { label: '落石防護工', cells: ['落ちた石を斜面下部・中部で止める'] },
          { label: 'コンクリート張工', cells: ['風化・侵食防止（土圧は考慮しない）'] },
          { label: '擁壁工', cells: ['斜面下部の安定、下端の切土を避けて設置'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '不安定な土塊を切り取り、表面に法面保護工を設ける。' },
        { label: '⑵', ok: true, note: '張工は風化・侵食防止が目的で、一般に土圧を考えない。' },
        { label: '⑶', ok: false, note: '予防工と防護工の説明が逆。予防工が発生を防ぎ、防護工が受け止める。' },
        { label: '⑷', ok: true, note: '斜面下端を切土しないような位置に擁壁を置く。' },
      ],
      basis: '新・斜面崩壊防止工事の設計と実例（全国治水砂防協会）',
    },
  },
}
