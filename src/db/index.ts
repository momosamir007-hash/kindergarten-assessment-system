import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || "pglite://./data/db";

const globalForDb = globalThis as typeof globalThis & {
  __arenaDb?: NodePgDatabase;
  __arenaPglite?: PGlite;
  __arenaPool?: Pool;
};

function ensureSchema(client: PGlite) {
  try {
    const sqlPath = path.join(process.cwd(), "drizzle", "0000_windy_rhodey.sql");
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, "utf-8");
      client.exec(sql).catch(() => {});
    }
    client.exec("ALTER TABLE students ADD COLUMN IF NOT EXISTS photo text;").catch(() => {});
  } catch {}
}

function initDb(): NodePgDatabase {
  if (globalForDb.__arenaDb) {
    return globalForDb.__arenaDb;
  }

  // Use embedded PGlite for local development or if specified
  const isPglite =
    databaseUrl.startsWith("pglite://") ||
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    !databaseUrl.startsWith("postgres");

  if (isPglite) {
    const dataDir = path.join(process.cwd(), "data", "db");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const client = globalForDb.__arenaPglite ?? new PGlite(dataDir);
    globalForDb.__arenaPglite = client;
    ensureSchema(client);
    const dbInstance = drizzlePglite(client) as unknown as NodePgDatabase;
    globalForDb.__arenaDb = dbInstance;
    return dbInstance;
  }

  const poolInstance =
    globalForDb.__arenaPool ??
    new Pool({
      connectionString: databaseUrl,
    });
  globalForDb.__arenaPool = poolInstance;
  const dbInstance = drizzlePg(poolInstance);
  globalForDb.__arenaDb = dbInstance;
  return dbInstance;
}

export const db: NodePgDatabase = initDb();
export const pool = globalForDb.__arenaPool;
