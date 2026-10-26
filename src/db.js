// postgresql pool + tenant setter
// src/db.js
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // e.g. postgres://admin:secret@localhost:5432/search
  // optional: ssl, max, idleTimeoutMillis …
});

/**
 * Acquire a client, set the tenant, run userFn, then release.
 * Guarantees that every query sees the correct `app.current_tenant`.
 */
export async function withTenant(tenantId, userFn) {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL app.current_tenant = $1", [tenantId]);
    const result = await userFn(client);
    return result;
  } finally {
    client.release();
  }
}
