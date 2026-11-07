"""Prepare only missing, fingerprinted public assets from a qualified archive."""
import argparse
import hashlib
import json
import pathlib
import re
import tarfile


def prepare(archive, expected_sha, current, output, source, build):
    archive, current, output = map(pathlib.Path, (archive, current, output))
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected_sha:
        raise ValueError('qualified_archive_digest_mismatch')
    if not re.fullmatch(r'[a-f0-9]{40}', source) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', build):
        raise ValueError('source_build_identity_invalid')
    if output.exists():
        raise ValueError('existing_plan_requires_reconciliation')
    assets, inventory = [], []
    with tarfile.open(archive, 'r:gz') as packed:
        members = packed.getmembers()
        for entry in members:
            parts = pathlib.PurePosixPath(entry.name).parts
            if not parts or parts[0] != 'dist' or '..' in parts or '\\' in entry.name or not (entry.isfile() or entry.isdir()):
                raise ValueError('archive_entry_invalid')
        for entry in members:
            if not entry.isfile() or not entry.name.startswith('dist/client/'):
                continue
            path = entry.name[len('dist/client/'):]
            body = packed.extractfile(entry).read()
            sha = hashlib.sha256(body).hexdigest()
            inventory.append({'path': path, 'bytes': len(body), 'sha256': sha})
            if not re.fullmatch(r'assets/[a-zA-Z0-9_.-]+-[a-zA-Z0-9_-]{8,}\.(?:js|css|woff2?|ttf|png|jpe?g|webp|avif|svg|ico)', path):
                continue
            present = current / path
            if present.exists():
                if hashlib.sha256(present.read_bytes()).hexdigest() != sha:
                    raise ValueError('immutable_asset_collision:' + path)
                continue
            if len(body) > 8 * 1024 * 1024:
                raise ValueError('asset_too_large:' + path)
            assets.append(({'path': '/' + path, 'bytes': len(body), 'sha256': sha, 'file': pathlib.Path(path).name}, body))
    output.mkdir(parents=True)
    for row, body in assets:
        (output / row['file']).write_bytes(body)
    plan = {'schemaVersion': 1, 'archiveSha256': expected_sha, 'source': source, 'buildId': build,
            'publicInventory': inventory, 'assets': [row for row, _ in assets]}
    (output / 'plan.json').write_text(json.dumps(plan, indent=2), encoding='utf8')
    return plan


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ['archive', 'expected-sha', 'current', 'output', 'source', 'build']:
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    result = prepare(args.archive, args.expected_sha, args.current, args.output, args.source, args.build)
    print(json.dumps({'publicInventory': len(result['publicInventory']), 'missingHashedAssets': len(result['assets'])}))
