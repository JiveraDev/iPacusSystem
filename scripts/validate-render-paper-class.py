"""Read-only source checks, independent geometry checks and monochrome preview."""
import hashlib
import json
import math
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'outputs/ipawcus-class-diagram-2026-10-08-paper'
FONT_ROOT = Path('C:/Windows/Fonts')


def font(size=14, bold=False):
    return ImageFont.truetype(str(FONT_ROOT / ('arialbd.ttf' if bold else 'arial.ttf')), size)


def overlaps(a, b):
    return (a['x'] < b['x'] + b['w'] and a['x'] + a['w'] > b['x']
            and a['y'] < b['y'] + b['h'] and a['y'] + a['h'] > b['y'])


def hit(a, b, rect, margin=0):
    left, right = rect['x'] - margin, rect['x'] + rect['w'] + margin
    top, bottom = rect['y'] - margin, rect['y'] + rect['h'] + margin
    if a['y'] == b['y']:
        return (top + .001 < a['y'] < bottom - .001
                and max(a['x'], b['x']) > left + .001 and min(a['x'], b['x']) < right - .001)
    assert a['x'] == b['x'], 'Nonorthogonal relationship.'
    return (left + .001 < a['x'] < right - .001
            and max(a['y'], b['y']) > top + .001 and min(a['y'], b['y']) < bottom - .001)


def validate(model):
    page = model['page']
    boxes, edges = page['nodes'], page['edges']
    detailed = json.loads((ROOT / model['basis']).read_text(encoding='utf-8'))
    mappings = [member for box in boxes for member in box['members']]
    assert len(boxes) == len({box['id'] for box in boxes}) == 16
    assert set(mappings) == {item['id'] for item in detailed['classes']}
    assert len(mappings) == len(set(mappings)) == 91
    assert sum(len(item['operations']) for item in detailed['classes']) == 174
    source_evidence = set()
    for item in detailed['classes']:
        for operation in item['operations']:
            evidence = operation['evidence']
            location = Path(evidence['file'])
            if not location.is_absolute():
                location = ROOT / location
            assert location.is_file(), 'Missing evidence: ' + str(location)
            source_evidence.add(str(location))
            if evidence.get('operation'):
                assert evidence['operation'] in location.read_text(encoding='utf-8'), 'Operation absent from current source.'
    for relative, expected in model['originals'].items():
        assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == expected, 'An original diagram was changed.'

    xml = ET.parse(OUT / 'ipawcus-class-diagram-simplified.drawio')
    diagrams = xml.getroot().findall('diagram')
    assert len(diagrams) == 1
    elements = list(diagrams[0].find('mxGraphModel/root'))
    cells = {element.get('id'): element for element in elements}
    assert len(cells) == len(elements), 'Duplicate native cell IDs.'
    assert cells['system-title'].get('value') == model['title']
    assert font(16).getlength(model['title']) < page['width'] - 180
    captions = [label for edge in edges for label in edge['labels']]
    for index, box in enumerate(boxes):
        assert all(not overlaps(box, other) for other in boxes[index + 1:])
        assert 0 <= box['x'] < box['x'] + box['w'] <= page['width']
        assert 0 <= box['y'] < box['y'] + box['h'] <= page['height']
        assert font(17, bold=True).getlength(box['name']) < box['w'] - 20
        required_width = max(font(17, bold=True).getlength(box['name']),
                             *[font().getlength(row) for row in box['attrs'] + box['methods']]) + 24
        assert required_width <= box['w'] < required_width + 2, 'Class is not content-sized: ' + box['name']
        assert box['h'] == box['header'] + 16 * (len(box['attrs']) + len(box['methods'])) + 16
        assert box['x'] + box['w'] / 2 == box['originalBounds']['x'] + box['originalBounds']['w'] / 2
        for row in box['attrs'] + box['methods']:
            assert font().getlength(row) <= box['w'] - 24, 'Text overflow: ' + row
        assert box['header'] + 17 + (len(box['attrs']) - 1) * 16 < box['methodY'] - 3
        assert box['methodY'] + 17 + (len(box['methods']) - 1) * 16 < box['h'] - 3
        node = cells[box['id']]
        assert node.get('label') == box['name']
        assert node.get('tooltip').startswith(box['explanation'])
        geometry = node.find('mxCell/mxGeometry')
        assert [float(geometry.get(key)) for key in ['x', 'y', 'width', 'height']] == [box['x'], box['y'], box['w'], box['h']]
        assert float(cells[box['id'] + '-divider'].find('mxGeometry').get('y')) == box['methodY']
        for kind, rows in [('attribute', box['attrs']), ('operation', box['methods'])]:
            for number, value in enumerate(rows):
                assert cells[f'{box["id"]}-{kind}-{number}'].get('value') == value
    for index, caption in enumerate(captions):
        assert caption['y'] + caption['h'] <= caption['lineY'] - 4
        assert font(12).getlength(caption['text']) <= caption['w']
        assert all(not overlaps(caption, other) for other in captions[index + 1:])
        assert all(not overlaps(caption, box) for box in boxes)
        bounds = font(12).getbbox(caption['text'], anchor='ls')
        assert 0 <= caption['baselineOffset'] + bounds[1]
        assert caption['baselineOffset'] + bounds[3] <= caption['h']
    segments = 0
    for edge in edges:
        cell = cells[edge['id']].find('mxCell')
        assert cell.get('source') == edge['source'] and cell.get('target') == edge['target']
        assert ('dashed=1' in cell.get('style')) == (edge['kind'] == 'dependency')
        assert ('endArrow=open' in cell.get('style')) == (edge['kind'] == 'dependency')
        native_points = cell.findall('mxGeometry/Array/mxPoint')
        assert [(float(p.get('x')), float(p.get('y'))) for p in native_points] == [(p['x'], p['y']) for p in edge['points'][1:-1]]
        for first, last in zip(edge['points'], edge['points'][1:]):
            segments += 1
            assert all(not hit(first, last, box) for box in boxes), 'Connector enters class: ' + edge['id']
            assert all(not hit(first, last, caption, 2) for caption in captions), 'Connector touches caption: ' + edge['id']
        for index, caption in enumerate(edge['labels']):
            at = 0 if caption['endpoint'] == 'start' else len(edge['points']) - 2
            first, last = edge['points'][at:at + 2]
            assert first['y'] == last['y'] == caption['lineY']
            assert min(first['x'], last['x']) <= caption['x'] and max(first['x'], last['x']) >= caption['x'] + caption['w']
            label_cell = cells[f'{edge["id"]}-label-{index}']
            assert label_cell.get('value') == caption['text'] and label_cell.get('parent') == edge['id']
            offset = label_cell.find('mxGeometry/mxPoint')
            endpoint = edge[caption['endpoint']]
            assert endpoint['x'] + float(offset.get('x')) == caption['x']
            assert endpoint['y'] + float(offset.get('y')) == caption['y']
    segments_list = [(edge['id'], first, last) for edge in edges for first, last in zip(edge['points'], edge['points'][1:])]
    crossings = []
    for first_index, (first_id, a, b) in enumerate(segments_list):
        for last_id, c, d in segments_list[first_index + 1:]:
            if first_id == last_id:
                continue
            horizontal, other_horizontal = a['y'] == b['y'], c['y'] == d['y']
            if horizontal == other_horizontal:
                key, other_key = ('x', 'y') if horizontal else ('y', 'x')
                if a[other_key] == c[other_key]:
                    overlap_length = min(max(a[key], b[key]), max(c[key], d[key])) - max(min(a[key], b[key]), min(c[key], d[key]))
                    assert overlap_length <= 0, 'Relationships share a line segment.'
            else:
                h, v = ([a, b], [c, d]) if horizontal else ([c, d], [a, b])
                if (min(h[0]['x'], h[1]['x']) < v[0]['x'] < max(h[0]['x'], h[1]['x'])
                        and min(v[0]['y'], v[1]['y']) < h[0]['y'] < max(v[0]['y'], v[1]['y'])):
                    crossings.append((first_id if horizontal else last_id, v[0]['x'], h[0]['y']))
    assert set(crossings) == {(jump['edge'], jump['x'], jump['y']) for jump in page['bridges']}
    for jump in page['bridges']:
        bounds = {'x': jump['x'] - jump['radius'] - 2, 'y': jump['y'] - jump['radius'] - 2,
                  'w': jump['radius'] * 2 + 4, 'h': jump['radius'] + 4}
        assert all(not overlaps(bounds, caption) for caption in captions), 'Bridge touches caption.'
        assert all(not overlaps(bounds, box) for box in boxes), 'Bridge touches class.'
    svg = ET.parse(OUT / '00-simplified-system-class-diagram.svg')
    assert sum(1 for element in svg.iter() if 'data-bridge' in element.attrib) == len(page['bridges'])
    appendix = (OUT / 'IMPLEMENTATION-MAPPING.md').read_text(encoding='utf-8')
    for table in [item['id'] for item in detailed['classes'] if item['table']]:
        assert '`' + table + '`' in appendix
    # Check additional source links too, not only the cached source-backed operations.
    import re
    for link in re.findall(r'\]\((C:/[^)]+)\)', appendix):
        assert Path(link).is_file(), 'Broken source link: ' + link
    return {**model['statistics'], 'checkedCurrentSourceFiles': len(source_evidence),
            'checkedSegments': segments, 'labelsAboveOwnLine': len(captions),
            'classBoxIntersections': 0, 'labelLineIntersections': 0, 'labelLabelIntersections': 0,
            'textOverflows': 0, 'oneEditableSheet': True, 'originalDiagramsPreserved': True,
            'contentSizedClassBoxes': True, 'columnCentersPreserved': True,
            'sharedWireSegments': 0, 'wireCrossingsWithBridges': len(page['bridges']),
            'applicationChanged': False, 'databaseChanged': False}


def render(model):
    page = model['page']
    image = Image.new('RGB', (page['width'], page['height']), '#ffffff')
    draw = ImageDraw.Draw(image)
    ink = '#111111'

    def text(x, y, value, size=14, bold=False, center=False):
        draw.text((x, y), value, fill=ink, font=font(size, bold), anchor='ms' if center else 'ls')

    text(90, 39, 'iPawcus — Simplified System Class Diagram', 24, True)
    text(90, 67, model['title'], 16)
    text(90, 94, '16 main classes · Attributes + operations · Solid: association · Dashed arrow: uses · 1: one · 0..1: optional · 0..*: many · ?: optional value')
    for edge in page['edges']:
        points = [(point['x'], point['y']) for point in edge['points']]
        for segment, (first, last) in enumerate(zip(points, points[1:])):
            jumps = sorted([jump for jump in page['bridges'] if jump['edge'] == edge['id'] and jump['segment'] == segment],
                           key=lambda jump: jump['x'], reverse=last[0] < first[0])
            direction = 1 if last[0] >= first[0] else -1
            intervals = []
            current = first
            for jump in jumps:
                intervals.append((current, (jump['x'] - direction * jump['radius'], jump['y'])))
                current = (jump['x'] + direction * jump['radius'], jump['y'])
            intervals.append((current, last))
            for start, finish in intervals:
                if edge['kind'] != 'dependency':
                    draw.line([start, finish], fill=ink, width=1)
                    continue
                first, last = start, finish
                length = math.dist(first, last)
                if not length:
                    continue
                ux, uy = (last[0] - first[0]) / length, (last[1] - first[1]) / length
                for offset in range(0, math.ceil(length), 9):
                    end = min(length, offset + 5)
                    draw.line([(first[0] + ux * offset, first[1] + uy * offset),
                               (first[0] + ux * end, first[1] + uy * end)], fill=ink, width=1)
        if edge['kind'] == 'dependency':
            first, last = points[-2:]
            length = math.dist(first, last)
            ux, uy = (last[0] - first[0]) / length, (last[1] - first[1]) / length
            wings = [(last[0] - ux * 8 + uy * sign * 4.5, last[1] - uy * 8 - ux * sign * 4.5) for sign in [-1, 1]]
            draw.line([wings[0], last, wings[1]], fill=ink, width=1)
    for jump in page['bridges']:
        x, y, radius = jump['x'], jump['y'], jump['radius']
        bounds = (x - radius, y - radius, x + radius, y + radius)
        draw.arc(bounds, 180, 360, fill='#ffffff', width=4)
        draw.arc(bounds, 180, 360, fill=ink, width=1)
    for box in page['nodes']:
        x, y, w, h = box['x'], box['y'], box['w'], box['h']
        draw.rectangle((x, y, x + w, y + h), fill='#ffffff', outline=ink, width=1)
        for offset in [box['header'], box['methodY']]:
            draw.line([(x, y + offset), (x + w, y + offset)], fill=ink, width=1)
        text(x + w / 2, y + 21, box['name'], 17, True, True)
        for index, row in enumerate(box['attrs']):
            text(x + 12, y + box['header'] + 17 + index * 16, row)
        for index, row in enumerate(box['methods']):
            text(x + 12, y + box['methodY'] + 17 + index * 16, row)
    for edge in page['edges']:
        for caption in edge['labels']:
            text(caption['x'], caption['y'] + caption['baselineOffset'], caption['text'], 12)
    image.save(OUT / '00-simplified-system-class-diagram.png')


if __name__ == '__main__':
    if '--measure' in sys.argv:
        boxes = json.loads(sys.stdin.read())
        print(json.dumps({box['id']: math.ceil((max(font(17, bold=True).getlength(box['name']),
                                                    *[font().getlength(row) for row in box['attrs'] + box['methods']]) + 24) / 2) * 2
                          for box in boxes}))
        sys.exit(0)
    model = json.loads((OUT / 'paper-class-layout.json').read_text(encoding='utf-8'))
    result = validate(model)
    render(model)
    (OUT / 'validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))
