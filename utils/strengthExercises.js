/** Pulling strength work: dumbbells, kettlebells, bands, or no weights. */

export const STRENGTH_EQUIPMENT = [
  { key: "dumbbell", label: "Dumbbells" },
  { key: "kettlebell", label: "Kettlebells" },
  { key: "body", label: "Body resistance / No weights" },
];

export const STRENGTH_EQUIPMENT_KEYS = STRENGTH_EQUIPMENT.map((item) => item.key);

export const STRENGTH_EXERCISES = [
  {
    id: "one-arm-row",
    name: "One-Arm Dumbbell Row",
    equipment: "dumbbell",
    description:
      "A single-arm row with a hand and knee on a bench, chair, or sturdy surface to train the back and even out left-right strength.",
    instructions: [
      "Place the left hand and left knee on a bench or chair; right foot on the floor, right hand holding a dumbbell.",
      "Keep the back flat and the neck in line with the spine.",
      "Pull the dumbbell toward the hip, leading with the elbow. Squeeze the shoulder blade at the top.",
      "Lower until the arm is long without rotating the torso.",
      "Finish the set, then switch sides.",
    ],
    benefits: [
      "Strengthens lats, mid-back, and biceps",
      "Fixes side-to-side imbalances",
      "Supports posture and pulling strength",
    ],
    sets: "3",
    repetitions: "8–12 per arm",
    rest: "60–90 seconds",
  },
  {
    id: "two-arm-row",
    name: "Two-Arm Dumbbell Row",
    equipment: "dumbbell",
    description:
      "A hip-hinged row with a dumbbell in each hand. Both sides work together, so you can load a bit more than a single-arm row.",
    instructions: [
      "Hold a dumbbell in each hand, hinge at the hips, and keep a flat back with a soft knee bend.",
      "Let the arms hang long under the shoulders, palms facing in.",
      "Pull both elbows toward the hips and squeeze the shoulder blades.",
      "Lower with control. Do not jerk the torso up to move the weights.",
    ],
    benefits: [
      "Builds bilateral pulling strength",
      "Trains the upper back and grip together",
      "Simple setup with a pair of dumbbells",
    ],
    sets: "3",
    repetitions: "8–12",
    rest: "60–90 seconds",
  },
  {
    id: "rear-delt-fly",
    name: "Dumbbell Rear Delt Fly",
    equipment: "dumbbell",
    description:
      "A light hinge-and-raise that targets the rear shoulders and upper back, balancing all the pressing in daily life.",
    instructions: [
      "Hinge at the hips with a flat back, dumbbells hanging under the shoulders, palms facing in.",
      "With a soft elbow, raise the arms out to the sides until they are about in line with the torso.",
      "Lead with the pinkies and squeeze the rear delts; do not shrug the traps.",
      "Lower slowly. Use a light load so the neck stays relaxed.",
    ],
    benefits: [
      "Strengthens rear delts and posture muscles",
      "Balances chest and pressing work",
      "Easy to do at home with light dumbbells",
    ],
    sets: "3",
    repetitions: "10–15",
    rest: "45–60 seconds",
  },
  {
    id: "dumbbell-curl",
    name: "Dumbbell Biceps Curl",
    equipment: "dumbbell",
    description:
      "The basic elbow-flexion pull for the biceps. Stand tall and keep the elbows close to the ribs.",
    instructions: [
      "Stand with a dumbbell in each hand, arms long, palms forward or in.",
      "Brace the core and curl the weights toward the shoulders without swinging.",
      "Keep the elbows under the shoulders; do not let them drift forward.",
      "Lower until the arms are straight. Alternate arms if a pair of heavy bells is hard to control.",
    ],
    benefits: [
      "Builds biceps and grip for pulling and carrying",
      "Simple progression: add load or slow the lowering phase",
      "Pairs well with rows on pull days",
    ],
    sets: "3",
    repetitions: "8–12",
    rest: "45–60 seconds",
  },
  {
    id: "kettlebell-row",
    name: "Kettlebell Bent-Over Row",
    equipment: "kettlebell",
    description:
      "A single-arm row using a kettlebell. The offset handle challenges grip and keeps the elbow path honest.",
    instructions: [
      "Place one hand and the same-side knee on a bench or hinge and brace the free hand on a chair.",
      "Hold the kettlebell in the working hand, arm long, back flat.",
      "Pull the bell toward the hip, leading with the elbow, without rotating the torso.",
      "Lower until the arm is straight. Finish the set, then switch sides.",
    ],
    benefits: [
      "Trains lats, mid-back, and grip",
      "The kettlebell handle is wrist-friendly for many people",
      "Easy to do one side at a time in a small space",
    ],
    sets: "3",
    repetitions: "8–12 per arm",
    rest: "60–90 seconds",
  },
  {
    id: "gorilla-row",
    name: "Kettlebell Gorilla Row",
    equipment: "kettlebell",
    description:
      "A wide, hinged row with two kettlebells on the floor. You row one bell at a time while the other stays planted.",
    instructions: [
      "Stand over two kettlebells, hinge to a flat back, and grip both handles.",
      "Row one bell to the hip while pressing the other bell into the floor.",
      "Keep the hips square; do not twist to yank the weight.",
      "Lower and row the other side. That is one pair of reps.",
    ],
    benefits: [
      "Builds a strong horizontal pull with a stable hinge",
      "Challenges anti-rotation through the trunk",
      "Uses a pair of kettlebells and little floor space",
    ],
    sets: "3",
    repetitions: "8–10 per arm",
    rest: "60–90 seconds",
  },
  {
    id: "kettlebell-high-pull",
    name: "Kettlebell High Pull",
    equipment: "kettlebell",
    description:
      "A hip-driven pull that brings the kettlebell from the floor or hang to chest height. Keep it a pull, not a swing into the chin.",
    instructions: [
      "Stand over a kettlebell, hinge, and grip the handle with one or both hands.",
      "Drive the hips forward and pull the elbow high and out, keeping the bell close to the body.",
      "Stop at about chest height. The elbow stays above the bell.",
      "Return to the hinge with control. Start light until the path is clean.",
    ],
    benefits: [
      "Trains a powerful pull through hips, back, and upper arms",
      "Carries over to picking things up quickly",
      "One kettlebell is enough",
    ],
    sets: "3",
    repetitions: "6–10 per side",
    rest: "60–90 seconds",
  },
  {
    id: "inverted-row",
    name: "Table or Towel Row",
    equipment: "body",
    description:
      "A pulling move using a sturdy table edge, or a towel around a solid post, to train the back and biceps with no weights.",
    instructions: [
      "Lie under a solid table and hold the edge with both hands, or loop a towel around a secure post at chest height.",
      "Keep the body straight from head to heels, heels on the floor.",
      "Pull the chest toward the hands, squeezing the shoulder blades together.",
      "Lower with control until the arms are straight.",
      "Only use furniture that cannot tip. If nothing is available, do Superman holds instead: lie face down and lift chest and legs slightly.",
    ],
    benefits: [
      "Balances pushing work with a pulling pattern",
      "Strengthens upper back, rear shoulders, and grip",
      "Helps posture from sitting",
    ],
    sets: "3",
    repetitions: "8–12",
    rest: "60–90 seconds",
  },
  {
    id: "pull-up",
    name: "Pull-Up or Hang Row",
    equipment: "body",
    description:
      "A vertical pull on a bar, playground rings, or a sturdy door-frame bar. Use a foot assist or hold a dead hang if a full pull-up is too hard.",
    instructions: [
      "Grip a bar slightly wider than the shoulders, palms away (pull-up) or toward you (chin-up).",
      "Hang with the shoulders packed down, legs still.",
      "Pull the chest toward the bar, leading with the elbows, without kipping.",
      "Lower until the arms are long. To make it easier, keep the feet on a chair and row the chest to the bar.",
    ],
    benefits: [
      "Builds lat, biceps, and grip strength",
      "The main no-weight vertical pull",
      "Scales from foot-assisted rows to full hangs and pull-ups",
    ],
    sets: "3",
    repetitions: "3–8 or 8–12 assisted",
    rest: "90 seconds",
  },
  {
    id: "chin-up",
    name: "Chin-Up",
    equipment: "body",
    description:
      "A vertical pull with the palms facing you. The underhand grip usually lets you recruit more biceps than a pull-up.",
    instructions: [
      "Grip a bar about shoulder-width, palms toward you, and hang with the shoulders packed down.",
      "Pull the chest toward the bar without swinging the legs.",
      "Lower until the arms are long. Keep the neck neutral.",
      "If a full chin-up is too hard, keep the feet on a chair and row the chest up, or hold a dead hang for time.",
    ],
    benefits: [
      "Builds biceps, lats, and grip",
      "Often easier than a pull-up for a first vertical pull",
      "No weights required",
    ],
    sets: "3",
    repetitions: "3–8 or 8–12 assisted",
    rest: "90 seconds",
  },
  {
    id: "prone-y-raise",
    name: "Prone Y Raise",
    equipment: "body",
    description:
      "Lie face down and raise the arms into a Y. It trains the lower traps and rear shoulders with no equipment.",
    instructions: [
      "Lie face down on the floor, forehead on a towel, arms reaching forward in a Y, thumbs up.",
      "Squeeze the shoulder blades down and back, then lift the arms a few inches off the floor.",
      "Keep the neck long; do not crane the head up.",
      "Lower with control. Small range is enough.",
    ],
    benefits: [
      "Strengthens postural pulling muscles",
      "No weights or band required",
      "Good filler between harder row sets",
    ],
    sets: "2–3",
    repetitions: "10–15",
    rest: "30–45 seconds",
  },
];

export function strengthExercisesByEquipment(equipmentKey) {
  if (!equipmentKey || equipmentKey === "all") return STRENGTH_EXERCISES;
  return STRENGTH_EXERCISES.filter((exercise) => exercise.equipment === equipmentKey);
}

export const EXERCISE_DB_EQUIPMENT_BY_KEY = {
  dumbbell: ["dumbbell"],
  kettlebell: ["kettlebell"],
  body: ["body weight"],
};

export const DEFAULT_STRENGTH_PROGRAM = {
  dumbbell: { sets: "3", repetitions: "8–12", rest: "60–90 seconds" },
  kettlebell: { sets: "3", repetitions: "8–12", rest: "60–90 seconds" },
  body: { sets: "3", repetitions: "8–15", rest: "60–90 seconds" },
};

export const DEFAULT_STRENGTH_BENEFITS = [
  "Builds pulling strength in the muscles listed",
  "Supports progressive overload when you add load or reps",
];

export const FEATURED_EXERCISE_DB_IDS = {
  "one-arm-row": "C0MA9bC",
  "two-arm-row": "BJ0Hz5L",
  "rear-delt-fly": "mu5Guxt",
  "dumbbell-curl": "3s4NnTh",
  "kettlebell-row": "g9AsZ8P",
  "kettlebell-high-pull": "8ARQ9Hw",
  "inverted-row": "bZGHsAZ",
  "pull-up": "0V2YQjW",
  "chin-up": "T2mxWqc",
};

export function gifUrlForFeatured(exerciseId) {
  const catalogId = FEATURED_EXERCISE_DB_IDS[exerciseId];
  return catalogId ? `https://static.exercisedb.dev/media/${catalogId}.gif` : null;
}

export const FEATURED_EXERCISE_DB_NAMES = {
  "one-arm-row": ["dumbbell one arm bent-over row"],
  "two-arm-row": ["dumbbell bent over row"],
  "rear-delt-fly": ["dumbbell rear delt raise", "dumbbell reverse fly"],
  "dumbbell-curl": ["dumbbell standing biceps curl", "dumbbell curl"],
  "kettlebell-row": ["kettlebell one arm row"],
  "gorilla-row": ["kettlebell gorilla row"],
  "kettlebell-high-pull": ["kettlebell sumo high pull", "kettlebell high pull"],
  "inverted-row": ["inverted row"],
  "pull-up": ["pull up (neutral grip)", "pull-up", "pull up"],
  "chin-up": ["chin-up"],
};

const PULL_NAME =
  /\b(row|rows|pull|pulls|pulldown|pull-down|pullover|pull-over|chin-?up|chin up|curl|shrug|inverted|face pull|high pull|gorilla)\b/i;
const PULL_MUSCLE =
  /\b(lats|latissimus|upper back|traps|trapezius|rhomboids|biceps|brachialis|rear deltoid|rear delts)\b/i;
const NOT_PULL_NAME =
  /\b(press|push-up|push up|squat|lunge|bench|flye?s?|crunch|plank|dip|burpee|calf|deadlift|pallof|bridge|carry|walk|jump|kick|extension|stretch|wrist|cable|yoga|asana|pose|facing dog|sphinx)\b/i;

export function usesBandEquipment(equipments = [], name = "") {
  if (/\bband\b/i.test(String(name || ""))) return true;
  return (Array.isArray(equipments) ? equipments : []).some((item) =>
    String(item || "").toLowerCase().includes("band"),
  );
}

export function isPullingExercise({ name = "", targetMuscles = [], bodyParts = [], equipments = [] } = {}) {
  const label = String(name || "");
  if (usesBandEquipment(equipments, label)) return false;
  if (/\b(reverse fly|rear delt|face pull)\b/i.test(label)) return true;
  if (NOT_PULL_NAME.test(label) && !PULL_NAME.test(label)) return false;
  if (PULL_NAME.test(label)) return true;
  const muscles = [...targetMuscles, ...bodyParts].join(" ");
  if (PULL_MUSCLE.test(muscles) && !NOT_PULL_NAME.test(label)) return true;
  return false;
}

export function equipmentKeyFromDb(equipments) {
  const names = (Array.isArray(equipments) ? equipments : []).map((item) =>
    String(item || "").trim().toLowerCase(),
  );
  if (names.includes("kettlebell")) return "kettlebell";
  if (names.includes("dumbbell")) return "dumbbell";
  if (names.includes("band") || names.includes("resistance band")) return null;
  if (names.includes("body weight")) return "body";
  return null;
}
