from pathlib import Path
import base64, io, shutil, tarfile, hashlib

root = Path(__file__).resolve().parents[1]
parts = sorted((root / '.release-v2').glob('part*'))
if len(parts) != 5:
    raise SystemExit(f'Expected 5 release parts, found {len(parts)}')
encoded = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
payload = base64.b64decode(encoded, validate=True)
digest = hashlib.sha256(payload).hexdigest()
expected = '96fb4795962a6e0744346a983b696a3a83c7286412e4f4b7ec509e1da38a64d7'
if digest != expected:
    raise SystemExit(f'Payload digest mismatch: {digest}')
with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
    names = set(archive.getnames())
    required = {'index.html','styles.css','app-v2.js','manifest.webmanifest','sw.js','README.md','scripts/validate.py'}
    missing = required - names
    if missing:
        raise SystemExit('Missing from payload: ' + ', '.join(sorted(missing)))
    archive.extractall(root)
shutil.rmtree(root / '.release-v2')
Path(__file__).unlink(missing_ok=True)
print('HP67 Studio V2 payload applied.')
