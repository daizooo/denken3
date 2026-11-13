# カード JSON の各列の md5 を、PostgreSQL の jsonb::text と同じ表記で計算する（投入後の照合用）。
# DB 側: select id, md5(stem), md5(frame::text), md5(key::text) from denken3.kk2_questions where exam_no = 39 order by id;
# usage: python3 hashes.py cards39.json   → id と3つの md5（先頭8桁）を出す
import hashlib, json, sys

def pg(v):
    """jsonb::text の表記（キーは「長さ→バイト列」の順、区切りは ': ' と ', '）。"""
    if isinstance(v, dict):
        items = sorted(v.items(), key=lambda kv: (len(kv[0].encode()), kv[0].encode()))
        return '{' + ', '.join(f'{json.dumps(k, ensure_ascii=False)}: {pg(x)}' for k, x in items) + '}'
    if isinstance(v, list):
        return '[' + ', '.join(pg(x) for x in v) + ']'
    return json.dumps(v, ensure_ascii=False)

def md5(s):
    return hashlib.md5(s.encode()).hexdigest()

if __name__ == '__main__':
    for c in sorted(json.load(open(sys.argv[1])), key=lambda c: c['id']):
        print(c['id'], md5(c['stem'])[:8], md5(pg(c['frame']))[:8], md5(pg(c['key']))[:8])
