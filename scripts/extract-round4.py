"""Extract Kelly's Round 4 workbook without modifying it (standard library only)."""

import hashlib
import json
import pathlib
import runpy
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
helpers = runpy.run_path(str(ROOT / 'scripts/extract-round3.py'))
read_sheets = helpers['read_sheets']
split = helpers['split']
family_id = helpers['family_id']
health_theme = helpers['health_theme']
NEW_LADDERS = {
    'GR-UNS': 'Getting unstuck',
    'GR-FLX': 'Rolling with change',
    'GR-TOG': 'Solving it together',
    'GR-MNY': 'Money and what matters',
    'PE-NEW': 'New friends',
    'GR-STA': 'Starting now',
    'GR-HUM': 'Staying human',
}


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/extract-round4.py workbook.xlsx')
    source = pathlib.Path(sys.argv[1])
    sheets = read_sheets(source)
    previous = json.loads((ROOT / 'data/round3/missions.json').read_text())
    previous_by_id = {mission['id']: mission for mission in previous}
    missions = []
    for row in sheets['Missions']:
        if not row.get('ID'):
            continue
        mission = dict(
            id=row['ID'], mission_text=row['Mission'], first_step=row['First step'],
            ladder=row['Ladder'], tags=split(row['Tags']), who_for=split(row["Who it's for"]),
            places=split(row['Place']), ladder_step=row['Ladder step'], stage=row['Stage'],
            size=row['Size'], level={'5-minute': 'easy', 'Normal': 'normal', 'Stretch': 'stretch'}[row['Size']],
            minutes=row['Minutes'], cost=row['Cost'], setting=row['Setting'] or '',
            safety_note=row['Safety note'] or '', interests=split(row['Interest']),
            quick_picks=split(row['Interest']), priorities=split(row['Priorities']),
            type=row['Type'].lower(), active=True,
            provenance=previous_by_id.get(row['ID'], {}).get(
                'provenance', 'Kelly · Round 4 · 25 November 2026'),
            ages=split(row.get('Ages')), family_id=family_id(row['ID']),
        )
        mission['theme'] = health_theme(mission)
        missions.append(mission)
    ids = {mission['id'] for mission in missions}
    assert len(missions) == len(ids) == 1257, 'Expected 1,257 unique missions'
    assert set(previous_by_id) <= ids, 'Historical IDs must remain available'
    assert all(m == previous_by_id[m['id']] for m in missions if m['id'] in previous_by_id), \
        'Round 4 adds missions; historical content must remain unchanged'
    additions = [m for m in missions if m['id'] not in previous_by_id]
    assert len(additions) == 105
    assert Counter(m['ladder'] for m in additions) == Counter({name: 15 for name in NEW_LADDERS.values()})
    for code, ladder in NEW_LADDERS.items():
        assert {m['id'] for m in additions if m['ladder'] == ladder} == {
            f'{code}-{step}{size}' for step in range(1, 6) for size in 'abc'
        }, f'Incomplete mission ladder: {ladder}'
    assert sum(m['type'] == 'learn' for m in missions) == 180
    assert all(m['priorities'] and m['first_step'] and m['mission_text'] for m in missions)
    assert all(set(m['ages']) <= {'under 6', '6–12', 'teens'} for m in missions)
    assert all(1 <= m['ladder_step'] <= 5 and m['minutes'] > 0 for m in missions)

    links = [dict(interest=row['Interest'], similar_interest=row['Similar interest'], reason=row['Reason (shown to the user)'])
             for row in sheets['Interest links'] if row.get('Interest') and row.get('Similar interest')]
    previous_books = json.loads((ROOT / 'data/round3/learning-shelf.json').read_text())
    book_ids = {(book['title'], book['author']): book['id'] for book in previous_books}
    next_id = max(int(book['id'].split('-')[1]) for book in previous_books) + 1
    books = []
    for row in sheets['Learning shelf']:
        if not row.get('Title') or not row.get('Author'):
            continue
        key = row['Title'], row['Author']
        identifier = book_ids.get(key)
        if identifier is None:
            identifier = f'book-{next_id:02d}'
            next_id += 1
        books.append(dict(id=identifier, title=row['Title'], author=row['Author'],
                          priorities=split(row['Priorities']), interests=split(row['Interests']),
                          why_it_fits=row['Why it fits (Chloe can use this)']))
    assert len(links) == 44 and len(books) == 57
    assert len({(book['title'], book['author']) for book in books}) == len(books)
    assert all(book in books for book in previous_books), 'Historical shelf entries must remain unchanged'

    target = ROOT / 'data/round4'
    target.mkdir(parents=True, exist_ok=True)
    metadata = dict(filename=source.name, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                    missions=len(missions), previous_missions=len(previous), added_missions=len(additions),
                    changed_missions=0, removed_missions=0, learning_missions=180, someday_starters=15,
                    age_tagged_missions=sum(bool(m['ages']) for m in missions), interest_links=len(links),
                    books=len(books), added_books=1,
                    new_ladders=[dict(code=code, name=name, missions=15) for code, name in NEW_LADDERS.items()])
    for name, data in [('missions', missions), ('interest-links', links), ('learning-shelf', books), ('source', metadata)]:
        (target / f'{name}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Validated {len(missions)} missions (+105), {len(links)} links and {len(books)} books (+1).')
    print('All historical mission and book IDs/content retained; no database changed.')


if __name__ == '__main__':
    main()
