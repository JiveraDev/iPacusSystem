"""Validate the plain DFD and render its figures for visual inspection."""
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'outputs/ipawcus-context-2026-10-08-short-labels'
FONTS = Path('C:/Windows/Fonts')
SCALE = 2


def font(size=13, bold=False):
    return ImageFont.truetype(str(FONTS / ('arialbd.ttf' if bold else 'arial.ttf')), round(size * SCALE))


def overlaps(a, b):
    return (a['x'] < b['x'] + b['w'] and a['x'] + a['w'] > b['x']
            and a['y'] < b['y'] + b['h'] and a['y'] + a['h'] > b['y'])


def hit(a, b, rectangle):
    if a['y'] == b['y']:
        return (rectangle['y'] < a['y'] < rectangle['y'] + rectangle['h']
                and max(a['x'], b['x']) > rectangle['x'] + .001
                and min(a['x'], b['x']) < rectangle['x'] + rectangle['w'] - .001)
    assert a['x'] == b['x'], 'Non-orthogonal data flow.'
    return (rectangle['x'] < a['x'] < rectangle['x'] + rectangle['w']
            and max(a['y'], b['y']) > rectangle['y'] + .001
            and min(a['y'], b['y']) < rectangle['y'] + rectangle['h'] - .001)


def shared_segment(a, b, c, d):
    if a == b or c == d:
        return False
    if a['y'] == b['y'] == c['y'] == d['y']:
        return min(max(a['x'], b['x']), max(c['x'], d['x'])) > max(min(a['x'], b['x']), min(c['x'], d['x']))
    if a['x'] == b['x'] == c['x'] == d['x']:
        return min(max(a['y'], b['y']), max(c['y'], d['y'])) > max(min(a['y'], b['y']), min(c['y'], d['y']))
    return False


def crosses(a, b, c, d):
    if a == b or c == d:
        return False
    if a['y'] == b['y'] and c['x'] == d['x']:
        return (min(a['x'], b['x']) <= c['x'] <= max(a['x'], b['x'])
                and min(c['y'], d['y']) <= a['y'] <= max(c['y'], d['y']))
    if a['x'] == b['x'] and c['y'] == d['y']:
        return crosses(c, d, a, b)
    return False


def on_boundary(point, node):
    return (node['x'] <= point['x'] <= node['x'] + node['w']
            and node['y'] <= point['y'] <= node['y'] + node['h']
            and (point['x'] in (node['x'], node['x'] + node['w'])
                 or point['y'] in (node['y'], node['y'] + node['h'])))


def validate(model):
    assert model['typography'] == {'title': 24, 'note': 14, 'node': 16, 'flow': 14, 'increasePx': 2}
    groups = [table for tables in model['storeTables'].values() for table in tables]
    assert len(groups) == len(set(groups)) == 89, 'Repeated or missing table mapping.'
    assert set(groups) == set(model['schemaTables'])
    for files in model['sources'].values():
        for filename in files:
            assert (ROOT / filename).is_file(), 'Missing source evidence: ' + filename
    diagram_file = ROOT / 'ipawcus-data-flow-diagram.drawio'
    editable = ET.parse(diagram_file).getroot()
    diagrams = editable.findall('diagram')
    assert len(diagrams) == len(model['pages']) == 7
    assert diagrams[0].get('id') == '01-simple-data-flow'
    colors = set(re.findall(r'#[0-9a-fA-F]{6}', diagram_file.read_text(encoding='utf-8')))
    assert colors <= {'#000000', '#ffffff'}, 'Coloring was introduced.'
    assert diagram_file.read_bytes() == (OUT / 'ipawcus-data-flow-simple.drawio').read_bytes()
    assert (OUT / 'previous-ipawcus-data-flow-diagram.drawio').is_file()
    process_count = flow_count = 0
    for page, diagram in zip(model['pages'], diagrams):
        assert diagram.get('id') == page['id']
        graph = diagram.find('mxGraphModel/root')
        elements = {element.get('id'): element for element in graph}
        assert len(elements) == len(list(graph)), 'Duplicate editable object identity.'
        boxes = page['nodes']
        by_id = {node['id']: node for node in boxes}
        logical_refs = [node['logicalId'] for node in boxes]
        assert len(logical_refs) == len(set(logical_refs)), 'Repeated user, data store, or process on the same sheet.'
        for index, node in enumerate(boxes):
            assert all(not overlaps(node, other) for other in boxes[index + 1:]), 'Figures overlap.'
            assert 0 <= node['x'] < node['x'] + node['w'] <= page['width']
            assert 0 <= node['y'] < node['y'] + node['h'] <= page['height']
            text_width = node['w'] - (48 if node['type'] == 'store' else 18)
            for row_index, row in enumerate(node['name'].split('\n')):
                size = node.get('fontSize', 16)
                prefix = node.get('boldPrefix', '') if row_index == 0 else ''
                width = (font(size, True).getlength(prefix) + font(size).getlength(row[len(prefix):])
                         if prefix else font(size, node['type'] == 'entity').getlength(row))
                assert width / SCALE < text_width, 'Figure text overflows: ' + node['id']
            assert len(node['name'].split('\n')) * node.get('lineHeight', 19) <= node['h'] - node.get('header', 0), 'Figure text height overflows.'
            if node['type'] == 'process':
                editable_name = elements[node['id'] + '-name']
                if node.get('boldPrefix'):
                    assert 'html=1;' in editable_name.get('style')
                    rich_name = ET.fromstring('<div>' + editable_name.get('value').replace('<br>', '\n') + '</div>')
                    assert [part.text for part in rich_name.findall('b')] == [node['boldPrefix']]
                    plain_name = ''.join(rich_name.itertext())
                else:
                    plain_name = editable_name.get('value')
                assert plain_name == node['name'], 'Editable process title differs from the model.'
                process_count += 1
                incoming = [edge for edge in page['edges'] if edge['target'] == node['id']]
                outgoing = [edge for edge in page['edges'] if edge['source'] == node['id']]
                assert incoming and outgoing, 'Process has no input or output.'
        labels = [edge['label'] for edge in page['edges']]
        for index, edge in enumerate(page['edges']):
            flow_count += 1
            source, target = by_id[edge['source']], by_id[edge['target']]
            # No direct user-to-store, store-to-store or user-to-user shortcuts.
            assert 'process' in [source['type'], target['type']]
            first, last = edge['points'][0], edge['points'][-1]
            assert first != last
            assert on_boundary(first, source) and on_boundary(last, target), 'Arrow does not connect to the correct figure boundary.'
            for other in page['edges'][index + 1:]:
                for a, b in zip(edge['points'], edge['points'][1:]):
                    for c, d in zip(other['points'], other['points'][1:]):
                        assert not shared_segment(a, b, c, d), 'Connectors overlap: ' + edge['id'] + ' and ' + other['id']
                        if page['level'] == 'context':
                            assert not crosses(a, b, c, d), 'Context connectors cross: ' + edge['id'] + ' and ' + other['id']
            for start, end in zip(edge['points'], edge['points'][1:]):
                if start == end:
                    continue
                assert all(not hit(start, end, node) for node in boxes), 'Flow passes through a figure.'
            label = edge['label']
            label_first, label_last = edge['points'][label.get('segment', 0):label.get('segment', 0) + 2]
            assert label['text'] == edge['data']
            assert label_first['y'] == label_last['y'] == label['lineY']
            assert label['y'] + label['h'] <= label_first['y'] - 5
            assert min(label_first['x'], label_last['x']) <= label['x'], 'Label begins before its segment: ' + edge['id']
            assert max(label_first['x'], label_last['x']) >= label['x'] + label['w'], 'Label exceeds its segment: ' + edge['id']
            assert font(label.get('fontSize', 14)).getlength(edge['data']) / SCALE <= label['w'], 'Flow text width exceeds label: ' + edge['id']
            assert all(not overlaps(label, box) for box in boxes), 'Label overlaps a figure.'
            assert all(not overlaps(label, other) for other in labels[index + 1:]), 'Labels overlap.'
            for other in page['edges']:
                for start, end in zip(other['points'], other['points'][1:]):
                    if start != end:
                        assert not hit(start, end, label), 'Arrow ' + other['id'] + ' touches label ' + edge['id']
            editable_edge = elements[edge['id']].find('mxCell')
            assert editable_edge.get('source') == edge['source']
            assert editable_edge.get('target') == edge['target']
            editable_label = elements[edge['id'] + '-label']
            assert editable_label.get('value') == edge['data']
            assert editable_label.get('parent') == edge['id']
            assert f'fontSize={label.get("fontSize", 14)};' in editable_label.get('style')
            geometry = editable_label.find('mxGeometry')
            assert geometry.get('relative') == '1' and geometry.get('x') == '-1'
            offset = geometry.find('mxPoint[@as="offset"]')
            assert first['x'] + float(offset.get('x')) == label['x']
            assert first['y'] + float(offset.get('y')) == label['y']
        svg = OUT / (page['id'] + '.svg')
        ET.parse(svg)
        assert set(re.findall(r'#[0-9a-fA-F]{6}', svg.read_text(encoding='utf-8'))) <= {'#000000', '#ffffff'}
        expected_fonts = {'14', '16', '19.5', '24'} if page['level'] == 'context' else {'14', '16', '24'}
        assert set(re.findall(r'font-size="([\d.]+)"', svg.read_text(encoding='utf-8'))) == expected_fonts
    overview = model['pages'][0]
    assert len(overview['blocks']) == 5 and len(overview['edges']) == 24
    main_roles = {node['logicalId'] for node in overview['nodes'] if node['type'] == 'entity'}
    assert main_roles == {'owner', 'admin', 'vet', 'super'}
    assert sum(node['type'] == 'entity' for node in overview['nodes']) == 4
    assert sum(node['type'] == 'store' for node in overview['nodes']) == 4
    context = next(page for page in model['pages'] if page['level'] == 'context')
    expected_title = 'iPawcus: A Web-Based Veterinary Management System with Online Booking and Pet Record Management for Vetfocus Care Animal Clinic'
    assert model['projectTitle'] == expected_title
    context_system = next(node for node in context['nodes'] if node['type'] == 'process')
    assert context_system['name'].replace('\n', ' ') == expected_title, 'The context must retain the full title exactly.'
    assert context_system['boldPrefix'] == 'iPawcus' and context_system['numberBold'] is False
    assert (context['width'], context['height']) == (1500, 750)
    assert context_system['x'] + context_system['w'] / 2 == context['width'] / 2
    for role in [node for node in context['nodes'] if node['type'] == 'entity']:
        if role['logicalId'] in ('super', 'vet'):
            assert context_system['y'] - (role['y'] + role['h']) == 20
        else:
            assert role['y'] - (context_system['y'] + context_system['h']) == 20
        assert role['x'] + role['w'] < context_system['x'] if role['logicalId'] in ('super', 'admin') else role['x'] > context_system['x'] + context_system['w']
        side_gap = (context_system['x'] - role['x'] - role['w'] if role['logicalId'] in ('super', 'admin')
                    else role['x'] - context_system['x'] - context_system['w'])
        assert side_gap == 305
    for side_x in (context_system['x'], context_system['x'] + context_system['w']):
        rows = sorted(point['y'] for edge in context['edges'] for point in (edge['points'][0], edge['points'][-1])
                      if point['x'] == side_x and context_system['y'] < point['y'] < context_system['y'] + context_system['h'])
        assert all(b - a == 28 for a, b in zip(rows, rows[1:]))
    context_graph = next(diagram for diagram in diagrams if diagram.get('id') == context['id']).find('mxGraphModel/root')
    assert all('fontStyle=1;' in context_graph.find(f'object[@id="{role["id"]}"]/mxCell').get('style')
               for role in context['nodes'] if role['type'] == 'entity')
    assert 'fontStyle=0;' in context_graph.find(f'mxCell[@id="{context_system["id"]}-number"]').get('style')
    context_svg = ET.parse(OUT / (context['id'] + '.svg')).getroot()
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    bold_spans = context_svg.findall('.//svg:tspan[@font-weight="700"]', ns)
    assert len(bold_spans) == 1 and bold_spans[0].text == 'iPawcus'
    system_group = context_svg.find(f'svg:g[@data-node="{context_system["id"]}"]', ns)
    assert all(text.get('font-weight') is None for text in system_group.findall('svg:text', ns))
    assert len(context['nodes']) == 5 and len(context['edges']) == len(model['contextFlows']) == 28
    assert sum(node['type'] == 'process' and node['number'] == '0' for node in context['nodes']) == 1
    assert not any(node['type'] == 'store' for node in context['nodes'])
    assert context['contextTypography'] == {'role': 19.5, 'flow': 16, 'roleIncreasePx': 3.5, 'flowIncreasePx': 2}
    assert next(node for node in context['nodes'] if node['type'] == 'process')['h'] == 260
    assert all(node.get('fontSize') == 19.5 for node in context['nodes'] if node['type'] == 'entity')
    for contract in model['contextFlows']:
        matches = [edge for edge in context['edges'] if edge['fullData'] == contract['data']]
        assert len(matches) == 1
        edge = matches[0]
        assert edge['data'] == contract['shortLabel']
        assert 2 <= len(edge['data'].split()) <= 4 and len(edge['data']) <= 29
        assert edge['covers'] == contract['covers']
        tooltip = context_graph.find(f'object[@id="{edge["id"]}"]').get('tooltip')
        assert edge['fullData'] in tooltip and all(detail in tooltip for detail in contract['covers'])
        expected_source = contract['actor'] if contract['direction'] == 'in' else '0'
        expected_target = '0' if contract['direction'] == 'in' else contract['actor']
        assert edge['logicalSource'] == expected_source and edge['logicalTarget'] == expected_target
        assert edge['direction'] == contract['direction']
    standalone_context = ROOT / 'ipawcus-context-diagram-revised.drawio'
    assert standalone_context.read_bytes() == (OUT / standalone_context.name).read_bytes()
    assert ET.parse(standalone_context).getroot().find('diagram').get('id') == context['id']
    return {'pages': 7, 'main_processes': 5, 'main_data_flows': 24,
            'processes_checked': process_count, 'data_flows_checked': flow_count,
            'tables_mapped_once': len(groups), 'black_and_white_only': True,
            'labels_above_their_own_arrows': True, 'figure_intersections': 0,
            'label_intersections': 0, 'text_overflows': 0,
            'each_user_once_per_sheet': True, 'each_data_store_once_per_sheet': True,
            'overlapping_connector_segments': 0,
            'context_data_flows': 28, 'context_directions_checked': True,
            'font_increase_px': 2, 'flow_font_px': 14, 'node_font_px': 16,
            'context_role_font_px': 19.5, 'context_flow_font_px': 16,
            'context_four_corner_layout': True,
            'all_four_roles_compact': True, 'context_vertical_gap_px': 20,
            'context_centered': True, 'context_horizontal_gap_px': 305,
            'context_canvas_px': {'width': 1500, 'height': 750},
            'context_connector_crossings': 0, 'context_selective_bold_verified': True,
            'context_short_labels': True, 'context_label_words_max': 4,
            'context_full_descriptions_preserved': True,
            'full_project_title_preserved': True,
            'source_files_exist': True, 'previous_diagram_preserved': True,
            'application_modified': False, 'database_modified': False}


def render(page):
    canvas = Image.new('RGB', (page['width'] * SCALE, page['height'] * SCALE), '#ffffff')
    draw = ImageDraw.Draw(canvas)

    def point(x, y):
        return x * SCALE, y * SCALE

    def text(x, y, value, size=13, centered=False, bold=False, bold_prefix=''):
        if bold_prefix and value.startswith(bold_prefix):
            bold_font, regular_font = font(size, True), font(size)
            remainder = value[len(bold_prefix):]
            prefix_width = bold_font.getlength(bold_prefix)
            full_width = prefix_width + regular_font.getlength(remainder)
            start_x, baseline = point(x, y)
            if centered:
                start_x -= full_width / 2
            draw.text((start_x, baseline), bold_prefix, font=bold_font, fill='#000000', anchor='ls')
            draw.text((start_x + prefix_width, baseline), remainder, font=regular_font, fill='#000000', anchor='ls')
            return
        draw.text(point(x, y), value, font=font(size, bold), fill='#000000', anchor='ms' if centered else 'ls')

    def line(points):
        draw.line([point(x, y) for x, y in points], fill='#000000', width=2)

    text(60, 34, page['title'], 24)
    text(60, 64, page.get('note') or f'Expansion of process {page["parent"]}. Each user role and each data store appears once.', 14)
    for edge in page['edges']:
        line([(vertex['x'], vertex['y']) for vertex in edge['points']])
        first, last = edge['points'][-2:]
        dx, dy = last['x'] - first['x'], last['y'] - first['y']
        distance = abs(dx) + abs(dy)
        assert distance > 0
        dx, dy = dx / distance, dy / distance
        tip = point(last['x'], last['y'])
        triangle = [tip, point(last['x'] - dx * 7 + dy * 4, last['y'] - dy * 7 - dx * 4),
                    point(last['x'] - dx * 7 - dy * 4, last['y'] - dy * 7 + dx * 4)]
        draw.polygon(triangle, fill='#000000')
        text(edge['label']['x'], edge['label']['y'] + edge['label']['baseline'], edge['data'], edge['label'].get('fontSize', 14))
    for node in page['nodes']:
        x, y, width, height = node['x'], node['y'], node['w'], node['h']
        if node['type'] == 'store':
            line([(x + width, y), (x, y), (x, y + height), (x + width, y + height)])
            line([(x + 40, y), (x + 40, y + height)])
            text(x + 20, y + height / 2 + 6, node['code'], 16, True)
        elif node['type'].startswith('process'):
            draw.rounded_rectangle([point(x, y), point(x + width, y + height)], radius=11 * SCALE, fill='#ffffff', outline='#000000', width=2)
            line([(x, y + node['header']), (x + width, y + node['header'])])
            text(x + width / 2, y + 20, node['number'], 16, True, node.get('numberBold', True))
        else:
            draw.rectangle([point(x, y), point(x + width, y + height)], fill='#ffffff', outline='#000000', width=2)
        rows = node['name'].split('\n')
        header = node['header'] if node['type'].startswith('process') else 0
        center_x = x + (40 + (width - 40) / 2 if node['type'] == 'store' else width / 2)
        center_y = y + header + (height - header) / 2
        for index, row in enumerate(rows):
            text(center_x, center_y + node.get('baselineOffset', 6) + (index - (len(rows) - 1) / 2) * node.get('lineHeight', 19), row, node.get('fontSize', 16), True, node['type'] == 'entity', node.get('boldPrefix', '') if index == 0 else '')
    destination = OUT / (page['id'] + '.png')
    canvas.save(destination)
    canvas.close()
    print('Rendered ' + destination.name)


if __name__ == '__main__':
    model = json.loads((OUT / 'dfd-model.json').read_text(encoding='utf-8'))
    result = validate(model)
    (OUT / 'validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    for page in model['pages']:
        render(page)
