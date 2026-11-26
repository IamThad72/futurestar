import { createError, getRequestHeader } from "h3";
import { createDbClient } from "../../utils/db";
import { runAccountCleanup } from "../../utils/accountDeletion";
import { cronAuthorized } from "~/utils/refreshInvestmentPrices.js";

/**
 * Retries leftover sign-in and file deletes, and drops throttle rows older than a day.
 * Scheduled once a day from nuxt.config.ts. Hobby runs that job sometime during the hour.
 */
function cronSecret() {
  try {
    const config = useRuntimeConfig();
    if (config?.cronSecret) return String(config.cronSecret);
  } catch {
    // Unit tests call this handler without the Nuxt runtime.
  }
  return String(process.env.CRON_SECRET || "");
}

export default defineEventHandler(async (event) => {
  const secret = cronSecret();
  if (!cronAuthorized(getRequestHeader(event, "authorization"), secret)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    return await runAccountCleanup(client);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
    if (statusCode) throw error;
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    console.error("[cron/account-cleanup] failed", { code: code ?? null });
    throw createError({ statusCode: 500, statusMessage: "Could not finish account cleanup." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
