# 公式PDF（試験問題A/B）から本文を抽出する（docs/design/doboku1-ichiji.md §6 T2）。
# ルビ（7pt未満のかな）を除き、同じベースラインの文字を左→右に連結する。小さい英数字は上付き・下付きとして
# 近い行に入れる（m² の ² は上付き、Na₂O の ₂ は下付きに変換、ρt の t はそのまま）。PyMuPDF が必要（pip install pymupdf）。
# 出力はリポジトリの外に置く（本文をコミットしない）。usage: python3 extract.py in.pdf out.txt [--plain]
# --plain: 正答肢PDF用。ページのテキストをそのまま書き出す（parseAnswerKey が読む形）。
import sys, re, pymupdf

SUP = str.maketrans('0123456789+-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻')
SUB = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
KANA = re.compile(r'[぀-ヿ　-〿]')

doc = pymupdf.open(sys.argv[1])
if len(sys.argv) > 3 and sys.argv[3] == '--plain':
    open(sys.argv[2], 'w').write('\n'.join(p.get_text() for p in doc)); sys.exit(0)

out = []
for i, p in enumerate(doc):
    out.append(f'=== page {i+1}')
    main, small = [], []
    for b in p.get_text('rawdict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                for c in s['chars']:
                    item = (c['origin'][1], c['origin'][0], c['c'], s['size'])
                    if s['size'] >= 7: main.append(item)
                    elif not KANA.match(c['c']) and c['c'].strip(): small.append(item)
    # 行（ベースライン）をまとめる
    main.sort()
    rows = []
    for y, x, ch, sz in main:
        if rows and abs(y - rows[-1]['y']) <= 3: rows[-1]['chars'].append((x, ch))
        else: rows.append({'y': y, 'chars': [(x, ch)]})
    # 小さい英数字を最寄りの行へ（行のベースラインより上なら上付き）
    for y, x, ch, sz in small:
        if not rows: break
        r = min(rows, key=lambda r: abs(r['y'] - y))
        if abs(r['y'] - y) > 8: continue
        if y < r['y'] - 2 and ch in '0123456789+-': ch = ch.translate(SUP)
        elif y > r['y'] + 0.5 and ch in '0123456789': ch = ch.translate(SUB)
        r['chars'].append((x, ch))
    for r in rows:
        r['chars'].sort()
        line, px = '', None
        for x, ch in r['chars']:
            if px is not None and x - px > 25: line += ' '
            line += ch; px = x
        if line.strip(): out.append(line)
open(sys.argv[2], 'w').write('\n'.join(out))
