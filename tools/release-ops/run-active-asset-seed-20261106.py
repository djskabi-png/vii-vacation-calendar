import os,tomllib,subprocess
from pathlib import Path
config=tomllib.loads(Path('C:/Users/Adir/AppData/Roaming/xdg.config/.wrangler/config/default.toml').read_text(encoding='utf-8'))
env=os.environ.copy();env['VII_ASSET_STORAGE_AUTH']=env.get('CLOUDFLARE_API_TOKEN') or config['oauth_token']
r=subprocess.run(['node','--experimental-strip-types','tools/release-ops/seed-active-assets-20261106.mjs'],env=env,timeout=260,capture_output=True,text=True)
Path('.qa-output/phase14-seed.stdout.log').write_text(r.stdout,encoding='utf-8');Path('.qa-output/phase14-seed.stderr.log').write_text(r.stderr,encoding='utf-8');print(r.stdout);print('exitCode='+str(r.returncode));raise SystemExit(r.returncode)


