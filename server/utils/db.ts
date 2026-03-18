import { Client } from "pg";

export const createDbClient = () => {
  const {
    DATABASE_URL,
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DB_SSL,
  } = process.env;

  if (DATABASE_URL) {
    const url = DATABASE_URL.trim();
    if (!url.includes("pooler.supabase.com") && !url.includes(".supabase.co")) {
      console.warn("[db] DATABASE_URL may be wrong - expected supabase host. Got:", url.slice(0, 60) + "...");
    }
    return new Client({
      connectionString: url,
      ssl: url.includes("supabase") ? { rejectUnauthorized: false } : false,
    });
  }

  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    throw new Error("Set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER in .env");
  }

  return new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
};
