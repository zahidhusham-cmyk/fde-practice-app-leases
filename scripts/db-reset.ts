import { pool } from "../src/db/pool";
import { resetDatabase } from "../src/db/reset";

const target = (process.env.DATABASE_URL ?? "default local database").replace(/:[^:@/]+@/, ":***@");

try {
  await resetDatabase();
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM properties)::int AS properties,
            (SELECT COUNT(*) FROM units)::int AS units,
            (SELECT COUNT(*) FROM leases)::int AS leases,
            (SELECT COUNT(*) FROM invoices)::int AS invoices,
            (SELECT COUNT(*) FROM payments)::int AS payments`,
  );
  console.log(`Reset ${target}:`, rows[0]);
} catch (err) {
  console.error("db:reset failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
