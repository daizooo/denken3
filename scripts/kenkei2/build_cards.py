# 抽出結果 → 設問ごとのカード（docs/design/kenkei2.md §5・K3）。DB に入れる行の元になる JSON を作り、検証する。
# usage: python3 build_cards.py <作業ディレクトリ> <回> [<回>…]
#   作業ディレクトリに a{回}.json（extract_answers）・s{回}.json（extract_sheets）・p{回}.json（extract_problems）が要る。
#   出力: cards{回}.json（リポジトリの外に置く。問題文・正答は DB のみ）
# カード: 第1問の仕訳1組・第2問の1問・第3問・第4問・第5問（精算表）を1枚ずつ。1回あたり 5+4+3 = 12枚。
import json, re, sys
from pdfwords import nfkc

DECOR = re.compile(r'〔\?[^〕]*〕')          # 項目番号の飾り字形（復元できない記号）
FIXES = [('茜', '・')]                       # 中黒が別の字形（茜）に化けている

CIRCLED = {chr(0x2460 + i): f'\ue000{i}\ue001' for i in range(20)}   # ①〜⑳ は NFKC で 1〜20 になるので退避する

def clean(s, blanks_on=False):
    s = DECOR.sub('', s)
    for a, b in FIXES:
        s = s.replace(a, b)
    for a, b in CIRCLED.items():
        s = s.replace(a, b)
    if blanks_on:
        s = re.sub('\u3000{3,}', '\ue002', s)   # 全角空白が3つ以上続く所は空欄（NFKC・空白の整理で消えないよう退避）。第1・2問の設問本文だけ
    s = nfkc(s)
    s = re.sub('\ue000(\\d+)\ue001', lambda m: chr(0x2460 + int(m.group(1))), s)
    s = re.sub(r' {2,}', ' ', s)
    return s.replace('\ue002', '＿＿＿＿')

def page_lines(prob):
    out = []
    for pi, page in enumerate(prob['pages']):
        for l in page:
            t = l['text']
            if 'indd' in t or re.search(r'i+n+d+d+', t) or '問問題題' in t or '問題.smd' in t or re.search(r'v\d\.\d\d$', t) or re.fullmatch(r'[-－−–— ]*\d[-－−–— ]*', clean(t)):
                continue   # フッタ（ページ番号・印刷情報）
            out.append({'page': pi, 'top': l['top'], 'x0': l['x0'], 'raw': t, 'text': clean(t), 'itext': clean(t, True)})
    return out

def heading_rest(text):
    """〔第N問〕 の見出しに続く本文（見出し行に本文の頭が入っている）。"""
    return re.sub(r'^〔第\s*\d\s*問〕[\t ]*', '', text)

def heading_index(lines, n):
    for i, l in enumerate(lines):
        if re.match(rf'^〔第\s*{n}\s*問〕', l['text']):
            return i
    return None

def split_items(lines, count):
    """設問 (1)〜(count) の本文。項目の先頭行 = 先頭が (n) か、番号だけ（飾り字形の直後）で、n が連番のもの。"""
    items, cur, expect = [], None, 1
    for l in lines:
        raw = l['raw']
        t = l['itext']
        has_marker = bool(DECOR.match(raw)) or bool(re.match(r'^\(\d\)', t))
        m = re.match(r'^\(?(\d)\)?\s*', t)
        if has_marker and m and int(m.group(1)) == expect and expect <= count:
            cur = [t[m.end():]]
            items.append(cur)
            expect += 1
        elif cur is not None:
            cur.append(t)
    return [re.sub(r'＿＿＿＿(?:\s*＿＿＿＿)+', '＿＿＿＿', join_lines(it)) for it in items]

def join_lines(parts):
    """折り返しの行をつなぐ。前後がどちらも英数字のときだけ空白を入れる（日本語の途中に空白を入れない）。"""
    out = ''
    for p in (x.strip() for x in parts):
        if out and re.search(r'[A-Za-z0-9,.]$', out) and re.match(r'[A-Za-z0-9]', p):
            out += ' '
        out += p
    return out.strip()

def blanks(s, keep_tabs=False):
    s = re.sub(r'[　]{3,}', '＿＿＿＿', s)
    s = re.sub(r'(?<=¥)\t+', '＿＿＿＿', s)
    s = re.sub(r'＿＿＿＿(?:[\s\t]*＿＿＿＿)+', '＿＿＿＿', s)   # 空白・枠・タブで二重に印が付いたものを1つにする
    return s if keep_tabs else s.replace('\t', ' ')

def symbols_of(lines):
    """勘定科目群（記号＋科目名）。"""
    txt = ' '.join(l['text'].replace('\t', ' ') for l in lines)
    return {m.group(1): m.group(2) for m in re.finditer(r'(?:(?<=\s)|^)([A-Z]) ?([^\sA-Z]\S*)', txt)}

def region(lines, a, b):
    return [l for l in lines[a:b]]

AMOUNT = re.compile(r'^\d{1,3}(,\d{3})+$')

def stem_numbers(stem):
    """問題文に出てくる数値の集合（カンマなしの整数）。"""
    return {int(x.replace(',', '')) for x in re.findall(r'\d[\d,]*', stem)}

def hint_words(words, stem):
    """解答用紙の「採点対象外の、計算で求める数値」（本番の解答用紙では空欄だった可能性が高く、見せるとヒントになる）の添字。
    - 部門費振替表: 表の最初の金額の行（問題に与えられた「工事直接費」などの行）は残し、それより下の金額を隠す。
      ただし資料に「?」がある回（第34・39回）は、解答用紙の数値から逆算させる問題なので隠さない。
    - 工事別原価計算表・工事原価明細表: **問題文に出てこない数値**を隠す（与件は問題文の資料にある。解答用紙にだけある数値は、計算して求めるもの）。
    - それ以外（T勘定など）: 隠さない（勘定口座の数値は解答用紙に与件として印字されている）。
    採点前だけ隠し、採点後は見せる。"""
    ys = sorted({w[2] for w in words if AMOUNT.match(w[0])})
    num = lambda t: int(t.replace(',', ''))
    isamt = lambda t: bool(AMOUNT.match(t) or re.fullmatch(r'\d+', t))
    if '部門費振替表' in stem:
        # 資料に「?」がある回（第34・39回）は、解答用紙に印字された数値が与件（解くのに必要）。隠すと解けなくなるので隠さない
        if not ys or '?' in stem:
            return []
        first = ys[0]
        # 1桁ずつの枠の金額（第34回。数字が1字ずつ別の語、またはカンマ無しの数字列）も、最初の金額の行より下なら隠す
        return [i for i, w in enumerate(words) if isamt(w[0]) and w[2] > first + 5]
    if not re.search(r'工事別原価計算表|工事原価明細表', stem):
        return []   # T勘定（第34・37回の第3問）などは、勘定口座の数値が解答用紙に与件として印字されている。隠さない
    given = stem_numbers(stem)
    return [i for i, w in enumerate(words) if isamt(w[0]) and len(w[0].replace(',', '')) >= 3 and num(w[0]) not in given]


def build(work, kai):
    A = json.load(open(f'{work}/a{kai}.json'))
    S = json.load(open(f'{work}/s{kai}.json'))
    P = json.load(open(f'{work}/p{kai}.json'))
    lines = page_lines(P)
    h = {n: heading_index(lines, n) for n in (1, 2, 3, 4, 5)}
    if None in h.values():
        raise SystemExit(f'見出しが見つからない: {h}')
    cards, problems = [], []

    # 第1問
    g0 = next((i for i in range(h[1] + 1, h[2]) if re.match(r'^<勘定科目群>', lines[i]['text'])), None)
    if g0 is None:
        raise SystemExit('勘定科目群が見つからない')
    items1 = split_items(lines[h[1] + 1:g0], 5)
    syms = symbols_of(lines[g0 + 1:h[2]])
    if len(items1) != 5:
        problems.append(f'第1問の設問が {len(items1)} 個')
    for e in A['part1']:
        key = {'debit': [{'s': l['symbol'], 'a': l['amount']} for l in e['debit']],
               'credit': [{'s': l['symbol'], 'a': l['amount']} for l in e['credit']]}
        for side in ('debit', 'credit'):
            for l in e[side]:
                if syms.get(l['symbol']) != l['name']:
                    problems.append(f"第1問({e['no']}) 記号 {l['symbol']} の科目名 {l['name']} が科目群 {syms.get(l['symbol'])} と違う")
        cards.append({'id': f"K2_{kai}_1_{e['no']}", 'part': 1, 'sub': e['no'], 'form_kind': 'journal', 'points': 4,
                      'stem': blanks(items1[e['no'] - 1]) if e['no'] <= len(items1) else '',
                      'frame': {'symbols': [[k, v] for k, v in syms.items()]}, 'key': key})

    # 第2問
    h3 = h[3]
    items2 = split_items(lines[h[2] + 1:h3], 4)
    if len(items2) != 4:
        problems.append(f'第2問の設問が {len(items2)} 個')
    for e in A['part2']:
        unit = e['unit'] or ('年' if '年' in (items2[e['no'] - 1][-12:] if e['no'] <= len(items2) else '') else '円')
        cards.append({'id': f"K2_{kai}_2_{e['no']}", 'part': 2, 'sub': e['no'], 'form_kind': 'amount', 'points': 3,
                      'stem': blanks(items2[e['no'] - 1]) if e['no'] <= len(items2) else '',
                      'frame': {'unit': unit}, 'key': {'value': e['value']}})

    # 第3・4問（解答用紙の複製＋問題文）
    for n in (3, 4):
        sh = next(x for x in S['sheets'] if x['part'] == n)
        end = h[n + 1] if n + 1 in h and h[n + 1] > h[n] else len(lines)
        stem = [blanks(heading_rest(lines[h[n]]['text']), True)] + [blanks(l['text'], True) for l in lines[h[n] + 1:end]]
        stem = [x for x in stem if x.strip()]
        units = [{'id': u['id'], 'points': u['points'], 'cells': [{'k': {'amount': 'a', 'symbol': 's', 'text': 't'}[c['kind']], 'box': [round(v) for v in c['box']]} for c in u['cells']]} for u in sh['units']]
        key = {f"{u['id']}.{i}": c['expected'] for u in sh['units'] for i, c in enumerate(u['cells'])}
        frame = {'box': [0, round(sh['top']), 730, round(sh['bottom'])], 'page': sh['page'],
                 'words': [[w['t'], round(w['x']), round(w['y']), round(w['x1']), round(w['y1'])] for w in sh['words']],
                 'rules': [[round(v) for v in r] for r in sh['rules']], 'units': units}
        hide = hint_words(frame['words'], '\n'.join(stem))
        if hide:
            frame['hide'] = hide
        cards.append({'id': f'K2_{kai}_{n}_1', 'part': n, 'sub': 1, 'form_kind': 'sheet', 'points': sum(u['points'] for u in sh['units']),
                      'stem': '\n'.join(stem), 'frame': frame, 'key': key})

    # 第5問（精算表）
    p5 = A['part5']
    stem5 = [x for x in [blanks(heading_rest(lines[h[5]]['text']), True)] + [blanks(l['text'], True) for l in lines[h[5] + 1:]] if x.strip()]
    frame5 = {'accounts': [{'n': a['name'], 'tb': a['tb']} for a in p5['accounts']], 'tbTotal': p5['tbTotal']}
    key5 = {'accounts': [{'n': a['name'], 'tb': a['tb'], 'adj': a['adj'], 'pl': a['pl'], 'bs': a['bs']} for a in p5['accounts']],
            'netIncome': p5['netIncome'], 'scored': [{'row': s['row'], 'col': s['col'], 'v': s['expected']} for s in p5['scored']]}
    cards.append({'id': f'K2_{kai}_5_1', 'part': 5, 'sub': 1, 'form_kind': 'settlement', 'points': 30,
                  'stem': '\n'.join(stem5), 'frame': frame5, 'key': key5})

    # 検証
    for c in cards:
        if not c['stem'].strip():
            problems.append(f"{c['id']}: 問題文が空")
        if c['part'] == 2 and c['stem'].count('＿＿＿＿') != 1:
            problems.append(f"{c['id']}: 空欄の印（＿＿＿＿）が {c['stem'].count('＿＿＿＿')} 個（1個のはず）")
        if '〔?' in c['stem'] or re.search(r'[\x00-\x08]', c['stem']):
            problems.append(f"{c['id']}: 復元できない字形が残っている")
    if sum(c['points'] for c in cards) != 100:
        problems.append(f"配点の合計が {sum(c['points'] for c in cards)}")
    return cards, problems

if __name__ == '__main__':
    work = sys.argv[1]
    bad = 0
    for kai in sys.argv[2:]:
        cards, problems = build(work, int(kai))
        json.dump(cards, open(f'{work}/cards{kai}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
        size = len(json.dumps(cards, ensure_ascii=False, separators=(',', ':')).encode())
        print(f'第{kai}回: {len(cards)}枚 {size // 1024}KB 配点{sum(c["points"] for c in cards)}', 'OK' if not problems else 'NG')
        for p in problems:
            print('   -', p)
        bad += bool(problems)
    sys.exit(1 if bad else 0)
