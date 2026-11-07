import { createError, getRequestHeader } from "h3";
import { createDbClient } from "../../utils/db";
import { cronAuthorized, refreshInvestmentPrices } from "../../../utils/refreshInvestmentPrices.js";

/** Weekday 8:00pm Eastern is 01:00 UTC. Hobby may start the call any time during that hour. */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const secret = String(config.cronSecret || process.env.CRON_SECRET || "");
  if (!cronAuthorized(getRequestHeader(event, "authorization"), secret)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized." });
  }

  const apiKey = String(config.alphaVantageApiKey || process.env.ALPHA_VANTAGE_API_KEY || "");
  const client = createDbClient();
  try {
    await client.connect();
    const result = await refreshInvestmentPrices(client, apiKey, (line) => console.log(line));
    if (result.ran && result.symbols > 0 && result.skipped.length === result.symbols) {
      throw createError({ statusCode: 502, statusMessage: "Alpha Vantage returned no closing prices." });
    }
    return result;
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error(error?.message || error);
    throw createError({ statusCode: 500, statusMessage: "Could not refresh investment prices." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
