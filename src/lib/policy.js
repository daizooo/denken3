// 適応型ポリシー（adaptive-fsrs-policy.md §3・Phase A）。すべて純関数。
//
// ==========================================================================
// 最上位の原則（設計書 §0）: **不確実性は、必ず「もっとやる」側へ倒す。**
//
// 「設定を下げない」の設定とは、retention や daily_cap のような明示的なつまみだけを
// 指さない。**モデルの中の仮定も設定である。** 検証されていない楽観的な仮定を使って
// 「必要な学習量は少ない」と結論することは、つまみを下げるのとまったく同じ結果を招く。
// このファイルの値はすべてこの原則に従い、迷ったら「学習量が増える側」を採る。
//
// 派生則:
//   1. 未着手は 0点。当て推量による得点を計画に組み込まない（analytics.STATUS_PROB）
//   2. 検証されていない正答確率は、もっともらしい範囲の悲観側を採る
//   3. 「合格に必要な最小集合」モードは、推定が実測で検証されるまで無効。
//      既定ゴールは全範囲完走（passTarget.isEstimateValidated がゲート）
// ==========================================================================
//
// 【Phase A の範囲】値を算出して**返すだけ**。FSRS のスケジューリングにはまだ流さない。
// 利用者の一次不満は「幾度となく最適化したが、いま何が効いているのか分からない」であり、
// 自動で動かすことはそれを悪化させ得る。だから可視化（Phase A）を自動化（Phase C）より
// 先に置く ―― **画面に出ていない値は自動で動かさない。**
// したがって `retentionOf()` の戻り値は現時点で提案値であり、`effectiveRetention`
// （いま実際に FSRS へ渡っている値）とは別物として扱う。混同させないため両方を返す。
import { isEstimateValidated } from './passTarget';
import { estimateMinutes } from './estimateMinutes';
import { RETENTION_ENDGAME, RETENTION_ENDGAME_DAYS, retentionFor } from './fsrs';
import { addDaysStr, diffDays } from './date';
// ---- 層1: 安全マージン（設計書 §3.3 層1）----
//
// 現行の固定値 10点（passTarget.DEFAULT_PASS_MARGIN）を、推定の信頼度から決め直す。
// 「合格を確実にする」なら、**推定が信用できないほどマージンを厚くする**のが正しい。
// CBT実測が無い間は最大側（15点＝目標75点）を採り、実測が貯まったら「想定得点が実測より
// どれだけ甘かったか」の分だけ上乗せする。実測で想定が正しいと分かれば 8点まで下がり、
// 無駄な負荷が自動的に消える ―― 下げるのは検証できたときだけ。
export const MARGIN_UNVALIDATED = 15;
export const MARGIN_MIN = 8;
export const MARGIN_MAX = 20;
// ---- 層3: 目標保持率（設計書 §3.3 層3）----
// コアは落とさない（0.90）。バッファは回転優先で、計算は 0.85・暗記は 0.80。
// 直前期（試験60日前から）はコア/バッファを問わず 0.90 を下限にする。
export const RETENTION_CORE = 0.9;
export const RETENTION_BUFFER_CALC = 0.85;
export const RETENTION_BUFFER_MEMORY = 0.8;
// ---- 停止中でも切らない最低ライン（設計書 §3.5）----
export const DAILY_FLOOR_MAX = 3;
// 1問を A 以上へ引き上げるまでに要する演習回数（実績が無いときの既定と上限）。pace.ts と同値。
const DEFAULT_ATTEMPTS_PER_MASTERY = 2;
const MAX_ATTEMPTS_PER_MASTERY = 5;
// 維持コア1問あたりの復習回数の上限。stability が極端に小さい問題で見積もりが
// 発散するのを防ぐだけのガード（下限は 1回＝期間中に最低1回は触る）。
const MAX_MAINTENANCE_REVIEWS = 10;
// 実績時間の EWMA 半減期（日）。pace.ts の学習ペース推定と揃える。
const EWMA_HALF_LIFE_DAYS = 14;
const EWMA_ALPHA = 1 - Math.pow(0.5, 1 / EWMA_HALF_LIFE_DAYS);
// 分野別完走の既定目標＝試験日の何日前か（plan.bunya_target_date 未設定時）。pace.ts と同値。
const DEFAULT_BUNYA_LEAD_DAYS = 90;
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function finishedCbt(sessions) {
    return sessions.filter(s => s.status === 'finished' && s.mode === 'cbt' && s.score != null);
}
function isMastered(status) {
    return status === 'A' || status === 'S';
}
/**
 * 層1: 安全マージン（点）。
 *
 * 設計書 §3.3 のコードは「実測が1件でもあれば bias から決める」としていたが、
 * ここでは較正の判定を passTarget.isEstimateValidated（CBT 2回以上）に合わせる。
 * 1回の結果は実力なのか出題の当たり外れなのか切り分けられず、それを根拠にマージンを
 * 15→8点へ下げると、たまたま良かった1回でゴールが下がる。原則 §0 の「不確実性は
 * もっとやる側へ」に照らして、下げる判断は検証が成立してからにする。
 */
export function passMarginFor(est, sessions) {
    if (!isEstimateValidated(sessions))
        return MARGIN_UNVALIDATED;
    const finished = finishedCbt(sessions);
    // bias が正 = 想定得点が実測より甘い。甘い分だけマージンへ上乗せする。
    const bias = finished.reduce((s, m) => s + (est.estimate - m.score), 0) / finished.length;
    return clamp(Math.round(MARGIN_MIN + Math.max(0, bias)), MARGIN_MIN, MARGIN_MAX);
}
// 1問を A 以上へ引き上げるのに要した実績演習回数。実績が無ければ既定値。
function attemptsPerMastery(chapters, reviews) {
    let attempts = 0;
    let mastered = 0;
    for (const c of chapters) {
        for (const q of c.questions) {
            const r = reviews[q.id];
            if (!r)
                continue;
            attempts += r.review_history?.length ?? 0;
            if (isMastered(r.status))
                mastered++;
        }
    }
    if (mastered === 0 || attempts === 0)
        return DEFAULT_ATTEMPTS_PER_MASTERY;
    return clamp(attempts / mastered, 1, MAX_ATTEMPTS_PER_MASTERY);
}
// 維持コア1問が期間中に発生させる復習回数の見込み。
// FSRS の stability（この間隔なら目標保持率を保てる日数）で残り日数を割った回数。
// S は復習キューから外れており、試験前の最終確認1回だけが発生する。
function maintenanceReviews(r, horizonDays) {
    if (r?.status === 'S')
        return 1;
    const stability = Math.max(1, r?.stability ?? 0);
    return clamp(Math.ceil(horizonDays / stability), 1, MAX_MAINTENANCE_REVIEWS);
}
/**
 * コア完遂に必要な 分/日。
 *
 * 前進コア（未修得）… 1問を A 以上にするまでの演習回数 × 1問の推定所要分
 * 維持コア（A・S）  … 期間中に発生する復習回数 × 1問の推定所要分
 *
 * 【設計書 §3.3 訂正】維持を勘定に入れるのが要点。A が C へ落ちる損失（0.15点/問）は
 * 新規着手の伸び（0.17点/問）とほぼ同じ大きさで、維持と前進は同じ土俵に並ぶ。
 * 既に A の問題を放置すれば忘れて落ち、想定得点はそのぶん下がる。
 *
 * 見積もりは保守側（多め）に出る。維持コアの1問あたり時間には、その問題の直近実測
 * （＝初見や苦戦した回を含む所要時間）をそのまま使っており、実際の復習はこれより速い。
 * 精緻な補正は入れない ―― 必要時間を過小に見せるより過大に見せるほうが安全側で、
 * 原則 §0 の倒し方に一致するため（estimateMinutes.ts 冒頭の判断と同じ）。
 */
function requiredMinutesPerDay(chapters, reviews, stats, horizonDays, attempts) {
    let minutes = 0;
    for (const c of chapters) {
        for (const q of c.questions) {
            const r = reviews[q.id];
            const per = estimateMinutes(q, r, stats);
            minutes += isMastered(r?.status)
                ? per * maintenanceReviews(r, horizonDays)
                : per * attempts;
        }
    }
    return minutes / horizonDays;
}
/**
 * 直近の実績から推定した 分/日（EWMA・半減期14日）。
 *
 * **計測できた解答時間（duration_seconds）だけを数える。** 計測が付いていない記録を
 * 推定値で補うと「使えた時間」が実際より大きく出て、供給過大＝必要量過小の方向へ倒れる。
 * 原則 §0 に従い、供給側は控えめに見積もる。実績ゼロの日も 0分として算入するので、
 * 停止期間は自動的に平均を押し下げる（休止を宣言させない・pace.ts と同じ考え方）。
 *
 * 集計対象は**この科目の収録問題だけ**。`reviews` は資格（exam_id）単位で読み込まれており
 * 他科目の進捗も入っているため、`Object.values(reviews)` を走らせると他科目の学習時間まで
 * 「この科目に使える時間」として数えてしまう。必要側（requiredMinutesPerDay）は科目内の
 * 問題だけで積んでいるので、供給側だけ科目をまたぐと供給過大＝shortfall の見逃しになる。
 */
function availableMinutesPerDay(chapters, reviews, today) {
    const daily = new Map();
    for (const c of chapters) {
        for (const q of c.questions) {
            for (const e of reviews[q.id]?.review_history ?? []) {
                const sec = e.duration_seconds;
                if (typeof sec !== 'number' || sec <= 0)
                    continue;
                daily.set(e.date, (daily.get(e.date) ?? 0) + sec / 60);
            }
        }
    }
    if (daily.size === 0)
        return 0;
    const start = [...daily.keys()].sort()[0];
    const span = diffDays(start, today);
    if (span < 0)
        return 0;
    let ewma = 0;
    for (let i = 0; i <= span; i++) {
        ewma = EWMA_ALPHA * (daily.get(addDaysStr(start, i)) ?? 0) + (1 - EWMA_ALPHA) * ewma;
    }
    return ewma;
}
function feasibilityOf(required, available) {
    let verdict;
    if (required <= 0)
        verdict = 'safe';
    else if (available >= required * 1.2)
        verdict = 'safe';
    else if (available >= required)
        verdict = 'tight';
    else
        verdict = 'shortfall';
    return {
        requiredMinutesPerDay: required,
        availableMinutesPerDay: available,
        verdict,
        // 自動では選ばない。事実として並べるだけ（設計書 §3.6）。
        options: verdict === 'shortfall' ? ['increase_time', 'defer_exam', 'accept_risk'] : [],
    };
}
/**
 * 毎日1回まわす純関数。三層のポリシー（設計書 §3.3）と実現可能性（§3.6）を算出する。
 *
 * Phase A では**値を返すだけ**で、FSRS のスケジューリングにも今日のキューにも流さない。
 * `retentionOf()` を実際の scheduling に効かせるのは Phase C で、そのときは
 * `ReviewHistoryEntry.policy` に適用値を書き残す必要がある（§3.4）。この仕組み無しに
 * 層3を実装すると、ポリシーが日々変わるたびに `deriveFromHistory` の再生結果が変わり、
 * 過去の予定日が毎日書き換わる ―― まさに利用者が困っている「現状が分からない」の悪化。
 */
export function optimizePolicy(params) {
    const { chapters, reviews, scoreEstimate, passTarget, sessions, timeStats, today, examDate, bunyaTargetDate, } = params;
    const estimateValidated = isEstimateValidated(sessions);
    const passMargin = passMarginFor(scoreEstimate, sessions);
    const targetScore = Math.min(100, scoreEstimate.passingScore + passMargin);
    // コア完遂の目標日: 明示指定 > (試験日 - 90日) > なし（試験日も未設定のとき）。
    const horizonDate = bunyaTargetDate ?? (examDate ? addDaysStr(examDate, -DEFAULT_BUNYA_LEAD_DAYS) : null);
    const horizonDays = horizonDate ? Math.max(1, diffDays(today, horizonDate)) : 1;
    // ---- 層2: コア集合 ----
    // 前進コア＝未修得すべて。維持コア＝既に A・S の問題。合わせて収録済みの全問になる。
    // 想定得点が CBT 実測で較正できたときにだけ、前進コアを最小集合（requiredIds）へ絞る。
    // 検証前に絞ると、未検証の楽観的な推定がそのまま「やらなくてよい」に化ける（§0 派生則3）。
    const coreIds = new Set();
    let coreForwardQ = 0;
    let coreMaintainQ = 0;
    for (const c of chapters) {
        for (const q of c.questions) {
            const status = reviews[q.id]?.status ?? '未着手';
            if (isMastered(status)) {
                coreIds.add(q.id);
                coreMaintainQ++;
            }
            else if (!estimateValidated || passTarget.requiredIds.has(q.id)) {
                coreIds.add(q.id);
                coreForwardQ++;
            }
        }
    }
    const requiredPaceQ = coreForwardQ / horizonDays;
    // 停止中でも切らない最低ライン。必要ペース（問/日）を上限3問で丸めた値。
    // 「今日はここまでで計画どおり」の下限であって、上限キャップではない。
    const dailyFloor = coreForwardQ === 0 ? 1 : clamp(Math.ceil(requiredPaceQ), 1, DAILY_FLOOR_MAX);
    // ---- 層3: 問題ごとの目標保持率（提案値。Phase C で FSRS へ流す）----
    const endgame = examDate ? diffDays(today, examDate) <= RETENTION_ENDGAME_DAYS : false;
    const retentionOf = (id, mode) => {
        const base = coreIds.has(id)
            ? RETENTION_CORE
            : mode === 'calc'
                ? RETENTION_BUFFER_CALC
                : RETENTION_BUFFER_MEMORY;
        return endgame ? Math.max(base, RETENTION_ENDGAME) : base;
    };
    const attempts = attemptsPerMastery(chapters, reviews);
    const required = requiredMinutesPerDay(chapters, reviews, timeStats, horizonDays, attempts);
    const available = availableMinutesPerDay(chapters, reviews, today);
    return {
        today,
        examDate,
        horizonDate,
        horizonDays,
        estimateValidated,
        passMargin,
        targetScore,
        estimate: scoreEstimate.estimate,
        coreIds,
        coreForwardQ,
        coreMaintainQ,
        requiredPaceQ,
        dailyFloor,
        attemptsPerMastery: attempts,
        retentionOf,
        effectiveRetention: retentionFor(today, examDate),
        endgame,
        feasibility: feasibilityOf(required, available),
    };
}
