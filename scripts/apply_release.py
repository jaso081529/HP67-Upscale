from pathlib import Path
import base64, io, shutil, tarfile

root = Path(__file__).resolve().parents[1]
parts = sorted((root / '.release').glob('part*'))
if len(parts) != 10:
    raise SystemExit(f'Expected 10 release parts, found {len(parts)}')
encoded = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
payload = base64.b64decode(encoded, validate=True)
with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
    names = set(archive.getnames())
    required = {'app.js','index.html','styles.css','README.md','.github/workflows/pages.yml','scripts/validate.py'}
    missing = required - names
    if missing:
        raise SystemExit('Release payload missing: ' + ', '.join(sorted(missing)))
    archive.extractall(root)
shutil.rmtree(root / '.release')
(root / '.github/workflows/apply-release.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
print('HP67 reliability release applied and temporary payload removed.')
