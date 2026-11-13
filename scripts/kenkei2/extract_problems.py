# 問題PDF → 文字（docs/design/kenkei2.md §3・K3）。第1・2問は設問ごと、第3〜5問は大問ごとの行にする。
# 問題PDFは数字・記号の一部が ToUnicode を持たない字形で入っている（制御文字に化ける）。
# フォントの /Differences の字形名（c2690〜c2699 = 0〜9、uniXXXX = その文字）から戻す（1級土木の extract.py と同じ方法）。
# usage: python3 extract_problems.py in.pdf out.json   （出力はリポジトリの外に置く）
import json, re, sys
import pdfplumber, pypdf
from pdfwords import nfkc

def font_maps(path):
    """BaseFont → {文字コード: 字形名}（/Differences があるものだけ）。"""
    out = {}
    for page in pypdf.PdfReader(path).pages:
        fonts = (page.get('/Resources') or {}).get('/Font') or {}
        for f in fonts.values():
            f = f.get_object()
            enc = f.get('/Encoding')
            enc = enc.get_object() if enc is not None and hasattr(enc, 'get_object') else enc
            if not hasattr(enc, 'get') or not enc.get('/Differences'):
                continue
            m, code = {}, 0
            for x in enc['/Differences']:
                if isinstance(x, int):
                    code = x
                else:
                    m[code] = str(x).lstrip('/')
                    code += 1
            out[str(f.get('/BaseFont')).lstrip('/')] = m
    return out

def glyph_char(name):
    m = re.fullmatch(r'uni([0-9A-Fa-f]{4})(?:\..*)?', name)
    if m:
        return chr(int(m.group(1), 16))
    m = re.fullmatch(r'c(26[9][0-9])', name)    # c2690〜c2699 = 0〜9
    if m:
        return str(int(m.group(1), 16) - 0x2690)
    return None

def repaired_chars(pg, maps):
    out = []
    for c in pg.chars:
        t = c['text']
        m = re.fullmatch(r'\(cid:(\d+)\)', t)
        code = int(m.group(1)) if m else (ord(t) if len(t) == 1 and ord(t) < 0x20 else None)
        if code is not None:
            name = maps.get(c['fontname'].lstrip('/'), {}).get(code)
            t = glyph_char(name) if name else None
            if t is None:
                t = f"〔?{code}:{c['fontname'][-12:]}〕"   # 復元できない字形は印を残す（検証ゲートで見つける）
        out.append({**c, 'text': t})
    return out

def lines_of(chars, y_gap=3.0, col_gap=14.0):
    """文字 → 行。行内で col_gap 以上離れたところは \\t（表の列の区切り）。"""
    rows = []
    for c in sorted(chars, key=lambda c: (c['top'], c['x0'])):
        if rows and abs(c['top'] - rows[-1]['top']) <= y_gap + (c['size'] * 0.0):
            rows[-1]['chars'].append(c)
        else:
            rows.append({'top': c['top'], 'chars': [c]})
    out = []
    for r in rows:
        cs = sorted(r['chars'], key=lambda c: c['x0'])
        s, prev = '', None
        for c in cs:
            if prev is not None:
                gap = c['x0'] - prev['x1']
                if gap >= col_gap:
                    s += '\t'
                elif gap > 1.5 and re.match(r'[A-Za-z0-9]', c['text']) and re.search(r'[A-Za-z0-9]$', s):
                    s += ' '
            s += c['text']
            prev = c
        out.append({'top': round(r['top'], 1), 'x0': round(cs[0]['x0'], 1), 'text': s.strip()})
    return [l for l in out if l['text']]

def main(src, dst):
    maps = font_maps(src)
    pdf = pdfplumber.open(src)
    pages = []
    for pg in pdf.pages:
        pages.append(lines_of(repaired_chars(pg, maps)))
    json.dump({'source': src.split('/')[-1], 'pages': pages}, open(dst, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
