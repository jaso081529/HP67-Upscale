from html.parser import HTMLParser
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]
required = [ROOT/'index.html', ROOT/'styles.css', ROOT/'app.js', ROOT/'README.md']
errors = []
for p in required:
    if not p.exists() or p.stat().st_size == 0:
        errors.append(f'Missing or empty: {p.relative_to(ROOT)}')

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set(); self.scripts=[]; self.links=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        if tag=='script' and a.get('src'): self.scripts.append(a['src'])
        if tag=='link' and a.get('href'): self.links.append(a['href'])

html = (ROOT/'index.html').read_text(encoding='utf-8')
js = (ROOT/'app.js').read_text(encoding='utf-8')
css = (ROOT/'styles.css').read_text(encoding='utf-8')
p=Parser(); p.feed(html)

for local in ['styles.css','app.js']:
    if local not in html:
        errors.append(f'{local} is not referenced by index.html')

js_ids=set(re.findall(r'\$\("#([A-Za-z0-9_-]+)"\)', js))
missing_ids=sorted(js_ids-p.ids)
if missing_ids:
    errors.append('IDs used by app.js but missing in HTML: ' + ', '.join(missing_ids))

critical=['dropzone','fileInput','pickFiles','jobList','beforeCanvas','afterCanvas','compareSlider','runAuto','exportCurrent','exportZip']
for cid in critical:
    if cid not in p.ids:
        errors.append(f'Critical UI id missing: {cid}')

if 'http://' in html:
    errors.append('Insecure http:// resource found in index.html')
if '<!doctype html>' not in html.lower():
    errors.append('HTML doctype missing')
if ':root' not in css:
    errors.append('CSS root variables missing')
if 'processCurrent' not in js or 'applyColorPipeline' not in js or 'upscaleCanvas' not in js:
    errors.append('Core image-processing functions missing')

if errors:
    print('VALIDATION FAILED')
    for e in errors: print(' -', e)
    sys.exit(1)
print('VALIDATION OK')
print(f'HTML IDs: {len(p.ids)} | JS-bound IDs: {len(js_ids)} | scripts: {len(p.scripts)}')
