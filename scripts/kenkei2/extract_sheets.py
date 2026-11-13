# 解答PDF（模範解答）→ 第3・4問の解答用紙の複製（docs/design/kenkei2.md §3・K2）。
# 表・金額・記号は形が回ごとに違うため、解答ページの文字・罫線をそのまま座標つきで写し、
# 解答欄（網掛け・¥の金額・記号）だけを入力欄（cells）に切り出す。画面はこの複製を描いて、cells を入力欄にする。
# usage: python3 extract_sheets.py in.pdf out.json   （出力はリポジトリの外に置く）
import json, re, sys
import pdfplumber
from pdfwords import nfkc, shaded_cells

# 配点（大栄の予想）。網掛けのマスは 1つにつき 2点。記号の表は 34・35 回が各2点、他は各1点。
# 網掛け以外の金額・記号は問ごとに決まる: 数値=1マスの点、('pair', 点)=その問の金額＋記号を両方正解で得点。
SYMBOL_ROW_POINTS = {34: 2, 35: 2}
POINTS = {
    (35, 3): {1: 4, 2: 4, 3: ('pair', 6)},
    (36, 3): {2: ('pair', 4)},
    (36, 4): {1: 2, 2: 3, 3: 3},
    (38, 3): {1: 5, 2: 5, 3: ('pair', 4)},
    (38, 4): {1: ('pair', 2)},
    (39, 3): {1: 2, 2: 3, 3: 3},
}
SHADE_POINTS = 2

def region_heads(pg):
    """ページ内の 〔第N問〕 見出し → [(n, top)]。"""
    out = []
    for w in pg.extract_words(x_tolerance=3.5, y_tolerance=2):
        m = re.fullmatch(r'〔第(\d)問〕', nfkc(w['text']).replace(' ', ''))
        if m:
            out.append((int(m.group(1)), w['top']))
    return sorted(out, key=lambda x: x[1])

def cell_value(words):
    s = ''.join(nfkc(w['text']) for w in sorted(words, key=lambda w: (round(w['top'] / 4), w['x0'])))
    s = re.sub(r'[\s,()]', '', s)
    if re.fullmatch(r'\d+', s):
        return 'amount', int(s)
    if re.fullmatch(r'[A-Z]', s):
        return 'symbol', s
    return 'text', s

def inside(w, b, pad=0.8):
    cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
    return b[0] - pad <= cx <= b[2] + pad and b[1] - pad <= cy <= b[3] + pad

def sheet_of(pg, kai, n, top, bottom):
    words = [w for w in pg.extract_words(x_tolerance=3.5, y_tolerance=2) if top - 1 <= w['top'] < bottom - 1]
    tokens = [(w, nfkc(w['text'])) for w in words]
    boxes = []   # (bbox, source)
    # 1) 網掛け。凡例の見本（右隣に「1つにつき」「各」がある小さな矩形）は除く
    for b in shaded_cells(pg):
        if not (top <= b[1] < bottom) or b[3] - b[1] < 3:
            continue
        legend = any(('つき' in t or t.startswith('各')) and b[2] <= w['x0'] <= b[2] + 12 and abs(w['top'] - b[1]) < 12 for w, t in tokens)
        if not legend:
            boxes.append((b, 'shade'))
    def covered(w):
        return any(inside(w, b) for b, _ in boxes)
    # 2) ¥ の右隣の数
    for i, (w, t) in enumerate(tokens):
        if t in ('¥', '￥') and not covered(w):
            nxt = [x for x, tx in tokens if abs(x['top'] - w['top']) < 6 and x['x0'] > w['x1'] - 1 and re.fullmatch(r'[\d,]+', tx)]
            if nxt:
                x = min(nxt, key=lambda x: x['x0'])
                boxes.append(((x['x0'], x['top'], x['x1'], x['bottom']), 'yen'))
    # 3) 「記号（…）」の右隣の英字1字
    for w, t in tokens:
        if t.startswith('記号(') or t.startswith('記号（'):
            nxt = [x for x, tx in tokens if abs(x['top'] - w['top']) < 6 and x['x0'] > w['x1'] - 1 and re.fullmatch(r'[A-Z]', tx)]
            if nxt:
                x = min(nxt, key=lambda x: x['x0'])
                boxes.append(((x['x0'], x['top'], x['x1'], x['bottom']), 'symbol'))
    # 4) 番号の行（1 2 3 …）の下の英字の行
    rows = {}
    for w, t in tokens:
        rows.setdefault(round(w['top'] / 4), []).append((w, t))
    keys = sorted(rows)
    for a, b in zip(keys, keys[1:]):
        nums = [t for _, t in sorted(rows[a], key=lambda p: p[0]['x0']) if re.fullmatch(r'\d', t)]
        letters = [(w, t) for w, t in sorted(rows[b], key=lambda p: p[0]['x0']) if re.fullmatch(r'[A-Z]', t)]
        if len(nums) >= 4 and nums == [str(i + 1) for i in range(len(nums))] and len(letters) == len(nums):
            for w, _ in letters:
                boxes.append(((w['x0'], w['top'], w['x1'], w['bottom']), 'symbol'))
    def elements_of(ws):
        """マスの中の単語 → 要素（記号・金額・文字）。括弧は印字なので読み飛ばす。"""
        out = []
        digits = []
        for w in sorted(ws, key=lambda w: (round(w['top'] / 4), w['x0'])):
            t = re.sub(r'[\s,()]', '', nfkc(w['text']))
            if t == '':
                continue
            if re.fullmatch(r'\d+', t):
                digits.append((w, t))
            elif re.fullmatch(r'[A-Z]', t):
                out.append(('symbol', t, w['x0'], w['top'], w['x1'], w['bottom']))
            else:
                out.append(('text', t, w['x0'], w['top'], w['x1'], w['bottom']))
        if digits:
            out.append(('amount', int(''.join(t for _, t in digits)), min(w['x0'] for w, _ in digits), min(w['top'] for w, _ in digits),
                        max(w['x1'] for w, _ in digits), max(w['bottom'] for w, _ in digits)))
        return sorted(out, key=lambda e: (round(e[3] / 4), e[2]))
    subs_sorted = sorted(subs := [{'no': int(m.group(1)), 'top': w['top']} for w, t in tokens
                                  if (m := re.fullmatch(r'問(\d)', t)) and w['x0'] < 130], key=lambda x: x['top'])
    def sub_of(y):
        cur = None
        for sb in subs_sorted:
            if sb['top'] - 2 <= y:
                cur = sb['no']
        return cur
    units = []
    seen = set()
    for b, src in sorted(boxes, key=lambda p: (round(p[0][1] / 4), p[0][0])):
        key = tuple(round(v) for v in b)
        if key in seen:
            continue
        seen.add(key)
        ws = [w for w in words if inside(w, b)]
        if src == 'shade':
            els = elements_of(ws)
            if not els:
                continue   # 中身の無い網掛けは「入力なし」の灰色
            units.append({'src': 'shade', 'sub': sub_of(b[1]), 'box': b, 'points': SHADE_POINTS,
                          'cells': [{'kind': k, 'expected': v, 'box': [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)]} for k, v, x0, y0, x1, y1 in els]})
        else:
            kind, val = cell_value(ws) if ws else ('text', '')
            units.append({'src': src, 'sub': sub_of(b[1]), 'box': b, 'points': None,
                          'cells': [{'kind': kind, 'expected': val, 'box': [round(v, 1) for v in b]}]})
    # 配点: 記号の表は行ごとの点、それ以外の金額・記号は POINTS（問ごと）に従う。pair は問内を1単位にまとめる
    rule = POINTS.get((kai, n), {})
    out_units, pair_units = [], {}
    for u in units:
        if u['src'] == 'symbol' and u['sub'] in (None, 1, 2) and rule.get(u['sub']) is None:
            u['points'] = SYMBOL_ROW_POINTS.get(kai, 1)
        elif u['src'] in ('yen', 'symbol'):
            r = rule.get(u['sub'])
            if isinstance(r, tuple):
                g = pair_units.setdefault(u['sub'], {'src': 'pair', 'sub': u['sub'], 'box': u['box'], 'points': r[1], 'cells': []})
                g['cells'] += u['cells']
                continue
            u['points'] = r if r is not None else SYMBOL_ROW_POINTS.get(kai, 1)
        out_units.append(u)
    out_units += list(pair_units.values())
    out_units.sort(key=lambda u: (round(u['box'][1] / 4), u['box'][0]))
    for i, u in enumerate(out_units):
        u['id'] = f'{n}-{i + 1}'
        u['box'] = [round(v, 1) for v in u['box']]
    cells = [c for u in out_units for c in u['cells']]
    cell_boxes = [c['box'] for c in cells]
    shown = [w for w in words if not any(inside(w, b) for b in cell_boxes)]
    rules = []
    for r in pg.rects:
        if top - 1 <= r['top'] < bottom and not (r.get('fill') and r.get('non_stroking_color') not in (0.0, 0, (0,), [0.0])) :
            h, wd = r['bottom'] - r['top'], r['x1'] - r['x0']
            if (h < 2.0 and wd > 3) or (wd < 2.0 and h > 3):
                rules.append([round(r['x0'], 1), round(r['top'], 1), round(r['x1'], 1), round(r['bottom'], 1)])
    legend = ' / '.join(sorted({t for _, t in tokens if re.search(r'\d点', t)}))
    return {
        'part': n, 'top': round(top, 1), 'bottom': round(bottom, 1),
        'words': [{'t': nfkc(w['text']), 'x': round(w['x0'], 1), 'y': round(w['top'], 1), 'x1': round(w['x1'], 1), 'y1': round(w['bottom'], 1)} for w in shown],
        'rules': rules, 'units': out_units, 'subs': [{'no': x['no'], 'top': round(x['top'], 1)} for x in subs], 'legend': legend,
    }

def main(src, dst):
    pdf = pdfplumber.open(src)
    kai = int(re.search(r'第(\d+)回', nfkc(pdf.pages[0].extract_text())).group(1))
    sheets = []
    for i, pg in enumerate(pdf.pages):
        if '解説' in nfkc(pg.extract_text() or '')[:300]:
            break   # 解説ページ（大栄の著作物）以降は読まない
        heads = region_heads(pg)
        if not heads or all(n in (1, 2, 5) for n, _ in heads):
            continue
        for k, (n, top) in enumerate(heads):
            if n not in (3, 4):
                continue
            bottom = heads[k + 1][1] if k + 1 < len(heads) else pg.height - 80
            s = sheet_of(pg, kai, n, top, bottom)
            s['page'] = i
            sheets.append(s)
    json.dump({'source': src.split('/')[-1], 'kai': kai, 'sheets': sheets}, open(dst, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
