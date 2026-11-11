# 公式PDF（試験問題A/B）から本文を抽出する（docs/design/doboku1-ichiji.md §6 T2）。
# ルビ（7pt未満のかな）を除き、同じベースラインの文字を左→右に連結する。小さい英数字は上付き・下付きとして
# 近い行に入れる（m² の ² は上付き、Na₂O の ₂ は下付きに変換、ρt の t はそのまま）。PyMuPDF が必要（pip install pymupdf）。
# 出力はリポジトリの外に置く（本文をコミットしない）。usage: python3 extract.py in.pdf out.txt [--plain]
# --plain: 正答肢PDF用。ページのテキストをそのまま書き出す（parseAnswerKey が読む形）。
import sys, re, unicodedata, pymupdf

SUP = str.maketrans('0123456789+-−', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻')
SUB = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
KANA = re.compile(r'[぀-ヿ　-〿]')
# ToUnicode の無い字形（R01〜R07 の数字・かぎ括弧・(ア)(イ) などの記号。CID 名 cXXXX）を /Differences の字形名から戻す。
# 空欄の記号（イ）〜（ニ）は前後に全角空白を付け、parse.ts の normalizeBlanks で ［イ］ にする。
# E050 は表の点線（列の区切り）、E054 は見出しの波線（飾り）。対応は字形を画像で確認した（2026-11-11）
GLYPH = {f'c{0x2690 + i:04X}': str(i) for i in range(10)} | {
    'c2F5B': '「', 'c2F5C': '」', 'c275E': '（ア）', 'c2760': '（ウ）',
    'c275F': '　イ　', 'c2788': '　ロ　', 'c2777': '　ハ　', 'c2773': '　ニ　',
}
# 記号だけの小さな字形セット（字形名が漢字になっている）。1〜2字形のフォントに限って置き換える（本物の「挨拶」を壊さない）
SYMBOL = {'uni6328': '−', 'uni8475': '±'}
PUA = {'\ue050': '\x00', '\ue054': ''}

def glyph_maps(doc, page):
    """フォント名 → {文字コード: 置換文字}（GLYPH にある字形名だけ）。"""
    out = {}
    for f in page.get_fonts(full=True):
        m = re.search(r'/Encoding (\d+) 0 R', doc.xref_object(f[0]))
        if not m: continue
        names, code = {}, 0
        for tok in re.findall(r'\d+|/[^\s/\]]+', doc.xref_object(int(m.group(1))).split('/Differences', 1)[-1].split(']', 1)[0]):
            if tok[0] == '/':
                names[code] = tok[1:]
                code += 1
            else: code = int(tok)
        table = GLYPH | (SYMBOL if len(names) <= 2 else {})
        diff = {c: table[n] for c, n in names.items() if n in table and n not in SYMBOL}
        if diff:
            key = f[3].split('+', 1)[-1]
            if key in out and any(out[key].get(c, v) != v for c, v in diff.items()):
                sys.exit(f'同名フォントで字形の対応が食い違う: {key} p.{page.number + 1}')
            out[key] = out.get(key, {}) | diff
        # SYMBOL の字形は ToUnicode で漢字（挨・葵）に戻され、フォント名も本文と同じなので、ページ全体で文字から引く
        for n in names.values():
            if n in SYMBOL and n in table: out.setdefault('*', {})[chr(int(n[3:], 16))] = table[n]
    return out

doc = pymupdf.open(sys.argv[1])
if len(sys.argv) > 3 and sys.argv[3] == '--plain':
    open(sys.argv[2], 'w').write('\n'.join(p.get_text() for p in doc)); sys.exit(0)

out = []
for i, p in enumerate(doc):
    out.append(f'=== page {i+1}')
    main, small = [], []
    gm = glyph_maps(doc, p)
    for b in p.get_text('rawdict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                for c in s['chars']:
                    ch = PUA.get(c['c'], gm.get(s['font'], {}).get(ord(c['c']), c['c']))
                    ch = gm.get('*', {}).get(ch, ch)
                    if ch == '': continue
                    item = (c['origin'][1], c['origin'][0], ch, s['size'])
                    if s['size'] >= 7: main.append(item)
                    elif not KANA.match(c['c']) and c['c'].strip(): small.append(item)
    # 行（ベースライン）をまとめる
    main.sort()
    rows = []
    for y, x, ch, sz in main:
        if rows and abs(y - rows[-1]['y']) <= 3: rows[-1]['chars'].append((x, ch))
        else: rows.append({'y': y, 'chars': [(x, ch)]})
    rows = [r for r in rows if any(ch.strip() for _, ch in r['chars'])]  # 空白だけの行（R02 A07）に上付きを付けない
    # 小さい英数字を最寄りの行へ（行のベースラインより上なら上付き）
    for y, x, ch, sz in small:
        if not rows: break
        r = min(rows, key=lambda r: abs(r['y'] - y))
        if abs(r['y'] - y) > 8: continue
        if y < r['y'] - 2 and ch in '0123456789+-−': ch = ch.translate(SUP)
        elif y > r['y'] + 0.5 and ch in '0123456789': ch = ch.translate(SUB)
        r['chars'].append((x, ch))
    for r in rows:
        r['chars'].sort()
        line, px = '', None
        for x, ch in r['chars']:
            if px is not None and x - px > 25: line += ' '
            line += ch; px = x
        line = re.sub(r'\s*\x00+\s*', '   ', line)  # 点線 → 列の区切り（3つ以上の空白）
        line = re.sub(r'[ｦ-ﾟ]+', lambda m: unicodedata.normalize('NFKC', m.group()), line)  # 半角カナ（R02 A01）
        if line.strip(): out.append(line)
open(sys.argv[2], 'w').write('\n'.join(out))
