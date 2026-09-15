from pathlib import Path
import base64, io, shutil, tarfile, hashlib

root = Path(__file__).resolve().parents[1]
release = root / '.release-v2'


def checked_text(path, expected_hash, expected_len):
    text = path.read_text(encoding='utf-8').strip()
    if len(text) != expected_len:
        raise SystemExit(f'{path.name}: length {len(text)} != {expected_len}')
    digest = hashlib.sha256(text.encode()).hexdigest()
    if digest != expected_hash:
        raise SystemExit(f'{path.name}: SHA-256 mismatch: {digest}')
    return text

part1 = checked_text(release/'part01', 'a127986123ad851864bfe5e5806538170d7577f836a35c8472c1bc424f20cb1c', 7000)
part2 = checked_text(release/'part02', 'd7b6957d79400c385c5d5c45a9d8a45f68b00f5fde5d419945bd7a5900cc2d45', 7000)
part4 = checked_text(release/'part04', '329e2f5417775af727f881b4fb08a6e26f8021893551c7eb2516925c983aefaa', 7000)
part5 = checked_text(release/'part05', '24495aa387a079b7521cfbc571332508faa0f818b6edc269a1b0603b4a3bc0ad', 5896)

chunk_hashes = [
    '6c2ea647b4df00b7842fe1168196d8dc2241a2ffa6f1713877c4d026c87617c1',
    '544eee14fd8f58bfff218e7feb88e51356c07f6eb6deb157ce847d04ba534208',
    'd5b159695b277db907528216844125576e6d642577a62aaa95286ebe6ac0af41',
    'c39896b428035861254d9014a8a126d30e63e167b6fe69be204ae7fa76468289',
    'df8f4674f256de9204bfb53218ae877d6ad59aabd5688cc2eaafd637a391bc2a',
    '39f795b0206754a1a7e40310413d7fc52f73b2f80af187c03fb5b0d36bf9fe11',
    '8ccca1b1441bc1f43efc9e42a653de14eb3c2993e65617e049f7a11748c043ec',
]
chunks = [checked_text(release/f'p3_{i}', h, 1000) for i, h in enumerate(chunk_hashes)]
part3 = ''.join(chunks)
part3_hash = hashlib.sha256(part3.encode()).hexdigest()
if part3_hash != '10f2dbe100ab5ec6de31a3551932dc91e623894b1d33882585e8f2d5d6db6074':
    raise SystemExit(f'part03 assembled SHA-256 mismatch: {part3_hash}')

encoded = part1 + part2 + part3 + part4 + part5
if len(encoded) != 33896:
    raise SystemExit(f'Encoded payload length mismatch: {len(encoded)}')
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

shutil.rmtree(release)
Path(__file__).unlink(missing_ok=True)
print('HP67 Studio V2 payload applied and verified.')
