/** Spiritual Health destinations (header Spiritual + in-section tabs). */
import { eveningLabel } from "./faithProfile.js";

export const SPIRITUAL_SECTIONS = [
  {
    name: "Morning Prayer",
    slug: "morning",
    icon: "sunny",
    description: "Begin the day in God’s presence, pray from Scripture, and set a clear intention.",
  },
  {
    name: "Daily Remembering",
    slug: "remembering",
    icon: "bookmark",
    description: "Return to the truths that keep the day from hurry, fear, and self-reliance.",
  },
  {
    name: "Scripture",
    slug: "scripture",
    icon: "book",
    description: "A weekly verse plus a daily reading from the Old and New Testaments.",
  },
  {
    name: "Evening Examen",
    slug: "examen",
    icon: "moon",
    description: "Review the day with gratitude, honesty, and a closing prayer.",
  },
  {
    name: "Reading Plans",
    slug: "plans",
    icon: "calendar-number",
    group: "practices",
    description: "Read through the Bible, the Gospels, or a season, one day at a time.",
  },
  {
    name: "Prayer List",
    slug: "prayers",
    icon: "heart",
    group: "practices",
    description: "Keep the people and needs you are praying for, and remember how God answered.",
  },
  {
    name: "Worship Check-in",
    slug: "worship",
    icon: "checkmark-circle",
    group: "practices",
    description: "Note each week's worship, the passage preached, and one thing to carry into the week.",
  },
];

/** Sidebar groups: daily rhythm first, then ongoing practices. */
export const SPIRITUAL_GROUPS = [
  { key: "daily", name: "Today" },
  { key: "practices", name: "Practices" },
];

function worshipSection(section, tradition) {
  const value = String(tradition || "").toLowerCase();
  if (value === "catholic") {
    return { ...section, name: "Mass Check-in", description: "Note each week's Mass, the Gospel or homily, and one thing to carry into the week." };
  }
  if (value === "orthodox") {
    return { ...section, name: "Liturgy Check-in", description: "Note each week's Divine Liturgy, the Gospel or homily, and one thing to carry into the week." };
  }
  return section;
}

/**
 * Sections named for the user's tradition. The evening review is "Evening Examen"
 * in Catholic mode and "Evening Reflection" otherwise; the slug stays "examen".
 * With no tradition (before the profile loads) the original names are used.
 */
export function spiritualSections(tradition) {
  if (!tradition) return SPIRITUAL_SECTIONS;
  return SPIRITUAL_SECTIONS.map((section) => {
    if (section.slug === "examen") return { ...section, name: eveningLabel(tradition) };
    if (section.slug === "worship") return worshipSection(section, tradition);
    return section;
  });
}

function navTabs(tradition) {
  return [
    {
      name: "Spiritual Home",
      href: "/spiritual",
      icon: "church",
      description: "Overview of your daily spiritual review.",
      match: (path) => path === "/spiritual",
    },
    ...spiritualSections(tradition).map((section) => ({
      name: section.name,
      href: `/spiritual/${section.slug}`,
      icon: section.icon,
      description: section.description,
      group: section.group || "daily",
      match: (path) => path === `/spiritual/${section.slug}`,
    })),
  ];
}

export const SPIRITUAL_NAV_TABS = navTabs();

export function isSpiritualPath(path) {
  const p = String(path || "");
  return p === "/spiritual" || p.startsWith("/spiritual/");
}

export function isSpiritualHomePath(path) {
  return String(path || "") === "/spiritual";
}

export function spiritualTabsForPath(path, tradition) {
  const p = String(path || "");
  return navTabs(tradition).map((tab) => ({
    ...tab,
    current: tab.match(p),
  }));
}

export function spiritualSectionBySlug(slug, tradition) {
  return spiritualSections(tradition).find((section) => section.slug === String(slug || "")) ?? null;
}

export function spiritualHomeLinks(tradition) {
  return navTabs(tradition).filter((tab) => tab.href !== "/spiritual");
}

export const SPIRITUAL_HOME_LINKS = spiritualHomeLinks();

/** Sidebar groups ("Today", "Practices") with their tabs for the current path. */
export function spiritualSidebarGroups(path, tradition) {
  const tabs = spiritualTabsForPath(path, tradition).filter((tab) => tab.href !== "/spiritual");
  return SPIRITUAL_GROUPS.map((group) => ({
    name: group.name,
    tabs: tabs.filter((tab) => tab.group === group.key),
  })).filter((group) => group.tabs.length);
}
