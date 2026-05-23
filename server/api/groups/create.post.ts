import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { backfillGroupIdForUser, getUserGroupMembership } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const groupName = String(body?.group_name ?? "").trim();
  const secondEmail = String(body?.second_user_email ?? "").trim().toLowerCase();

  if (!groupName || !secondEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: "Group name and second user email are required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const existingMembership = await getUserGroupMembership(client, userId);
    if (existingMembership?.group_id) {
      throw createError({
        statusCode: 400,
        statusMessage: "You are already in a group.",
      });
    }

    const secondUserResult = await client.query(
      `SELECT user_id
       FROM app_users
       WHERE email = $1`,
      [secondEmail],
    );

    const secondUserId = secondUserResult.rows[0]?.user_id;

    if (!secondUserId) {
      throw createError({
        statusCode: 404,
        statusMessage: "Second user not found.",
      });
    }

    const groupResult = await client.query(
      `INSERT INTO groups (group_name, created_by)
       VALUES ($1, $2)
       RETURNING group_id`,
      [groupName, userId],
    );

    const groupId = groupResult.rows[0]?.group_id;

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, $3), ($1, $4, $5)`,
      [groupId, userId, "owner", secondUserId, "member"],
    );

    // Backfill group_id on owner's existing records so linked members can see them
    await backfillGroupIdForUser(client, groupId, userId);

    return { success: true, group_id: groupId };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create group.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
