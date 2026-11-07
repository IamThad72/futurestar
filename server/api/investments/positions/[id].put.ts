import { createError, readBody } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { updatePosition } from "../../../utils/investmentPositions";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid holding." });
  }
  const body = await readBody(event);
  const client = createDbClient();
  try {
    await client.connect();
    const position = await updatePosition(client, userId, id, body);
    return { position };
  } catch (error) {
    if (error?.statusCode) throw error;
    const duplicate = String(error?.code || "") === "23505";
    throw createError({
      statusCode: duplicate ? 409 : 500,
      statusMessage: duplicate ? "That symbol is already in this account." : "Could not save the holding.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
