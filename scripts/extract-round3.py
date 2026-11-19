"""Read Kelly's Round 3 workbook without changing it (Python standard library)."""

import hashlib
import json
import pathlib
import re
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = pathlib.Path(__file__).resolve().parents[1]
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def read_sheets(source):
    with ZipFile(source) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(node.itertext()) for node in ET.fromstring(
                archive.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        relations = {node.attrib['Id']: node.attrib['Target'] for node in ET.fromstring(
            archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = {}
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
            target = relations[sheet.attrib[REL]]
            path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in ET.fromstring(archive.read(path)).findall('m:sheetData/m:row', NS):
                cells = {}
                for cell in row.findall('m:c', NS):
                    value = cell.find('m:v', NS)
                    value = value.text if value is not None else None
                    kind = cell.attrib.get('t')
                    if kind == 's' and value is not None:
                        value = strings[int(value)]
                    elif kind == 'inlineStr':
                        value = ''.join(cell.find('m:is', NS).itertext())
                    elif value is not None and kind not in ('str', 'e'):
                        value = float(value) if '.' in value else int(value)
                    cells[re.sub(r'\d', '', cell.attrib['r'])] = value
                rows.append(cells)
            headers = rows[0]
            sheets[sheet.attrib['name']] = [
                {label: row.get(col) for col, label in headers.items()} for row in rows[1:]
            ]
        return sheets


def split(value):
    return [word.strip() for word in str(value or '').split(';') if word.strip()]


def family_id(identifier):
    match = re.fullmatch(r'(.*?)([abc])(\d*)', identifier)
    if not match:
        return identifier
    prefix, _, extra = match.groups()
    return prefix + (f'#{extra}' if extra else '')


def health_theme(mission):
    if 'healthy' not in mission['priorities']:
        return ''
    tags = mission['tags']
    if mission['id'].startswith('HL-'):
        return tags[1]
    if mission['id'].startswith(('GR-FIT-', 'PA-SPO-', 'IN-YOG-')):
        return 'moving'
    text = ' '.join([mission['mission_text'], *tags]).lower()
    if 'sleep' in text or 'bedtime' in text:
        return 'sleep'
    if 'water' in text:
        return 'water'
    if any(word in text for word in ['cook', 'lunch', 'meal']):
        return 'eating well'
    if any(word in text for word in ['checkup', 'check-up', 'doctor', 'dentist']):
        return 'check-ups'
    if any(word in text for word in ['walk', 'workout', 'moving', 'yoga', 'stretch', 'hiking']):
        return 'moving'
    if any(word in text for word in ['meditation', 'body scan', 'leave work on time']):
        return 'rest and stress'
    return ''


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/extract-round3.py workbook.xlsx')
    source = pathlib.Path(sys.argv[1])
    sheets = read_sheets(source)
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
            provenance='Kelly · Round 3 · 18 November 2026',
            ages=split(row.get('Ages')), family_id=family_id(row['ID']),
        )
        mission['theme'] = health_theme(mission)
        missions.append(mission)
    links = [dict(interest=row['Interest'], similar_interest=row['Similar interest'], reason=row['Reason (shown to the user)'])
             for row in sheets['Interest links'] if row.get('Interest') and row.get('Similar interest')]
    books = [dict(id=f'book-{i + 1:02d}', title=row['Title'], author=row['Author'], priorities=split(row['Priorities']),
                  interests=split(row['Interests']), why_it_fits=row['Why it fits (Chloe can use this)'])
             for i, row in enumerate(sheets['Learning shelf']) if row.get('Title') and row.get('Author')]
    old = json.loads((ROOT / 'data/round2/missions.json').read_text())
    ids = {mission['id'] for mission in missions}
    assert len(missions) == len(ids) == 1152
    assert {mission['id'] for mission in old} <= ids, 'Historical IDs must remain available'
    assert sum(m['type'] == 'learn' for m in missions) == 180
    assert sum(m['id'].startswith('KK-') for m in missions) == 36
    assert sum(m['id'].startswith('HL-') for m in missions) == 27
    assert len(links) == 44 and len(books) == 56
    assert all(m['priorities'] and m['first_step'] and m['mission_text'] for m in missions)
    assert all(set(m['ages']) <= {'under 6', '6–12', 'teens'} for m in missions)
    target = ROOT / 'data/round3'
    target.mkdir(parents=True, exist_ok=True)
    metadata = dict(filename=source.name, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                    missions=len(missions), added_missions=len(ids - {m['id'] for m in old}),
                    learning_missions=180, someday_starters=15, healthy_added=27, kids_added=36,
                    age_tagged_missions=sum(bool(m['ages']) for m in missions), interest_links=len(links), books=len(books))
    for name, data in [('missions', missions), ('interest-links', links), ('learning-shelf', books), ('source', metadata)]:
        (target / f'{name}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Validated {len(missions)} missions, {len(links)} interest links and {len(books)} books; all historical IDs retained.')


if __name__ == '__main__':
    main()
