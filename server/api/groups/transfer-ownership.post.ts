import { createError, readBody } from "h3";
import { createDbClient } from "../../utils/db";
import { getSessionUserId } from "../../utils/auth";
import { getUserGroupMembership } from "../../utils/group";

/**
 * The signed-in owner hands the household to another member, then can leave.
 * A user id in the body is the new owner, never the account being deleted.
 */
export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const body = await readBody(event);
  const targetUserId = body?.user_id != null ? Number(body.user_id) : NaN;

  if (!Number.isInteger(targetUserId) || targetUserId < 1 || targetUserId === userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose another member to become the owner.",
    });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const membership = await getUserGroupMembership(client, userId);
    if (!membership?.group_id || membership.role !== "owner") {
      throw createError({
        statusCode: 403,
        statusMessage: "Only the household owner can transfer ownership.",
      });
    }

    const target = await client.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [membership.group_id, targetUserId],
    );
    if (!target.rows[0]) {
      throw createError({
        statusCode: 404,
        statusMessage: "That person is not in this household.",
      });
    }

    await client.query(`BEGIN`);
    try {
      await client.query(`UPDATE groups SET created_by = $1 WHERE group_id = $2`, [
        targetUserId,
        membership.group_id,
      ]);
      await client.query(
        `UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`,
        [membership.group_id, targetUserId],
      );
      await client.query(
        `UPDATE group_members SET role = 'member' WHERE group_id = $1 AND user_id = $2 AND role = 'owner'`,
        [membership.group_id, userId],
      );
      await client.query(`COMMIT`);
    } catch (error) {
      await client.query(`ROLLBACK`).catch(() => undefined);
      throw error;
    }

    return { success: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
    if (statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "Could not transfer ownership." });
  } finally {
    await client.end().catch(() => undefined);
  }
});
