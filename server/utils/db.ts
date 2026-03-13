import { Client } from "pg";

export const createDbClient = () => {
  const {
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DB_SSL,
  } = process.env;

  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    throw new Error("Database environment variables are not set.");
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
