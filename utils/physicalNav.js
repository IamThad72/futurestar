/** Physical Health destinations (header Physical + in-section tabs). */

export const PHYSICAL_SECTIONS = [
  {
    name: "Nutrition Journal",
    slug: "nutrition",
    description: "Set a daily plan and log meals from your foods or USDA FoodData Central.",
  },
  {
    name: "Exercise Journal",
    slug: "workout-journal",
    description: "Record completed sessions from a saved workout or log random catalog exercises.",
  },
  {
    name: "Workout Manager",
    slug: "workouts",
    description: "Build a workout plan, then drag exercises in from a training list.",
  },
];

export const PHYSICAL_CATEGORIES = [
  {
    name: "Cardio Training",
    slug: "cardio-training",
    description: "Outdoor cardio and machines: runs, walks, bikes, and trainers.",
  },
  {
    name: "Plyometrics Training",
    slug: "plyometrics-training",
    description: "Explosive jumps and plyo work for power and landing control.",
  },
  {
    name: "Stretching",
    slug: "stretching",
    description: "Stretches grouped by hips, back, shoulders, legs, and neck.",
  },
  {
    name: "Weight Lifting",
    slug: "strength-training",
    description: "Pulling strength with dumbbells, kettlebells, or body resistance / no weights.",
  },
  {
    name: "Yoga Training",
    slug: "yoga-training",
    description: "Yoga poses and flows matched from the flexibility catalog.",
  },
  {
    name: "Aerobic Training",
    slug: "aerobic-training",
    description: "Higher-pulse bodyweight, rope, and kettlebell aerobic work.",
  },
];

/** Old subsection slugs that should keep working. */
export const PHYSICAL_SLUG_ALIASES = {
  "endurance-training": "cardio-training",
  "flexibility-mobility": "stretching",
};

export function canonicalPhysicalSlug(slug) {
  const raw = String(slug || "");
  return PHYSICAL_SLUG_ALIASES[raw] || raw;
}

export function isWorkoutManagerPath(path) {
  const p = String(path || "");
  return p === "/physical/workouts" || p.startsWith("/physical/workouts/");
}

function physicalSlugFromPath(path) {
  const p = String(path || "");
  if (!p.startsWith("/physical/")) return "";
  const parts = p.slice("/physical/".length).split("/").filter(Boolean);
  if (parts[0] === "workouts") return parts[1] || "workouts";
  return parts[0] || "";
}

export const PHYSICAL_NAV_TABS = [
  {
    name: "Physical Home",
    href: "/physical",
    description: "Overview of your physical health tools.",
    match: (path) => path === "/physical",
  },
  ...PHYSICAL_SECTIONS.map((section) => ({
    name: section.name,
    href: `/physical/${section.slug}`,
    description: section.description,
    match: (path) =>
      section.slug === "workouts"
        ? isWorkoutManagerPath(path)
        : canonicalPhysicalSlug(physicalSlugFromPath(path)) === section.slug,
  })),
];

export function isPhysicalPath(path) {
  const p = String(path || "");
  return p === "/physical" || p.startsWith("/physical/");
}

export function physicalTabsForPath(path) {
  const p = String(path || "");
  return PHYSICAL_NAV_TABS.map((tab) => ({
    ...tab,
    current: tab.match(p),
  }));
}

export function physicalCategoryBySlug(slug) {
  const canonical = canonicalPhysicalSlug(slug);
  return (
    PHYSICAL_SECTIONS.find((section) => section.slug === canonical) ??
    PHYSICAL_CATEGORIES.find((category) => category.slug === canonical) ??
    null
  );
}

export function physicalTrainingBySlug(slug) {
  const canonical = canonicalPhysicalSlug(slug);
  return PHYSICAL_CATEGORIES.find((category) => category.slug === canonical) ?? null;
}

export const PHYSICAL_HOME_LINKS = PHYSICAL_NAV_TABS.filter((tab) => tab.href !== "/physical");

export const PHYSICAL_TRAINING_LINKS = PHYSICAL_CATEGORIES.map((category) => ({
  ...category,
  href: `/physical/workouts/${category.slug}`,
}));
