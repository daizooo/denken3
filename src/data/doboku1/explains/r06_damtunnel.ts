// 令和6年度 試験問題A No.38〜41（ダム・トンネル）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A38' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R06_DAMTUNNEL: Explains = {
  A38: {
    explain: {
      point: 'ステージ注入工法は「上から下へ」。上位のステージを削孔・注入してから、次の下位ステージへ進む。',
      figures: [{
        type: 'compare',
        title: 'ステージ注入とパッカー注入',
        columns: ['進め方'],
        rows: [
          { label: 'ステージ注入工法', cells: ['上位→下位へ、削孔と注入を交互に'] },
          { label: 'パッカー注入工法', cells: ['全長を削孔後、下位→上位へ注入'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'ステージ注入は上位から下位へ削孔と注入を繰り返す。' },
        { label: '⑵', ok: true, note: '着岩部付近の遮水性改良と弱部補強が目的。' },
        { label: '⑶', ok: true, note: 'ルジオンテストでルジオン値（Lu）を求める。' },
        { label: '⑷', ok: true, note: '薄い配合から濃い配合へ切り替える。' },
      ],
      basis: 'グラウチング技術指針・同解説（国土開発技術研究センター）',
    },
  },
  A39: {
    explain: {
      point: 'バケットからの放出は材料分離を防ぐため、バケット下端を打込み面上「1m以下」まで下ろしてから行う。',
      figures: [{
        type: 'rule',
        title: 'ダムコンクリートの打込み',
        rows: [
          { label: 'バケット放出高さ', value: '打込み面上1m以下', trap: '「2m」は誤り' },
          { label: 'RCDの許容時間', value: '夏季3時間・冬季4時間程度' },
          { label: '横継目の止水', value: '上流端付近に主副2枚の止水板' },
          { label: '降雨（RCD）', value: '2mm/h以上で打込み中止' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '放出高さは打込み面上1m以下。2mでは分離しやすい。' },
        { label: '⑵', ok: true, note: '夏季3時間、冬季4時間程度が標準。' },
        { label: '⑶', ok: true, note: '漏水防止に主副2枚の止水板を設ける。' },
        { label: '⑷', ok: true, note: 'RCDは2mm/h以上の降雨で打込みを中止。' },
      ],
      basis: 'コンクリート標準示方書［ダムコンクリート編］（土木学会）',
    },
  },
  A40: {
    explain: {
      point: '地山が不良なときは、早く断面を閉合させるためにベンチ長を「短く」する。長くすると変位が進む。',
      figures: [{
        type: 'compare',
        title: '山岳トンネルの掘削工法',
        columns: ['特徴'],
        rows: [
          { label: '補助ベンチ付き全断面', cells: ['ベンチで切羽安定、上下半を同時施工'] },
          { label: 'ベンチカット', cells: ['上下半に分割。不良地山はベンチを短く'] },
          { label: '導坑先進', cells: ['地質確認・水抜き。頂設・中央・底設など'] },
          { label: '中壁分割', cells: ['大断面で片側半断面を先進'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '上部・下部半断面を同時施工して効率を上げる。' },
        { label: '⑵', ok: false, note: '地山が不良な場合は早期閉合のためベンチ長を短くする。' },
        { label: '⑶', ok: true, note: '前方の地質確認や水抜きの効果がある。' },
        { label: '⑷', ok: true, note: '大断面で片側を先進掘削する。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
  A41: {
    explain: {
      point: '鏡ボルトは切羽（鏡面）の安定対策。脚部の安定対策は仮インバート、ウイングリブ付き鋼製支保工、脚部補強ボルトなど。',
      figures: [{
        type: 'compare',
        title: '補助工法の目的と例',
        columns: ['主な工法'],
        rows: [
          { label: '天端の安定', cells: ['フォアポーリング（充塡式・注入式）'] },
          { label: '鏡面（切羽）の安定', cells: ['鏡吹付け・鏡ボルト'] },
          { label: '脚部の安定', cells: ['仮インバート・ウイングリブ・脚部補強ボルト'] },
          { label: '地下水対策', cells: ['水抜きボーリング・止水注入'] },
          { label: '地表面沈下対策', cells: ['長尺フォアパイリング・パイプルーフ'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '長尺フォアパイリング・パイプルーフは沈下対策。' },
        { label: '⑵', ok: true, note: '水抜きボーリング・止水注入は地下水対策。' },
        { label: '⑶', ok: false, note: '鏡ボルトは鏡面の安定対策。脚部対策ではない。' },
        { label: '⑷', ok: true, note: 'フォアポーリングは天端の崩落防止。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
}
