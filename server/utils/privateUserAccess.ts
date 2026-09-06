import type { H3Event } from "h3";
import { getSessionUserId } from "./auth";
import { soloUserClause, soloUserClauseAt } from "./group";

/**
 * Physical and Spiritual user data is always the logged-in `app_users.user_id`.
 * Linked-account groups (`getUserGroupId` / `groupAccessClause`) apply to
 * Financial tables only. Exercise catalogs may stay global/read-only after auth.
 * Nutrition search uses the USDA FDC API (no local food catalog). Logs, intake,
 * favorites, and similar rows must use these helpers.
 */
export async function requirePrivateUserId(event: H3Event): Promise<number> {
  return getSessionUserId(event);
}

export const privateUserClause = soloUserClause;
export const privateUserClauseAt = soloUserClauseAt;

/** Strip group scope keys so Physical/Spiritual handlers never filter by them. */
export function omitGroupScope(input: Record<string, unknown> | null | undefined) {
  if (!input) return {};
  const rest = { ...input };
  delete rest.group_id;
  delete rest.groupId;
  delete rest.group;
  return rest;
}
