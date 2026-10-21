import type { D1Database } from "../../types/cloudflare-runtime";

type D1Statement = ReturnType<D1Database["prepare"]>;
type D1RunResult = Awaited<ReturnType<D1Statement["run"]>>;

type AwsDatabaseEnv = {
  DB: D1Database;
  VII_AWS_DB_ENDPOINT?: string;
  VII_AWS_DB_TOKEN?: string;
  VII_AWS_DB_MODE?: string;
};

type RemoteOperation = {
  sql: string;
  params: unknown[];
  method: "all" | "first" | "raw" | "run";
};

type RemoteResult = {
  success: boolean;
  results?: Record<string, unknown>[];
  raw?: unknown[][];
  meta?: Record<string, unknown>;
  error?: string;
};

function sqlAliases(sql: string) {
  const aliases = new Map<string, string>();
  for (const match of sql.matchAll(/\bAS\s+(?:"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))/gi)) {
    const alias = match[1] || match[2];
    if (alias) aliases.set(alias.toLowerCase(), alias);
  }
  return aliases;
}

/** PostgreSQL folds unquoted aliases to lower case while D1 preserves the
 * spelling written in SQL. Restore the D1 row contract at the adapter edge so
 * application code does not silently lose camelCase fields after migration. */
function restoreD1AliasCasing(sql: string, rows: Record<string, unknown>[] | undefined) {
  if (!rows?.length) return rows || [];
  const aliases = sqlAliases(sql);
  if (![...aliases].some(([lower, alias]) => lower !== alias)) return rows;
  return rows.map((source) => {
    const row = { ...source };
    for (const [lower, alias] of aliases) {
      if (lower === alias || Object.hasOwn(row, alias) || !Object.hasOwn(row, lower)) continue;
      row[alias] = row[lower];
      delete row[lower];
    }
    return row;
  });
}

function configured(env: AwsDatabaseEnv) {
  return env.VII_AWS_DB_MODE === "primary" && Boolean(env.VII_AWS_DB_ENDPOINT && env.VII_AWS_DB_TOKEN);
}

function retryableRead(operations: RemoteOperation[], transactional: boolean) {
  return !transactional && operations.length > 0 && operations.every(operation =>
    operation.method !== "run" && /^\s*SELECT\b/i.test(operation.sql));
}

async function bridgeRequest(env: AwsDatabaseEnv, operations: RemoteOperation[], transactional: boolean) {
  return fetch(env.VII_AWS_DB_ENDPOINT!, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.VII_AWS_DB_TOKEN}`,
      "content-type": "application/json",
      "x-vii-database-mode": "primary",
    },
    body: JSON.stringify({ operations, transactional }),
  });
}

async function callBridge(env: AwsDatabaseEnv, operations: RemoteOperation[], transactional = false) {
  if (!configured(env)) throw new Error("VII AWS database bridge is not configured");
  const canRetry = retryableRead(operations, transactional);
  let response: Response;
  try {
    response = await bridgeRequest(env, operations, transactional);
  } catch (error) {
    if (!canRetry) throw error;
    response = await bridgeRequest(env, operations, transactional);
  }
  if (canRetry && (response.status === 429 || response.status >= 500)) {
    await response.body?.cancel();
    response = await bridgeRequest(env, operations, transactional);
  }
  const payload = await response.json().catch(() => ({})) as {
    ok?: boolean;
    results?: RemoteResult[];
    error?: string;
  };
  if (!response.ok || !payload.ok || !payload.results) {
    throw new Error(payload.error || `VII AWS database bridge returned ${response.status}`);
  }
  return payload.results;
}

class RemotePreparedStatement {
  private params: unknown[] = [];
  private readonly env: AwsDatabaseEnv;
  readonly statement: string;

  constructor(env: AwsDatabaseEnv, statement: string) {
    this.env = env;
    this.statement = statement;
  }

  bind(...values: unknown[]) {
    const next = new RemotePreparedStatement(this.env, this.statement);
    next.params = values;
    return next;
  }

  operation(method: RemoteOperation["method"]): RemoteOperation {
    return { sql: this.statement, params: this.params, method };
  }

  async all<T = Record<string, unknown>>() {
    const [result] = await callBridge(this.env, [this.operation("all")]);
    return { success: result.success,
      results: restoreD1AliasCasing(this.statement, result.results) as T[], meta: result.meta || {} };
  }

  async first<T = Record<string, unknown>>(column?: string) {
    const [result] = await callBridge(this.env, [this.operation("first")]);
    const row = restoreD1AliasCasing(this.statement, result.results)[0] as T | undefined;
    if (!row) return null;
    return column ? (row as Record<string, unknown>)[column] as T : row;
  }

  async raw<T extends unknown[] = unknown[]>() {
    const [result] = await callBridge(this.env, [this.operation("raw")]);
    return (result.raw || []) as T[];
  }

  async run<T = D1RunResult>() {
    const [result] = await callBridge(this.env, [this.operation("run")]);
    return { success: result.success,
      results: restoreD1AliasCasing(this.statement, result.results), meta: result.meta || {} } as T;
  }
}

class RemoteD1Database {
  private readonly env: AwsDatabaseEnv;

  constructor(env: AwsDatabaseEnv) {
    this.env = env;
  }

  prepare(sql: string) {
    return new RemotePreparedStatement(this.env, sql) as unknown as D1Statement;
  }

  async batch<T = unknown>(statements: D1Statement[]) {
    const operations = statements.map(statement => {
      const remote = statement as unknown as RemotePreparedStatement;
      if (typeof remote.operation !== "function") throw new Error("VII AWS database batch received a foreign statement");
      // D1 batch is used for both reads and writes. PostgreSQL returns an empty
      // row set for writes, so requesting rows preserves both contracts.
      return remote.operation("all");
    });
    const results = await callBridge(this.env, operations, true);
    return results.map((result, index) => ({ ...result,
      results: restoreD1AliasCasing(operations[index].sql, result.results),
    })) as unknown as Awaited<ReturnType<D1Database["batch"]>>;
  }

  async exec(sql: string) {
    const [result] = await callBridge(this.env, [{ sql, params: [], method: "run" }], true);
    return { count: Number(result.meta?.changes || 0), duration: Number(result.meta?.duration || 0) };
  }

  withSession() {
    return this as unknown as ReturnType<D1Database["withSession"]>;
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error("VII AWS database dump is intentionally unavailable");
  }
}

const adapters = new WeakMap<object, D1Database>();

export function databaseForEnv(env: AwsDatabaseEnv): D1Database {
  if (!configured(env)) return env.DB;
  const existing = adapters.get(env as object);
  if (existing) return existing;
  const adapter = new RemoteD1Database(env) as unknown as D1Database;
  adapters.set(env as object, adapter);
  return adapter;
}

export function databaseForRuntimeEnv(env: Partial<AwsDatabaseEnv>): D1Database | undefined {
  if (!env.DB) return undefined;
  return databaseForEnv(env as AwsDatabaseEnv);
}

export function activateAwsDatabase(env: AwsDatabaseEnv) {
  if (!configured(env)) return false;
  const adapter = databaseForEnv(env);
  try {
    env.DB = adapter;
  } catch {
    // Some runtimes expose bindings through a read-only facade. The worker's
    // own calls still use the adapter and the health route detects a mismatch.
  }
  return env.DB === adapter;
}

export function awsDatabaseMode(env: Pick<AwsDatabaseEnv, "VII_AWS_DB_MODE">) {
  return env.VII_AWS_DB_MODE === "primary" ? "aws-aurora" : "cloudflare-d1";
}

