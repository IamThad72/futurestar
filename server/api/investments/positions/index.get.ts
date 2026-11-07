import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { listPositions } from "../../../utils/investmentPositions";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const client = createDbClient();
  try {
    await client.connect();
    const positions = await listPositions(client, userId);
    return { currency: "USD", positions };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "Could not load investment holdings." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
