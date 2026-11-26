/**
 * Weekly worship check-in: wording by tradition, week math and a gentle streak.
 * Weeks run Sunday to Saturday, like the church calendar panel.
 */
import { addDays } from "./readingPlans.js";

export const ATTENDANCE_OPTIONS = ["in_person", "online", "not_this_week"];

export function normalizeAttendance(value) {
  const text = String(value || "").trim().toLowerCase();
  return ATTENDANCE_OPTIONS.includes(text) ? text : "";
}

/** Mass for Catholic, Divine Liturgy for Orthodox, a worship service otherwise. */
export function worshipTerms(tradition) {
  const value = String(tradition || "").toLowerCase();
  if (value === "catholic") {
    return {
      service: "Mass",
      question: "Did you go to Mass this week?",
      inPerson: "At Mass in person",
      online: "Watched Mass online",
      notThisWeek: "Not this week",
      church: "Parish",
      sermon: "Gospel or homily passage",
      notes: "Homily notes",
    };
  }
  if (value === "orthodox") {
    return {
      service: "Divine Liturgy",
      question: "Did you attend the Divine Liturgy this week?",
      inPerson: "At the Divine Liturgy in person",
      online: "Joined the Divine Liturgy online",
      notThisWeek: "Not this week",
      church: "Parish",
      sermon: "Gospel or homily passage",
      notes: "Homily notes",
    };
  }
  return {
    service: "worship service",
    question: "Did you worship with your church this week?",
    inPerson: "At a worship service in person",
    online: "Joined a worship service online",
    notThisWeek: "Not this week",
    church: "Church",
    sermon: "Sermon passage",
    notes: "Sermon notes",
  };
}

export function attendanceLabel(attendance, tradition) {
  const terms = worshipTerms(tradition);
  if (attendance === "in_person") return terms.inPerson;
  if (attendance === "online") return terms.online;
  if (attendance === "not_this_week") return terms.notThisWeek;
  return "";
}

function weekdayOf(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Sunday that starts the week containing `iso`. */
export function weekStartFor(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  return addDays(iso, -weekdayOf(iso));
}

export function attended(attendance) {
  return attendance === "in_person" || attendance === "online";
}

/**
 * Consecutive weeks with worship, counting back from this week. If this week
 * has no check-in yet, counting starts from last week, so an unrecorded
 * current week never breaks the streak.
 * @param {{ week_start: string, attendance: string }[]} checkins
 */
export function worshipStreak(checkins, today) {
  const byWeek = new Map((checkins || []).map((row) => [String(row.week_start).slice(0, 10), row.attendance]));
  let week = weekStartFor(today);
  if (!week) return 0;
  if (!byWeek.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (attended(byWeek.get(week))) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

/** Short, guilt-free line for the streak. */
export function streakMessage(streak, tradition) {
  const { service } = worshipTerms(tradition);
  if (streak >= 2) return `${streak} weeks in a row. Thank God for your church family.`;
  if (streak === 1) return "You worshiped last time. Every week is a gift.";
  return `Whenever you next gather for ${service === "worship service" ? "worship" : service}, you can note it here.`;
}
