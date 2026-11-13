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

def _area(b):
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])

def _inter(a, b):
    return _area((max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])))

def shaded_cells(page):
    """網掛けの矩形を1マス1つの bbox（x0, top, x1, bottom）にする。
    同じマスの外枠と内側（入れ子・大きく重なる矩形）はまとめる。隣り合うマスは、接していても別のマスのまま。
    ただし括弧や1桁ずつの枠（幅 25pt 未満）でつながった同じ高さの矩形は1つのマスにまとめる。"""
    boxes = [(r['x0'], r['top'], r['x1'], r['bottom']) for r in page.rects if is_gray(r)]
    out = []
    for b in sorted(boxes, key=lambda b: -_area(b)):
        for m in out:
            if _inter(b, m) >= 0.5 * min(_area(b), _area(m)):
                m[0], m[1], m[2], m[3] = min(m[0], b[0]), min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3])
                break
        else:
            out.append(list(b))
    # 括弧・1桁ずつの枠（幅 25pt 未満）でつながった同じ高さの矩形は1つのマス（例: 「( 2,738,300 )」「J ( 10,611,500 )」）。
    # 幅は併合前の値で判定する（つなぎ役の細い枠が両隣をまとめる）
    parent = list(range(len(out)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i in range(len(out)):
        for j in range(i + 1, len(out)):
            a, b = out[i], out[j]
            narrow = (a[2] - a[0]) < 25 or (b[2] - b[0]) < 25
            same_row = abs(a[1] - b[1]) < 3 and abs(a[3] - b[3]) < 3
            if narrow and same_row and a[0] <= b[2] + 1.5 and a[2] >= b[0] - 1.5:
                parent[find(i)] = find(j)
    groups = {}
    for i, b in enumerate(out):
        groups.setdefault(find(i), []).append(b)
    out = [[min(x[0] for x in g), min(x[1] for x in g), max(x[2] for x in g), max(x[3] for x in g)] for g in groups.values()]
    return [tuple(b) for b in out]

def words_in(page, box, pad=1.0):
    """bbox の中に収まる単語（中心で判定）。"""
    x0, t, x1, b = box
    out = []
    for w in page.extract_words(x_tolerance=3.5, y_tolerance=2):
        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
        if x0 - pad <= cx <= x1 + pad and t - pad <= cy <= b + pad:
            out.append(w)
    return sorted(out, key=lambda w: (round(w['top']), w['x0']))
