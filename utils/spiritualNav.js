/** Spiritual Health destinations (header Spiritual + in-section tabs). */

export const SPIRITUAL_SECTIONS = [
  {
    name: "Morning Prayer",
    slug: "morning",
    description: "Begin the day in God’s presence, pray from Scripture, and set a clear intention.",
  },
  {
    name: "Daily Remembering",
    slug: "remembering",
    description: "Return to the truths that keep the day from hurry, fear, and self-reliance.",
  },
  {
    name: "Scripture",
    slug: "scripture",
    description: "A weekly verse plus a daily reading from the Old and New Testaments.",
  },
  {
    name: "Evening Examen",
    slug: "examen",
    description: "Review the day with gratitude, honesty, and a closing prayer.",
  },
];

export const SPIRITUAL_NAV_TABS = [
  {
    name: "Spiritual Home",
    href: "/spiritual",
    description: "Overview of your daily spiritual review.",
    match: (path) => path === "/spiritual",
  },
  ...SPIRITUAL_SECTIONS.map((section) => ({
    name: section.name,
    href: `/spiritual/${section.slug}`,
    description: section.description,
    match: (path) => path === `/spiritual/${section.slug}`,
  })),
];

export function isSpiritualPath(path) {
  const p = String(path || "");
  return p === "/spiritual" || p.startsWith("/spiritual/");
}

export function isSpiritualHomePath(path) {
  return String(path || "") === "/spiritual";
}

export function spiritualTabsForPath(path) {
  const p = String(path || "");
  return SPIRITUAL_NAV_TABS.map((tab) => ({
    ...tab,
    current: tab.match(p),
  }));
}

export function spiritualSectionBySlug(slug) {
  return SPIRITUAL_SECTIONS.find((section) => section.slug === String(slug || "")) ?? null;
}

export const SPIRITUAL_HOME_LINKS = SPIRITUAL_NAV_TABS.filter((tab) => tab.href !== "/spiritual");
