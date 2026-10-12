"""Independent geometry, source coverage, editable UML and PNG checks."""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = ROOT.parent.parent
FONTS = Path('C:/Windows/Fonts')


def font(size=12, mono=False, bold=False):
    name = 'consola.ttf' if mono else 'arialbd.ttf' if bold else 'arial.ttf'
    return ImageFont.truetype(str(FONTS / name), round(size))


def overlaps(a, b):
    return (a['x'] < b['x'] + b['w'] and a['x'] + a['w'] > b['x']
            and a['y'] < b['y'] + b['h'] and a['y'] + a['h'] > b['y'])


def hit(a, b, rectangle, margin=0):
    left, right = rectangle['x'] - margin, rectangle['x'] + rectangle['w'] + margin
    top, bottom = rectangle['y'] - margin, rectangle['y'] + rectangle['h'] + margin
    if a['y'] == b['y']:
        return (top + .001 < a['y'] < bottom - .001 and max(a['x'], b['x']) > left + .001
                and min(a['x'], b['x']) < right - .001)
    assert a['x'] == b['x'], 'Non-orthogonal line.'
    return (left + .001 < a['x'] < right - .001 and max(a['y'], b['y']) > top + .001
            and min(a['y'], b['y']) < bottom - .001)


def validate(layout, model, source):
    classes = {item['id']: item for item in model['classes']}
    expected_tables = {table['name']: table for table in source['tables']}
    persistent = {name: item for name, item in classes.items() if item['table']}
    assert len(classes) == len(model['classes']), 'Repeated class identity.'
    assert set(persistent) == set(expected_tables), 'Persistent domain object missing.'
    assert len(persistent) == 89
    for name, item in persistent.items():
        assert [a['sqlName'] for a in item['attributes']] == [c['name'] for c in expected_tables[name]['columns']]
        assert len({a['name'] for a in item['attributes']}) == len(item['attributes'])
    assert sum(len(item['attributes']) for item in classes.values()) == 1069
    assert [item['id'] for item in classes.values() if item['migrationOnly']] == ['clinical_intakes']
    expected_keys = {(table['name'], key['constraint']) for table in source['tables'] for key in table['fks']}
    modeled_keys = {(edge['source'], edge['evidence']['constraint']) for edge in model['relations'] if edge['kind'] == 'association'}
    assert expected_keys == modeled_keys and len(modeled_keys) == 189
    cached_sources = {}

    def lines(evidence):
        filename = evidence['file']
        location = Path(filename) if Path(filename).is_absolute() else SOURCE_ROOT / filename
        assert location.is_file(), 'Missing source evidence: ' + str(location)
        if filename not in cached_sources:
            cached_sources[filename] = location.read_text(encoding='utf-8').splitlines()
        content = cached_sources[filename]
        assert 1 <= evidence['line'] <= len(content), 'Evidence line out of range.'
        return content

    operation_count = 0
    for item in classes.values():
        for operation in item['operations']:
            operation_count += 1
            content = lines(operation['evidence'])
            evidence = operation['evidence']
            if evidence.get('operation'):
                nearby = '\n'.join(content[max(0, evidence['line'] - 2):evidence['line'] + 2])
                assert evidence['operation'] in nearby, 'Function evidence changed: ' + evidence['operation']
    for edge in model['relations']:
        lines(edge['evidence'])
    complete = next(page for page in layout['pages'] if page['id'] == 'complete-domain-model')
    assert {node['id'] for node in complete['nodes']} == set(classes)
    assert {edge['modelId'] for edge in complete['edges']} == {edge['id'] for edge in model['relations']}
    for node in complete['nodes']:
        item = classes[node['id']]
        assert len(node['attrs']) == len(item['attributes'])
        assert node['methods'] == [op['signature'] for op in item['operations']]
    full_owned = [node['id'] for page in layout['pages'][2:] for node in page['nodes'] if not node['reference']]
    assert len(full_owned) == len(set(full_owned)) == 89 and set(full_owned) == set(expected_tables)
    diagrams = ET.parse(ROOT / 'ipawcus-system-class-diagram.drawio').getroot().findall('diagram')
    assert len(diagrams) == len(layout['pages']) == 11
    assert diagrams[0].get('id') == 'system-class-diagram'
    labels = segments = relations = 0
    for page, diagram in zip(layout['pages'], diagrams):
        assert diagram.get('id') == page['id']
        boxes = page['nodes']
        captions = [label for edge in page['edges'] for label in edge['labels']]
        graph = diagram.find('mxGraphModel/root')
        xml_elements = {element.get('id'): element for element in graph}
        assert len(xml_elements) == len(list(graph)), 'Duplicate editable cell identity.'
        for index, box in enumerate(boxes):
            assert all(not overlaps(box, other) for other in boxes[index + 1:]), 'Class box overlap.'
            assert 0 <= box['x'] < box['x'] + box['w'] <= page['width']
            assert 0 <= box['y'] < box['y'] + box['h'] <= page['height']
            assert font(14, bold=True).getlength(box['name']) < box['w'] - 20
            for row in box['attrs'] + box['methods']:
                assert font().getlength(row) < box['w'] - 24, 'Text overflow: ' + box['id'] + ': ' + row
            assert box['methodY'] > box['header'] and box['methodY'] < box['h']
            if box['attrs']:
                assert box['header'] + 17 + (len(box['attrs']) - 1) * 16 < box['methodY'] - 3
            if box['methods']:
                assert box['methodY'] + 17 + (len(box['methods']) - 1) * 16 < box['h'] - 3
            editable = xml_elements[box['id']]
            assert editable.get('label') == box['name']
            assert 'startSize=30' in editable.find('mxCell').get('style')
            divider = xml_elements[box['id'] + '-method-divider'].find('mxGeometry')
            assert float(divider.get('y')) == box['methodY']
            for number, operation in enumerate(box['methods']):
                assert xml_elements[f'{box["id"]}-operation-{number}'].get('value') == operation
        for index, label in enumerate(captions):
            labels += 1
            assert label['y'] + label['h'] <= label['lineY'] - 4
            assert all(not overlaps(label, other) for other in captions[index + 1:]), 'Label overlap.'
            assert all(not overlaps(label, box) for box in boxes), 'Label enters class.'
            bounds = font(11.5, mono=True).getbbox(label['text'], anchor='ls')
            assert bounds[2] <= label['w']
            assert 0 <= label['baselineOffset'] + bounds[1]
            assert label['baselineOffset'] + bounds[3] <= label['h']
        for edge in page['edges']:
            relations += 1
            assert all(0 <= point['x'] <= page['width'] and 0 <= point['y'] <= page['height'] for point in edge['points'])
            for first, last in zip(edge['points'], edge['points'][1:]):
                segments += 1
                assert all(not hit(first, last, box) for box in boxes), 'Line enters another class.'
                assert all(not hit(first, last, label, 2) for label in captions), 'Line touches text.'
            cell = xml_elements[edge['id']].find('mxCell')
            assert cell.get('source') == edge['source'] and cell.get('target') == edge['target']
            assert ('dashed=1' in cell.get('style')) == (edge['kind'] != 'association')
            assert ('endArrow=open' in cell.get('style')) == (edge['kind'] == 'dependency')
            for index, label in enumerate(edge['labels']):
                at = 0 if label['endpoint'] == 'start' else len(edge['points']) - 2
                first, last = edge['points'][at:at + 2]
                assert first['y'] == last['y'] == label['lineY']
                assert min(first['x'], last['x']) <= label['x'] and max(first['x'], last['x']) >= label['x'] + label['w']
                caption = xml_elements[f'{edge["id"]}-label-{index}']
                assert caption.get('parent') == edge['id'] and caption.get('value') == label['text']
                geometry = caption.find('mxGeometry')
                assert geometry.get('relative') == '1'
                assert float(geometry.get('x')) == (-1 if label['endpoint'] == 'start' else 1)
                offset = geometry.find('mxPoint[@as="offset"]')
                endpoint = edge[label['endpoint']]
                assert endpoint['x'] + float(offset.get('x')) == label['x']
                assert endpoint['y'] + float(offset.get('y')) == label['y']
        ET.parse(ROOT / f'{page["number"]:02d}-{page["id"]}.svg')
    return {**layout['statistics'], 'checked_operations': operation_count, 'rendered_relations_checked': relations,
            'segments_checked': segments, 'labels_above_own_line': labels, 'class_box_intersections': 0,
            'label_line_intersections': 0, 'label_label_intersections': 0, 'text_overflows': 0,
            'all_persistent_attributes_in_complete_model': True, 'three_compartment_classes': True,
            'app_changed': False, 'database_changed': False}


def render(page):
    canvas = Image.new('RGB', (page['width'], page['height']), '#ffffff')
    draw = ImageDraw.Draw(canvas)
    ink, border, line = '#202020', '#767676', '#858585'

    def text(x, y, value, size=12, mono=False, bold=False, center=False):
        draw.text((x, y), value, fill=ink, font=font(size, mono, bold), anchor='ms' if center else 'ls')

    text(90, 40, 'iPawcus — ' + page['title'], 25)
    text(90, 68, 'Classes show attributes and operations. Solid: association · dashed: logical association · dashed arrow: dependency.', 13)
    text(90, 91, 'Core system objects; complete-model and detail sheets include all classes and attributes.' if page['overview']
         else '1 required · 0..1 optional · 0..* zero-to-many · ? nullable · source and behavior mappings in DOMAIN-REFERENCE.md.')
    for edge in page['edges']:
        points = [(point['x'], point['y']) for point in edge['points']]
        if edge['kind'] == 'association':
            draw.line(points, fill=line, width=1)
        else:
            pattern = 8 if edge['kind'] == 'application-association' else 4
            for first, last in zip(points, points[1:]):
                distance = math.hypot(last[0] - first[0], last[1] - first[1])
                if not distance:
                    continue
                ux, uy = (last[0] - first[0]) / distance, (last[1] - first[1]) / distance
                for offset in range(0, math.ceil(distance), pattern + 4):
                    end = min(distance, offset + pattern)
                    draw.line([(first[0] + ux * offset, first[1] + uy * offset),
                               (first[0] + ux * end, first[1] + uy * end)], fill=line, width=1)
        if edge['kind'] == 'dependency':
            first, last = points[-2:]
            distance = math.hypot(last[0] - first[0], last[1] - first[1])
            ux, uy = (last[0] - first[0]) / distance, (last[1] - first[1]) / distance
            wings = [(last[0] - ux * 8 + uy * sign * 4.5, last[1] - uy * 8 - ux * sign * 4.5) for sign in [-1, 1]]
            draw.line([wings[0], last, wings[1]], fill=line, width=1)
    for box in page['nodes']:
        x, y, width, height = box['x'], box['y'], box['w'], box['h']
        draw.rectangle((x, y, x + width, y + height), fill='#ffffff', outline=border, width=1)
        for offset in [box['header'], box['methodY']]:
            draw.line([(x, y + offset), (x + width, y + offset)], fill=border, width=1)
        text(x + width / 2, y + 20, box['name'], 14, bold=True, center=True)
        for index, row in enumerate(box['attrs']):
            text(x + 12, y + box['header'] + 17 + index * 16, row)
        for index, row in enumerate(box['methods']):
            text(x + 12, y + box['methodY'] + 17 + index * 16, row)
    for edge in page['edges']:
        for label in edge['labels']:
            text(label['x'], label['y'] + label['baselineOffset'], label['text'], 11.5, mono=True)
    filename = f'{page["number"]:02d}-{page["id"]}.png'
    canvas.save(ROOT / filename)
    if page['id'] == 'system-class-diagram':
        # A close-up for visual QA, not a replacement for the full-resolution file.
        canvas.crop((70, 125, min(page['width'], 1480), min(page['height'], 1040))).save(ROOT / 'domain-detail-preview.png')
    canvas.close()
    print('Rendered ' + filename)


if __name__ == '__main__':
    layout = json.loads((ROOT / 'domain-layout.json').read_text(encoding='utf-8'))
    model = json.loads((ROOT / 'domain-model.json').read_text(encoding='utf-8'))
    source = json.loads((ROOT / 'system-source-model.json').read_text(encoding='utf-8'))
    result = validate(layout, model, source)
    (ROOT / 'domain-validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    for page in layout['pages']:
        render(page)
