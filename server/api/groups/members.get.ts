import { createError } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupMembership } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const client = createDbClient();

  try {
    await client.connect();
    const membership = await getUserGroupMembership(client, userId);

    if (!membership?.group_id) {
      return { group_id: null, group_name: null, role: null, members: [] };
    }

    const membersResult = await client.query(
      `SELECT gm.user_id, au.email, au.display_name, gm.role, gm.created_at
       FROM group_members gm
       JOIN app_users au ON au.user_id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at ASC`,
      [membership.group_id],
    );

    return {
      group_id: membership.group_id,
      group_name: membership.group_name,
      role: membership.role,
      members: membersResult.rows,
    };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load group members.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
