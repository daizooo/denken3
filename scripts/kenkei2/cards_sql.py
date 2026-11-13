# カード JSON（build_cards.py の出力）→ INSERT … ON CONFLICT DO UPDATE の SQL（docs/kenkei2-ingest.md）。
# 追加と更新（upsert）のみ。DELETE・DROP・TRUNCATE は出さない。再実行しても同じ結果になる。
# usage: python3 cards_sql.py cards39.json <user_id(uuid)> > insert39.sql   （出力はリポジトリの外に置く）
import json, re, sys

def main(path, user_id):
    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', user_id):
        raise SystemExit('user_id が UUID でない')
    cards = json.load(open(path))
    rows = []
    for c in cards:
        m = re.fullmatch(r'K2_(\d+)_(\d)_(\d)', c['id'])
        assert m, c['id']
        stem = c['stem']
        blob = json.dumps(c['frame'], ensure_ascii=False, separators=(',', ':')) + json.dumps(c['key'], ensure_ascii=False, separators=(',', ':')) + stem
        assert '$kk2$' not in blob
        rows.append("('%s','%s',%s,%s,%s,'%s',%s,$kk2$%s$kk2$,$kk2$%s$kk2$::jsonb,$kk2$%s$kk2$::jsonb)" % (
            user_id, c['id'], m.group(1), c['part'], c['sub'], c['form_kind'], c['points'], stem,
            json.dumps(c['frame'], ensure_ascii=False, separators=(',', ':')),
            json.dumps(c['key'], ensure_ascii=False, separators=(',', ':'))))
    print('INSERT INTO denken3.kk2_questions (user_id,id,exam_no,part,sub,form_kind,points,stem,frame,key) VALUES')
    print(',\n'.join(rows))
    print('ON CONFLICT (user_id,id) DO UPDATE SET exam_no=EXCLUDED.exam_no,part=EXCLUDED.part,sub=EXCLUDED.sub,form_kind=EXCLUDED.form_kind,points=EXCLUDED.points,stem=EXCLUDED.stem,frame=EXCLUDED.frame,key=EXCLUDED.key;')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
