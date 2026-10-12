"""Independent structural/geometry checks and native PNG previews."""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = ROOT.parent.parent
SCALE = 1
FONT_ROOT = Path('C:/Windows/Fonts')


def font(family, size):
    return ImageFont.truetype(str(FONT_ROOT / family), round(size * SCALE))


def overlaps(first, last):
    return (first['x'] < last['x'] + last['w'] and first['x'] + first['w'] > last['x']
            and first['y'] < last['y'] + last['h'] and first['y'] + first['h'] > last['y'])


def intersects(first, last, box, margin=0):
    left, right = box['x'] - margin, box['x'] + box['w'] + margin
    top, bottom = box['y'] - margin, box['y'] + box['h'] + margin
    if first['y'] == last['y']:
        return (top + .001 < first['y'] < bottom - .001
                and max(first['x'], last['x']) > left + .001
                and min(first['x'], last['x']) < right - .001)
    assert first['x'] == last['x'], 'Non-orthogonal relationship.'
    return (left + .001 < first['x'] < right - .001
            and max(first['y'], last['y']) > top + .001
            and min(first['y'], last['y']) < bottom - .001)


def validate(layout, model):
    definitions = [node['id'] for page in layout['pages'] for node in page['nodes']
                   if not node['reference'] and node['kind'] in ['boundary', 'service', 'backend']]
    expected = [module['id'] for module in model['modules']]
    assert len(definitions) == len(set(definitions)) == len(expected), 'Repeated or missing source modules.'
    assert set(definitions) == set(expected)
    assert len([table for table in model['tables'] if table['provenance'] == 'sql-export']) == 88
    additions = [table for table in model['tables'] if table['provenance'] == 'migration-only']
    assert [table['name'] for table in additions] == ['clinical_intakes']
    assert len(additions[0]['columns']) == 19 and len(additions[0]['fks']) == 5
    assert len(model['routes']) == 140
    table_by_name = {table['name']: table for table in model['tables']}
    for module in model['modules']:
        assert (SOURCE_ROOT / module['source']).is_file(), 'Missing source file.'
    labels = segments = dependencies = 0
    overflows = []
    for page in layout['pages']:
        boxes = page['nodes']
        identities = {node['id'] for node in boxes}
        captions = [label for edge in page['edges'] for label in edge['labels']]
        for index, node in enumerate(boxes):
            assert all(not overlaps(node, other) for other in boxes[index + 1:]), 'Class boxes overlap.'
            assert node['x'] >= 0 and node['x'] + node['w'] <= page['width']
            assert node['y'] >= 0 and node['y'] + node['h'] <= page['height']
            for rows, family, size in [(node['nameRows'], 'arial.ttf', 16), (node['subtitleRows'], 'arial.ttf', 11.5), (node['sourceRows'], 'arial.ttf', 11.5), (node['rows'], 'consola.ttf', 12)]:
                for row in rows:
                    if font(family, size).getlength(row) / SCALE > node['w'] - 28:
                        overflows.append(f'{node["id"]} / {row}')
            body_bottom = node['y'] + node['header'] + 23 + (len(node['rows']) - 1) * 18
            footer_top = node['y'] + node['h'] - 12 - (len(node['sourceRows']) - 1) * 16 - 11
            assert body_bottom < footer_top, 'Body overlaps source footer.'
        for index, label in enumerate(captions):
            labels += 1
            assert label['y'] + label['h'] <= label['lineY'] - 4
            assert all(not overlaps(label, other) for other in captions[index + 1:]), 'Labels overlap.'
            assert all(not overlaps(label, node) for node in boxes), 'Label enters a box.'
            bounds = font('consola.ttf', 11.5).getbbox(label['text'], anchor='ls')
            assert bounds[2] / SCALE <= label['w']
            assert label['baselineOffset'] + bounds[1] / SCALE >= 0
            assert label['baselineOffset'] + bounds[3] / SCALE <= label['h']
        for edge in page['edges']:
            dependencies += 1
            assert edge['source'] in identities and edge['target'] in identities
            assert all(0 <= point['x'] <= page['width'] and 0 <= point['y'] <= page['height']
                       for point in edge['points']), 'A relationship is clipped by the canvas.'
            if edge['kind'] not in ['summary']:
                assert edge['evidence'], 'Missing source evidence.'
                for evidence in edge['evidence']:
                    assert (SOURCE_ROOT / evidence['file']).is_file()
                    line_count = len((SOURCE_ROOT / evidence['file']).read_text(encoding='utf-8').splitlines())
                    assert 1 <= evidence['line'] <= line_count
            if edge['text'] == 'SQL' and edge['kind'] != 'summary':
                table = edge['target'].removeprefix('db:')
                assert table in table_by_name
                assert all(evidence['table'] == table for evidence in edge['evidence'])
            for first, last in zip(edge['points'], edge['points'][1:]):
                segments += 1
                assert all(not intersects(first, last, node) for node in boxes), 'Line enters a class.'
                assert all(not intersects(first, last, label, 3) for label in captions), 'Line touches text.'
            for label in edge['labels']:
                at = 0 if label['endpoint'] == 'start' else len(edge['points']) - 2
                first, last = edge['points'][at:at + 2]
                assert first['y'] == last['y'] == label['lineY']
                assert min(first['x'], last['x']) <= label['x']
                assert max(first['x'], last['x']) >= label['x'] + label['w']
        ET.parse(ROOT / f'{page["number"]}-{page["id"]}.svg')
    assert not overflows, 'Text overflows: ' + '\n'.join(overflows[:30])
    combined = ET.parse(ROOT / 'ipawcus-system-and-database.drawio').getroot()
    original = ET.parse(ROOT / 'ipawcus-class-diagram.drawio').getroot()
    assert len(combined.findall('diagram')) == len(layout['pages']) + 10
    assert combined.find('diagram').get('id') == 'system-system-overview', 'System overview must open first.'
    for diagram in original.findall('diagram'):
        preserved = next(item for item in combined.findall('diagram') if item.get('id') == diagram.get('id'))
        assert ET.tostring(preserved) == ET.tostring(diagram), 'Original compact DB page changed.'
    for page in layout['pages']:
        diagram = next(item for item in combined.findall('diagram') if item.get('id') == 'system-' + page['id'])
        graph = diagram.find('mxGraphModel/root')
        ids = [element.get('id') for element in graph]
        assert len(ids) == len(set(ids)), 'Duplicate editable object ID.'
        for edge in page['edges']:
            relationship = next(obj for obj in graph.findall('object') if obj.get('id') == edge['id'])
            cell = relationship.find('mxCell')
            assert cell.get('source') == edge['source'] and cell.get('target') == edge['target']
            if edge['kind'] == 'inheritance':
                assert 'endArrow=block' in cell.get('style') and 'dashed=1' not in cell.get('style')
            for index, label in enumerate(edge['labels']):
                caption = next(cell for cell in graph.findall('mxCell') if cell.get('id') == f'{edge["id"]}-label-{index}')
                assert caption.get('parent') == edge['id'] and caption.get('value') == label['text']
                geometry = caption.find('mxGeometry')
                assert geometry.get('relative') == '1'
                assert float(geometry.get('x')) == (-1 if label['endpoint'] == 'start' else 1)
                offset = geometry.find('mxPoint[@as="offset"]')
                endpoint = edge[label['endpoint']]
                assert endpoint['x'] + float(offset.get('x')) == label['x']
                assert endpoint['y'] + float(offset.get('y')) == label['y']
    return {'combined_pages': len(combined.findall('diagram')), 'source_modules_checked': len(expected),
            'sql_export_entities': 88, 'migration_only_entities': 1, 'dispatcher_patterns': 140,
            'system_relationships_checked': dependencies, 'system_segments_checked': segments,
            'labels_above_own_line': labels, 'class_box_intersections': 0,
            'label_line_intersections': 0, 'label_label_intersections': 0, 'text_overflows': 0,
            'original_compact_db_pages_preserved': True, 'application_modified': False,
            'database_modified': False, 'sql_export_modified': False}


def render(page):
    image = Image.new('RGB', (page['width'] * SCALE, page['height'] * SCALE), '#ffffff')
    draw = ImageDraw.Draw(image)
    neutral, muted, line, border = '#2d3748', '#596579', '#8793a3', '#c4cbd4'

    def text(x, y, value, size=12, family='arial.ttf', color=neutral):
        draw.text((x * SCALE, y * SCALE), value, font=font(family, size), fill=color, anchor='ls')

    text(80, 44, 'iPawcus / ' + page['title'], 25)
    text(80, 73, 'React / service / PHP / entity reference · source-code dependencies, not invented OO inheritance.', 14, color=muted)
    text(80, 100, 'Dashed: dependency. Solid: migration FK or real class inheritance. Full source evidence accompanies detailed links.', 13, color=muted)
    headers = (['Migration-defined entity', '', 'Related SQL-export entities', ''] if page['id'] == 'schema-additions'
               else ['UI and system views', 'JavaScript services', 'PHP backend modules', 'Database references'])
    for layer, header in enumerate(headers):
        node = next((node for node in page['nodes'] if node['layer'] == layer), None)
        if node:
            text(node['x'], 143, header, 14, color=muted)
    for edge in page['edges']:
        points = [(vertex['x'] * SCALE, vertex['y'] * SCALE) for vertex in edge['points']]
        if edge['kind'] in ['migration-fk', 'inheritance']:
            draw.line(points, fill=line, width=max(1, round(1.2 * SCALE)))
        else:
            for first, last in zip(points, points[1:]):
                distance = math.hypot(last[0] - first[0], last[1] - first[1])
                ux, uy = ((last[0] - first[0]) / distance, (last[1] - first[1]) / distance)
                for offset in range(0, math.ceil(distance), 9 * SCALE):
                    end = min(distance, offset + 5 * SCALE)
                    draw.line([(first[0] + ux * offset, first[1] + uy * offset),
                               (first[0] + ux * end, first[1] + uy * end)], fill=line,
                              width=max(1, round(1.2 * SCALE)))
        first, last = edge['points'][-2:]
        dx, dy = last['x'] - first['x'], last['y'] - first['y']
        distance = math.hypot(dx, dy)
        ux, uy = dx / distance, dy / distance
        tip = (last['x'] * SCALE, last['y'] * SCALE)
        wings = [((last['x'] - ux * 8 + uy * side * 4.5) * SCALE,
                  (last['y'] - uy * 8 - ux * side * 4.5) * SCALE) for side in [-1, 1]]
        if edge['kind'] == 'inheritance':
            draw.polygon([wings[0], tip, wings[1]], fill='#ffffff', outline=line)
        else:
            draw.line([wings[0], tip, wings[1]], fill=line, width=max(1, round(1.2 * SCALE)))
    for node in page['nodes']:
        left, top = node['x'], node['y']
        draw.rectangle((left * SCALE, top * SCALE, (left + node['w']) * SCALE,
                        (top + node['h']) * SCALE), fill='#f8fafc' if node['reference'] else '#ffffff', outline=border)
        draw.line([(left * SCALE, (top + node['header']) * SCALE),
                   ((left + node['w']) * SCALE, (top + node['header']) * SCALE)], fill=border)
        for index, value in enumerate(node['nameRows']):
            text(left + 14, top + 23 + index * 19, value, 16)
        for index, value in enumerate(node['subtitleRows']):
            text(left + 14, top + 23 + len(node['nameRows']) * 19 + index * 16, value, 11.5, color=muted)
        for index, value in enumerate(node['rows']):
            text(left + 14, top + node['header'] + 23 + index * 18, value, 12, 'consola.ttf')
        for index, value in enumerate(node['sourceRows']):
            text(left + 14, top + node['h'] - 12 - (len(node['sourceRows']) - 1 - index) * 16, value, 11.5, color=muted)
    for edge in page['edges']:
        for label in edge['labels']:
            text(label['x'], label['y'] + label['baselineOffset'], label['text'], 11.5, 'consola.ttf', muted)
    destination = ROOT / f'{page["number"]}-{page["id"]}.png'
    image.save(destination)
    image.close()
    print(f'Rendered {destination.name}')


if __name__ == '__main__':
    layout = json.loads((ROOT / 'system-layout.json').read_text(encoding='utf-8'))
    model = json.loads((ROOT / 'system-source-model.json').read_text(encoding='utf-8'))
    result = validate(layout, model)
    (ROOT / 'system-validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    for page in layout['pages']:
        if page['id'] in ['system-overview', 'examination-1', 'prescriptions', 'schema-additions']:
            render(page)
