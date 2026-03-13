import { createError } from "h3";
import { Client } from "pg";

export default defineEventHandler(async () => {
  const {
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DB_SSL,
  } = process.env;

  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    throw createError({
      statusCode: 500,
      statusMessage: "Database environment variables are not set.",
    });
  }

  const client = new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");

    return {
      connected: true,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Database connection failed.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
