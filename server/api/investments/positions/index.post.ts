import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { createPosition } from "../../../utils/investmentPositions";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const client = createDbClient();
  try {
    await client.connect();
    const position = await createPosition(client, userId, body);
    return { position };
  } catch (error) {
    if (error?.statusCode) throw error;
    const duplicate = String(error?.code || "") === "23505";
    throw createError({
      statusCode: duplicate ? 409 : 500,
      statusMessage: duplicate ? "That symbol is already in this account." : "Could not add the holding.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
