"""Verify the exact VII route and build; repair only its quota fail-open flag."""
import argparse, json, os, subprocess, tomllib, urllib.request, urllib.error, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ACCOUNT = "45b2f6dcf2cfe44204d2c470cbe682d9"
ZONE = "f1d778343394ef4f56bbcb089793a22a"
PATTERN = "vii.spaplus.co/*"
SCRIPT = "vii-edge-delivery"
parser = argparse.ArgumentParser()
parser.add_argument("--repair-fail-open", action="store_true")
parser.add_argument("--receipt")
parser.add_argument("--suspended-origin-build", help="Verify intentional pending-build admission suspension against this observed current origin build")
args = parser.parse_args()
receipt = None
if args.repair_fail_open:
    if not args.receipt:
        parser.error("repair requires a new receipt path")
    receipt = (ROOT / args.receipt).resolve()
    if not receipt.is_relative_to((ROOT / ".qa-output").resolve()) or receipt.exists():
        parser.error("receipt must be a new file inside .qa-output")
config = tomllib.loads((ROOT / "services/vii-edge-delivery/wrangler.toml").read_text())
expected = config["vars"]["EXPECTED_BUILD"]
if args.suspended_origin_build and not expected.startswith("pending-"):
    parser.error("suspension verification requires an explicit pending expected-build sentinel")
auth_path = Path(os.environ["APPDATA"]) / "xdg.config/.wrangler/config/default.toml"
token = tomllib.loads(auth_path.read_text()).get("oauth_token")
if not token:
    raise SystemExit("Existing Wrangler authorization unavailable; no credential is printed.")

def api(path, payload=None):
    request = urllib.request.Request("https://api.cloudflare.com/client/v4" + path,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        data=None if payload is None else json.dumps(payload).encode(), method="GET" if payload is None else "PUT")
    with urllib.request.urlopen(request, timeout=15) as response:
        value = json.load(response)
    if value.get("success") is not True:
        raise RuntimeError("Cloudflare rejected the route operation")
    return value["result"]

path = "/zones/" + ZONE + "/workers/routes"
before = api(path)
matching = [row for row in before if row.get("pattern") == PATTERN]
if len(matching) != 1 or matching[0].get("script") != SCRIPT:
    raise SystemExit("Exact VII route missing or owned by a different worker; nothing was changed.")
route = matching[0]
report = {"operation": "vii-edge-route-guard-" + str(uuid.uuid4()), "phase": "read", "route": route, "expectedBuild": expected}
if not route.get("request_limit_fail_open") and args.repair_fail_open:
    report["phase"] = "write_reserved"
    receipt.write_text(json.dumps(report, indent=2))
    try:
        route = api(path + "/" + route["id"], {"pattern": PATTERN, "script": SCRIPT, "request_limit_fail_open": True})
    except Exception:
        report["phase"] = "write_uncertain_do_not_retry"
        receipt.write_text(json.dumps(report, indent=2))
        raise

after = api(path)
others_before = sorted([r for r in before if r["id"] != route["id"]], key=lambda r:r["id"])
others_after = sorted([r for r in after if r["id"] != route["id"]], key=lambda r:r["id"])
assert others_after == others_before, "Unrelated routes changed during verification"
verified = [r for r in after if r.get("pattern") == PATTERN]
assert len(verified) == 1 and verified[0].get("script") == SCRIPT and verified[0].get("request_limit_fail_open") is True, "VII quota fail-open not verified"
probe = "https://vii.spaplus.co/?release=edge-guard-" + uuid.uuid4().hex
report.update({"phase":"route_verified_before_public_probe", "route":verified[0], "otherRoutesUnchanged":True})
if receipt:
    receipt.write_text(json.dumps(report, indent=2))
# Node uses the same supported public HTTP path as the project probes. The
# host's urllib proxy route can be denied before reaching the actual origin.
code = "const r=await fetch(process.argv[1],{headers:{Accept:'text/html'},signal:AbortSignal.timeout(20000)});await r.arrayBuffer();console.log(JSON.stringify({status:r.status,build:r.headers.get('x-vii-cache-build'),edge:r.headers.get('x-vii-edge-delivery'),skip:r.headers.get('x-vii-edge-cache-skip')}));"
observed = json.loads(subprocess.run(["node","--input-type=module","-e",code,probe],cwd=ROOT,capture_output=True,text=True,timeout=25,check=True).stdout)
status, build, edge = observed["status"], observed["build"], observed["edge"]
if args.suspended_origin_build:
    assert status == 200 and build == args.suspended_origin_build and observed.get("skip") == "build_mismatch" and edge != "HIT", "Intentional cache suspension not verified"
else:
    assert status == 200 and build == expected and edge == "MISS", "Fresh public response does not match the active edge build"
report.update({"phase":"passed", "route":verified[0], "otherRoutesUnchanged":True, "otherRouteCount":len(others_after), "publicStatus":status, "publicBuild":build, "edge":edge})
if args.suspended_origin_build:
    report.update({"mode":"admission_suspended", "skip":observed.get("skip")})
if receipt:
    receipt.write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
