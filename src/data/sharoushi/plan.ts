// 社労士の目標日の逆算（licensehub-expansion.md §10.1）の既定値。利用者は設定画面で変える
// （denken_settings.plan_anchors / plan_weights / plan_order。未設定の項目はここの値を使う）。
import type { PlanAnchors } from '../../lib/license/plan'
import { SHAROUSHI_SUBJECTS } from './index.ts'

export const SHAROUSHI_PLAN_ANCHORS: PlanAnchors = {
  startDate: '2026-10-23',   // 演習の開始日（一問一答①の発売日）
  gateDate: '2027-05-31',    // 模試ゲート
  finalPhaseWeeks: 8,        // 直前期の開始 = 本試験の8週前
  throughWeeks: 12,          // 通し演習の開始 = ゲートの12週前（1周目の完了期限はその前日）
  minPracticeDays: 7,        // 書籍の発売日から目標日までの最短日数（仮。実測で置き換える）
  // 一問一答①〜④の発売日（§2）。①は「労基・安衛等」、②は「雇用・労一等」。
  // 労災・徴収がどちらの巻かは現物で確認する（遅い方の②に置き、制約の確認を甘くしない）。
  releaseDates: {
    rouki: '2026-10-23',
    anei: '2026-10-23',
    rousai: '2026-11-16',
    koyou: '2026-11-16',
    choushu: '2026-11-16',
    rouippan: '2026-11-16',
    kenpo: '2026-12-14',
    kokunen: '2026-12-14',
    kounen: '2026-12-18',
    shaippan: '2026-12-18',
  },
}

// 仮の重み = 択一の問数（§10.1: 労基・安衛10／労災・雇用・徴収20／健保・国年20／厚年10／労一・社一10）を学習科目に割る。
// 労災・雇用の問8〜10が徴収（§4.3）、労一・社一は問1〜5・6〜10（要確認）。取り込み後は科目ごとの肢数に置き換える。
export const SHAROUSHI_PLAN_WEIGHTS: Record<string, number> = {
  rouki: 5,
  anei: 5,
  rousai: 7,
  koyou: 7,
  choushu: 6,
  kenpo: 10,
  kokunen: 10,
  kounen: 10,
  rouippan: 5,
  shaippan: 5,
}

// 学習順の既定 = タブの並び（SHAROUSHI_SUBJECTS）。
export const SHAROUSHI_PLAN_ORDER: string[] = SHAROUSHI_SUBJECTS.map(s => s.id)
