import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupMembership } from "../../utils/group";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const body = await readBody(event);
  const targetUserId = body?.user_id != null ? Number(body.user_id) : NaN;

  if (!Number.isInteger(targetUserId) || targetUserId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: "Valid user_id is required.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const membership = await getUserGroupMembership(client, userId);

    if (!membership?.group_id) {
      throw createError({
        statusCode: 404,
        statusMessage: "You are not in a group.",
      });
    }

    const targetMemberResult = await client.query(
      `SELECT role FROM group_members
       WHERE group_id = $1 AND user_id = $2`,
      [membership.group_id, targetUserId],
    );

    const targetMember = targetMemberResult.rows[0];

    if (!targetMember) {
      throw createError({
        statusCode: 404,
        statusMessage: "User is not in this group.",
      });
    }

    if (targetMember.role === "owner") {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot remove the group owner.",
      });
    }

    if (membership.role === "owner") {
      await client.query(
        `DELETE FROM group_members
         WHERE group_id = $1 AND user_id = $2`,
        [membership.group_id, targetUserId],
      );
      return { success: true };
    }

    if (targetUserId === userId) {
      await client.query(
        `DELETE FROM group_members
         WHERE group_id = $1 AND user_id = $2`,
        [membership.group_id, userId],
      );
      return { success: true };
    }

    throw createError({
      statusCode: 403,
      statusMessage: "Only group owners can remove other members.",
    });
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to remove group member.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
