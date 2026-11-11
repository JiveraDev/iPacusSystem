"""Read original Office files without modifying them or requiring Office."""
import json
import re
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
BACKUP = Path(r'D:\recovery back up-20261012T091915Z-1-002\recovery back up')
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}


def workbook(path):
    with ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = []
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).find('s:sheets', NS):
            target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            root = ET.fromstring(z.read(target))
            rows = []
            for row in root.findall('s:sheetData/s:row', NS):
                cells = {}
                for cell in row:
                    address = cell.attrib['r']
                    col = re.match('[A-Z]+', address).group()
                    if len(col) > 1 or col > 'K':
                        continue
                    value = cell.find('s:v', NS)
                    if cell.attrib.get('t') == 'inlineStr':
                        text = ''.join(cell.find('s:is', NS).itertext())
                    elif value is None:
                        continue
                    elif cell.attrib.get('t') == 's':
                        text = strings[int(value.text)]
                    else:
                        text = value.text
                    cells[col] = text
                if cells:
                    rows.append({'row': int(row.attrib['r']), 'cells': cells})
            sheets.append({'name': sheet.attrib['name'], 'rows': rows})
    return {'path': str(path), 'sheets': sheets}


def document(path):
    with ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    paragraphs = [''.join(p.itertext()) for p in root.findall('.//w:p', NS)]
    # Only text nodes: itertext also includes fields, but is useful for discovery.
    paragraphs = [''.join(t.text or '' for t in p.findall('.//w:t', NS)) for p in root.findall('.//w:p', NS)]
    hits = set()
    for i, p in enumerate(paragraphs):
        if re.search(r'gantt|one month|six weeks|increment [1-6]|2026|2025|deployment', p, re.I):
            hits.update(range(max(0, i-1), min(len(paragraphs), i+2)))
    return {'path': str(path), 'paragraph_count': len(paragraphs),
            'excerpts': [{'paragraph': i, 'text': paragraphs[i]} for i in sorted(hits)]}


def main():
    names = ['timeline - Phase 1.xlsx', 'timeline - PHASE 2.xlsx',
             'iPawcus_Revised_Gantt.xlsx', 'iPawcus_whole_gantt_July10_updated.xlsx',
             'Book1_actual_development_update_until_Aug15.xlsx', 'ito na to.xlsx']
    books = [workbook(BACKUP / name) for name in names]
    books += [workbook(p) for p in (OUT.parent / 'gantt_update_2026-09-21').glob('*.xlsx')]
    (OUT / 'source_workbooks.json').write_text(json.dumps(books, indent=2), encoding='utf-8')
    papers = [document(BACKUP / name) for name in ['_iPawcus  8_25_2026.docx',
              '7-iPawcus-Rivera-C1-C3 (REVIEWED).docx', 'iPawcus C1-C3 w_ Appendix .docx',
              'iPawcus_Chapters_4_and_5_Revised.docx']]
    (OUT / 'paper_excerpts.json').write_text(json.dumps(papers, indent=2), encoding='utf-8')
    for b in books:
        print(Path(b['path']).name + ': ' + ', '.join(s['name'] + ' (' + str(len(s['rows'])) + ' rows)' for s in b['sheets']))
    for p in papers:
        print(Path(p['path']).name + ': ' + str(p['paragraph_count']) + ' paragraphs')


if __name__ == '__main__':
    main()
