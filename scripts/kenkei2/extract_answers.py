# 解答PDF（模範解答）→ 構造化JSON（docs/design/kenkei2.md §3・K2）。第1問（仕訳）・第2問（金額）・第5問（精算表）。
# usage: python3 -I extract_answers.py in.pdf out.json
# 出力はリポジトリの外に置く。検証は scripts/kenkei2/check.mjs（src/lib/kenkei2/validate.ts）が行う。
import json, re, sys
import pdfplumber
from pdfwords import nfkc, num, rows_of, shaded_cells, words_in

def find_page(pdf, marker):
    """見出し（〔第N問〕）のあるページを返す（解説ページの見出しは「《2級解説》」の後ろなので最初の1つ）。"""
    for i, pg in enumerate(pdf.pages):
        if marker in nfkc(pg.extract_text() or '').replace(' ', ''):
            return i
    return None

# ---- 第1問 仕訳 ----
def part1(pg):
    rows = rows_of(pg)
    labels = []   # (y, n)
    for r in rows:
        for w in r:
            m = re.fullmatch(r'\((\d)\)', nfkc(w['text']))
            if m and w['x0'] < 120:
                labels.append((w['top'], int(m.group(1))))
    labels.sort()
    mids = [(labels[i][0] + labels[i + 1][0]) / 2 for i in range(len(labels) - 1)]
    def entry_of(y):
        k = 0
        while k < len(mids) and y > mids[k]:
            k += 1
        return labels[k][1]
    entries = {n: {'debit': [], 'credit': []} for _, n in labels}
    for r in rows:
        side = {'debit': [w for w in r if 125 <= w['x0'] < 385], 'credit': [w for w in r if w['x0'] >= 385]}
        for name, ws in side.items():
            if not ws:
                continue
            sym = nfkc(ws[0]['text'])
            amt = num(ws[-1]['text'])
            if re.fullmatch(r'[A-Z]', sym) and amt is not None and len(ws) >= 2:
                label = ''.join(nfkc(w['text']) for w in ws[1:-1])
                entries[entry_of(r[0]['top'])][name].append({'symbol': sym, 'name': label, 'amount': amt})
    return [{'no': n, **entries[n]} for n in sorted(entries)]

# ---- 第2問 金額 ----
def part2(pg):
    out = []
    rows = rows_of(pg)
    start = next((i for i, r in enumerate(rows) if '〔第2問〕' in ''.join(nfkc(w['text']) for w in r).replace(' ', '')), 0)
    for r in rows[start + 1:]:
        toks = [nfkc(w['text']) for w in r]
        for i, t in enumerate(toks):
            m = re.fullmatch(r'\((\d)\)', t)
            if m:
                rest = [x for x in toks[i + 1:] if not re.fullmatch(r'\(\d\)', x)]
                # 次の (n) までの最初の数
                val, unit = None, ''
                j = i + 1
                while j < len(toks) and not re.fullmatch(r'\(\d\)', toks[j]):
                    v = num(toks[j])
                    if v is not None and val is None:
                        val = v
                    if toks[j] in ('年', '％', '%', '円', '月', '日'):
                        unit = toks[j]
                    j += 1
                if val is not None:
                    out.append({'no': int(m.group(1)), 'value': val, 'unit': unit})
    return sorted(out, key=lambda x: x['no'])

# ---- 第5問 精算表 ----
COLS = ['tb_d', 'tb_c', 'adj_d', 'adj_c', 'pl_d', 'pl_c', 'bs_d', 'bs_c']

def part5(pg):
    # 縦罫（細長い矩形）の x から 8 列の境界を取る
    import collections
    cnt = collections.Counter(round(r['x0']) for r in pg.rects if (r['x1'] - r['x0']) < 2.0 and (r['bottom'] - r['top']) > 8)
    xs = sorted(x for x, c in cnt.items() if c >= 20 and x > 100)   # 表の縦罫は行ごとの矩形が多数並ぶ（凡例の見本は1つだけ）
    bounds = []
    for x in xs:
        if not bounds or x - bounds[-1] > 4:
            bounds.append(x)
    bounds = [x for x in bounds if x < 700]
    if len(bounds) < 9:
        raise SystemExit(f'列の罫線が足りない: {bounds}')
    bounds = bounds[-9:]
    # 行の境界 = 「勘定科目」の列を横切る罫線（整理記入に複数行ある勘定は科目のマスが結合されていて罫線が無い）
    thin = [r for r in pg.rects if (r['bottom'] - r['top']) < 2.0]
    by_y = {}
    for r in thin:
        by_y.setdefault(round(r['top']), []).append((r['x0'], r['x1']))
    def covers(iv, lo=75, hi=160):
        cur = lo
        for x0, x1 in sorted(iv):
            if x0 <= cur + 1:
                cur = max(cur, x1)
        return cur >= hi
    ys = sorted(y for y, iv in by_y.items() if covers(iv))
    rules = []
    for y in ys:
        if not rules or y - rules[-1] > 3:
            rules.append(y)
    words = pg.extract_words(x_tolerance=3.5, y_tolerance=2)
    header_bottom = max(w['bottom'] for w in words if nfkc(w['text']) in ('借', '貸') and 110 < w['top'] < 140)
    rules = [y for y in rules if y > header_bottom - 4]
    bands = [(rules[i], rules[i + 1]) for i in range(len(rules) - 1)]
    rows_out = []
    for top, bot in bands:
        inside = [w for w in words if top - 1 <= (w['top'] + w['bottom']) / 2 <= bot + 1]
        name = ''.join(nfkc(w['text']) for w in inside if w['x1'] < bounds[0] + 1 and w['x0'] > 55)
        cells = {c: [] for c in COLS}
        for w in sorted(inside, key=lambda w: w['top']):
            v = num(w['text'])
            if v is None:
                continue
            cx = (w['x0'] + w['x1']) / 2
            for k in range(8):
                if bounds[k] - 1 <= cx <= bounds[k + 1] + 1:
                    cells[COLS[k]].append({'v': v, 'y': round(w['top'], 1)})
                    break
        rows_out.append({'name': name, 'top': top, 'bottom': bot, 'cells': cells})
    # 網掛け（採点マス）→ 行・列・正答。凡例の見本（表の下の小さな矩形）は除く
    table_bottom = bands[-1][1]
    shades = []
    for b in shaded_cells(pg):
        if (b[3] - b[1]) < 3 or b[1] < header_bottom or b[1] > table_bottom or b[0] > 690:
            continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        col = next((COLS[k] for k in range(8) if bounds[k] <= cx <= bounds[k + 1]), None)
        ri = next((i for i, (t, bt) in enumerate(bands) if t - 1 <= cy <= bt + 1), None)
        if ri is not None and cx < bounds[0]:
            shades.append((ri, 'label', cy))          # 当期（純利益）の見出し自体が解答欄の回（第34回）
        elif col is not None and ri is not None:
            shades.append((ri, col, cy))
    # 行の意味づけ
    def one(cells, col):
        v = [c['v'] for c in cells[col]]
        if len(v) > 1:
            raise SystemExit(f'1マスに複数の値: {col} {v}')
        return v[0] if v else 0
    accounts, tb_total, subtotal, ni_band = [], None, None, None
    index_of = {}
    for i, r in enumerate(rows_out):
        c = r['cells']
        has = any(c[k] for k in COLS)
        if '当期' in r['name']:
            ni_band = i
        elif r['name']:
            index_of[i] = len(accounts)
            accounts.append({
                'name': r['name'],
                'tb': [one(c, 'tb_d'), one(c, 'tb_c')],
                'adj': [[x['v'] for x in c['adj_d']], [x['v'] for x in c['adj_c']]],
                'pl': [one(c, 'pl_d'), one(c, 'pl_c')],
                'bs': [one(c, 'bs_d'), one(c, 'bs_c')],
            })
        elif has and tb_total is None and c['tb_d'] and c['tb_c']:
            tb_total = [one(c, 'tb_d'), one(c, 'tb_c')]
        elif has and subtotal is None and ni_band is None and c['adj_d']:
            subtotal = {'adj': [one(c, 'adj_d'), one(c, 'adj_c')], 'pl': [one(c, 'pl_d'), one(c, 'pl_c')], 'bs': [one(c, 'bs_d'), one(c, 'bs_c')]}
        elif has and ni_band is None:
            raise SystemExit(f'名前の無い行に数値: {i} {r["cells"]}')
    ni = None
    if subtotal:
        ni = subtotal['pl'][1] - subtotal['pl'][0]
    scored = []
    for ri, col, cy in shades:
        if ri == ni_band:
            if col == 'label':
                scored.append({'row': 'ni', 'col': 'label', 'expected': '純利益' if (ni or 0) >= 0 else '純損失'})
            elif col in ('pl_d', 'bs_c') if (ni or 0) >= 0 else col in ('pl_c', 'bs_d'):
                # 利益なら損益計算書の借方・貸借対照表の貸方（損失なら逆）だけが解答欄。他の網掛けは「入力なし」の灰色
                scored.append({'row': 'ni', 'col': col, 'expected': abs(ni) if ni is not None else None})
        elif ri in index_of:
            cs = rows_out[ri]['cells'][col]
            cand = min(cs, key=lambda c: abs(c['y'] - cy)) if cs else None
            scored.append({'row': index_of[ri], 'col': col, 'expected': cand['v'] if cand else None})
        else:
            scored.append({'row': None, 'col': col, 'expected': None, 'bandName': rows_out[ri]['name']})
    return {'accounts': accounts, 'tbTotal': tb_total, 'subtotal': subtotal, 'netIncome': ni, 'scored': scored}

def main(src, dst):
    pdf = pdfplumber.open(src)
    out = {'source': src.split('/')[-1]}
    out['title'] = nfkc(pdf.pages[0].extract_text().splitlines()[0])
    out['part1'] = part1(pdf.pages[find_page(pdf, '〔第1問〕')])
    out['part2'] = part2(pdf.pages[find_page(pdf, '〔第2問〕')])
    p5 = find_page(pdf, '〔第5問〕')
    out['part5'] = part5(pdf.pages[p5]) if p5 is not None else None
    out['pages'] = {'part1': find_page(pdf, '〔第1問〕'), 'part5': p5}
    json.dump(out, open(dst, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
