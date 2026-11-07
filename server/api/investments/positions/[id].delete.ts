import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { deletePosition } from "../../../utils/investmentPositions";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid holding." });
  }
  const client = createDbClient();
  try {
    await client.connect();
    await deletePosition(client, userId, id);
    return { success: true };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "Could not remove the holding." });
  } finally {
    await client.end().catch(() => undefined);
  }
});