/** Endurance work from ExerciseDB’s cardio body-part catalog. */

export const ENDURANCE_EQUIPMENT = [
  { key: "outdoor", label: "Outdoor" },
  { key: "body", label: "Bodyweight" },
  { key: "machine", label: "Cardio machines" },
  { key: "rope", label: "Jump rope" },
  { key: "dumbbell", label: "Dumbbells" },
  { key: "kettlebell", label: "Kettlebells" },
];

export const ENDURANCE_EQUIPMENT_KEYS = ENDURANCE_EQUIPMENT.map((item) => item.key);

export const ENDURANCE_MACHINE_EQUIPMENT = [
  "stationary bike",
  "elliptical machine",
  "stepmill machine",
  "leverage machine",
  "skierg machine",
  "upper body ergometer",
  "sled machine",
];

export const DEFAULT_ENDURANCE_PROGRAM = {
  outdoor: { sets: "1", repetitions: "20–30 min", rest: "" },
  body: { sets: "3–5", repetitions: "30–45 sec", rest: "30–60 seconds" },
  dumbbell: { sets: "3", repetitions: "8–12", rest: "45–60 seconds" },
  kettlebell: { sets: "3–5", repetitions: "30–45 sec", rest: "30–60 seconds" },
  machine: { sets: "1", repetitions: "20–30 min", rest: "" },
  rope: { sets: "3–5", repetitions: "45–60 sec", rest: "30–60 seconds" },
};

export const DEFAULT_ENDURANCE_BENEFITS = [
  "Raises heart rate and builds aerobic stamina",
  "Progress by adding time, rounds, or a slightly harder pace",
];

export const ENDURANCE_EXERCISES = [
  {
    id: "outdoor-run",
    name: "Outdoor Run",
    equipment: "outdoor",
    description:
      "Easy to moderate running on a road, path, or trail. Keep a pace you could hold a short conversation at.",
    instructions: [
      "Stand tall with a slight forward lean and relaxed shoulders.",
      "Land softly under the hips and keep the cadence quick rather than overstriding.",
      "Breathe steadily through the nose and mouth.",
      "Finish with a few minutes of walking to cool down.",
    ],
    benefits: [
      "Builds aerobic base with no equipment",
      "Easy to progress by time or distance",
      "Supports heart and lung health",
    ],
    sets: "1",
    repetitions: "20–30 min",
    rest: "",
  },
  {
    id: "outdoor-walk",
    name: "Brisk Walk",
    equipment: "outdoor",
    description:
      "A steady outdoor walk at a pace that raises the heart rate. Use a neighborhood loop, park path, or trail.",
    instructions: [
      "Walk tall with a quick, comfortable stride and relaxed arms.",
      "Keep the effort at a pace where talking is possible but singing is not.",
      "Use a slight hill if you want more work without speeding up.",
      "Finish easier for the last few minutes.",
    ],
    benefits: [
      "Low-impact outdoor cardio",
      "Easy to do most days",
      "Builds a base for longer runs or hikes",
    ],
    sets: "1",
    repetitions: "20–40 min",
    rest: "",
  },
  {
    id: "outdoor-cycle",
    name: "Outdoor Bike",
    equipment: "outdoor",
    description:
      "Steady cycling on a road, bike path, or easy trail. Stay in a gear you can spin without bouncing in the saddle.",
    instructions: [
      "Set the saddle so the knee stays slightly bent at the bottom of the stroke.",
      "Look ahead and keep a quiet upper body.",
      "Spin a cadence you can hold; shift before the legs grind.",
      "Ease off for a short cool-down before you stop.",
    ],
    benefits: [
      "Low-impact cardio for the legs and lungs",
      "Covers more ground than walking",
      "Simple to hold for 20–30 minutes",
    ],
    sets: "1",
    repetitions: "20–40 min",
    rest: "",
  },
  {
    id: "outdoor-hike",
    name: "Hike",
    equipment: "outdoor",
    description:
      "Walking on trails or rolling terrain. Hills and uneven ground raise the heart rate more than a flat sidewalk.",
    instructions: [
      "Wear shoes with grip and take shorter steps on climbs.",
      "Keep a pace you can sustain to the top of the hill.",
      "Use poles if the terrain is steep or your knees need support.",
      "Turn around with enough time to walk out at an easy pace.",
    ],
    benefits: [
      "Builds endurance on natural terrain",
      "Strengthens legs and ankles together",
      "Easy to progress with distance or elevation",
    ],
    sets: "1",
    repetitions: "30–60 min",
    rest: "",
  },
  {
    id: "outdoor-swim",
    name: "Swim",
    equipment: "outdoor",
    description:
      "Continuous swimming in a pool, lake, or open water you know is safe. Choose a stroke you can hold without gasping.",
    instructions: [
      "Warm up with easy lengths or a few minutes of mixed strokes.",
      "Settle into a rhythm and breathe to both sides if you can.",
      "Keep the effort conversational; rest at the wall if form fades.",
      "Finish with easy swimming, then get out and warm up.",
    ],
    benefits: [
      "Full-body cardio with little joint impact",
      "Builds lungs and upper-body endurance",
      "A strong outdoor option when running is too hard on the legs",
    ],
    sets: "1",
    repetitions: "20–30 min",
    rest: "",
  },
  {
    id: "jump-rope",
    name: "Jump Rope",
    equipment: "rope",
    description: "A compact cardio bout that trains calves, coordination, and a steady rhythm.",
    instructions: [
      "Hold the handles with the rope behind the heels, elbows close to the ribs.",
      "Turn from the wrists and jump just high enough to clear the rope.",
      "Stay on the balls of the feet with soft knees.",
      "Stop the set if the rope catches; reset and keep the jumps small.",
    ],
    benefits: [
      "High calorie cost in a small space",
      "Improves footwork and timing",
      "Easy to split into short intervals",
    ],
    sets: "3–5",
    repetitions: "45–60 sec",
    rest: "30–60 seconds",
  },
  {
    id: "stationary-bike",
    name: "Stationary Bike",
    equipment: "machine",
    description: "Seated cycling at a steady cadence. Adjust the seat so the knee stays slightly bent at the bottom of the pedal stroke.",
    instructions: [
      "Set the seat height so the leg is almost straight at the bottom of the stroke.",
      "Lightly hold the bars and keep the torso quiet.",
      "Pedal at a cadence you can sustain without bouncing in the saddle.",
      "Ease the resistance down for the last few minutes.",
    ],
    benefits: [
      "Low-impact cardio for the legs and lungs",
      "Simple to hold a target effort",
      "Joint-friendly alternative to running",
    ],
    sets: "1",
    repetitions: "20–30 min",
    rest: "",
  },
  {
    id: "jumping-jacks",
    name: "Jumping Jacks",
    equipment: "body",
    description: "A full-body pulse raiser: jump the feet out while the arms reach overhead, then return.",
    instructions: [
      "Start with feet together and arms by the sides.",
      "Jump the feet apart and raise the arms overhead.",
      "Jump back to the start and keep the landings quiet.",
      "Step the feet out instead of jumping if needed.",
    ],
    benefits: [
      "Warms up the whole body quickly",
      "No equipment required",
      "Easy to use in short intervals",
    ],
    sets: "3–5",
    repetitions: "30–45 sec",
    rest: "30–60 seconds",
  },
  {
    id: "burpee",
    name: "Burpee",
    equipment: "body",
    description: "A squat-to-plank-to-jump that spikes the heart rate. Keep the hips from sagging in the plank.",
    instructions: [
      "Squat, place the hands on the floor, and step or jump the feet back to a plank.",
      "Keep a straight line from head to heels.",
      "Step or jump the feet forward, then stand or jump up.",
      "Use a step-back burpee if the jump is too hard.",
    ],
    benefits: [
      "Trains cardio and full-body power together",
      "Scales from step-backs to jump burpees",
      "Useful as a short finisher",
    ],
    sets: "3–5",
    repetitions: "30–45 sec",
    rest: "45–60 seconds",
  },
  {
    id: "mountain-climber",
    name: "Mountain Climber",
    equipment: "body",
    description: "From a high plank, drive the knees toward the chest in a running rhythm without letting the hips pike.",
    instructions: [
      "Start in a high plank, hands under the shoulders, body in a straight line.",
      "Drive one knee toward the chest, then quickly switch legs.",
      "Keep the shoulders stacked over the hands.",
      "Slow the pace if the hips start to bounce or sag.",
    ],
    benefits: [
      "Raises heart rate while the core stays braced",
      "No equipment required",
      "Fits easily between steadier cardio bouts",
    ],
    sets: "3–5",
    repetitions: "30–45 sec",
    rest: "30–60 seconds",
  },
  {
    id: "elliptical",
    name: "Elliptical",
    equipment: "machine",
    description: "A standing, low-impact stride on an elliptical trainer. Use the handles and keep a tall posture.",
    instructions: [
      "Set a moderate resistance and stand tall on the pedals.",
      "Push and pull the handles in time with the legs.",
      "Avoid locking the knees or leaning hard on the rails.",
      "Ease the resistance for a short cool-down.",
    ],
    benefits: [
      "Cardio with less joint impact than running",
      "Works legs and arms together",
      "Simple to hold for 20–30 minutes",
    ],
    sets: "1",
    repetitions: "20–30 min",
    rest: "",
  },
  {
    id: "skater-hops",
    name: "Skater Hops",
    equipment: "body",
    description: "Side-to-side bounds that train lateral power and get the heart rate up quickly.",
    instructions: [
      "Stand on one leg with a soft knee and a slight hip hinge.",
      "Bound sideways onto the other leg and let the trail leg sweep behind.",
      "Stick each landing for a moment before the next hop.",
      "Shorten the jump if you cannot land quietly.",
    ],
    benefits: [
      "Builds lateral endurance and ankle stability",
      "No equipment required",
      "Useful as a short interval",
    ],
    sets: "3–5",
    repetitions: "30–45 sec",
    rest: "30–60 seconds",
  },
];

export const FEATURED_ENDURANCE_DB_IDS = {
  "outdoor-run": "oLrKqDH",
  "jump-rope": "e1e76I2",
  "stationary-bike": "H1PESYI",
  "jumping-jacks": "1g5bPpA",
  burpee: "dK9394r",
  "mountain-climber": "RJgzwny",
  elliptical: "rjtuP6X",
  "skater-hops": "zfNHMN9",
};

export const FEATURED_ENDURANCE_DB_NAMES = {
  "outdoor-run": ["run", "run (equipment)", "short stride run"],
  "jump-rope": ["jump rope"],
  "stationary-bike": ["stationary bike run", "stationary bike walk"],
  "jumping-jacks": ["jack jump (male)", "star jump (male)"],
  burpee: ["burpee"],
  "mountain-climber": ["mountain climber"],
  elliptical: ["walk elliptical cross trainer"],
  "skater-hops": ["skater hops"],
};

export function gifUrlForFeaturedEndurance(exerciseId) {
  const catalogId = FEATURED_ENDURANCE_DB_IDS[exerciseId];
  return catalogId ? `https://static.exercisedb.dev/media/${catalogId}.gif` : null;
}

/** Featured outdoor cards without ExerciseDB GIFs still need a stable catalog id for workouts. */
export function featuredEnduranceCatalogId(exercise) {
  const localId = String(exercise?.id || "").trim();
  return FEATURED_ENDURANCE_DB_IDS[localId] || exercise?.exerciseId || localId || null;
}

export const LOCAL_FEATURED_ENDURANCE_IDS = ENDURANCE_EXERCISES.filter(
  (exercise) => !FEATURED_ENDURANCE_DB_IDS[exercise.id],
).map((exercise) => exercise.id);

export function isJunkEnduranceName(name = "") {
  return /\b(blunt|pulse style|expanded variation|alternating bear crawl)\b/i.test(String(name || ""));
}

export function isOutdoorEndurance(name = "", equipments = []) {
  const label = String(name || "");
  const gear = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (gear.some((item) => ENDURANCE_MACHINE_EQUIPMENT.includes(item))) return false;
  if (gear.includes("rope") || gear.includes("dumbbell")) return false;
  if (/\b(hike|hiking|swim|swimming|trail)\b/i.test(label)) return true;
  if (/\b(push to run|wheel run)\b/i.test(label)) return false;
  if (/\b(jump|burpee|climber|jack|hop|crawl|high knee)\b/i.test(label)) return false;
  return /\b(run|jog|walk)\b/i.test(label);
}

export function isSteadyEndurance(name = "", equipment = "") {
  if (equipment === "machine" || equipment === "outdoor") return true;
  const label = String(name || "");
  if (/\b(burpee|jump|climber|crawl|hop|jack|scissor|ski step|swing|bear|push to|high knee)\b/i.test(label)) {
    return false;
  }
  return /\b(run|walk|jog|bike|cycle|elliptical|stepmill|treadmill)\b/i.test(label);
}

export function enduranceProgramFor(equipment, name = "") {
  if (equipment === "outdoor" || isSteadyEndurance(name, equipment)) {
    return DEFAULT_ENDURANCE_PROGRAM[equipment] || DEFAULT_ENDURANCE_PROGRAM.outdoor;
  }
  return DEFAULT_ENDURANCE_PROGRAM[equipment] || DEFAULT_ENDURANCE_PROGRAM.body;
}

export function enduranceEquipmentKeyFromDb(equipments = [], name = "") {
  const names = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (names.includes("kettlebell")) return "kettlebell";
  if (names.includes("dumbbell")) return "dumbbell";
  if (names.includes("rope")) return "rope";
  if (names.some((item) => ENDURANCE_MACHINE_EQUIPMENT.includes(item))) return "machine";
  if (isOutdoorEndurance(name, names)) return "outdoor";
  return "body";
}

export function isCardioExercise({ bodyParts = [] } = {}) {
  return (Array.isArray(bodyParts) ? bodyParts : []).some(
    (part) => String(part || "").trim().toLowerCase() === "cardio",
  );
}

export const CARDIO_EQUIPMENT_KEYS = ["outdoor", "machine"];
export const AEROBIC_EQUIPMENT_KEYS = ENDURANCE_EQUIPMENT_KEYS.filter(
  (key) => !CARDIO_EQUIPMENT_KEYS.includes(key),
);
export const CARDIO_EQUIPMENT = ENDURANCE_EQUIPMENT.filter((item) =>
  CARDIO_EQUIPMENT_KEYS.includes(item.key),
);
export const AEROBIC_EQUIPMENT = ENDURANCE_EQUIPMENT.filter((item) =>
  AEROBIC_EQUIPMENT_KEYS.includes(item.key),
);

export function isOfficialCardioExercise({
  name = "",
  bodyParts = [],
  equipment = "",
  equipments = [],
} = {}) {
  if (CARDIO_EQUIPMENT_KEYS.includes(equipment)) return true;
  if (isOutdoorEndurance(name, equipments)) return true;
  return isCardioExercise({ bodyParts });
}

export function isAerobicExtraExercise({
  name = "",
  bodyParts = [],
  targetMuscles = [],
  equipments = [],
  equipment = "",
} = {}) {
  if (isOfficialCardioExercise({ name, bodyParts, equipment, equipments })) return false;
  if (AEROBIC_EQUIPMENT_KEYS.includes(equipment)) return true;
  return isAerobicExercise({ name, bodyParts, targetMuscles, equipments });
}

const AEROBIC_NAME =
  /\b(jump|jumps|skip|sprint|sprints|burpee|mountain climber|jumping jack|high knee|jump rope|kettlebell swing|skater|box jump|shuffle|bear crawl|aerobic)\b/i;
const NOT_AEROBIC_NAME =
  /\b(stretch|depth jump|push-up depth|push up depth|yoga|asana|pose|facing dog|sphinx)\b/i;
const NOT_AEROBIC_EQUIPMENT = new Set([
  "barbell",
  "olympic barbell",
  "ez barbell",
  "cable",
  "smith machine",
]);

export function isAerobicExercise({
  name = "",
  bodyParts = [],
  targetMuscles = [],
  equipments = [],
} = {}) {
  if (isJunkEnduranceName(name)) return false;
  const label = String(name || "");
  if (NOT_AEROBIC_NAME.test(label)) return false;
  const gear = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "")
      .trim()
      .toLowerCase(),
  );
  if (gear.some((item) => NOT_AEROBIC_EQUIPMENT.has(item))) return false;
  if (isCardioExercise({ bodyParts })) return true;
  const muscles = (Array.isArray(targetMuscles) ? targetMuscles : [])
    .map((item) => String(item || "").toLowerCase())
    .join(" ");
  if (muscles.includes("cardiovascular")) return true;
  return AEROBIC_NAME.test(label);
}
