import base64
import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

REGION = "il-central-1"
ACCOUNT = "551626543793"
FUNCTION = "vii-production-database-bridge"
ROLE_ARN = f"arn:aws:iam::{ACCOUNT}:role/OrganizationAccountAccessRole"
SOURCE_DIR = Path(__file__).resolve().parent


def build_package():
    temporary = Path(tempfile.mkdtemp(prefix="vii-aurora-bridge-"))
    package_dir = temporary / "package"
    package_dir.mkdir()
    shutil.copy2(SOURCE_DIR / "index.cjs", package_dir / "index.cjs")
    shutil.copy2(SOURCE_DIR / "package.json", package_dir / "package.json")
    npm = shutil.which("npm")
    pnpm = shutil.which("pnpm")
    if npm:
        install = [npm, "install", "--omit=dev", "--ignore-scripts", "--no-package-lock"]
    elif pnpm:
        install = [pnpm, "install", "--ignore-workspace", "--prod", "--ignore-scripts", "--lockfile=false", "--config.node-linker=hoisted"]
    else:
        raise RuntimeError("node_package_manager_unavailable")
    subprocess.run(install, cwd=package_dir, check=True)
    archive = temporary / "vii-aurora-bridge.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        for path in sorted(package_dir.rglob("*")):
            if path.is_file():
                output.write(path, path.relative_to(package_dir).as_posix())
    return temporary, archive


def main():
    import boto3

    credentials = boto3.client("sts").assume_role(
        RoleArn=ROLE_ARN,
        RoleSessionName="vii-aurora-bridge-code-repair-20261029",
        DurationSeconds=900,
    )["Credentials"]
    session = boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
        region_name=REGION,
    )
    functions = session.client("lambda")
    temporary, archive = build_package()
    try:
        result = functions.update_function_code(
            FunctionName=FUNCTION,
            ZipFile=archive.read_bytes(),
            Publish=True,
        )
        functions.get_waiter("function_updated_v2").wait(FunctionName=FUNCTION)
        current = functions.get_function(FunctionName=FUNCTION)["Configuration"]
        print(json.dumps({
            "ok": True,
            "account": ACCOUNT,
            "region": REGION,
            "function": FUNCTION,
            "version": result.get("Version"),
            "codeSha256": current.get("CodeSha256"),
            "lastModified": current.get("LastModified"),
            "packageSha256": base64.b64encode(__import__("hashlib").sha256(archive.read_bytes()).digest()).decode(),
            "configurationChanged": False,
        }))
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


if __name__ == "__main__":
    main()
