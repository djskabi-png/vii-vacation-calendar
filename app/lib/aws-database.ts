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

function configured(env: AwsDatabaseEnv) {
  return env.VII_AWS_DB_MODE === "primary" && Boolean(env.VII_AWS_DB_ENDPOINT && env.VII_AWS_DB_TOKEN);
}

async function callBridge(env: AwsDatabaseEnv, operations: RemoteOperation[], transactional = false) {
  if (!configured(env)) throw new Error("VII AWS database bridge is not configured");
  const response = await fetch(env.VII_AWS_DB_ENDPOINT!, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.VII_AWS_DB_TOKEN}`,
      "content-type": "application/json",
      "x-vii-database-mode": "primary",
    },
    body: JSON.stringify({ operations, transactional }),
  });
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
    return { success: result.success, results: (result.results || []) as T[], meta: result.meta || {} };
  }

  async first<T = Record<string, unknown>>(column?: string) {
    const [result] = await callBridge(this.env, [this.operation("first")]);
    const row = result.results?.[0] as T | undefined;
    if (!row) return null;
    return column ? (row as Record<string, unknown>)[column] as T : row;
  }

  async raw<T extends unknown[] = unknown[]>() {
    const [result] = await callBridge(this.env, [this.operation("raw")]);
    return (result.raw || []) as T[];
  }

  async run<T = D1RunResult>() {
    const [result] = await callBridge(this.env, [this.operation("run")]);
    return { success: result.success, results: result.results || [], meta: result.meta || {} } as T;
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
    return await callBridge(this.env, operations, true) as unknown as Awaited<ReturnType<D1Database["batch"]>>;
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

