# 解答PDF（資格スクール大栄の模範解答）から文字・罫線・網掛けを読む共通部品（docs/design/kenkei2.md §3）。
# pdfplumber が必要（pip install pdfplumber）。出力はリポジトリの外に置く（本文・正答をコミットしない）。
import re, unicodedata

def nfkc(s):
    """全角→半角（ローマ数字記号の「Ⅽ」「Ⅿ」も英字になる）。"""
    return unicodedata.normalize('NFKC', s)

def num(s):
    """'1,234' → 1234。PDF の誤植 '47.800'（桁区切りが小数点）も 1234 と同じく読む。数でなければ None。"""
    t = nfkc(s).replace(',', '').replace('￥', '').replace('¥', '').strip()
    m = re.fullmatch(r'(\d+)\.(\d{3})', t)      # 47.800 → 47800（小数の金額は出題されない）
    if m:
        return int(m.group(1) + m.group(2))
    return int(t) if re.fullmatch(r'\d+', t) else None

def rows_of(page, x_tol=3.5, y_gap=4):
    """ページの単語を行にまとめる。各行は [word…]（左→右）、行の top は先頭の top。"""
    words = sorted(page.extract_words(x_tolerance=x_tol, y_tolerance=2), key=lambda w: (w['top'], w['x0']))
    rows = []
    for w in words:
        if rows and abs(w['top'] - rows[-1][0]['top']) <= y_gap:
            rows[-1].append(w)
        else:
            rows.append([w])
    return [sorted(r, key=lambda w: w['x0']) for r in rows]

def is_gray(r):
    """採点対象の網掛け（グレー 0.5〜0.95）。"""
    c = r.get('non_stroking_color')
    try:
        v = c if isinstance(c, (int, float)) else c[0]
    except Exception:
        return False
    return bool(r.get('fill')) and 0.5 < v < 0.95

def shaded_cells(page):
    """網掛けの矩形をつなげて1マス1つの bbox（x0, top, x1, bottom）にする。凡例の見本（小さな単独矩形）は呼び側で除く。"""
    boxes = [[r['x0'], r['top'], r['x1'], r['bottom']] for r in page.rects if is_gray(r)]
    merged = []
    for b in boxes:
        hit = None
        for m in merged:
            if b[0] <= m[2] + 0.5 and b[2] >= m[0] - 0.5 and b[1] <= m[3] + 0.5 and b[3] >= m[1] - 0.5:
                hit = m
                break
        if hit:
            hit[0], hit[1], hit[2], hit[3] = min(hit[0], b[0]), min(hit[1], b[1]), max(hit[2], b[2]), max(hit[3], b[3])
        else:
            merged.append(b)
    # 併合で新たに重なったものを繰り返しまとめる
    changed = True
    while changed:
        changed = False
        out = []
        for b in merged:
            for m in out:
                if b[0] <= m[2] + 0.5 and b[2] >= m[0] - 0.5 and b[1] <= m[3] + 0.5 and b[3] >= m[1] - 0.5:
                    m[0], m[1], m[2], m[3] = min(m[0], b[0]), min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3])
                    changed = True
                    break
            else:
                out.append(list(b))
        merged = out
    return [tuple(b) for b in merged]

def words_in(page, box, pad=1.0):
    """bbox の中に収まる単語（中心で判定）。"""
    x0, t, x1, b = box
    out = []
    for w in page.extract_words(x_tolerance=3.5, y_tolerance=2):
        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
        if x0 - pad <= cx <= x1 + pad and t - pad <= cy <= b + pad:
            out.append(w)
    return sorted(out, key=lambda w: (round(w['top']), w['x0']))
