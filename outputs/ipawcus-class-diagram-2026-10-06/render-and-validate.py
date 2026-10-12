"""Render the native-vector layout and independently validate its geometry."""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
FONT_ROOT = Path('C:/Windows/Fonts')
SCALE = 2


def font(name, size):
    return ImageFont.truetype(str(FONT_ROOT / name), round(size * SCALE))


def font_width(text, name, size):
    return font(name, size).getlength(text) / SCALE


def point(value):
    return value['x'] * SCALE, value['y'] * SCALE


def crosses_box(first, last, node):
    epsilon = 0.001
    left, top = node['x'], node['y']
    right, bottom = left + node['w'], top + node['h']
    if abs(first['y'] - last['y']) < epsilon:
        return (top + epsilon < first['y'] < bottom - epsilon
                and max(first['x'], last['x']) > left + epsilon
                and min(first['x'], last['x']) < right - epsilon)
    if abs(first['x'] - last['x']) < epsilon:
        return (left + epsilon < first['x'] < right - epsilon
                and max(first['y'], last['y']) > top + epsilon
                and min(first['y'], last['y']) < bottom - epsilon)
    raise AssertionError('A relationship segment is not orthogonal.')


def overlaps(first, last):
    return (first['x'] < last['x'] + last['w']
            and first['x'] + first['w'] > last['x']
            and first['y'] < last['y'] + last['h']
            and first['y'] + first['h'] > last['y'])


def expanded(rectangle, margin):
    return {'x': rectangle['x'] - margin, 'y': rectangle['y'] - margin,
            'w': rectangle['w'] + margin * 2, 'h': rectangle['h'] + margin * 2}


def validate(layout, schema):
    full_pages = layout['pages'][1:]
    actual_tables = [node['id'] for page in full_pages for node in page['nodes'] if not node['reference']]
    expected_tables = [table['name'] for table in schema['tables']]
    assert len(actual_tables) == len(set(actual_tables)) == len(expected_tables) == 88
    assert set(actual_tables) == set(expected_tables)
    fields = {table['name']: [column['name'] for column in table['columns']] for table in schema['tables']}
    attributes = 0
    for page in full_pages:
        for node in page['nodes']:
            if not node['reference']:
                assert node['columns'] == fields[node['id']], f'Missing fields in {node["id"]}'
                attributes += len(node['attrs'])
    assert attributes == layout['columnCount'] == 1050
    expected_edges = [(table['name'], foreign_key['constraint'], foreign_key['table'], tuple(foreign_key['columns']))
                      for table in schema['tables'] for foreign_key in table['fks']]
    actual_edges = [(edge['source'], edge['constraint'], edge['target'], tuple(edge['columns']))
                    for page in full_pages for edge in page['edges']]
    assert sorted(actual_edges) == sorted(expected_edges)
    assert len(actual_edges) == layout['foreignKeyCount'] == 184
    segments = 0
    labels_checked = 0
    for page in layout['pages']:
        captions = [label for edge in page['edges'] for label in edge['labels']]
        relationship_segments = [(first, last) for edge in page['edges']
                                 for first, last in zip(edge['points'], edge['points'][1:])]
        for index, label in enumerate(captions):
            labels_checked += 1
            assert label['y'] + label['h'] <= label['lineY'] - 4, 'Label is not above its own line.'
            assert all(not overlaps(label, other) for other in captions[index + 1:]), 'Relationship labels overlap.'
            assert all(not crosses_box(first, last, expanded(label, 2))
                       for first, last in relationship_segments), 'A line touches relationship text.'
            bounds = font('consola.ttf', 11.5).getbbox(label['text'], anchor='ls')
            glyph = {'x': label['x'] + bounds[0] / SCALE,
                     'y': label['y'] + label['baselineOffset'] + bounds[1] / SCALE,
                     'w': (bounds[2] - bounds[0]) / SCALE,
                     'h': (bounds[3] - bounds[1]) / SCALE}
            assert glyph['x'] >= label['x'] and glyph['x'] + glyph['w'] <= label['x'] + label['w']
            assert glyph['y'] >= label['y'] and glyph['y'] + glyph['h'] <= label['y'] + label['h']
        for index, node in enumerate(page['nodes']):
            assert all(not overlaps(node, other) for other in page['nodes'][index + 1:]), 'Class boxes overlap.'
            assert font_width(node['className'], 'arialbd.ttf', 17) <= node['w'] - 32
            label = node['id'] + (f' · reference / page {node["page"]:02d}' if node['reference'] else '')
            assert font_width(label, 'arial.ttf', 11.5) <= node['w'] - 32
            for text in node['attrs']:
                assert font_width(text, 'consola.ttf', 12) <= node['w'] - 28, f'Attribute text exceeds {node["id"]}: {text}'
        for edge in page['edges']:
            for first, last in zip(edge['points'], edge['points'][1:]):
                segments += 1
                for node in page['nodes']:
                    assert not crosses_box(first, last, node), f'{edge["constraint"]} crosses {node["id"]}'
            for label in edge['labels']:
                assert all(not overlaps(label, node) for node in page['nodes']), 'Multiplicity label overlaps a class.'
                endpoint = edge[label['endpoint']]
                owner = next(node for node in page['nodes'] if node['id'] == label['owner'])
                box_edge = owner['x'] + owner['w'] if endpoint['x'] > owner['x'] else owner['x']
                distance = min(abs(label['x'] - box_edge), abs(label['x'] + label['w'] - box_edge))
                assert distance == 12, 'A label is not close to its class box.'
                index = 0 if label['endpoint'] == 'start' else len(edge['points']) - 2
                first, last = edge['points'][index:index + 2]
                assert first['y'] == last['y'] == label['lineY'], 'A label is not above a horizontal docking segment.'
                assert min(first['x'], last['x']) <= label['x'] and max(first['x'], last['x']) >= label['x'] + label['w']
        svg_file = ROOT / f'{layout["pages"].index(page):02d}-{page["id"]}.svg'
        svg = ET.parse(svg_file)
        namespace = {'svg': 'http://www.w3.org/2000/svg'}
        text_nodes = svg.findall('.//svg:text[@data-relationship]', namespace)
        assert len(text_nodes) == len(captions), 'A relationship caption is missing from the SVG.'
        for edge in page['edges']:
            for label in edge['labels']:
                text_node = next(node for node in text_nodes if node.get('data-relationship') == edge['id']
                                 and node.get('data-endpoint') == label['endpoint'])
                assert text_node.text == label['text']
                assert float(text_node.get('x')) == label['x']
                assert float(text_node.get('y')) == label['y'] + label['baselineOffset']
    drawio = ET.parse(ROOT / 'ipawcus-class-diagram.drawio')
    assert len(drawio.getroot().findall('diagram')) == 10
    for page, diagram in zip(layout['pages'], drawio.getroot().findall('diagram')):
        graph = diagram.find('mxGraphModel/root')
        identities = [element.get('id') for element in graph if element.get('id')]
        assert len(identities) == len(set(identities)), 'Duplicate draw.io object identifiers.'
        node_names = {cell.get('id') for cell in graph.findall('mxCell') if cell.get('vertex') == '1'}
        for relation in graph.findall('object/mxCell'):
            assert relation.get('source') in node_names and relation.get('target') in node_names
        for edge in page['edges']:
            label_cells = [cell for cell in graph.findall('mxCell') if cell.get('parent') == edge['id']]
            assert len(label_cells) == len(edge['labels']) == 2, 'Captions must belong to their own relationship.'
            for index, label in enumerate(edge['labels']):
                cell = next(cell for cell in label_cells if cell.get('id') == f'{edge["id"]}-multiplicity-{index}')
                assert cell.get('value') == label['text'] and 'fillColor=none' in cell.get('style')
                geometry = cell.find('mxGeometry')
                assert geometry.get('relative') == '1'
                assert float(geometry.get('x')) == (-1 if index == 0 else 1)
                assert float(geometry.get('y')) == 0
                offset = geometry.find('mxPoint[@as="offset"]')
                endpoint = edge['start' if index == 0 else 'end']
                assert endpoint['x'] + float(offset.get('x')) == label['x']
                assert endpoint['y'] + float(offset.get('y')) == label['y']
    return {'tables': 88, 'attributes': attributes, 'declared_foreign_keys': len(actual_edges),
            'pages': 10, 'relationship_segments_checked': segments, 'class_box_intersections': 0,
            'relationship_labels_checked': labels_checked, 'label_box_intersections': 0,
            'label_line_intersections': 0, 'label_label_intersections': 0,
            'labels_above_own_line': labels_checked, 'text_overflows': 0}


def render(page, destination):
    image = Image.new('RGB', (page['width'] * SCALE, page['height'] * SCALE), '#ffffff')
    draw = ImageDraw.Draw(image)
    neutral, muted, line, border = '#2d3748', '#596579', '#8793a3', '#c4cbd4'

    def text(x, y, value, size=12, family='arial.ttf', color=neutral):
        draw.text((x * SCALE, y * SCALE), value, font=font(family, size), fill=color, anchor='ls')

    title = 'iPawcus / ' + page['title']
    text(110, 45, title, 26, 'arialbd.ttf')
    subtitle = ('Selected core attributes. See module pages for every schema field.' if page.get('overview')
                else 'Complete attributes for this module; reference boxes link to other pages.')
    text(110, 76, subtitle, 14, color=muted)
    text(110, 100, '1 required · 0..1 optional · 0..* zero-to-many · ? nullable · PK/FK/UK keys', 13, color=muted)
    for edge in page['edges']:
        draw.line([point(vertex) for vertex in edge['points']], fill=line, width=round(1.2 * SCALE))
        first, last = edge['points'][-2:]
        dx, dy = last['x'] - first['x'], last['y'] - first['y']
        distance = math.hypot(dx, dy)
        ux, uy = dx / distance, dy / distance
        wing1 = {'x': last['x'] - ux * 8 - uy * 4.5, 'y': last['y'] - uy * 8 + ux * 4.5}
        wing2 = {'x': last['x'] - ux * 8 + uy * 4.5, 'y': last['y'] - uy * 8 - ux * 4.5}
        draw.line([point(wing1), point(last), point(wing2)], fill=line, width=round(1.2 * SCALE))
    for node in page['nodes']:
        left, top = node['x'], node['y']
        rectangle = [left * SCALE, top * SCALE, (left + node['w']) * SCALE, (top + node['h']) * SCALE]
        draw.rectangle(rectangle, fill='#f8fafc' if node['reference'] else '#ffffff', outline=border, width=2)
        draw.line([(left * SCALE, (top + 48) * SCALE), ((left + node['w']) * SCALE, (top + 48) * SCALE)], fill=border, width=2)
        text(left + 16, top + 23, node['className'], 17, 'arialbd.ttf')
        label = node['id'] + (f' · reference / page {node["page"]:02d}' if node['reference'] else '')
        text(left + 16, top + 40, label, 11.5, color=muted)
        for index, attribute in enumerate(node['attrs']):
            text(left + 14, top + 64 + index * 18, attribute, 12, 'consola.ttf')
        if node['reference']:
            text(left + 14, top + node['h'] - 12, f'Full class on page {node["page"]:02d}', 11.5, color=muted)
    for edge in page['edges']:
        for label in edge['labels']:
            x, y = label['x'], label['y']
            text(x, y + label['baselineOffset'], label['text'], 11.5, 'consola.ttf', muted)
    image.save(destination)
    image.close()


if __name__ == '__main__':
    layout = json.loads((ROOT / 'layout.json').read_text(encoding='utf-8'))
    schema = json.loads((ROOT / 'schema-model.json').read_text(encoding='utf-8'))
    print(json.dumps(validate(layout, schema), indent=2))
    for index in [0, 4]:
        page = layout['pages'][index]
        destination = ROOT / f'{index:02d}-{page["id"]}.png'
        render(page, destination)
        print(f'Rendered {destination.name}')
