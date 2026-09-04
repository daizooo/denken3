// 本番（CBT）の1問あたりの持ち時間。
// 「速い/遅い」の判定基準に使う（study-time-scarcity.md 課題12）。
//
// 従来は「同難易度帯の中央値超え」で遅いと判定していたが、中央値は定義上つねに約半数を
// 「遅い」側に落とすため、難易度1（中央値1.9分）では4分で解けていても警告が出ていた。
// 表示文言が元々意図していた「本番で失点しやすい」に実装を合わせる。
// 理論は90分でA問題14問＋B問題3問（B問題は(a)(b)の2問構成）。
// 見直しの時間を残す前提で、A問題5分・B問題10分を持ち時間とする。
export const A_LIMIT_SECONDS = 5 * 60;
export const B_LIMIT_SECONDS = 10 * 60;
// タイトル末尾の出典表記（例:「（H17-B15）」「（H16-A4/R6下-A7）」）から B問題を判定する。
// 出典が未記載の章（静電気・電気計測・三相交流）は A問題として扱う。
// 本番の出題数もA問題が大半（14/17）であり、既定としてA問題側に倒すのが安全側。
const B_SOURCE = /-B\d/;
export function examTimeLimitSeconds(title) {
    return B_SOURCE.test(title) ? B_LIMIT_SECONDS : A_LIMIT_SECONDS;
}
