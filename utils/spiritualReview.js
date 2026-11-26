export const BE_STILL_LINES = [
  "God, You are here. I place this day in Your hands.",
  "Help me see clearly, love faithfully, work honestly,",
  "and receive what comes with courage and gratitude.",
];

export const BE_STILL_PROMPTS = [
  "Take three slow breaths.",
  "Ask: What is God inviting me to be today?",
];

export const REMEMBER_TRUTHS = [
  "I am loved before I achieve anything.",
  "My work is service; people are not obstacles.",
  "I cannot control everything, but I can be faithful.",
  "I will protect my attention from hurry and distraction.",
  "I will be grateful for ordinary gifts.",
  "When I fail, I will return quickly to God.",
  "I will do the next right thing.",
];

export const MORNING_INTENTION_FIELDS = [
  { key: "faithful_act", label: "One concrete act of faithfulness" },
  { key: "surrender", label: "What I need to surrender to God" },
];

export const VIRTUE_GROUPS = [
  {
    name: "Theological",
    virtues: [
      { name: "Faith", definition: "Trust in God and what He has revealed" },
      { name: "Hope", definition: "Confidence in God's promises" },
      { name: "Charity", definition: "Love of God above all, and of neighbor for His sake" },
    ],
  },
  {
    name: "Cardinal",
    virtues: [
      { name: "Prudence", definition: "Right judgment about what to do" },
      { name: "Justice", definition: "Giving God and others what is due" },
      { name: "Fortitude", definition: "Courage to do what is right" },
      { name: "Temperance", definition: "Right measure in desires and pleasures" },
    ],
  },
  {
    name: "Daily practice",
    virtues: [
      { name: "Humility", definition: "A truthful view of yourself before God" },
      { name: "Patience", definition: "Bearing difficulty without resentment" },
      { name: "Kindness", definition: "Goodwill shown in word and action" },
      { name: "Honesty", definition: "Speech and action that match the truth" },
      { name: "Generosity", definition: "Giving freely of what you have" },
      { name: "Gratitude", definition: "Receiving the day's gifts with thanks" },
      { name: "Mercy", definition: "Compassion that forgives and helps" },
      { name: "Diligence", definition: "Steady care in the work given to you" },
      { name: "Gentleness", definition: "Strength used without harshness" },
      { name: "Self-control", definition: "Ordering desires toward what is good" },
    ],
  },
];

export const VIRTUES = VIRTUE_GROUPS.flatMap((group) => group.virtues.map((virtue) => virtue.name));

/**
 * Scripture-based wording for Christian, Protestant and Orthodox modes.
 * VIRTUE_GROUPS above (Catechism wording) stays the Catholic list, unchanged.
 */
export const SCRIPTURE_VIRTUE_GROUPS = [
  {
    name: "Faith, hope and love",
    virtues: [
      { name: "Faith", definition: "Trusting God and taking Him at His word (Hebrews 11:1)" },
      { name: "Hope", definition: "Holding on to what God has promised (Romans 15:13)" },
      { name: "Love", definition: "Loving God with all your heart, and your neighbor as yourself (Mark 12:30–31)" },
    ],
  },
  {
    name: "Fruit of the Spirit",
    virtues: [
      { name: "Joy", definition: "Gladness in God that does not depend on circumstances (Philippians 4:4)" },
      { name: "Peace", definition: "Resting in God instead of worry (Philippians 4:6–7)" },
      { name: "Patience", definition: "Bearing with people and delays without resentment (Colossians 3:12–13)" },
      { name: "Kindness", definition: "Goodwill shown in word and action (Ephesians 4:32)" },
      { name: "Goodness", definition: "Doing what is right and good for others (Galatians 6:9–10)" },
      { name: "Faithfulness", definition: "Keeping your word and finishing what is yours to do (Luke 16:10)" },
      { name: "Gentleness", definition: "Strength used without harshness (Philippians 4:5)" },
      { name: "Self-control", definition: "Ordering desires toward what is good (Titus 2:11–12)" },
    ],
  },
  {
    name: "Daily practice",
    virtues: [
      { name: "Humility", definition: "A truthful view of yourself before God (Micah 6:8)" },
      { name: "Wisdom", definition: "Seeking God's way before deciding (James 1:5)" },
      { name: "Justice", definition: "Treating others fairly and doing what is right (Micah 6:8)" },
      { name: "Courage", definition: "Doing what is right when it is hard (Joshua 1:9)" },
      { name: "Honesty", definition: "Speech and action that match the truth (Ephesians 4:25)" },
      { name: "Generosity", definition: "Giving freely of what you have (2 Corinthians 9:7)" },
      { name: "Gratitude", definition: "Receiving the day's gifts with thanks (1 Thessalonians 5:18)" },
      { name: "Mercy", definition: "Compassion that forgives and helps (Luke 6:36)" },
      { name: "Diligence", definition: "Steady care in the work given to you (Colossians 3:23)" },
    ],
  },
];

/** The virtue list a person sees: Catechism wording in Catholic mode, Scripture wording otherwise. */
export function virtueGroupsForTradition(tradition) {
  return String(tradition || "").toLowerCase() === "catholic" ? VIRTUE_GROUPS : SCRIPTURE_VIRTUE_GROUPS;
}

export function virtueNamesForTradition(tradition) {
  return virtueGroupsForTradition(tradition).flatMap((group) => group.virtues.map((virtue) => virtue.name));
}

/** Definition for a virtue saved under either list (so older journal entries still work). */
export function findVirtueDefinition(name, tradition = "") {
  const needle = String(name || "").trim().toLowerCase();
  if (!needle) return "";
  const preferred = virtueGroupsForTradition(tradition);
  const other = preferred === VIRTUE_GROUPS ? SCRIPTURE_VIRTUE_GROUPS : VIRTUE_GROUPS;
  for (const groups of [preferred, other]) {
    for (const group of groups) {
      for (const virtue of group.virtues) {
        if (virtue.name.toLowerCase() === needle) return virtue.definition;
      }
    }
  }
  return "";
}

export const EXAMEN_FIELDS = [
  { key: "grateful", label: "What am I grateful for today?" },
  { key: "presence", label: "When did I experience peace, joy, love, or God’s presence?" },
  { key: "troubled", label: "What troubled, drained, or distracted me?" },
  { key: "integrity", label: "Where did I act with love and integrity?" },
  { key: "shortfall", label: "Where did I fall short or need forgiveness?" },
  { key: "amends", label: "Is there anyone I need to forgive, contact, or make amends with?" },
  { key: "tomorrow", label: "What is one specific intention for tomorrow?" },
];

export const CLOSING_PRAYER_LINES = [
  "Lord, thank You for this day.",
  "Forgive what was selfish, fearful, or unloving in me.",
  "Receive what was good and use it for Your purposes.",
  "Give me rest, peace, and grace for tomorrow. Amen.",
];

export function emptySpiritualReview() {
  return {
    love_person: "",
    virtue: "",
    faithful_act: "",
    surrender: "",
    grateful: "",
    presence: "",
    troubled: "",
    integrity: "",
    shortfall: "",
    amends: "",
    tomorrow: "",
  };
}
