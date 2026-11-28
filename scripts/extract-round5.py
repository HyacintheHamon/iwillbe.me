"""Extract Kelly's mission library v2 without modifying the source workbook."""

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


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/extract-round5.py workbook.xlsx')
    source = pathlib.Path(sys.argv[1])
    sheets = read_sheets(source)
    previous = json.loads((ROOT / 'data/round4/missions.json').read_text())
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
                'provenance', 'Kelly · Mission library v2 · 26 November 2026'),
            ages=split(row.get('Ages')), family_id=family_id(row['ID']),
        )
        mission['theme'] = health_theme(mission)
        missions.append(mission)

    ids = {mission['id'] for mission in missions}
    assert len(missions) == len(ids) == 1284, 'Expected 1,284 unique missions'
    assert set(previous_by_id) <= ids, 'Historical IDs must remain available'
    additions = [m for m in missions if m['id'] not in previous_by_id]
    changes = [m for m in missions if m['id'] in previous_by_id and m != previous_by_id[m['id']]]
    assert len(additions) == 27 and len(changes) == 24
    assert Counter(m['ladder'] for m in additions) == Counter({
        'Joy': 15, 'Learning: joyful': 3, 'With my kids': 9,
    })
    expected_additions = (
        {f'BE-JOY-{step}{size}' for step in range(1, 6) for size in 'abc'}
        | {f'LR-P39-1{size}' for size in 'abc'}
        | {f'KA-{step:02d}{size}' for step in range(1, 4) for size in 'abc'}
    )
    assert {m['id'] for m in additions} == expected_additions
    for mission in changes:
        before = previous_by_id[mission['id']]
        assert mission == {**before, 'priorities': [*before['priorities'], 'joyful']}, \
            f'Unexpected change to historical mission {mission["id"]}'
    assert sum(m['type'] == 'learn' for m in missions) == 183
    assert all(m['priorities'] and m['first_step'] and m['mission_text'] for m in missions)
    assert all(len(m['priorities']) <= 4 and len(m['interests']) <= 2 for m in missions)
    assert len({p for m in missions for p in m['priorities']}) == 39
    assert all(set(m['ages']) <= {'under 6', '6–12', 'teens', 'adults'} for m in missions)
    assert sum(m['ages'] == ['adults'] for m in missions) == 9
    stage_for_step = {1: 'Want to try', 2: 'From time to time', 3: 'Into it', 4: 'Into it', 5: 'All in'}
    assert all(stage_for_step.get(m['ladder_step']) == m['stage'] and m['minutes'] > 0 for m in missions)

    links = [dict(interest=row['Interest'], similar_interest=row['Similar interest'], reason=row['Reason (shown to the user)'])
             for row in sheets['Interest links'] if row.get('Interest') and row.get('Similar interest')]
    previous_links = json.loads((ROOT / 'data/round4/interest-links.json').read_text())
    assert links == previous_links, 'Interest links must retain their existing wording'

    previous_books = json.loads((ROOT / 'data/round4/learning-shelf.json').read_text())
    book_ids = {(book['title'], book['author']): book['id'] for book in previous_books}
    next_id = max(int(book['id'].split('-')[1]) for book in previous_books) + 1
    books = []
    for row in sheets['Learning shelf']:
        # The sheet also includes an instruction row, which is not a book.
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
    assert len(links) == 44 and len(books) == 59
    assert len({(book['title'], book['author']) for book in books}) == len(books)
    assert all(book in books for book in previous_books), 'Historical shelf entries must remain unchanged'

    target = ROOT / 'data/round5'
    target.mkdir(parents=True, exist_ok=True)
    metadata = dict(filename=source.name, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                    missions=len(missions), previous_missions=len(previous), added_missions=len(additions),
                    changed_missions=len(changes), removed_missions=0,
                    changed_mission_ids=[m['id'] for m in changes],
                    learning_missions=183, someday_starters=15,
                    age_tagged_missions=sum(bool(m['ages']) for m in missions),
                    adult_kid_missions=9, priority_count=39, joyful_missions=43,
                    interest_links=len(links), books=len(books), added_books=2,
                    new_ladders=[dict(code='BE-JOY', name='Joy', missions=15),
                                 dict(code='LR-P39', name='Learning: joyful', missions=3)],
                    extended_ladders=[dict(code='KA', name='With my kids', added_missions=9)])
    for name, data in [('missions', missions), ('interest-links', links), ('learning-shelf', books), ('source', metadata)]:
        (target / f'{name}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Validated {len(missions)} missions (+27, 24 joyful tags), {len(links)} links and {len(books)} books (+2).')
    print('All historical IDs and mission wording retained; no database changed.')


if __name__ == '__main__':
    main()
