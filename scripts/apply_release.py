from pathlib import Path
import base64, io, shutil, tarfile

root = Path(__file__).resolve().parents[1]
parts = sorted((root / '.release').glob('part*'))
if len(parts) != 10:
    raise SystemExit(f'Expected 10 release parts, found {len(parts)}')

# GitHub Actions' built-in token is not allowed to push workflow-file changes.
# Preserve the current deploy workflow, apply the verified app payload, then
# restore the workflow. It will be updated separately through the GitHub API.
pages_workflow = root / '.github/workflows/pages.yml'
preserved_pages = pages_workflow.read_bytes() if pages_workflow.exists() else None

encoded = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
payload = base64.b64decode(encoded, validate=True)
with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
    names = set(archive.getnames())
    required = {'app.js','index.html','styles.css','README.md','.github/workflows/pages.yml','scripts/validate.py'}
    missing = required - names
    if missing:
        raise SystemExit('Release payload missing: ' + ', '.join(sorted(missing)))
    archive.extractall(root)

if preserved_pages is not None:
    pages_workflow.write_bytes(preserved_pages)

shutil.rmtree(root / '.release')
# Keep apply-release.yml unchanged so the Actions token does not attempt a
# forbidden workflow-file deletion. It is removed separately after success.
Path(__file__).unlink(missing_ok=True)
print('HP67 reliability release applied; workflow preserved for separate update.')
