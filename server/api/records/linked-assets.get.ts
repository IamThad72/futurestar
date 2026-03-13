import { createError, getCookie } from "h3";
import { createDbClient } from "../../utils/db";
import { SESSION_COOKIE_NAME } from "../../utils/session";
import { getUserGroupId } from "../../utils/group";

type LinkedAsset = { type: string; id: number; label: string };

export default defineEventHandler(async (event): Promise<{ assets: LinkedAsset[] }> => {
  const sessionToken = getCookie(event, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be logged in to view records.",
    });
  }

  const client = createDbClient();

  try {
    await client.connect();
    const sessionResult = await client.query(
      `SELECT user_id FROM app_sessions WHERE session_token = $1 AND expires_at > NOW()`,
      [sessionToken],
    );

    const userId = sessionResult.rows[0]?.user_id;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Session expired. Please log in again.",
      });
    }

    const groupId = await getUserGroupId(client, userId);
    const whereClause = groupId
      ? `WHERE user_id = $1 OR group_id = $2 OR user_id IN (SELECT user_id FROM group_members WHERE group_id = $2)`
      : `WHERE user_id = $1`;
    const params = groupId ? [userId, groupId] : [userId];

    const assets: LinkedAsset[] = [];

    const [aiRows, vhRows, ciRows, reRows, insRows] = await Promise.all([
      client.query(`SELECT ai_id, title FROM asset_inventory ${whereClause}`, params),
      client.query(`SELECT vh_id, year, make, model FROM asset_vehicles ${whereClause}`, params),
      client.query(`SELECT ci_id, institution, acct_type FROM cash_and_investments ${whereClause}`, params),
      client.query(`SELECT re_id, number, street, city, state, zipcode FROM real_estate ${whereClause}`, params),
      client.query(`SELECT ins_id, policy_holder, entity_covered FROM insurance ${whereClause}`, params),
    ]);

    for (const r of aiRows.rows as { ai_id: number; title: string }[]) {
      assets.push({ type: "asset_inventory", id: r.ai_id, label: r.title || `Asset #${r.ai_id}` });
    }
    for (const r of vhRows.rows as { vh_id: number; year?: number; make?: string; model?: string }[]) {
      const parts = [r.year, r.make, r.model].filter(Boolean);
      assets.push({ type: "asset_vehicles", id: r.vh_id, label: parts.length ? parts.join(" ") : `Vehicle #${r.vh_id}` });
    }
    for (const r of ciRows.rows as { ci_id: number; institution?: string; acct_type?: string }[]) {
      const label = [r.institution, r.acct_type].filter(Boolean).join(" - ") || `Account #${r.ci_id}`;
      assets.push({ type: "cash_and_investments", id: r.ci_id, label });
    }
    for (const r of reRows.rows as { re_id: number; number?: string; street?: string; city?: string; state?: string; zipcode?: string }[]) {
      const addr = [r.number, r.street].filter(Boolean).join(" ");
      const parts = [addr, r.city, r.state, r.zipcode].filter(Boolean);
      assets.push({ type: "real_estate", id: r.re_id, label: parts.length ? parts.join(", ") : `Property #${r.re_id}` });
    }
    for (const r of insRows.rows as { ins_id: number; policy_holder?: string; entity_covered?: string }[]) {
      const label = [r.policy_holder, r.entity_covered].filter(Boolean).join(" - ") || `Policy #${r.ins_id}`;
      assets.push({ type: "insurance", id: r.ins_id, label });
    }

    return { assets };
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load linkable assets.",
    });
  } finally {
    await client.end().catch(() => undefined);
  }
});
