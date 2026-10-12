"""Measure class content, validate saved geometry, and render sharp PNG exports."""
import argparse
import json
import math
from functools import lru_cache
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PREVIOUS = ROOT.parent / 'ipawcus-class-diagram-2026-10-06'
SOURCE = ROOT.parent.parent
FONTS = Path('C:/Windows/Fonts')
SCALE = 3


@lru_cache(maxsize=32)
def font(size, bold=False, mono=False, scale=SCALE):
    name = 'consola.ttf' if mono else 'arialbd.ttf' if bold else 'arial.ttf'
    return ImageFont.truetype(str(FONTS / name), round(size * scale))


def measure():
    pages = json.loads((PREVIOUS / 'domain-layout.json').read_text(encoding='utf-8'))['pages']
    nodes = [node for page in pages for node in page['nodes']]
    metrics = {'names': {}, 'rows': {}}
    title_font, row_font = font(11, bold=True), font(10)
    for node in nodes:
        metrics['names'][node['name']] = title_font.getlength(node['name']) / SCALE
        for row in node['attrs'] + node['methods']:
            metrics['rows'][row] = row_font.getlength(row) / SCALE
    (ROOT / 'text-metrics.json').write_text(json.dumps(metrics, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'measured_class_names': len(metrics['names']), 'measured_rows': len(metrics['rows'])}))


def overlap(a, b):
    return (a['x'] < b['x'] + b['w'] and a['x'] + a['w'] > b['x']
            and a['y'] < b['y'] + b['h'] and a['y'] + a['h'] > b['y'])


def hit(a, b, rectangle, margin=0):
    left, right = rectangle['x'] - margin, rectangle['x'] + rectangle['w'] + margin
    top, bottom = rectangle['y'] - margin, rectangle['y'] + rectangle['h'] + margin
    if a['y'] == b['y']:
        return top + .001 < a['y'] < bottom - .001 and max(a['x'], b['x']) > left + .001 and min(a['x'], b['x']) < right - .001
    assert a['x'] == b['x'], 'Non-orthogonal connector'
    return left + .001 < a['x'] < right - .001 and max(a['y'], b['y']) > top + .001 and min(a['y'], b['y']) < bottom - .001


def validate(layout):
    previous = json.loads((PREVIOUS / 'domain-layout.json').read_text(encoding='utf-8'))
    previous_pages = {page['id']: page for page in previous['pages']}
    assert (ROOT / 'domain-model.json').read_bytes() == (PREVIOUS / 'domain-model.json').read_bytes(), 'Class content changed'
    counts = {'pages': len(layout['pages']), 'class_boxes': 0, 'relationships': 0,
              'content_fitted_boxes': 0, 'text_overflows': 0, 'box_intersections': 0, 'label_intersections': 0}
    for page in layout['pages']:
        original = previous_pages[page['id']]
        original_nodes = {node['id']: node for node in original['nodes']}
        assert {node['id'] for node in page['nodes']} == set(original_nodes)
        assert {edge['modelId'] for edge in page['edges']} == {edge['modelId'] for edge in original['edges']}
        boxes = page['nodes']
        captions = [label for edge in page['edges'] for label in edge['labels']]
        for index, node in enumerate(boxes):
            counts['class_boxes'] += 1
            if node['reference'] and node['id'] == 'users':
                assert node['attrs'] == original_nodes[node['id']]['attrs'] + ['+ role: string?']
            else:
                assert node['attrs'] == original_nodes[node['id']]['attrs']
            assert node['methods'] == original_nodes[node['id']]['methods']
            assert node['w'] == math.ceil(node['measuredTextWidth'] + 20), 'Width is not fitted to actual text'
            assert node['h'] == 24 + len(node['attrs']) * 13 + 10 + len(node['methods']) * 13 + 10, 'Height is not fitted to content'
            counts['content_fitted_boxes'] += 1
            assert not any(overlap(node, other) for other in boxes[index + 1:]), 'Overlapping class boxes'
            assert font(11, bold=True).getlength(node['name']) / SCALE < node['w'] - 18
            for row in node['attrs'] + node['methods']:
                assert font(10).getlength(row) / SCALE <= node['w'] - 19, f'Text overflows: {node["name"]} / {row}'
            assert node['x'] >= 0 and node['y'] >= 0 and node['x'] + node['w'] < page['width'] and node['y'] + node['h'] < page['height']
        for index, label in enumerate(captions):
            assert not any(overlap(label, other) for other in captions[index + 1:]), 'Overlapping relationship labels'
            assert not any(overlap(label, box) for box in boxes), 'Label overlaps a class'
            assert font(page['labelFont'], mono=True).getlength(label['text']) / SCALE <= label['w']
        for edge in page['edges']:
            counts['relationships'] += 1
            assert edge['source'] in original_nodes and edge['target'] in original_nodes
            assert all(0 <= point['x'] <= page['width'] and 80 <= point['y'] <= page['height'] - 40 for point in edge['points'])
            for a, b in zip(edge['points'], edge['points'][1:]):
                assert not any(hit(a, b, box) for box in boxes), 'Line enters a class box'
                assert not any(hit(a, b, label, page['labelClearance']) for label in captions), 'Line enters a relationship label'
        ET.parse(ROOT / f'{page["number"]:02d}-{page["id"]}.svg')
    document = ET.parse(ROOT / 'ipawcus-class-diagram.drawio').getroot()
    assert len(document.findall('diagram')) == len(layout['pages'])
    for diagram in document.findall('diagram'):
        graph = diagram.find('mxGraphModel/root')
        ids = [cell.get('id') for cell in graph]
        assert len(ids) == len(set(ids)), 'Duplicate editable IDs'
    model = json.loads((ROOT / 'domain-model.json').read_text(encoding='utf-8'))
    evidence = [operation['evidence'] for cls in model['classes'] for operation in cls['operations']]
    missing_operations = []
    contents = {}
    for entry in evidence:
        source_file = Path(entry['file']) if Path(entry['file']).is_absolute() else SOURCE / entry['file']
        assert source_file.is_file(), f'Missing source: {source_file}'
        contents.setdefault(str(source_file), source_file.read_text(encoding='utf-8'))
        if entry.get('operation') and entry['operation'] not in contents[str(source_file)]:
            missing_operations.append(entry)
    assert not missing_operations, f'Operation no longer exists: {missing_operations}'
    counts.update(core_classes=len(layout['pages'][0]['nodes']), complete_classes=len(layout['pages'][1]['nodes']),
                  source_backed_operations=len(evidence), original_content_preserved=True,
                  application_modified=False, database_modified=False)
    (ROOT / 'validation.json').write_text(json.dumps(counts, indent=2) + '\n', encoding='utf-8')
    return counts


def render(page, theme):
    canvas = Image.new('RGB', (math.ceil(page['width'] * SCALE), math.ceil(page['height'] * SCALE)), 'white')
    draw = ImageDraw.Draw(canvas)

    def text(x, baseline, value, size=10, bold=False, mono=False):
        draw.text((x * SCALE, baseline * SCALE), value, font=font(size, bold, mono), fill=theme['ink'], anchor='ls')

    def segment(a, b, dashed=False, pattern=(7, 3)):
        ax, ay, bx, by = a['x'] * SCALE, a['y'] * SCALE, b['x'] * SCALE, b['y'] * SCALE
        width = max(1, round(theme['lineWidth'] * SCALE))
        if not dashed:
            draw.line((ax, ay, bx, by), fill=theme['line'], width=width)
            return
        length = math.hypot(bx - ax, by - ay)
        if not length:
            return
        ux, uy = (bx - ax) / length, (by - ay) / length
        position = 0
        while position < length:
            end = min(position + pattern[0] * SCALE, length)
            draw.line((ax + ux * position, ay + uy * position, ax + ux * end, ay + uy * end), fill=theme['line'], width=width)
            position += sum(pattern) * SCALE

    text(72, 35, 'iPawcus - ' + page['title'], 19)
    text(72, 56, 'Conceptual UML model | class name, attributes, operations | + public | ? nullable', 10)
    text(72, 73, 'Solid: association | dashed: application association | dashed arrow: uses | 1 / 0..1 / 0..* multiplicities', 9.5)
    for edge in page['edges']:
        for a, b in zip(edge['points'], edge['points'][1:]):
            segment(a, b, edge['kind'] != 'association', (4, 3) if edge['kind'] == 'dependency' else (7, 3))
        if edge['kind'] == 'dependency':
            before, last = edge['points'][-2:]
            dx, dy = last['x'] - before['x'], last['y'] - before['y']
            length = math.hypot(dx, dy)
            ux, uy = dx / length, dy / length
            for sign in (-1, 1):
                arm = {'x': last['x'] - ux * 7 - uy * sign * 4, 'y': last['y'] - uy * 7 + ux * sign * 4}
                segment(arm, last)
    for node in page['nodes']:
        rectangle = (node['x'] * SCALE, node['y'] * SCALE, (node['x'] + node['w']) * SCALE, (node['y'] + node['h']) * SCALE)
        draw.rectangle(rectangle, fill='white', outline=theme['border'], width=round(theme['borderWidth'] * SCALE))
        for offset in (node['header'], node['methodY']):
            draw.line((node['x'] * SCALE, (node['y'] + offset) * SCALE,
                       (node['x'] + node['w']) * SCALE, (node['y'] + offset) * SCALE), fill=theme['border'], width=round(theme['borderWidth'] * SCALE))
        width = font(11, bold=True).getlength(node['name']) / SCALE
        text(node['x'] + (node['w'] - width) / 2, node['y'] + 16, node['name'], 11, bold=True)
        for index, row in enumerate(node['attrs']):
            text(node['x'] + 10, node['y'] + node['header'] + 14 + index * 13, row)
        for index, row in enumerate(node['methods']):
            text(node['x'] + 10, node['y'] + node['methodY'] + 14 + index * 13, row)
    for edge in page['edges']:
        for label in edge['labels']:
            text(label['x'], label['y'] + label['baselineOffset'], label['text'], page['labelFont'], mono=True)
    note = ('Core classes and selected attributes. Full class definitions and relationships are on the complete and detail sheets.'
            if page['number'] == 0 else 'Complete conceptual model, including legacy records. Operations map to existing functions and API workflows.'
            if page['number'] == 1 else 'Reference boxes repeat an existing class. Empty operation compartments indicate supporting state.')
    text(72, page['height'] - 22, note, 9)
    filename = f'{page["number"]:02d}-{page["id"]}.png'
    canvas.save(ROOT / filename, dpi=(300, 300))
    if page['number'] == 0:
        preview = canvas.copy()
        preview.thumbnail((2000, 2400), Image.Resampling.LANCZOS)
        preview.save(ROOT / 'preview.png')
        # Detailed crop for visual review at the original font scale.
        first = next(node for node in page['nodes'] if node['id'] == 'users')
        canvas.crop((int((first['x'] - 58) * SCALE), int((first['y'] - 48) * SCALE),
                     int((first['x'] + first['w'] + 58) * SCALE), int((first['y'] + first['h'] + 64) * SCALE))).save(ROOT / 'detail-preview.png')
    print(f'Rendered {filename}: {canvas.width} x {canvas.height}')


def contact_sheet(layout):
    sheet = Image.new('RGB', (1600, 1740), '#ededed')
    draw = ImageDraw.Draw(sheet)
    for index, page in enumerate(layout['pages']):
        x, y = index % 4 * 400, index // 4 * 580
        with Image.open(ROOT / f'{page["number"]:02d}-{page["id"]}.png') as original:
            thumbnail = original.copy()
            thumbnail.thumbnail((380, 540), Image.Resampling.LANCZOS)
            sheet.paste(thumbnail, (x + (400 - thumbnail.width) // 2, y + 30))
        draw.text((x + 10, y + 8), f'{page["number"]:02d} - {page["title"]}',
                  font=font(11, scale=1), fill='#222222')
    sheet.save(ROOT / 'all-sheets-preview.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--measure', action='store_true')
    parser.add_argument('--contact', action='store_true')
    args = parser.parse_args()
    if args.measure:
        measure()
    elif args.contact:
        contact_sheet(json.loads((ROOT / 'diagram-layout.json').read_text(encoding='utf-8')))
    else:
        saved = json.loads((ROOT / 'diagram-layout.json').read_text(encoding='utf-8'))
        reference = ROOT / 'SOURCE-REFERENCE.md'
        reference.write_text(reference.read_text(encoding='utf-8').replace(
            'ipawcus-system-class-diagram.drawio', 'ipawcus-class-diagram.drawio'), encoding='utf-8')
        result = validate(saved)
        print(json.dumps(result))
        for current_page in saved['pages']:
            render(current_page, saved['theme'])
        contact_sheet(saved)
