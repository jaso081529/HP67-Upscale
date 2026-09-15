from html.parser import HTMLParser
from pathlib import Path
import re, sys, json

ROOT = Path(__file__).resolve().parents[1]
required = [
    ROOT/'index.html', ROOT/'styles.css', ROOT/'app-v2.js', ROOT/'README.md',
    ROOT/'manifest.webmanifest', ROOT/'sw.js', ROOT/'.github/workflows/pages.yml'
]
errors=[]
for p in required:
    if not p.exists() or p.stat().st_size == 0:
        errors.append(f'Missing or empty: {p.relative_to(ROOT)}')

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set(); self.scripts=[]; self.links=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a:
            if a['id'] in self.ids: errors.append(f'Duplicate HTML id: {a["id"]}')
            self.ids.add(a['id'])
        if tag=='script' and a.get('src'): self.scripts.append(a['src'])
        if tag=='link' and a.get('href'): self.links.append(a['href'])

html=(ROOT/'index.html').read_text(encoding='utf-8')
js=(ROOT/'app-v2.js').read_text(encoding='utf-8')
css=(ROOT/'styles.css').read_text(encoding='utf-8')
p=Parser(); p.feed(html)
for local in ['styles.css','app-v2.js','manifest.webmanifest']:
    if local not in html: errors.append(f'{local} is not referenced by index.html')
js_ids=set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'\)", js))
missing=sorted(js_ids-p.ids)
if missing: errors.append('IDs used by app-v2.js but missing in HTML: '+', '.join(missing))
critical=['dropzone','fileInput','jobList','beforeCanvas','afterCanvas','compareSlider','runAuto','runBatch','undoBtn','redoBtn','exportCurrent','exportZip','histogram','mode','rotateLeft','applyCrop','removeBgNow','brushSize','applyOutline','applyPrintSize']
for cid in critical:
    if cid not in p.ids: errors.append('Critical UI id missing: '+cid)
core=['processCurrent','processAll','processJob','applyGlobal','applyDenoise','applySharpen','applyClarity','upscaleCanvas','edgeMask','removeBackground','blurBackground','applyBrush','rotateArbitrary','cropCanvas','resizeCanvas','canvasToBlob','addPngDpi','pushHistory','undo','redo']
for name in core:
    if name not in js: errors.append('Core function missing: '+name)
for feature in ['jszip@3.10.2','heic2any@0.0.4','pako@1.0.11','utif@3.1.0/UTIF.js']:
    if feature not in html: errors.append('Pinned dependency missing: '+feature)
for fallback in ['unpkg.com/jszip@3.10.2','unpkg.com/heic2any@0.0.4','unpkg.com/pako@1.0.11','unpkg.com/utif@3.1.0/UTIF.js']:
    if fallback not in html: errors.append('CDN fallback missing: '+fallback)
if 'http://' in html: errors.append('Insecure http:// resource found in index.html')
if '<!doctype html>' not in html.lower(): errors.append('HTML doctype missing')
if ':root' not in css: errors.append('CSS root variables missing')
try:
    manifest=json.loads((ROOT/'manifest.webmanifest').read_text(encoding='utf-8'))
    if manifest.get('display')!='standalone': errors.append('PWA manifest display must be standalone')
except Exception as e:
    errors.append('Invalid manifest.webmanifest: '+str(e))
if errors:
    print('VALIDATION FAILED'); [print(' -',e) for e in errors]; sys.exit(1)
print('VALIDATION OK')
print(f'HTML IDs: {len(p.ids)} | JS-bound IDs: {len(js_ids)} | scripts: {len(p.scripts)}')
