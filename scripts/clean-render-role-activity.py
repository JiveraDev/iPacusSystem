"""Create a compact four-sheet copy and previews from the existing draw.io file.

Keep workflow wording, connections, and horizontal geometry. Only vertical
layout, text leading, and the system-column header are revised. The source
document is never overwritten.
"""
import base64
import copy
import hashlib
import html
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/IPAWCUS-Role-Activity-Diagrams.drawio'
OUT = ROOT / 'outputs/ipawcus-diagrams-2026-10-08-clean/role-activities'
TITLE = 'iPawcus: A Web-Based Veterinary Management System with Online Booking and Pet Record Management for Vetfocus Care Animal Clinic'
LOGO = ROOT / 'src/assets/circular_logo.png'
ROLES = {'pet-owner': 'Pet Owner', 'admin': 'Admin', 'veterinarian': 'Veterinarian', 'super-admin': 'Super Admin'}
VERTICAL_SCALE = .65
SCALE = 2
HEADER = 72
LEADING = 14


def font(size=12, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/' + ('arialbd.ttf' if bold else 'arial.ttf'), round(size * SCALE))


def styles(cell):
    return dict((part.split('=', 1) if '=' in part else (part, '1'))
                for part in cell.get('style', '').split(';') if part)


def set_style(cell, **changes):
    values = styles(cell)
    values.update({key: str(value) for key, value in changes.items()})
    cell.set('style', ';'.join(key if value == '1' and key in ('ellipse', 'rhombus', 'swimlane', 'text')
                              else key + '=' + value for key, value in values.items()) + ';')


def rect(cell):
    geometry = cell.find('mxGeometry')
    return {key: float(geometry.get(attribute, '0')) for key, attribute in
            [('x', 'x'), ('y', 'y'), ('w', 'width'), ('h', 'height')]}


def write_rect(cell, box):
    for key, attribute in [('x', 'x'), ('y', 'y'), ('w', 'width'), ('h', 'height')]:
        cell.find('mxGeometry').set(attribute, f'{box[key]:.4f}'.rstrip('0').rstrip('.'))


def wrap(value, width, size=12, bold=False):
    result = []
    for paragraph in value.split('\n'):
        line = ''
        for word in paragraph.split():
            candidate = (line + ' ' + word).strip()
            if line and font(size, bold).getlength(candidate) / SCALE > width:
                result.append(line)
                line = word
            else:
                line = candidate
        result.append(line)
    return result


def overlap(a, b, margin=0):
    return (a['x'] < b['x'] + b['w'] + margin and a['x'] + a['w'] + margin > b['x']
            and a['y'] < b['y'] + b['h'] + margin and a['y'] + a['h'] + margin > b['y'])


def segment_hit(a, b, box):
    if abs(a[1] - b[1]) < .05:
        return box['y'] < a[1] < box['y'] + box['h'] and max(a[0], b[0]) > box['x'] + .05 and min(a[0], b[0]) < box['x'] + box['w'] - .05
    if abs(a[0] - b[0]) < .05:
        return box['x'] < a[0] < box['x'] + box['w'] and max(a[1], b[1]) > box['y'] + .05 and min(a[1], b[1]) < box['y'] + box['h'] - .05
    raise AssertionError('Non-orthogonal connector: ' + str((a, b)))


def boundary(node, fx, fy):
    """Attach straight wires to the actual circle/diamond outline, not its box."""
    x, y, w, h = (node[key] for key in ('x', 'y', 'w', 'h'))
    px, py = round(x + w * fx, 2), round(y + h * fy, 2)
    cx, cy = x + w / 2, y + h / 2
    if node['kind'] in ('start', 'end', 'decision'):
        if fx in (0, 1):
            fraction = abs(py - cy) / (h / 2)
            reach = (1 - fraction) if node['kind'] == 'decision' else math.sqrt(max(0, 1 - fraction ** 2))
            px = cx + (-1 if fx == 0 else 1) * w / 2 * reach
        elif fy in (0, 1):
            fraction = abs(px - cx) / (w / 2)
            reach = (1 - fraction) if node['kind'] == 'decision' else math.sqrt(max(0, 1 - fraction ** 2))
            py = cy + (-1 if fy == 0 else 1) * h / 2 * reach
    return round(px, 2), round(py, 2)


def label_position(edge, nodes, all_edges, labels):
    width = math.ceil(font(11, True).getlength(edge['label']) / SCALE) + 8
    candidates = []
    distance = 0
    for a, b in zip(edge['points'], edge['points'][1:]):
        length = abs(a[0] - b[0]) + abs(a[1] - b[1])
        if abs(a[1] - b[1]) < .05 and length >= width + 12:
            left, right = sorted((a[0], b[0]))
            for px in (left + 6, (left + right - width) / 2, right - width - 6):
                for py in (a[1] - 20, a[1] + 6):
                    candidates.append((distance + abs(px - a[0]), {'x': px, 'y': py, 'w': width, 'h': 14}))
        elif abs(a[0] - b[0]) < .05 and length >= 16:
            top, bottom = sorted((a[1], b[1]))
            for py in (top + 1, top + 6, (top + bottom - 14) / 2, bottom - 15):
                for px in (a[0] + 7, a[0] - width - 7):
                    candidates.append((distance + abs(py - a[1]) + 20, {'x': px, 'y': py, 'w': width, 'h': 14}))
        distance += length
    for _, candidate in sorted(candidates, key=lambda item: item[0]):
        if candidate['x'] < 1 or candidate['y'] < 175:
            continue
        if any(overlap(candidate, node, 1) for node in nodes) or any(overlap(candidate, other, 2) for other in labels):
            continue
        if any(segment_hit(a, b, candidate) for other in all_edges for a, b in zip(other['points'], other['points'][1:])):
            continue
        return candidate
    raise AssertionError('No clear position for branch label: ' + edge['id'] + ' ' + edge['label'] + ' ' + str(edge['points']))


def clean_page(original):
    page = copy.deepcopy(original)
    graph = page.find('mxGraphModel')
    root = graph.find('root')
    cells = {cell.get('id'): cell for cell in root}
    node_cells = [cell for cell in root if cell.get('vertex') == '1' and cell.get('parent') == '1'
                  and not cell.get('id').startswith(('lane-', 'page-'))]
    first_y = min(rect(cell)['y'] for cell in node_cells)
    map_y = lambda y: 95 + HEADER + 30 + (y - first_y) * VERTICAL_SCALE
    nodes, edges, labels = [], [], []
    # Some source-page headings were manually narrowed and moved above the
    # canvas. Give every sheet the same unclipped title/subtitle baseline.
    title_box = rect(cells['page-title'])
    title_box.update(x=30, y=15, w=float(graph.get('pageWidth')) - 610, h=34)
    write_rect(cells['page-title'], title_box)
    subtitle_box = rect(cells['page-subtitle'])
    subtitle_box.update(x=30, y=53, w=float(graph.get('pageWidth')) - 60, h=24)
    write_rect(cells['page-subtitle'], subtitle_box)
    cells['page-legend'].set('value', 'Filled circle = start; double circle = end.\nRounded box = activity; diamond = decision; bar = fork/join.')
    for cell in node_cells:
        style, old = styles(cell), rect(cell)
        kind = ('end' if style.get('shape') == 'endState' else 'start' if 'ellipse' in style
                else 'decision' if 'rhombus' in style else 'bar' if not cell.get('value') else 'action')
        rows = wrap(cell.get('value', ''), old['w'] * .64 if kind == 'decision' else old['w'] - 16)
        height = max(old['h'] * VERTICAL_SCALE, len(rows) * LEADING + 12) if cell.get('value') else old['h'] * VERTICAL_SCALE
        if kind in ('start', 'end'):
            height = old['w']
        center_y = map_y(old['y'] + old['h'] / 2)
        box = {**old, 'y': center_y - height / 2, 'h': height}
        write_rect(cell, box)
        plain = cell.get('value', '')
        if plain:
            cell.set('value', '<div style="line-height:14px">' + '<br>'.join(html.escape(row) for row in rows) + '</div>')
            set_style(cell, html=1, spacing=5)
        nodes.append({**box, 'id': cell.get('id'), 'kind': kind, 'text': plain, 'rows': rows, 'style': style})
    by_id = {node['id']: node for node in nodes}
    for cell in root:
        if cell.get('edge') != '1':
            continue
        style = styles(cell)
        source, target = by_id[cell.get('source')], by_id[cell.get('target')]
        first = boundary(source, float(style['exitX']), float(style['exitY']))
        last = boundary(target, float(style['entryX']), float(style['entryY']))
        geometry = cell.find('mxGeometry')
        controls = geometry.findall('Array/mxPoint')
        points = [(float(point.get('x')), map_y(float(point.get('y')))) for point in controls]
        # Original anchors have four-decimal precision. Align tiny rounding
        # differences and the resized start/end circles with their adjacent wire.
        if points:
            if float(style['exitY']) in (0, 1):
                points[0] = (first[0], points[0][1])
            else:
                points[0] = (points[0][0], first[1])
            if float(style['entryY']) in (0, 1):
                points[-1] = (last[0], points[-1][1])
            else:
                points[-1] = (points[-1][0], last[1])
        for element, point in zip(controls, points):
            element.set('x', str(point[0]))
            element.set('y', str(point[1]))
        set_style(cell, exitPerimeter=0, entryPerimeter=0,
                  exitX=(first[0] - source['x']) / source['w'], exitY=(first[1] - source['y']) / source['h'],
                  entryX=(last[0] - target['x']) / target['w'], entryY=(last[1] - target['y']) / target['h'])
        label_cell = cells.get(cell.get('id') + '-label')
        edges.append({'id': cell.get('id'), 'source': source['id'], 'target': target['id'],
                      'points': [first, *points, last], 'label': label_cell.get('value', '') if label_cell is not None else '', 'cell': label_cell})
    for edge in edges:
        if not edge['label']:
            continue
        box = label_position(edge, nodes, edges, labels)
        edge['label_box'] = box
        labels.append(box)
        geometry = edge['cell'].find('mxGeometry')
        geometry.set('x', '-1')
        geometry.set('y', '0')
        geometry.set('width', str(box['w']))
        geometry.set('height', str(box['h']))
        offset = geometry.find('mxPoint')
        if offset is None:
            offset = ET.SubElement(geometry, 'mxPoint', {'as': 'offset'})
        offset.set('x', str(box['x'] - edge['points'][0][0]))
        offset.set('y', str(box['y'] - edge['points'][0][1]))
        set_style(edge['cell'], align='left', spacing=0)
    height = math.ceil(max(node['y'] + node['h'] for node in nodes) + 70)
    graph.set('pageHeight', str(height))
    for label in labels:
        assert 0 <= label['x'] and label['x'] + label['w'] <= float(graph.get('pageWidth'))
        assert 0 <= label['y'] and label['y'] + label['h'] <= height
    lanes = []
    for lane_id in ('lane-role', 'lane-system', 'lane-collab'):
        cell = cells[lane_id]
        box = rect(cell)
        box['h'] = height - box['y'] - 25
        write_rect(cell, box)
        set_style(cell, startSize=HEADER)
        lanes.append({**box, 'id': lane_id, 'text': cell.get('value'), 'style': styles(cell)})
    system = lanes[1]
    cells['lane-system'].set('value', '')
    title_rows = wrap(TITLE, system['w'] - 84, 13, True)
    assert ' '.join(title_rows) == TITLE and len(title_rows) * 15 <= HEADER - 16
    title_cell = ET.SubElement(root, 'mxCell', {'id': 'system-title',
        'value': '<div style="line-height:15px"><b>' + '<br>'.join(html.escape(row) for row in title_rows) + '</b></div>',
        'style': 'text;html=1;whiteSpace=wrap;fontFamily=Arial;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;fillColor=none;strokeColor=none;',
        'vertex': '1', 'parent': '1'})
    ET.SubElement(title_cell, 'mxGeometry', {'x': str(system['x'] + 70), 'y': str(system['y'] + 8),
                  'width': str(system['w'] - 84), 'height': str(HEADER - 16), 'as': 'geometry'})
    logo64 = base64.b64encode(LOGO.read_bytes()).decode('ascii')
    logo_cell = ET.SubElement(root, 'mxCell', {'id': 'system-logo', 'value': '',
        'style': 'shape=image;imageAspect=1;aspect=fixed;image=data:image/png,' + logo64 + ';', 'vertex': '1', 'parent': '1'})
    ET.SubElement(logo_cell, 'mxGeometry', {'x': str(system['x'] + 14), 'y': str(system['y'] + (HEADER - 44) / 2),
                  'width': '44', 'height': '44', 'as': 'geometry'})
    for index, node in enumerate(nodes):
        assert node['y'] >= 95 + HEADER + 15, 'Activity overlaps its lane header.'
        assert all(not overlap(node, other) for other in nodes[index + 1:]), 'Activity boxes overlap.'
        assert all(font().getlength(row) / SCALE <= node['w'] - 12 for row in node['rows']), 'Activity text overflows.'
        for edge in edges:
            if node['id'] not in (edge['source'], edge['target']):
                assert all(not segment_hit(a, b, node) for a, b in zip(edge['points'], edge['points'][1:])), 'Connector hits activity ' + node['id']
    assert len(nodes) == len(node_cells)
    for old_lane, lane_data in zip(('lane-role', 'lane-system', 'lane-collab'), lanes):
        old_box = rect(original.find(f'mxGraphModel/root/mxCell[@id="{old_lane}"]'))
        assert old_box['x'] == lane_data['x'] and old_box['w'] == lane_data['w'], 'Column position or width changed.'
    for node in nodes:
        old_node = original.find(f'mxGraphModel/root/mxCell[@id="{node["id"]}"]')
        assert old_node.get('value', '') == node['text']
        assert rect(old_node)['x'] == node['x'] and rect(old_node)['w'] == node['w']
    return page, {'id': page.get('id'), 'role': ROLES[page.get('id')], 'width': int(graph.get('pageWidth')),
                  'height': height, 'old_height': int(original.find('mxGraphModel').get('pageHeight')),
                  'lanes': lanes, 'nodes': nodes, 'edges': edges, 'title_rows': title_rows,
                  'header_cells': [cells['page-title'], cells['page-subtitle'], cells['page-legend']], 'logo64': logo64}


def render(model):
    width, height = model['width'], model['height']
    canvas = Image.new('RGB', (width * SCALE, height * SCALE), '#ffffff')
    draw = ImageDraw.Draw(canvas)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
           '<title>' + html.escape(model['role'] + ' activity diagram') + '</title>',
           '<rect width="100%" height="100%" fill="#ffffff"/>']

    def text(box, rows, size=12, bold=False, color='#111827', align='center', leading=14):
        mid_y = box['y'] + box['h'] / 2
        for index, row in enumerate(rows):
            x = box['x'] + box['w'] / 2 if align == 'center' else box['x'] + 5
            y = mid_y + size * .36 + (index - (len(rows) - 1) / 2) * leading
            draw.text((x * SCALE, y * SCALE), row, font=font(size, bold), fill=color, anchor='ms' if align == 'center' else 'ls')
            svg.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{size}" fill="{color}" text-anchor="{"middle" if align == "center" else "start"}" font-weight="{700 if bold else 400}">{html.escape(row)}</text>')

    def box_shape(box, fill, stroke, radius=0, stroke_width=1.4):
        bounds = (box['x'] * SCALE, box['y'] * SCALE, (box['x'] + box['w']) * SCALE, (box['y'] + box['h']) * SCALE)
        draw.rounded_rectangle(bounds, radius=radius * SCALE, fill=fill, outline=stroke, width=round(stroke_width * SCALE))
        svg.append(f'<rect x="{box["x"]}" y="{box["y"]}" width="{box["w"]}" height="{box["h"]}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}"/>')

    def line(points, color='#374151', thickness=1.4):
        draw.line([(x * SCALE, y * SCALE) for x, y in points], fill=color, width=round(thickness * SCALE))
        svg.append('<polyline points="' + ' '.join(f'{x},{y}' for x, y in points) + f'" fill="none" stroke="{color}" stroke-width="{thickness}"/>')

    for lane in model['lanes']:
        box_shape(lane, '#ffffff', '#9ca3af', stroke_width=1)
        header_box = {**lane, 'h': HEADER}
        box_shape(header_box, '#f8fafc', '#9ca3af', stroke_width=1)
        if lane['id'] != 'lane-system':
            text(header_box, wrap(lane['text'], lane['w'] - 20, 13, True), 13, True, leading=15)
    system = model['lanes'][1]
    text({'x': system['x'] + 70, 'y': system['y'] + 8, 'w': system['w'] - 84, 'h': HEADER - 16}, model['title_rows'], 13, True, leading=15)
    with Image.open(LOGO) as logo:
        thumb = logo.convert('RGBA').resize((44 * SCALE, 44 * SCALE), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (round((system['x'] + 14) * SCALE), round((system['y'] + (HEADER - 44) / 2) * SCALE)), thumb)
    svg.append(f'<image x="{system["x"] + 14}" y="{system["y"] + (HEADER - 44) / 2}" width="44" height="44" href="data:image/png;base64,{model["logo64"]}"/>')
    for cell in model['header_cells']:
        style, bounds = styles(cell), rect(cell)
        size = int(style.get('fontSize', 12))
        if cell.get('id') == 'page-legend':
            box_shape(bounds, '#ffffff', '#9ca3af', stroke_width=1)
        text(bounds, wrap(cell.get('value', ''), bounds['w'] - 16, size, style.get('fontStyle') == '1'), size,
             style.get('fontStyle') == '1', style.get('fontColor', '#111827'), 'left', size + 3)
    for edge_index, edge in enumerate(model['edges']):
        points = [point for index, point in enumerate(edge['points']) if index == 0 or point != edge['points'][index - 1]]
        # Match the editable connector's jumpStyle=arc. Crossings are bridges,
        # not implied joins between unrelated branches.
        for a, b in zip(points, points[1:]):
            crossings = []
            if abs(a[1] - b[1]) < .05:
                for previous in model['edges'][:edge_index]:
                    for c, d in zip(previous['points'], previous['points'][1:]):
                        if (abs(c[0] - d[0]) < .05 and min(a[0], b[0]) + 5 < c[0] < max(a[0], b[0]) - 5
                                and min(c[1], d[1]) + 5 < a[1] < max(c[1], d[1]) - 5):
                            crossings.append(c[0])
            direction = 1 if b[0] > a[0] else -1
            cursor = a
            for crossing in sorted(set(crossings), reverse=direction < 0):
                before, after = (crossing - direction * 4, a[1]), (crossing + direction * 4, a[1])
                line([cursor, before])
                arc_bounds = ((crossing - 4) * SCALE, (a[1] - 4) * SCALE, (crossing + 4) * SCALE, (a[1] + 4) * SCALE)
                draw.arc(arc_bounds, 180, 360, fill='#ffffff', width=round(4.5 * SCALE))
                draw.arc(arc_bounds, 180, 360, fill='#374151', width=round(1.4 * SCALE))
                arc = f'M{before[0]} {before[1]} A4 4 0 0 {1 if direction > 0 else 0} {after[0]} {after[1]}'
                svg.append(f'<path d="{arc}" fill="none" stroke="#ffffff" stroke-width="4.5"/>')
                svg.append(f'<path d="{arc}" fill="none" stroke="#374151" stroke-width="1.4"/>')
                cursor = after
            line([cursor, b])
        a, b = points[-2:]
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        dx, dy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        tip = [b, (b[0] - dx * 7 + dy * 3, b[1] - dy * 7 - dx * 3), (b[0] - dx * 7 - dy * 3, b[1] - dy * 7 + dx * 3)]
        draw.polygon([(x * SCALE, y * SCALE) for x, y in tip], fill='#374151')
        svg.append('<polygon points="' + ' '.join(f'{x},{y}' for x, y in tip) + '" fill="#374151"/>')
    for node in model['nodes']:
        x, y, w, h = (node[key] for key in ('x', 'y', 'w', 'h'))
        if node['kind'] in ('start', 'end'):
            for radius, fill in ([(w / 2, '#111827')] if node['kind'] == 'start' else [(w / 2, '#111827'), (w / 2 - 2, '#ffffff'), (w / 2 - 6, '#111827')]):
                cx, cy = x + w / 2, y + h / 2
                draw.ellipse(((cx - radius) * SCALE, (cy - radius) * SCALE, (cx + radius) * SCALE, (cy + radius) * SCALE), fill=fill)
                svg.append(f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="{fill}"/>')
        elif node['kind'] == 'decision':
            points = [(x + w / 2, y), (x + w, y + h / 2), (x + w / 2, y + h), (x, y + h / 2)]
            draw.polygon([(px * SCALE, py * SCALE) for px, py in points], fill='#ffffff')
            draw.line([(px * SCALE, py * SCALE) for px, py in points + points[:1]], fill='#111827', width=3)
            svg.append('<polygon points="' + ' '.join(f'{px},{py}' for px, py in points) + '" fill="#ffffff" stroke="#111827" stroke-width="1.5"/>')
        else:
            box_shape(node, '#111827' if node['kind'] == 'bar' else '#ffffff', '#111827' if node['kind'] == 'bar' else '#374151', 0 if node['kind'] == 'bar' else 6)
        if node['text']:
            text(node, node['rows'])
    for edge in model['edges']:
        if edge['label']:
            text(edge['label_box'], [edge['label']], 11, True, align='left')
    svg.append('</svg>')
    (OUT / (model['id'] + '.svg')).write_text('\n'.join(svg) + '\n', encoding='utf-8')
    canvas.save(OUT / (model['id'] + '.png'))
    # A readable top-of-sheet preview shows the updated title and first decisions.
    canvas.crop((0, 0, width * SCALE, min(height, 980) * SCALE)).save(OUT / (model['id'] + '-header-preview.png'))
    canvas.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    original_bytes = SOURCE.read_bytes()
    source = ET.fromstring(original_bytes)
    output = ET.Element('mxfile', {'host': 'app.diagrams.net', 'type': 'device', 'compressed': 'false', 'pages': '4'})
    models = []
    for sheet_index, sheet_id in enumerate(ROLES, start=1):
        page = source.find(f'diagram[@id="{sheet_id}"]')
        assert page is not None, 'Missing source role sheet: ' + sheet_id
        cleaned, model = clean_page(page)
        cleaned.set('name', f'{sheet_index:02d} - {ROLES[sheet_id]}')
        output.append(cleaned)
        models.append(model)
        render(model)
        print(f'{model["role"]}: {model["old_height"]} -> {model["height"]} px; {len(model["nodes"])} activities, {len(model["edges"])} connections')
    ET.indent(output, space='  ')
    target = OUT / 'IPAWCUS-Role-Activity-Diagrams-clean.drawio'
    ET.ElementTree(output).write(target, encoding='UTF-8', xml_declaration=True)
    # Verify the final editable artifact independently of preview geometry.
    saved = ET.parse(target).getroot()
    assert len(saved.findall('diagram')) == 4
    for sheet in saved.findall('diagram'):
        saved_cells = {cell.get('id'): cell for cell in sheet.find('mxGraphModel/root')}
        source_cells = {cell.get('id'): cell for cell in source.find(f'diagram[@id="{sheet.get("id")}"]/mxGraphModel/root')}
        assert {(cell.get('id'), cell.get('source'), cell.get('target')) for cell in saved_cells.values() if cell.get('edge') == '1'} == {
            (cell.get('id'), cell.get('source'), cell.get('target')) for cell in source_cells.values() if cell.get('edge') == '1'}
        rich_title = ET.fromstring(saved_cells['system-title'].get('value').replace('<br>', '\n'))
        bold_title = rich_title.find('b')
        assert bold_title is not None and ' '.join(''.join(bold_title.itertext()).split()) == TITLE
        assert 'image=data:image/png,' in saved_cells['system-logo'].get('style')
        for cell_id, cell in source_cells.items():
            if cell.get('vertex') == '1' and cell.get('parent') == '1' and not cell_id.startswith(('lane-', 'page-')):
                cleaned_cell = saved_cells[cell_id]
                new_value = cleaned_cell.get('value', '')
                if cell.get('value'):
                    new_value = ''.join(ET.fromstring(new_value.replace('<br>', '\n')).itertext())
                assert ' '.join(new_value.split()) == ' '.join(cell.get('value', '').split())
                assert (rect(cleaned_cell)['x'], rect(cleaned_cell)['w']) == (rect(cell)['x'], rect(cell)['w'])
    assert SOURCE.read_bytes() == original_bytes, 'Original diagram must remain untouched.'
    validation = {'source': str(SOURCE), 'source_sha256': hashlib.sha256(original_bytes).hexdigest(), 'source_preserved': True,
                  'sheets': 4, 'updated_system_title': TITLE, 'entire_system_title_bold': True, 'logo_embedded': True,
                  'vertical_scale': VERTICAL_SCALE, 'process_text_leading_px': LEADING, 'column_positions_and_gaps_unchanged': True,
                  'workflow_content_and_connections_preserved': True, 'figure_intersections': 0, 'connector_figure_intersections': 0,
                  'branch_label_intersections': 0, 'application_modified': False, 'database_modified': False,
                  'editable_artifact_checked': True, 'headings_unclipped': True,
                  'crossings_shown_as_bridges': True,
                  'pages': [{'role': model['role'], 'height_before': model['old_height'], 'height_after': model['height'],
                             'activities': len(model['nodes']), 'connections': len(model['edges'])} for model in models]}
    (OUT / 'validation.json').write_text(json.dumps(validation, indent=2) + '\n', encoding='utf-8')
    (OUT / 'README.md').write_text('# Four cleaned role-activity sheets\n\nEditable copy: IPAWCUS-Role-Activity-Diagrams-clean.drawio.\n\n'
        'PNG and SVG previews are provided for Pet Owner, Admin, Veterinarian and Super Admin. Header-preview images show the top of each sheet at readable resolution.\n\n'
        'The original five-sheet document in docs is unchanged. Horizontal column positions, widths and gaps, workflow labels, activities and branch connections are preserved. '
        'The four sheets are compressed vertically, process text uses 14 px leading, and the full system title is bold beside the existing clinic logo.\n\n'
        'These are presentation revisions of the existing activity file, not a new audit or revision of its older workflow content.\n', encoding='utf-8')
    print('Saved ' + str(target))


if __name__ == '__main__':
    main()
