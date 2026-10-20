#!/usr/bin/env python3
"""Copy the bounded VII D1 dataset into Aurora through the private bridge.

Secrets are read from files supplied on the command line and are never logged.
Only table names, counts and deterministic content digests are emitted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


def request_json(url: str, token: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
    if urllib.parse.urlsplit(url).netloc == "vii.spaplus.co" and body is None:
        config = "\n".join([
            "silent",
            "show-error",
            "fail-with-body",
            f"url = {json.dumps(url)}",
            f"header = {json.dumps(f'Authorization: Bearer {token}')}",
            'header = "Accept: application/json"',
            'user-agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36"',
        ])
        config_path = ""
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".curl", delete=False) as config_file:
                config_file.write(config)
                config_path = config_file.name
            result = subprocess.run(
                ["curl.exe", "--config", config_path],
                check=False,
                capture_output=True,
                timeout=120,
            )
        finally:
            if config_path:
                try:
                    os.remove(config_path)
                except FileNotFoundError:
                    pass
        if result.returncode != 0:
            detail = result.stdout[:500].decode("utf-8", "replace") or result.stderr[:500].decode("utf-8", "replace")
            raise RuntimeError(f"curl HTTP failure from {urllib.parse.urlsplit(url).netloc}: {detail}")
        payload = json.loads(result.stdout)
        if not isinstance(payload, dict) or not payload.get("ok"):
            raise RuntimeError(f"Unsuccessful response from {urllib.parse.urlsplit(url).netloc}")
        return payload

    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read(500).decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {error.code} from {urllib.parse.urlsplit(url).netloc}: {detail}") from error
    if not isinstance(payload, dict) or not payload.get("ok"):
        raise RuntimeError(f"Unsuccessful response from {urllib.parse.urlsplit(url).netloc}")
    return payload


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def postgres_type(sqlite_type: str) -> str:
    normalized = sqlite_type.upper().strip()
    if "INT" in normalized:
        return "BIGINT"
    if any(marker in normalized for marker in ("REAL", "FLOA", "DOUB")):
        return "DOUBLE PRECISION"
    if "BLOB" in normalized:
        return "BYTEA"
    if "BOOL" in normalized:
        return "BOOLEAN"
    return "TEXT"


def postgres_default(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", text):
        return text
    if re.fullmatch(r"'(?:''|[^'])*'", text):
        return text
    if text.upper() in {"CURRENT_TIMESTAMP", "CURRENT_DATE", "CURRENT_TIME", "TRUE", "FALSE", "NULL"}:
        return text.upper()
    if "strftime" in text.lower() or "unixepoch" in text.lower():
        return "(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT)"
    return None


def table_create_sql(table: dict[str, Any]) -> str:
    columns = sorted(table["columns"], key=lambda column: int(column.get("cid", 0)))
    definitions: list[str] = []
    primary = sorted((column for column in columns if int(column.get("pk", 0)) > 0), key=lambda column: int(column["pk"]))
    for column in columns:
        if int(column.get("hidden", 0)) != 0:
            continue
        fragment = f"{quote_identifier(str(column['name']))} {postgres_type(str(column.get('type') or 'TEXT'))}"
        if int(column.get("notnull", 0)):
            fragment += " NOT NULL"
        default = postgres_default(column.get("dflt_value"))
        if default is not None:
            fragment += f" DEFAULT {default}"
        definitions.append(fragment)
    if primary:
        definitions.append("PRIMARY KEY (" + ", ".join(quote_identifier(str(column["name"])) for column in primary) + ")")
    return f"CREATE TABLE {quote_identifier(table['name'])} (" + ", ".join(definitions) + ")"


def index_sql(table: dict[str, Any]) -> list[str]:
    statements: list[str] = []
    for index in table.get("indexes", []):
        if str(index.get("origin") or "") == "pk":
            continue
        columns = [
            str(column["name"])
            for column in sorted(index.get("columns", []), key=lambda column: int(column.get("seqno", 0)))
            if int(column.get("key", 1)) == 1 and int(column.get("cid", -1)) >= 0 and column.get("name")
        ]
        if not columns:
            continue
        unique = "UNIQUE " if int(index.get("unique", 0)) else ""
        name = str(index.get("name") or f"idx_{table['name']}_{'_'.join(columns)}")
        statements.append(
            f"CREATE {unique}INDEX {quote_identifier(name)} ON {quote_identifier(table['name'])} "
            + "(" + ", ".join(quote_identifier(column) for column in columns) + ")"
        )
    return statements


def foreign_key_sql(table: dict[str, Any]) -> list[str]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for foreign_key in table.get("foreignKeys", []):
        grouped.setdefault(int(foreign_key.get("id", 0)), []).append(foreign_key)
    statements: list[str] = []
    allowed_actions = {"NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"}
    for key_id, entries in sorted(grouped.items()):
        ordered = sorted(entries, key=lambda entry: int(entry.get("seq", 0)))
        referenced_table = str(ordered[0].get("table") or "")
        source_columns = [str(entry.get("from") or "") for entry in ordered]
        target_columns = [str(entry.get("to") or "") for entry in ordered]
        if not referenced_table or not all(source_columns) or not all(target_columns):
            raise RuntimeError(f"Invalid foreign key metadata for {table['name']} id {key_id}")
        update_action = str(ordered[0].get("on_update") or "NO ACTION").upper()
        delete_action = str(ordered[0].get("on_delete") or "NO ACTION").upper()
        if update_action not in allowed_actions or delete_action not in allowed_actions:
            raise RuntimeError(f"Unsupported foreign key action for {table['name']} id {key_id}")
        constraint = f"fk_{table['name']}_{key_id}"
        statements.append(
            f"ALTER TABLE {quote_identifier(str(table['name']))} ADD CONSTRAINT {quote_identifier(constraint)} "
            + "FOREIGN KEY (" + ", ".join(quote_identifier(column) for column in source_columns) + ") "
            + f"REFERENCES {quote_identifier(referenced_table)} ("
            + ", ".join(quote_identifier(column) for column in target_columns) + ") "
            + f"ON UPDATE {update_action} ON DELETE {delete_action}"
        )
    return statements


def primary_columns(table: dict[str, Any]) -> list[str]:
    return [
        str(column["name"])
        for column in sorted(table["columns"], key=lambda column: int(column.get("pk", 0)))
        if int(column.get("pk", 0)) > 0
    ]


def visible_columns(table: dict[str, Any]) -> list[str]:
    return [
        str(column["name"])
        for column in sorted(table["columns"], key=lambda column: int(column.get("cid", 0)))
        if int(column.get("hidden", 0)) == 0
    ]


class MultisetDigest:
    def __init__(self, table: dict[str, Any]) -> None:
        self.count = 0
        self.total = 0
        self.xor = 0
        self.types = {str(column["name"]): postgres_type(str(column.get("type") or "TEXT")) for column in table["columns"]}

    def add(self, rows: list[dict[str, Any]]) -> None:
        for row in rows:
            normalized: dict[str, Any] = {}
            for key, value in row.items():
                kind = self.types.get(key, "TEXT")
                if value is None:
                    normalized[key] = None
                elif kind == "BIGINT":
                    normalized[key] = str(value)
                elif kind == "DOUBLE PRECISION":
                    normalized[key] = float(value)
                elif kind == "BOOLEAN":
                    normalized[key] = bool(value) if isinstance(value, (bool, int)) else str(value).lower() in {"1", "t", "true"}
                else:
                    normalized[key] = value
            encoded = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
            number = int.from_bytes(hashlib.sha256(encoded).digest(), "big")
            self.total = (self.total + number) % (1 << 256)
            self.xor ^= number
            self.count += 1

    def hexdigest(self) -> str:
        material = f"{self.count}:{self.total:064x}:{self.xor:064x}".encode("ascii")
        return hashlib.sha256(material).hexdigest()


def bridge(endpoint: str, token: str, operations: list[dict[str, Any]], transactional: bool = False) -> list[dict[str, Any]]:
    payload = request_json(endpoint, token, body={"operations": operations, "transactional": transactional})
    results = payload.get("results")
    if not isinstance(results, list) or any(not result.get("success") for result in results):
        raise RuntimeError("Aurora bridge operation failed")
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="https://vii.spaplus.co/api/admin/aws-migration-export")
    parser.add_argument("--source-token-file", required=True)
    parser.add_argument("--bridge", required=True)
    parser.add_argument("--bridge-token-file", required=True)
    parser.add_argument("--page-size", type=int, default=50)
    arguments = parser.parse_args()

    source_token = Path(arguments.source_token_file).read_text(encoding="utf-8").strip()
    bridge_token = Path(arguments.bridge_token_file).read_text(encoding="utf-8").strip()
    if not source_token or not bridge_token:
        raise RuntimeError("Token file is empty")

    manifest = request_json(arguments.source, source_token)
    tables = manifest.get("tables")
    if manifest.get("version") != 1 or not isinstance(tables, list) or len(tables) != 28:
        raise RuntimeError("Unexpected migration manifest")

    bridge(arguments.bridge, bridge_token, [{"sql": "DROP SCHEMA public CASCADE", "params": [], "method": "run"}])
    bridge(arguments.bridge, bridge_token, [{"sql": "CREATE SCHEMA public", "params": [], "method": "run"}])
    bridge(arguments.bridge, bridge_token, [
        {"sql": "GRANT ALL ON SCHEMA public TO vii_owner", "params": [], "method": "run"},
        {"sql": "GRANT ALL ON SCHEMA public TO public", "params": [], "method": "run"},
    ], transactional=True)

    for table in tables:
        bridge(arguments.bridge, bridge_token, [{"sql": table_create_sql(table), "params": [], "method": "run"}])

    evidence: list[dict[str, Any]] = []
    for table in tables:
        name = str(table["name"])
        columns = visible_columns(table)
        expected_count = int(table.get("count", 0))
        source_digest = MultisetDigest(table)
        offset = 0
        while offset < expected_count:
            query = urllib.parse.urlencode({"table": name, "offset": offset, "limit": arguments.page_size})
            page = request_json(f"{arguments.source}?{query}", source_token)
            rows = page.get("rows")
            if not isinstance(rows, list) or not rows:
                raise RuntimeError(f"Source pagination ended early for {name}")
            source_digest.add(rows)
            placeholders = "(" + ", ".join("?" for _ in columns) + ")"
            sql = (
                f"INSERT INTO {quote_identifier(name)} (" + ", ".join(quote_identifier(column) for column in columns) + ") VALUES "
                + ", ".join(placeholders for _ in rows)
            )
            params = [row.get(column) for row in rows for column in columns]
            bridge(arguments.bridge, bridge_token, [{"sql": sql, "params": params, "method": "run"}], transactional=True)
            offset += len(rows)
        if offset != expected_count:
            raise RuntimeError(f"Source count changed during export for {name}: expected {expected_count}, copied {offset}")

        for statement in index_sql(table):
            bridge(arguments.bridge, bridge_token, [{"sql": statement, "params": [], "method": "run"}])

        key_columns = primary_columns(table) or columns
        order = ", ".join(quote_identifier(column) for column in key_columns)
        target_digest = MultisetDigest(table)
        target_count = 0
        while target_count < expected_count:
            sql = f"SELECT * FROM {quote_identifier(name)} ORDER BY {order} LIMIT ? OFFSET ?"
            [result] = bridge(arguments.bridge, bridge_token, [{"sql": sql, "params": [arguments.page_size, target_count], "method": "all"}])
            rows = result.get("results") or []
            if not rows:
                break
            target_digest.add(rows)
            target_count += len(rows)
        matched = target_count == expected_count and target_digest.hexdigest() == source_digest.hexdigest()
        evidence.append({"table": name, "count": target_count, "sha256": target_digest.hexdigest(), "matched": matched})
        print(json.dumps(evidence[-1], separators=(",", ":")), flush=True)
        if not matched:
            raise RuntimeError(f"Reconciliation failed for {name}")

    foreign_key_count = 0
    for table in tables:
        for statement in foreign_key_sql(table):
            bridge(arguments.bridge, bridge_token, [{"sql": statement, "params": [], "method": "run"}])
            foreign_key_count += 1

    print(json.dumps({"ok": True, "tables": len(evidence), "rows": sum(item["count"] for item in evidence), "foreignKeys": foreign_key_count}, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")), file=sys.stderr)
        raise SystemExit(1)
