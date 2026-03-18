/**
 * Validates required env vars at server startup.
 * Fails fast with a clear message if database config is missing.
 * Never logs or exposes connection strings.
 */
export default defineNitroPlugin(() => {
  const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER } = process.env;

  const hasDatabaseUrl = !!DATABASE_URL;
  const hasDbVars = !!(DB_HOST && DB_PORT && DB_NAME && DB_USER);

  if (!hasDatabaseUrl && !hasDbVars) {
    throw new Error(
      "Database config missing. Set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER in .env. See .env.example."
    );
  }
});
