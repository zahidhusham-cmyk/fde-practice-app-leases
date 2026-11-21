import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool";
import { seed } from "./seed";

const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../db/schema.sql");

/** Drop and recreate every table, then load the seed data. */
export async function resetDatabase(): Promise<void> {
  const schema = await readFile(schemaPath, "utf8");
  await pool.query("SET client_min_messages TO warning");
  await pool.query(schema);
  await seed();
}
