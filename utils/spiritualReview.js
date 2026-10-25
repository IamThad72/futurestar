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
