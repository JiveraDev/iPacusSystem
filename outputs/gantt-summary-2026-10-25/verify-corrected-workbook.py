"""Verify the actual XLSX styles and formulas without synthesizing colors."""
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
import json
import re
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
FILE = OUT / 'iPawcus_Gantt_Auto_Color_2026.xlsx'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
GREEN = 'FF70AD47'
YELLOW = 'FFFFD966'

with ZipFile(FILE) as archive:
    assert archive.testzip() is None
    for name in archive.namelist():
        if name.endswith('.xml'):
            ET.fromstring(archive.read(name))
    styles = ET.fromstring(archive.read('xl/styles.xml'))
    fills = styles.find('s:fills', NS)
    xfs = styles.find('s:cellXfs', NS)
    calc = ET.fromstring(archive.read('xl/workbook.xml')).find('s:calcPr', NS)
    assert calc.attrib['calcMode'] == 'auto'
    report = {'file': str(FILE), 'archive_and_xml_valid': True, 'automatic_calculation': True, 'sheets': []}
    for number, name in [(1, 'Summary Gantt'), (2, 'Increment Gantt')]:
        sheet = ET.fromstring(archive.read(f'xl/worksheets/sheet{number}.xml'))
        counts = Counter()
        date_formulas = []
        for cell in sheet.findall('s:sheetData/s:row/s:c', NS):
            style = xfs[int(cell.attrib.get('s', '0'))]
            pattern = fills[int(style.attrib['fillId'])].find('s:patternFill', NS)
            fg = pattern.find('s:fgColor', NS) if pattern is not None else None
            if fg is not None:
                counts[fg.attrib.get('rgb', 'other')] += 1
            if re.fullmatch(r'C\d+', cell.attrib['r']):
                formula = cell.find('s:f', NS)
                if formula is not None:
                    date_formulas.append(formula.text)
        assert counts[GREEN] > 0 and counts[YELLOW] > 0
        assert all('CHAR(10)' not in f and ' days' not in f for f in date_formulas)
        expected_rows = 30 if number == 1 else 24
        assert len(date_formulas) == expected_rows
        rules = sheet.findall('s:conditionalFormatting/s:cfRule', NS)
        assert rules and all(r.attrib['type'] == 'expression' for r in rules)
        assert all('ISNUMBER' in r.find('s:formula', NS).text for r in rules)
        for cell in sheet.findall('s:sheetData/s:row/s:c', NS):
            formula = cell.find('s:f', NS)
            if formula is not None and 'DATEVALUE' in formula.text:
                assert '$C' in formula.text
        report['sheets'].append({
            'name': name, 'saved_green_cells': counts[GREEN],
            'saved_yellow_cells': counts[YELLOW],
            'date_only_formulas': len(date_formulas),
        })
    edit = ET.fromstring(archive.read('xl/worksheets/sheet3.xml'))
    assert not edit.findall('.//s:f', NS), 'The editable schedule should not contain duration formulas.'
    report['no_edit_schedule_duration_formulas'] = True
    for dxf in styles.find('s:dxfs', NS):
        pattern = dxf.find('s:fill/s:patternFill', NS)
        if pattern is not None:
            assert pattern.find('s:bgColor', NS) is not None, 'Excel conditional fills require their background color.'
    report['passed'] = True
    (OUT / 'saved-color-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
