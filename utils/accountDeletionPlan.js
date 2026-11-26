/**
 * Pure household handoff for account deletion.
 *
 * members: every group_members row for the person's one group, or [] when
 * they are not in a group. Each entry is { user_id, role, created_at }.
 * options.createdBy: groups.created_by. Needed because that foreign key
 * cascades and would erase the household if the creator is deleted first.
 *
 * mode:
 *   solo     — not in a group. Erase everything they own.
 *   reown    — a member leaves other people, and an owner remains.
 *              reownToUserId is that owner. newOwnerId is null.
 *   promote  — an owner leaves, or nobody remaining is an owner.
 *              The earliest other member becomes owner.
 *              newOwnerId and reownToUserId are that person.
 *   dissolve — they are the only member. Erase the household too.
 *
 * Earliest means the smallest created_at. The same timestamp keeps the
 * lower user_id, so the choice does not change between calls.
 * A list that does not include this person is solo (no household handoff).
 */

function asUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function timeValue(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  }
  if (typeof value === "string" && value.trim()) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function compareJoined(left, right) {
  const diff = timeValue(left.created_at) - timeValue(right.created_at);
  if (diff !== 0) return diff;
  return left.user_id - right.user_id;
}

function normalizeMembers(members) {
  if (!Array.isArray(members)) return [];
  const byId = new Map();
  for (const member of members) {
    const userId = asUserId(member?.user_id);
    if (userId == null) continue;
    const next = {
      user_id: userId,
      role: member?.role === "owner" ? "owner" : "member",
      created_at: member?.created_at,
    };
    const previous = byId.get(userId);
    if (!previous || compareJoined(next, previous) < 0) byId.set(userId, next);
  }
  return [...byId.values()];
}

function earliest(members) {
  return members.slice().sort(compareJoined)[0] ?? null;
}

const SOLO = { mode: "solo", newOwnerId: null, reownToUserId: null };

export function planAccountDeletion(userId, members, options = {}) {
  const selfId = asUserId(userId);
  const list = normalizeMembers(members);
  const self = selfId == null ? null : list.find((member) => member.user_id === selfId);
  if (!self) return { ...SOLO };

  const others = list.filter((member) => member.user_id !== self.user_id);
  if (others.length === 0) {
    return { mode: "dissolve", newOwnerId: null, reownToUserId: null };
  }

  const createdBy = asUserId(options?.createdBy);
  const selfIsOwner = self.role === "owner" || createdBy === self.user_id;
  const remainingOwners = others.filter((member) => member.role === "owner");
  if (!selfIsOwner && remainingOwners.length > 0) {
    return { mode: "reown", newOwnerId: null, reownToUserId: earliest(remainingOwners).user_id };
  }

  const successor = earliest(others);
  return {
    mode: "promote",
    newOwnerId: successor.user_id,
    reownToUserId: successor.user_id,
  };
}
