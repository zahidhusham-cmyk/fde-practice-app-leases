import pg from "pg";

// BIGINT (int8) comes back from pg as a string by default. Our money columns are
// integer cents, which fit safely in a JS number, so parse them as numbers.
pg.types.setTypeParser(20, (value: string) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new Error(`BIGINT value ${value} is too large for a JS number`);
  }
  return n;
});

// DATE (1082): keep as a 'YYYY-MM-DD' string so timezones never shift the day.
pg.types.setTypeParser(1082, (value: string) => value);

export const DEFAULT_DATABASE_URL = "postgres://leases:leases@localhost:5433/leases";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

/** Anything we can run a query on: the pool, or a client inside a transaction. */
export type Db = pg.Pool | pg.PoolClient;

/** Run fn inside BEGIN/COMMIT on a single client; ROLLBACK if it throws. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
