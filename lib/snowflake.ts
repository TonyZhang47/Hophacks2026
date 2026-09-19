import "server-only";
import { env, isSnowflakeConfigured } from "@/lib/env";

/**
 * One long-lived Snowflake connection for the life of the process.
 * Only ever imported from server modules used by Route Handlers.
 */
type Binds = (string | number | boolean | null)[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let conn: any = null;
let connecting: Promise<unknown> | null = null;

async function connect() {
  if (conn) return conn;
  if (connecting) return connecting;
  connecting = (async () => {
    const snowflake = (await import("snowflake-sdk")).default;
    snowflake.configure({ logLevel: "ERROR" });
    const s = env.snowflake;
    const opts: Record<string, unknown> = {
      account: s.account,
      username: s.username,
      warehouse: s.warehouse || undefined,
      database: s.database || undefined,
      schema: s.schema || undefined,
      role: s.role || undefined,
      clientSessionKeepAlive: true,
    };
    if (s.privateKeyB64) {
      opts.authenticator = "SNOWFLAKE_JWT";
      opts.privateKey = Buffer.from(s.privateKeyB64, "base64").toString("utf8");
    } else {
      opts.password = s.password;
    }
    const c = snowflake.createConnection(opts);
    await new Promise<void>((resolve, reject) =>
      c.connect((err: Error | undefined) => (err ? reject(err) : resolve())),
    );
    conn = c;
    return c;
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export async function query<T = Record<string, unknown>>(sqlText: string, binds: Binds = []): Promise<T[]> {
  if (!isSnowflakeConfigured()) throw new Error("Snowflake not configured");
  const c = await connect();
  return new Promise<T[]>((resolve, reject) => {
    c.execute({
      sqlText,
      binds,
      complete: (err: Error | undefined, _stmt: unknown, rows: T[] | undefined) => {
        if (err) return reject(err);
        resolve(rows ?? []);
      },
    });
  });
}

export function fqn(table: string) {
  const s = env.snowflake;
  return s.database ? `${s.database}.${s.schema}.${table}` : table;
}
