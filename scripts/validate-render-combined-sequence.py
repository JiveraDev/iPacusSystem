"""Independent font measurement, sequence-contract checks, XML QA and PNG render."""
import argparse
import base64
import hashlib
import json
import math
import re
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'outputs/ipawcus-sequence-diagram-2026-10-08-combined'
FONT_PATH = Path('C:/Windows/Fonts/arialbd.ttf')
SCALE = 2
INK = '#111111'
parser = argparse.ArgumentParser()
parser.add_argument('--fonts', action='store_true')
parser.add_argument('--plain', action='store_true')
args = parser.parse_args()
if args.plain:
    OUT = ROOT / 'outputs/ipawcus-sequence-diagram-2026-10-08-plain'

if args.fonts:
    OUT.mkdir(parents=True, exist_ok=True)
    metrics = {}
    for size in (18, 20, 22, 26):
        font = ImageFont.truetype(str(FONT_PATH), size)
        metrics[str(size)] = {chr(code): font.getlength(chr(code)) for code in range(32, 127)}
        metrics[str(size)]['→'] = font.getlength('→')
    (OUT / 'font-metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
    print('Measured Arial Bold at 18, 20, 22 and 26 px.')
    raise SystemExit(0)

model = json.loads((OUT / 'sequence-layout.json').read_text(encoding='utf-8'))
errors = []
def check(condition, message):
    if not condition:
        errors.append(message)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

participants = model['participants']
by_participant = {p['id']: p for p in participants}
check(len(participants) == 6, 'Expected exactly six lifelines.')
check(sum(p['actor'] for p in participants) == 4, 'Expected exactly four role actors.')
check(len(by_participant) == 6, 'Duplicate participant ID.')
check({p['id'] for p in participants} == {'SA', 'AD', 'VT', 'PO', 'SYS', 'DB'}, 'Participant identity mismatch.')
messages = model['messages']
by_message = {m['id']: m for m in messages}
check(len(by_message) == len(messages), 'Duplicate message ID.')
check(all(messages[i]['y'] < messages[i + 1]['y'] for i in range(len(messages) - 1)), 'Message order is not strictly increasing.')

def flatten(items):
    result = []
    for event in items:
        if event['type'] == 'message':
            result.append(event['id'])
        for branch in event.get('branches', []):
            result.extend(flatten(branch['events']))
    return result
check(flatten(model['events']) == [m['id'] for m in messages], 'Rendered order differs from conceptual sequence.')
for m in messages:
    check(m['from'] in by_participant and m['to'] in by_participant, f"Invalid sender/receiver: {m['id']}")
    check(math.copysign(1, m['x2'] - m['x1']) == math.copysign(1, by_participant[m['to']]['x'] - by_participant[m['from']]['x']), f"Reversed arrow: {m['id']}")
    check(m['kind'] in ('call', 'reply', 'signal'), f"Unknown arrow convention: {m['id']}")
    label = m['label']
    check(label['y'] + label['h'] + 5 <= m['y'], f"Label is not above own arrow: {m['id']}")
    check(label['x'] >= min(m['x1'], m['x2']) + 10 and label['x'] + label['w'] <= max(m['x1'], m['x2']) - 10, f"Label crosses arrow endpoint: {m['id']}")
    for other in messages:
        if other['id'] != m['id']:
            check(not (label['y'] - 2 <= other['y'] <= label['y'] + label['h'] + 2), f"Label overlaps another message: {m['id']}/{other['id']}")

for item in model['textItems']:
    font = ImageFont.truetype(str(FONT_PATH), item['size'])
    check(item['size'] >= 18, f"Text smaller than requested minimum: {item['id']}")
    check(all(row == row.upper() for row in item['lines']), f"Non-uppercase visible text: {item['id']}")
    check(all(font.getlength(row) <= item['w'] - 1 for row in item['lines']), f"Text exceeds own box: {item['id']}")
    check(item['x'] >= 0 and item['y'] >= 0 and item['x'] + item['w'] <= model['width'] and item['y'] + item['h'] <= model['height'], f"Text outside page: {item['id']}")
    if item['role'] in ('guard', 'reference-label', 'section-heading', 'online-heading', 'note'):
        for m in messages:
            check(not (item['y'] - 2 <= m['y'] <= item['y'] + item['h'] + 2), f"Fragment text overlaps message: {item['id']}/{m['id']}")

logos = [p for p in model['primitives'] if p['type'] == 'image']
if args.plain:
    check({p['id'] for p in logos} == {'ipawcus-logo', 'mysql-logo'}, 'Expected both supplied header logos.')
    check(all(p['placement'] == 'above' for p in logos), 'Both logos must be above their header boxes.')
for asset in model.get('logoAssets', []):
    saved = OUT / asset['savedFile']
    check(saved.is_file() and digest(saved) == asset['sha256'], f"Saved logo pixels changed: {asset['id']}")
    original = Path(asset['originalFile'])
    if original.is_file():
        check(digest(original) == asset['sha256'], f"Original logo was altered: {asset['id']}")
for logo in logos:
    check(hashlib.sha256(base64.b64decode(logo['data64'])).hexdigest() == logo['assetSha256'], f"Embedded logo differs from source: {logo['id']}")
    check(abs(logo['w'] / logo['h'] - next(a['naturalWidth'] / a['naturalHeight'] for a in model['logoAssets'] if a['id'] == logo['id'])) < 0.01, f"Logo aspect ratio changed: {logo['id']}")
    for item in model['textItems']:
        overlap = logo['x'] < item['x'] + item['w'] and logo['x'] + logo['w'] > item['x'] and logo['y'] < item['y'] + item['h'] and logo['y'] + logo['h'] > item['y']
        check(not overlap, f"Logo overlaps text: {logo['id']}/{item['id']}")
    header = next(p for p in model['primitives'] if p['id'] == 'participant-box-' + logo['participant'])
    if logo['placement'] == 'inside':
        check(logo['x'] > header['x'] and logo['x'] + logo['w'] < header['x'] + header['w'] and logo['y'] > header['y'] and logo['y'] + logo['h'] < header['y'] + header['h'], 'System logo must be inside its header box.')
    else:
        check(logo['y'] + logo['h'] < header['y'], f"Logo must be above its header box: {logo['id']}")
        check(abs(logo['x'] + logo['w'] / 2 - header['x'] - header['w'] / 2) < 0.01, f"Logo must be centered above its header: {logo['id']}")

for e in model['evidence']:
    path = ROOT / e['file']
    check(path.is_file(), f"Evidence missing: {e['file']}")
    if path.is_file():
        check(e['needle'] in path.read_text(encoding='utf-8'), f"Evidence anchor missing: {e['file']}")
        check(digest(path) == e['sha256'], f"Evidence file changed after generation: {e['file']}")
for file, expected in model['originalHashes'].items():
    check(digest(ROOT / file) == expected, f'Pre-existing diagram changed: {file}')

frames = {f['id']: f for f in model['frames']}
if args.plain:
    check(model.get('plain'), 'Wrong diagram version selected.')
    check(len(model['refs']) == 0, 'Plain version must not contain reference blocks.')
    check(not any(p.get('role') in ('fragment', 'separator', 'reference', 'operator') for p in model['primitives']), 'Plain version still draws control/grouping boxes.')
    check(not any(item['role'] in ('section-heading', 'note', 'guard') for item in model['textItems']), 'A removed grouping heading or note is still visible.')
    check(len(model.get('onlineBoxes', [])) == 1, 'Exactly one online consultation box must remain.')
    check(sum(item['role'] == 'online-heading' for item in model['textItems']) == 1, 'Only the online section may have a grouping label.')
    online = model['onlineBoxes'][0]
    expected_online = {'o1', 'o2', 'meeting-open', 'o3', 'o4'}
    check(set(online['messageIds']) == expected_online, 'Online box contains incorrect exchanges.')
    for message in messages:
        inside = online['y'] <= message['y'] <= online['y'] + online['h']
        check(inside == (message['id'] in expected_online), f"Online box incorrectly includes/excludes: {message['id']}")
        if inside:
            check(min(message['x1'], message['x2']) > online['x'] and max(message['x1'], message['x2']) < online['x'] + online['w'], f"Online arrow escapes box: {message['id']}")
    for item in model['textItems']:
        check(not any(re.search(r'\b(?:OPT|ALT|LOOP|REF|R\d+)\b', row) for row in item['lines']), f"Coded notation remains visible: {item['id']}")
    check(by_message['login-submit']['order'] < by_message['login-check']['order'] < by_message['login-return']['order'] < by_message['login-session']['order'], 'Login request, validation and session result order changed.')
    check(by_message['login-submit']['from'] == 'PO' and by_message['login-return']['from'] == 'DB' and by_message['login-session']['to'] == 'PO', 'Login sender/return direction changed.')
    check(by_message['b5']['order'] < by_message['booking-saved']['order'] < by_message['b6']['order'], 'Initial pending result is confused with later Admin review.')
    check(by_message['patient-open']['order'] < by_message['patient-read']['order'] < by_message['patient-return']['order'] < by_message['c7']['order'], 'Diagnosis must follow patient/examination review.')
    check(by_message['record-request']['order'] < by_message['record-read']['order'] < by_message['record-result']['order'], 'Owner medical record request/read/return order changed.')
check(frames['care']['operator'] == 'alt' and len(frames['care']['branches']) == 3, 'Three service alternatives must be explicit.')
check(frames['print']['operator'] == 'opt', 'Printing must be conditional.')
check('printable' in frames['print']['branches'][0]['guard'].lower(), 'Missing nonempty print guard.')
check('prescription' not in frames['print']['scope'], 'Printing must not depend on creating a changed plan.')
check(by_message['r1']['order'] < by_message['r2']['order'] < by_message['r3']['order'] < by_message['r4']['order'], 'Prescription persistence, notification, printing and owner start order changed.')
check('existing' in frames['prescription-start']['branches'][0]['guard'], 'Existing prescription items must also be startable.')
for ref in model['refs']:
    for part in ref['scope'].strip('/').split('/'):
        if part:
            frame = frames[part.split(':')[0]]
            check(ref['x'] >= frame['x'] and ref['x'] + ref['w'] <= frame['x'] + frame['w'] and ref['y'] >= frame['y'] and ref['y'] + ref['h'] <= frame['y'] + frame['h'], f"Reference escapes its containing fragment: {ref['id']}")
check(frames['doses']['operator'] == 'loop' and 'item' in frames['doses']['branches'][0]['guard'], 'Medication loop must remain per item.')
check(by_message['c4']['from'] == 'PO' and by_message['c4']['to'] == 'AD', 'Exam consent must be administered by Admin.')
check(by_message['c4']['order'] < by_message['c5']['order'] < by_message['c7']['order'], 'Consent, examination completion and diagnosis order changed.')
check(by_message['r4']['from'] == 'PO' and 'per item' in by_message['r4']['text'], 'Owner per-item prescription start missing.')
check(by_message['a3']['to'] == 'SA', 'Report result must return to Super Admin.')
check(all(a['h'] < 210 for a in model['activations']), 'An activation incorrectly spans unrelated sessions.')

xml = ET.parse(OUT / 'ipawcus-combined-sequence.drawio').getroot()
pages = xml.findall('diagram')
check(len(pages) == 1, 'Expected one combined sequence sheet, not four activity sheets.')
graph = xml.find('.//mxGraphModel')
check(int(graph.get('pageWidth')) == model['width'] and int(graph.get('pageHeight')) == model['height'], 'Editable page size mismatch.')
cells = {cell.get('id'): cell for cell in xml.findall('.//mxCell')}
check(sum(cell_id.startswith('lifeline-') for cell_id in cells) == 6, 'Editable diagram does not have six lifelines.')
for p in participants:
    check(f"participant-{p['id']}" in cells, f"Missing editable role header: {p['id']}")
for m in messages:
    cell = cells[m['id']]
    style = cell.get('style', '')
    check('endArrow=block' in style if m['kind'] == 'call' else 'endArrow=open' in style, f"Editable arrowhead mismatch: {m['id']}")
    check(('dashed=1' in style) == (m['kind'] == 'reply'), f"Editable reply dash mismatch: {m['id']}")
    points = {point.get('as'): point for point in cell.findall('./mxGeometry/mxPoint')}
    check(float(points['sourcePoint'].get('x')) == m['x1'] and float(points['targetPoint'].get('x')) == m['x2'], f"Editable arrow direction mismatch: {m['id']}")
    check(float(points['sourcePoint'].get('y')) == m['y'] and float(points['targetPoint'].get('y')) == m['y'], f"Editable arrow is not horizontal: {m['id']}")
    label = cells[f"label-{m['id']}"]
    check(label.get('parent') == m['id'], f"Label is not attached to its editable message: {m['id']}")
    check(label.get('value') == '\n'.join(m['label']['rows']), f"Editable label differs from preview: {m['id']}")
for item in model['textItems']:
    style = cells[item['id']].get('style', '')
    check('fontStyle=1;' in style and f"fontSize={item['size']};" in style, f"Editable typography mismatch: {item['id']}")
for logo in logos:
    check(f"image=data:image/png,{logo['data64']};" in cells[logo['id']].get('style', ''), f"Editable logo is not embedded: {logo['id']}")

report = {'passed': not errors, 'errors': errors, 'roles': 4, 'lifelines': 6, 'messages': len(messages), 'grouping_boxes_drawn': len(model.get('onlineBoxes', [])) if args.plain else len(frames), 'general_grouping_headings': 0 if args.plain else len(frames), 'reference_blocks': len(model['refs']), 'embedded_logos': len(logos), 'evidence_checks': len(model['evidence']), 'minimum_font_px': 18, 'bold': True, 'uppercase': True, 'width': model['width'], 'height': model['height'], 'original_diagrams_preserved': True, 'live_database_tested': False}
(OUT / 'validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
if errors:
    print(json.dumps(report, indent=2))
    raise SystemExit(1)

image = Image.new('RGB', (model['width'] * SCALE, model['height'] * SCALE), 'white')
draw = ImageDraw.Draw(image)
def point(x, y):
    return round(x * SCALE), round(y * SCALE)
def dashed_line(a, b, width):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    if not length:
        return
    for start in range(0, math.ceil(length), 11 * SCALE):
        end = min(length, start + 6 * SCALE)
        draw.line([(round(a[0] + dx * start / length), round(a[1] + dy * start / length)), (round(a[0] + dx * end / length), round(a[1] + dy * end / length))], fill=INK, width=width)

for p in model['primitives']:
    stroke = max(1, round(1.5 * SCALE))
    if p['type'] == 'rect':
        draw.rectangle([point(p['x'], p['y']), point(p['x'] + p['w'], p['y'] + p['h'])], fill=p.get('fill'), outline=INK, width=stroke)
    elif p['type'] == 'circle':
        draw.ellipse([point(p['x'] - p['r'], p['y'] - p['r']), point(p['x'] + p['r'], p['y'] + p['r'])], fill=p.get('fill'), outline=INK, width=stroke)
    elif p['type'] == 'polygon':
        points = [point(*xy) for xy in p['points']]
        draw.polygon(points, fill=p.get('fill'))
        draw.line(points + [points[0]], fill=INK, width=stroke)
    elif p['type'] in ('line', 'message'):
        message = p['type'] == 'message'
        a = point(p['x1'], p['y'] if message else p['y1'])
        b = point(p['x2'], p['y'] if message else p['y2'])
        if p.get('dash') or p.get('kind') == 'reply':
            dashed_line(a, b, SCALE if p.get('role') == 'lifeline' else stroke)
        else:
            draw.line([a, b], fill=INK, width=stroke)
        if message:
            direction = math.copysign(1, p['x2'] - p['x1'])
            arrow = [point(p['x2'] - direction * 11, p['y'] - 5), b, point(p['x2'] - direction * 11, p['y'] + 5)]
            if p['kind'] == 'call':
                draw.polygon(arrow, fill=INK)
            else:
                draw.line(arrow, fill=INK, width=stroke)
    elif p['type'] == 'text':
        if p.get('fill'):
            draw.rectangle([point(p['x'], p['y']), point(p['x'] + p['w'], p['y'] + p['h'])], fill=p['fill'])
        font = ImageFont.truetype(str(FONT_PATH), p['size'] * SCALE)
        for i, row in enumerate(p['lines']):
            x = p['x'] + p['w'] / 2 if p['align'] == 'center' else p['x']
            baseline = p['y'] + p['size'] + i * (p['size'] + 4)
            draw.text(point(x, baseline), row, fill=INK, font=font, anchor='ms' if p['align'] == 'center' else 'ls')
    elif p['type'] == 'image':
        with Image.open(OUT / p['file']) as source:
            logo = source.convert('RGBA')
        factor = min(p['w'] * SCALE / logo.width, p['h'] * SCALE / logo.height)
        logo = logo.resize((round(logo.width * factor), round(logo.height * factor)), Image.Resampling.LANCZOS)
        x = round(p['x'] * SCALE + (p['w'] * SCALE - logo.width) / 2)
        y = round(p['y'] * SCALE + (p['h'] * SCALE - logo.height) / 2)
        image.paste(logo, (x, y), logo)

image.save(OUT / 'ipawcus-combined-sequence.png', optimize=True)
# Readable QA crops, not additional diagrams or repeated lifelines in the figure.
preview = image.resize((model['width'], model['height']), Image.Resampling.LANCZOS)
preview.save(OUT / 'ipawcus-combined-sequence-preview.png', optimize=True)
preview.crop((0, 0, model['width'], min(model['height'], 960))).save(OUT / 'qa-top.png')
preview.crop((0, 0, model['width'], min(model['height'], model['lifelineStart'] + 14))).save(OUT / 'qa-headers.png')
clinical = frames['care']
preview.crop((320, max(0, clinical['y'] - 12), model['width'] - 20, min(model['height'], clinical['y'] + clinical['h'] + 12))).save(OUT / 'qa-clinical.png')
prescription = frames['prescription']
start = frames['prescription-start']
preview.crop((600, max(0, prescription['y'] - 12), model['width'] - 20, min(model['height'], start['y'] + start['h'] + 12))).save(OUT / 'qa-prescription.png')
print(json.dumps(report, indent=2))
print('Rendered monochrome 2x PNG, preview and three QA crops.')
