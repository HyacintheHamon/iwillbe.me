"""Extract the supplied workbook without altering it. Run with the bundled Python."""
import hashlib
import json
import pathlib
import sys
import openpyxl

root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path(sys.argv[1])
book = openpyxl.load_workbook(source, read_only=True, data_only=True)
split = lambda value: [x.strip() for x in str(value or '').split(';') if x.strip()]
rows = list(book['Missions'].values)
missions = []
for row in rows[1:]:
    if not row[0]:
        continue
    m = dict(zip(rows[0], row))
    missions.append(dict(id=m['ID'], mission_text=m['Mission'], first_step=m['First step'],
        ladder=m['Ladder'], tags=split(m['Tags']), who_for=split(m["Who it's for"]),
        places=split(m['Place']), ladder_step=m['Ladder step'], stage=m['Stage'],
        size=m['Size'], level={'5-minute':'easy','Normal':'normal','Stretch':'stretch'}[m['Size']],
        minutes=m['Minutes'], cost=m['Cost'], setting=m['Setting'] or '',
        safety_note=m['Safety note'] or '', interests=split(m['Interest']),
        quick_picks=split(m['Interest']), priorities=split(m['Priorities']),
        type=m['Type'].lower(), active=True, provenance='Kelly · Round 2 · 14 November 2026'))
links = [dict(interest=r[0], similar_interest=r[1], reason=r[2])
         for r in list(book['Interest links'].values)[1:] if r[0] and r[1]]
shelf = [dict(id=f'book-{i+1:02d}', title=r[0], author=r[1], priorities=split(r[2]),
              interests=split(r[3]), why_it_fits=r[4])
         for i,r in enumerate(list(book['Learning shelf'].values)[1:]) if r[0] and r[1]]
assert len(missions) == 1089
assert len(set(m['id'] for m in missions)) == 1089
assert sum(m['type']=='learn' for m in missions) == 180
assert sum(m['id'].startswith('SD-') for m in missions) == 15
assert len(shelf) == 56
assert all(m['priorities'] and m['mission_text'] and m['first_step'] for m in missions)
target = root / 'data' / 'round2'
target.mkdir(parents=True, exist_ok=True)
for name, data in [('missions',missions),('interest-links',links),('learning-shelf',shelf)]:
    (target/f'{name}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(target/'source.json').write_text(json.dumps(dict(filename=source.name,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    missions=len(missions),learning_missions=180,someday_starters=15,interest_links=len(links),books=len(shelf)),indent=2)+'\n')
print(f'Validated {len(missions)} missions, {len(links)} interest links, {len(shelf)} books')
