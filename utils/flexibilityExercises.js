/** Flexibility and mobility from ExerciseDB OSS: name-matched stretches and yoga poses. */

export const FLEXIBILITY_BODY_REGIONS = [
  { key: "hips", label: "Hips" },
  { key: "back", label: "Back / Spine" },
  { key: "shoulders", label: "Shoulders & Chest" },
  { key: "legs", label: "Legs & Ankles" },
  { key: "neck", label: "Neck" },
];

export const FLEXIBILITY_REGIONS = [
  ...FLEXIBILITY_BODY_REGIONS,
  { key: "plyo", label: "Plyometrics" },
];

export const FLEXIBILITY_REGION_KEYS = FLEXIBILITY_REGIONS.map((item) => item.key);

export const FLEXIBILITY_FILTERS = [
  { key: "all", label: "All" },
  { key: "yoga", label: "Yoga" },
  { key: "plyo", label: "Plyometrics" },
  ...FLEXIBILITY_BODY_REGIONS,
];

export const FLEXIBILITY_FILTER_KEYS = FLEXIBILITY_FILTERS.map((item) => item.key);

export const DEFAULT_FLEXIBILITY_PROGRAM = {
  sets: "2–3",
  repetitions: "20–30 sec hold",
  rest: "",
};

export const DEFAULT_PLYOMETRIC_PROGRAM = {
  sets: "3–5",
  repetitions: "4–8",
  rest: "45–90 seconds",
};

export const DEFAULT_PLYOMETRIC_BENEFITS = [
  "Builds explosive power and landing control",
  "Keep landings quiet; stop if joints feel sharp pain",
];

export const DEFAULT_FLEXIBILITY_BENEFITS = [
  "Improves range of motion and movement quality",
  "Hold a comfortable stretch; ease off if you feel sharp pain",
];

export const FLEXIBILITY_EXERCISES = [
  {
    id: "world-greatest-stretch",
    name: "World’s Greatest Stretch",
    region: "hips",
    equipment: "body",
    description:
      "A lunge-to-rotate flow that opens the hips, hamstrings, and thoracic spine. Move slowly and keep the back knee light.",
    instructions: [
      "Step into a long lunge with the front foot flat and both hands on the floor inside the front foot.",
      "Drop the back knee if you need more stability.",
      "Reach the inside arm up and rotate the chest toward the front knee.",
      "Return the hand to the floor, then switch sides.",
    ],
    benefits: [
      "Combines hip, hamstring, and upper-back mobility",
      "Useful as a warm-up before strength or running",
      "No equipment required",
    ],
    sets: "2–3",
    repetitions: "5–8/side",
    rest: "",
  },
  {
    id: "seated-glute-stretch",
    name: "Seated Glute Stretch",
    region: "hips",
    equipment: "body",
    description:
      "A figure-four sit that targets the glutes and outer hip. Keep the spine long instead of rounding hard.",
    instructions: [
      "Sit tall with the legs extended, then cross one ankle over the opposite thigh.",
      "Place a hand behind you for support.",
      "Gently press the raised knee away or hinge forward until you feel the outer hip.",
      "Hold, then switch sides.",
    ],
    benefits: [
      "Opens the glutes and piriformis",
      "Helpful after sitting",
      "Easy to do on the floor",
    ],
    sets: "2–3",
    repetitions: "20–30 sec/side",
    rest: "",
  },
  {
    id: "butterfly-yoga",
    name: "Butterfly Yoga Pose",
    region: "hips",
    equipment: "body",
    description:
      "Soles of the feet together, knees out. Sit tall and let the inner thighs open without forcing the knees down.",
    instructions: [
      "Sit with the soles of the feet together and hold the ankles or feet.",
      "Lengthen the spine and relax the shoulders.",
      "Let the knees drop toward the floor only as far as is comfortable.",
      "Breathe steadily, then slowly bring the knees up to come out.",
    ],
    benefits: [
      "Stretches the inner thighs and groin",
      "A calm hip opener with no equipment",
      "Easy to hold and breathe through",
    ],
    sets: "2–3",
    repetitions: "20–30 sec hold",
    rest: "",
  },
  {
    id: "rocking-frog-stretch",
    name: "Rocking Frog Stretch",
    region: "hips",
    equipment: "body",
    description:
      "A kneeling hip opener. Rock gently so the inner thighs and hips warm up instead of dumping into the low back.",
    instructions: [
      "Kneel with the knees wider than the hips and the hands on the floor.",
      "Keep the spine long and the hips behind the knees.",
      "Rock forward and back through a small, comfortable range.",
      "Stop if the knees or low back complain; narrow the stance if needed.",
    ],
    benefits: [
      "Builds hip mobility with a gentle rocking motion",
      "No equipment required",
      "Pairs well with static glute stretches",
    ],
    sets: "2–3",
    repetitions: "8–10 rocks",
    rest: "",
  },
  {
    id: "hamstring-stretch",
    name: "Hamstring Stretch",
    region: "legs",
    equipment: "body",
    description:
      "A standing hinge toward one foot. Keep a flat back and a soft knee rather than rounding to touch the floor.",
    instructions: [
      "Stand with feet about hip-width, then step one foot forward.",
      "Hinge at the hips and reach toward the front foot.",
      "Keep the front knee soft and the spine long.",
      "Hold, then switch sides.",
    ],
    benefits: [
      "Lengthens the hamstrings",
      "Supports hinge work and running",
      "No equipment required",
    ],
    sets: "2–3",
    repetitions: "20–30 sec/side",
    rest: "",
  },
  {
    id: "lying-quads-stretch",
    name: "Side-Lying Quad Stretch",
    region: "legs",
    equipment: "body",
    description:
      "Lie on your side and bring the top heel toward the glute. Keep the thighs in line and the low back quiet.",
    instructions: [
      "Lie on your side with the legs stacked and the head supported.",
      "Bend the top knee and hold the ankle or foot.",
      "Gently draw the heel toward the glute without pinching the low back.",
      "Hold, then switch sides.",
    ],
    benefits: [
      "Stretches the front of the thigh",
      "Useful after squats, lunges, or sitting",
      "Easy to control on the floor",
    ],
    sets: "2–3",
    repetitions: "20–30 sec/side",
    rest: "",
  },
  {
    id: "seated-calf-stretch",
    name: "Seated Calf Stretch",
    region: "legs",
    equipment: "body",
    description:
      "Sit and reach toward a straight leg until the calf and Achilles take the stretch. Keep the heel down.",
    instructions: [
      "Sit on a chair or the floor with one leg extended and the heel down.",
      "Lean forward from the hips until you feel the calf.",
      "Flex the toes toward you to add a little more stretch.",
      "Hold, then switch sides.",
    ],
    benefits: [
      "Opens the calves and ankles",
      "Helps walking and running stride",
      "No equipment required",
    ],
    sets: "2–3",
    repetitions: "20–30 sec/side",
    rest: "",
  },
  {
    id: "upper-back-stretch",
    name: "Upper Back Stretch",
    region: "back",
    equipment: "body",
    description:
      "Reach the arms forward or overhead and round the upper back just enough to feel the mid-back open.",
    instructions: [
      "Stand tall with the feet about shoulder-width.",
      "Reach the arms forward, interlace the fingers, and turn the palms away.",
      "Gently round the upper back or raise the arms while keeping the neck long.",
      "Hold, then release and repeat.",
    ],
    benefits: [
      "Relieves tightness from sitting and reaching",
      "Targets the upper back and rear shoulders",
      "No equipment required",
    ],
    sets: "2–3",
    repetitions: "20–30 sec hold",
    rest: "",
  },
  {
    id: "spine-stretch",
    name: "Spine Stretch",
    region: "back",
    equipment: "body",
    description:
      "A seated lean that lengthens the spine. Move slowly and stop short of collapsing through the low back.",
    instructions: [
      "Sit with the legs extended and the hands behind you for support.",
      "Sit tall, then slowly lean back until you feel a stretch along the spine.",
      "Keep the shoulders down and the neck in line.",
      "Return with control and repeat.",
    ],
    benefits: [
      "Encourages spinal range of motion",
      "A quiet mobility drill on the floor",
      "No equipment required",
    ],
    sets: "2–3",
    repetitions: "20–30 sec hold",
    rest: "",
  },
  {
    id: "roller-back-stretch",
    name: "Foam Roller Back Stretch",
    region: "back",
    equipment: "roller",
    description:
      "Lie over a foam roller and roll from the mid-back toward the upper back. Keep the hips heavy and the neck relaxed.",
    instructions: [
      "Sit, place the roller behind you, and lie back so it sits across the mid-back.",
      "Support the head with the hands if needed.",
      "Slowly roll toward the upper back, pausing on tight spots.",
      "Stay off the low back and the neck.",
    ],
    benefits: [
      "Soft-tissue work for the thoracic spine",
      "Pairs well with the static upper-back stretch",
      "Uses a foam roller",
    ],
    sets: "2–3",
    repetitions: "30–45 sec",
    rest: "",
  },
  {
    id: "dynamic-chest-stretch",
    name: "Dynamic Chest Stretch",
    region: "shoulders",
    equipment: "body",
    description:
      "Open and cross the arms to warm the chest and the front of the shoulders. Keep the ribs down.",
    instructions: [
      "Stand tall with the arms out to the sides at shoulder height.",
      "Sweep the arms forward to cross in front of the chest.",
      "Open them again and feel a stretch across the pecs.",
      "Move slowly; hold the open position for a breath if you prefer a static version.",
    ],
    benefits: [
      "Opens the chest after pressing or sitting",
      "Works as a warm-up or a between-set reset",
      "No equipment required",
    ],
    sets: "2–3",
    repetitions: "8–10 sweeps",
    rest: "",
  },
  {
    id: "neck-side-stretch",
    name: "Neck Side Stretch",
    region: "neck",
    equipment: "body",
    description:
      "Ear toward the shoulder with the opposite shoulder staying down. Use almost no hand pressure.",
    instructions: [
      "Sit or stand tall with the shoulders relaxed.",
      "Tilt one ear toward the same-side shoulder.",
      "Optionally rest a light hand on the head; do not pull hard.",
      "Hold, then switch sides.",
    ],
    benefits: [
      "Eases tightness along the side of the neck",
      "Useful after screen time",
      "Very little range is enough",
    ],
    sets: "2–3",
    repetitions: "15–30 sec/side",
    rest: "",
  },
];

export const FEATURED_FLEXIBILITY_DB_IDS = {
  "world-greatest-stretch": "DFGXwZr",
  "seated-glute-stretch": "DeDThfG",
  "butterfly-yoga": "bWlZvXh",
  "rocking-frog-stretch": "2Dk4xQV",
  "hamstring-stretch": "99rWm7w",
  "lying-quads-stretch": "BWnJR72",
  "seated-calf-stretch": "17bqEXD",
  "upper-back-stretch": "GSDioYu",
  "spine-stretch": "JbC2iaV",
  "roller-back-stretch": "isofgzg",
  "dynamic-chest-stretch": "3uj0Ozg",
  "neck-side-stretch": "x2chWLO",
};

export const FEATURED_FLEXIBILITY_DB_NAMES = {
  "world-greatest-stretch": ["world greatest stretch"],
  "seated-glute-stretch": ["seated glute stretch"],
  "butterfly-yoga": ["butterfly yoga pose"],
  "rocking-frog-stretch": ["rocking frog stretch"],
  "hamstring-stretch": ["hamstring stretch"],
  "lying-quads-stretch": ["lying (side) quads stretch"],
  "seated-calf-stretch": ["seated calf stretch (male)", "seated calf stretch"],
  "upper-back-stretch": ["upper back stretch"],
  "spine-stretch": ["spine stretch"],
  "roller-back-stretch": ["roller back stretch"],
  "dynamic-chest-stretch": ["dynamic chest stretch (male)", "dynamic chest stretch"],
  "neck-side-stretch": ["neck side stretch"],
};

export function gifUrlForFeaturedFlexibility(exerciseId) {
  const catalogId = FEATURED_FLEXIBILITY_DB_IDS[exerciseId];
  return catalogId ? `https://static.exercisedb.dev/media/${catalogId}.gif` : null;
}

const FLEX_NAME = /\b(stretch|yoga|asana|pose|hip opener|facing dog|sphinx)\b/i;
const YOGA_NAME = /\b(yoga|asana|pose|facing dog|sphinx)\b/i;
const PLYO_NAME =
  /\b(jump|jumps|plyo|plyometric|box jump|depth jump|clap push|plyo push|skater|tuck jump|broad jump|drop jump|star jump|scissor jump|astride jump|jack jump)\b/i;
const NOT_FLEX_NAME =
  /\b(push-up|push up|planche|lunge|bridge|curl|press|crunch|deadlift|pulldown|row|split squat)\b/i;
const NOT_PLYO_NAME = /\b(stretch|yoga|pose|jump rope|isometric)\b/i;
const HIP_NAME =
  /\b(glute|piriformis|hip|adductor|groin|butterfly|frog|iron cross|world greatest|wide angle)\b/i;
const SHOULDER_NAME = /\b(shoulder|pec|chest|delt|triceps|wrist|forearm)\b/i;
const BACK_NAME = /\b(spine|lat|thoracic|back|facing dog|sphinx)\b/i;
const NECK_NAME = /\bneck\b/i;
const DYNAMIC_NAME = /\b(world greatest|dynamic|rocking|circles)\b/i;

export function isYogaExercise(name = "") {
  const label = String(name || "");
  if (NOT_FLEX_NAME.test(label)) return false;
  return YOGA_NAME.test(label);
}

export function isStretchExercise(name = "") {
  const label = String(name || "");
  if (isPlyometricExercise(label) || isYogaExercise(label)) return false;
  return FLEX_NAME.test(label) && !NOT_FLEX_NAME.test(label);
}

export function isPlyometricExercise(name = "") {
  const label = String(name || "");
  if (NOT_PLYO_NAME.test(label)) return false;
  return PLYO_NAME.test(label);
}

export function isFlexibilityExercise({ name = "", bodyParts = [] } = {}) {
  const label = String(name || "");
  if (isPlyometricExercise(label)) return true;
  const parts = (Array.isArray(bodyParts) ? bodyParts : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (parts.includes("cardio")) return false;
  if (!FLEX_NAME.test(label)) return false;
  if (NOT_FLEX_NAME.test(label)) return false;
  return true;
}

export function flexibilityRegionFromDb({ name = "", bodyParts = [], targetMuscles = [] } = {}) {
  const label = String(name || "");
  if (isPlyometricExercise(label)) return "plyo";
  const parts = (Array.isArray(bodyParts) ? bodyParts : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  const muscles = [...(Array.isArray(targetMuscles) ? targetMuscles : []), ...parts].join(" ");

  if (parts.includes("neck") || NECK_NAME.test(label)) return "neck";
  if (HIP_NAME.test(label) || /\b(glutes|adductors|hip flexors)\b/i.test(muscles)) {
    if (!/\b(pec|chest)\b/i.test(label)) return "hips";
  }
  if (/\b(pec|chest)\b/i.test(label)) return "shoulders";
  if (parts.includes("back") || BACK_NAME.test(label) || /\bspine\b/i.test(muscles)) return "back";
  if (
    parts.includes("shoulders") ||
    parts.includes("chest") ||
    parts.includes("upper arms") ||
    parts.includes("lower arms") ||
    SHOULDER_NAME.test(label)
  ) {
    return "shoulders";
  }
  return "legs";
}

export function flexibilityProgramFor(name = "") {
  const label = String(name || "");
  if (isPlyometricExercise(label)) {
    return { ...DEFAULT_PLYOMETRIC_PROGRAM };
  }
  if (isYogaExercise(label)) {
    return { ...DEFAULT_FLEXIBILITY_PROGRAM };
  }
  if (DYNAMIC_NAME.test(label)) {
    return { sets: "2–3", repetitions: "5–8/side", rest: "" };
  }
  if (NECK_NAME.test(label)) {
    return { sets: "2–3", repetitions: "15–30 sec hold", rest: "" };
  }
  return { ...DEFAULT_FLEXIBILITY_PROGRAM };
}

export function flexibilityEquipmentKeyFromDb(equipments = []) {
  const names = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (names.includes("roller") || names.includes("wheel roller")) return "roller";
  if (names.includes("stability ball")) return "ball";
  if (names.includes("assisted")) return "assisted";
  if (names.includes("rope")) return "rope";
  if (names.includes("kettlebell")) return "kettlebell";
  if (names.includes("dumbbell")) return "dumbbell";
  if (names.includes("body weight")) return "body";
  return null;
}
