from pathlib import Path
import base64, io, shutil, tarfile, hashlib

root = Path(__file__).resolve().parents[1]
parts = sorted((root / '.release-v2').glob('part*'))
if len(parts) != 5:
    raise SystemExit(f'Expected 5 release parts, found {len(parts)}')

expected_part_hashes = [
    'a127986123ad851864bfe5e5806538170d7577f836a35c8472c1bc424f20cb1c',
    'd7b6957d79400c385c5d5c45a9d8a45f68b00f5fde5d419945bd7a5900cc2d45',
    '10f2dbe100ab5ec6de31a3551932dc91e623894b1d33882585e8f2d5d6db6074',
    '329e2f5417775af727f881b4fb08a6e26f8021893551c7eb2516925c983aefaa',
    '24495aa387a079b7521cfbc571332508faa0f818b6edc269a1b0603b4a3bc0ad',
]
expected_lengths = [7000, 7000, 7000, 7000, 5896]

texts = []
for idx, (path, expected_hash, expected_len) in enumerate(zip(parts, expected_part_hashes, expected_lengths), 1):
    text = path.read_text(encoding='utf-8').strip()
    digest = hashlib.sha256(text.encode()).hexdigest()
    if digest != expected_hash:
        # Connector transfers are text-only. If exactly one character was inserted,
        # recover the original chunk only when its known SHA-256 matches exactly.
        if len(text) == expected_len + 1:
            repaired = None
            for pos in range(len(text)):
                candidate = text[:pos] + text[pos + 1:]
                if hashlib.sha256(candidate.encode()).hexdigest() == expected_hash:
                    repaired = candidate
                    print(f'Repaired one transfer character in part {idx} at offset {pos}.')
                    break
            if repaired is None:
                raise SystemExit(f'Part {idx} integrity check failed and could not be repaired.')
            text = repaired
        else:
            raise SystemExit(f'Part {idx} integrity check failed: len={len(text)}, expected={expected_len}.')
    texts.append(text)

encoded = ''.join(texts)
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
print('HP67 Studio V2 payload applied and verified.')
