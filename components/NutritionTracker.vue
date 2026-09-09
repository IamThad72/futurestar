<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end gap-3">
      <label class="form-control w-full max-w-xs">
        <span class="label py-1">
          <span class="label-text text-sm text-gray-600 dark:text-gray-300">Day</span>
        </span>
        <input v-model="eatenOn" type="date" class="input input-bordered w-full" />
      </label>
      <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="eatenOn = todayIso()">Today</button>
    </div>

    <NutritionDailyChart
      v-if="!isNarrow"
      v-model:days="chartRangeDays"
      :data="historyDays"
      :loading="historyLoading"
      :error="historyError"
    />

    <section class="app-card px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ eatenOnLabel }} vs plan</h2>
      <p v-if="!comparison?.targets" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Save a daily plan to compare what you eat against targets.
      </p>
      <ul class="mt-3 space-y-3">
        <li v-for="row in macroRows" :key="row.key">
          <div class="flex items-baseline justify-between gap-2 text-sm">
            <span class="font-medium text-gray-800 dark:text-gray-100">{{ row.label }}</span>
            <span class="tabular-nums text-gray-600 dark:text-gray-300">
              {{ row.consumedLabel }}
              <span v-if="row.targetLabel"> / {{ row.targetLabel }}</span>
            </span>
          </div>
          <progress
            class="progress mt-1 w-full"
            :class="row.over ? 'progress-error' : 'progress-primary'"
            :value="row.percent"
            max="100"
          />
          <p v-if="row.remainingLabel" class="mt-0.5 text-xs" :class="row.over ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">
            {{ row.remainingLabel }}
          </p>
        </li>
      </ul>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="space-y-4">
        <div class="app-card px-4 py-4">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Log food</h2>
          <input
            v-model.trim="searchInput"
            type="search"
            class="input input-bordered mt-3 w-full"
            placeholder="Search your foods or USDA Foundation and branded foods"
            autocomplete="off"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your custom foods appear first. USDA search uses FoodData Central (Foundation and Branded).
          </p>
          <details class="mt-3 rounded-lg border border-gray-200 open:bg-gray-50 dark:border-white/10 dark:open:bg-white/5">
            <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-primary">
              Add custom food
            </summary>
            <form class="grid gap-3 px-3 pb-3" @submit.prevent="saveCustomFood(false)">
              <label class="form-control">
                <span class="label py-1"><span class="label-text text-sm">Name</span></span>
                <input
                  v-model.trim="customForm.name"
                  type="text"
                  maxlength="160"
                  class="input input-bordered w-full"
                  placeholder="e.g. Homemade chili"
                  required
                />
              </label>
              <label class="form-control">
                <span class="label py-1"><span class="label-text text-sm">Brand (optional)</span></span>
                <input
                  v-model.trim="customForm.brand"
                  type="text"
                  maxlength="80"
                  class="input input-bordered w-full"
                />
              </label>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="form-control">
                  <span class="label py-1"><span class="label-text text-sm">Serving label</span></span>
                  <input
                    v-model.trim="customForm.serving_label"
                    type="text"
                    maxlength="80"
                    class="input input-bordered w-full"
                    placeholder="1 bowl"
                    required
                  />
                </label>
                <label class="form-control">
                  <span class="label py-1">
                    <span class="label-text text-sm">Serving weight (oz)</span>
                    <span v-if="customServingGramsPreview" class="label-text-alt text-xs text-gray-500">
                      ≈ {{ customServingGramsPreview }} g
                    </span>
                  </span>
                  <input
                    v-model="customForm.serving_oz"
                    type="number"
                    min="0.01"
                    step="0.01"
                    class="input input-bordered w-full"
                    required
                  />
                </label>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Macros for one serving (same as a nutrition label).</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="form-control">
                  <span class="label py-1"><span class="label-text text-sm">Calories</span></span>
                  <input v-model="customForm.kcal" type="number" min="0" step="1" class="input input-bordered w-full" required />
                </label>
                <label class="form-control">
                  <span class="label py-1"><span class="label-text text-sm">Protein (g)</span></span>
                  <input v-model="customForm.protein_g" type="number" min="0" step="0.1" class="input input-bordered w-full" required />
                </label>
                <label class="form-control">
                  <span class="label py-1"><span class="label-text text-sm">Fat (g)</span></span>
                  <input v-model="customForm.fat_g" type="number" min="0" step="0.1" class="input input-bordered w-full" required />
                </label>
                <label class="form-control">
                  <span class="label py-1"><span class="label-text text-sm">Carbohydrate (g)</span></span>
                  <input v-model="customForm.carb_g" type="number" min="0" step="0.1" class="input input-bordered w-full" required />
                </label>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="form-control">
                  <span class="label py-1"><span class="label-text text-sm">Meal</span></span>
                  <select v-model="logForm.meal" class="select select-bordered w-full">
                    <option v-for="meal in mealOptions" :key="`custom-${meal.value}`" :value="meal.value">{{ meal.label }}</option>
                  </select>
                </label>
                <label class="form-control">
                  <span class="label py-1"><span class="label-text text-sm">Time</span></span>
                  <input v-model="logForm.time" type="time" class="input input-bordered w-full" required />
                </label>
              </div>
              <p v-if="customError" class="text-sm text-red-600 dark:text-red-400">{{ customError }}</p>
              <p v-else-if="customNotice" class="text-sm text-emerald-700 dark:text-emerald-400">{{ customNotice }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="submit" class="training-chip btn btn-ghost btn-sm rounded-full" :disabled="savingCustom">
                  {{ savingCustom ? "Saving…" : "Save to my foods" }}
                </button>
                <button
                  type="button"
                  class="training-chip btn btn-primary btn-sm rounded-full"
                  :disabled="savingCustom"
                  @click="saveCustomFood(true)"
                >
                  {{ savingCustom ? "Saving…" : "Save and add to log" }}
                </button>
              </div>
            </form>
          </details>
          <p v-if="searchError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ searchError }}</p>
          <p v-else-if="fdcSearchMessage" class="mt-2 text-sm text-amber-700 dark:text-amber-400">{{ fdcSearchMessage }}</p>
          <p v-else-if="searching" class="mt-2 text-sm text-gray-500 dark:text-gray-400">Searching…</p>
          <p v-else-if="searchInput.trim().length === 1" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Type at least 2 characters to search USDA, or pick one of your foods below.
          </p>
          <p v-if="!searchError && searched && !foods.length && !searching" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No foods matched. Add a custom food, or try a different USDA or brand name.
          </p>
          <p v-else-if="!searchError && !searchInput.trim() && foods.length" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Your foods
          </p>
          <p v-else-if="!searchError && !searchInput.trim() && !foods.length && !searching" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No custom foods yet. Add one above, or search USDA.
          </p>
          <ul v-if="visibleFoods.length" class="mt-3 max-h-56 space-y-1 overflow-y-auto">
            <li v-for="food in visibleFoods" :key="foodSearchKey(food)">
              <button
                type="button"
                class="w-full rounded-md px-2 py-1.5 text-left text-sm no-underline hover:bg-gray-100 dark:hover:bg-white/10"
                :class="isSelectedFood(food) ? 'bg-primary/10' : ''"
                @click="selectFood(food)"
              >
                <span class="block font-medium text-gray-900 dark:text-white">{{ foodSearchLabel(food) }}</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">
                  {{ foodSearchMeta(food) }}
                </span>
              </button>
            </li>
          </ul>

          <form v-if="selectedFood" class="mt-4 grid gap-3" @submit.prevent="logFood">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ foodSearchLabel(selectedFood) }}</p>
            <p v-if="isCustomFood(selectedFood) || isBrandedFood(selectedFood)" class="text-xs text-gray-500 dark:text-gray-400">
              {{ foodSearchMeta(selectedFood) }}
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="form-control">
                <span class="label py-1"><span class="label-text text-sm">Meal</span></span>
                <select v-model="logForm.meal" class="select select-bordered w-full">
                  <option v-for="meal in mealOptions" :key="meal.value" :value="meal.value">{{ meal.label }}</option>
                </select>
              </label>
              <label class="form-control">
                <span class="label py-1"><span class="label-text text-sm">Time</span></span>
                <input v-model="logForm.time" type="time" class="input input-bordered w-full" required />
              </label>
            </div>
            <label class="form-control">
              <span class="label py-1"><span class="label-text text-sm">Portion</span></span>
              <select v-model="logForm.portionId" class="select select-bordered w-full">
                <option value="">Custom weight (oz)</option>
                <option v-for="portion in selectedPortions" :key="portion.portion_id" :value="String(portion.portion_id)">
                  {{ portion.label || formatPortionDropdownLabel(portion) }}
                </option>
              </select>
            </label>
            <label v-if="logForm.portionId" class="form-control">
              <span class="label py-1"><span class="label-text text-sm">Servings</span></span>
              <input v-model="logForm.quantity" type="number" min="0.01" step="0.01" class="input input-bordered w-full" required />
            </label>
            <label v-else class="form-control">
              <span class="label py-1">
                <span class="label-text text-sm">Weight (oz)</span>
                <span v-if="customGramsPreview" class="label-text-alt text-xs text-gray-500">≈ {{ customGramsPreview }} g</span>
              </span>
              <input v-model="logForm.ounces" type="number" min="0.01" step="0.01" class="input input-bordered w-full" required />
            </label>
            <p v-if="logError" class="text-sm text-red-600 dark:text-red-400">{{ logError }}</p>
            <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full" :disabled="logging">
              {{ logging ? "Logging…" : "Add to log" }}
            </button>
          </form>
        </div>

        <div class="app-card px-4 py-4">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Food log</h2>
          <p v-if="loadError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
          <p v-else-if="loading" class="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading log…</p>
          <p v-else-if="!entries.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Nothing logged for this day yet.
          </p>
          <div v-else class="mt-3 space-y-4">
            <section v-for="group in groupedEntries" :key="group.meal">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ group.label }}
              </h3>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="entry in group.entries"
                  :key="entry.entry_id"
                  class="flex items-start justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-white/5"
                >
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ entry.food_description }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ entryServingLine(entry) }}
                    </p>
                    <p class="text-xs tabular-nums text-gray-600 dark:text-gray-300">
                      {{ formatMacro(entry.kcal, 0) }} kcal ·
                      P {{ formatWeightOzGrams(entry.protein_g) }} ·
                      F {{ formatWeightOzGrams(entry.fat_g) }} ·
                      C {{ formatWeightOzGrams(entry.carb_g) }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="training-chip btn btn-ghost btn-xs rounded-full text-red-600 dark:text-red-400"
                    :disabled="deletingId === entry.entry_id"
                    @click="deleteEntry(entry.entry_id)"
                  >
                    Remove
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </section>

      <section class="app-card px-4 py-4 lg:self-start">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Daily plan</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          One active private plan. Logged foods on a day are compared to these targets.
        </p>
        <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="savePlan">
          <label class="form-control sm:col-span-2">
            <span class="label py-1"><span class="label-text text-sm">Name</span></span>
            <input v-model.trim="planForm.name" type="text" maxlength="80" class="input input-bordered w-full" />
          </label>
          <label class="form-control">
            <span class="label py-1"><span class="label-text text-sm">Calories (kcal)</span></span>
            <input v-model="planForm.kcal" type="number" min="0" step="1" class="input input-bordered w-full" required />
          </label>
          <label class="form-control">
            <span class="label py-1">
              <span class="label-text text-sm">Protein (oz)</span>
              <span class="label-text-alt text-xs text-gray-500">≈ {{ formatPlanGrams(planForm.protein_oz) }} g</span>
            </span>
            <input v-model="planForm.protein_oz" type="number" min="0" step="0.01" class="input input-bordered w-full" required />
          </label>
          <label class="form-control">
            <span class="label py-1">
              <span class="label-text text-sm">Fat (oz)</span>
              <span class="label-text-alt text-xs text-gray-500">≈ {{ formatPlanGrams(planForm.fat_oz) }} g</span>
            </span>
            <input v-model="planForm.fat_oz" type="number" min="0" step="0.01" class="input input-bordered w-full" required />
          </label>
          <label class="form-control">
            <span class="label py-1">
              <span class="label-text text-sm">Carbohydrate (oz)</span>
              <span class="label-text-alt text-xs text-gray-500">≈ {{ formatPlanGrams(planForm.carb_oz) }} g</span>
            </span>
            <input v-model="planForm.carb_oz" type="number" min="0" step="0.01" class="input input-bordered w-full" required />
          </label>
          <div class="sm:col-span-2">
            <p v-if="planError" class="mb-2 text-sm text-red-600 dark:text-red-400">{{ planError }}</p>
            <p v-else-if="planNotice" class="mb-2 text-sm text-emerald-700 dark:text-emerald-400">{{ planNotice }}</p>
            <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full" :disabled="savingPlan">
              {{ savingPlan ? "Saving…" : "Save plan" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { parseFetchError } from "~/utils/parseFetchError";
import {
  formatPortionDropdownLabel,
  formatPortionGrams,
  formatPortionOunces,
  formatWeightOzGrams,
  ouncesToGrams,
} from "~/utils/foodPortionLabel";

const mealOptions = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "other", label: "Other" },
];

const mealLabels = Object.fromEntries(mealOptions.map((meal) => [meal.value, meal.label]));

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function eatenAtIso(dateStr, timeStr) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeStr || ""));
  if (!dateMatch || !timeMatch) return new Date().toISOString();
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] || 0);
  return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
}

function formatEatenTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function entryServingLine(entry) {
  const time = formatEatenTime(entry?.eaten_at);
  const portionName = displayPortionLabel(entry?.portion_label);
  const portion = `${entry?.quantity} × ${portionName}`;
  const weight = entry?.gram_weight ? ` · ${formatWeightOzGrams(entry.gram_weight)}` : "";
  return `${time ? `${time} · ` : ""}${portion}${weight}`;
}

function displayPortionLabel(label) {
  const raw = String(label || "").trim();
  if (!raw || raw === "custom grams") return "custom weight";
  return raw;
}

function foodSearchLabel(food) {
  return food?.description || food?.name || "";
}

function isCustomFood(food) {
  return Boolean(food?.user_food_id) || food?.source === "custom";
}

function foodSearchKey(food) {
  if (isCustomFood(food)) return `custom-${food.user_food_id || food.description}`;
  return `fdc-${food?.fdc_id || food?.description}`;
}

function isBrandedFood(food) {
  return Boolean(food?.is_branded) || String(food?.data_type || "").toLowerCase() === "branded";
}

function foodSearchMeta(food) {
  if (isCustomFood(food)) {
    const brand = food?.brand_name || food?.brand_owner;
    const serving = food?.serving_label || "1 serving";
    const kcal = `${formatMacro(food?.kcal_per_100g, 0)} kcal / ${formatWeightOzGrams(100)}`;
    return brand ? `Your food · ${brand} · ${serving} · ${kcal}` : `Your food · ${serving} · ${kcal}`;
  }
  const brand = food?.brand_name || food?.brand_owner;
  const kind = isBrandedFood(food) ? "Branded" : food?.category || food?.data_type || "USDA";
  const kcal = `${formatMacro(food?.kcal_per_100g, 0)} kcal / ${formatWeightOzGrams(100)}`;
  if (isBrandedFood(food) && brand) return `${kind} · ${brand} · ${kcal}`;
  return `${kind} · ${kcal}`;
}

function formatMacro(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function remainingTextKcal(remaining) {
  if (remaining == null) return "";
  const n = Number(remaining);
  if (!Number.isFinite(n)) return "";
  if (n >= 0) return `${formatMacro(n, 0)} kcal left`;
  return `${formatMacro(Math.abs(n), 0)} kcal over`;
}

function remainingMassText(remainingGrams) {
  if (remainingGrams == null) return "";
  const n = Number(remainingGrams);
  if (!Number.isFinite(n)) return "";
  const label = formatWeightOzGrams(Math.abs(n)) || "0 oz";
  if (n >= 0) return `${label} left`;
  return `${label} over`;
}

function formatPlanGrams(ounces) {
  const grams = ouncesToGrams(ounces);
  if (grams == null) return "0";
  return formatPortionGrams(grams) || "0";
}

function emptyPlanForm() {
  return {
    name: "Daily plan",
    kcal: "2000",
    protein_oz: formatPortionOunces(150) || "5.29",
    fat_oz: formatPortionOunces(65) || "2.29",
    carb_oz: formatPortionOunces(200) || "7.05",
  };
}

function emptyCustomForm() {
  return {
    name: "",
    brand: "",
    serving_label: "1 serving",
    serving_oz: formatPortionOunces(100) || "3.53",
    kcal: "",
    protein_g: "",
    fat_g: "",
    carb_g: "",
  };
}

const eatenOn = ref(todayIso());
const loading = ref(false);
const loadError = ref("");
const entries = ref([]);
const comparison = ref(null);
const planForm = ref(emptyPlanForm());
const savingPlan = ref(false);
const planError = ref("");
const planNotice = ref("");
const searchInput = ref("");
const foods = ref([]);
const searching = ref(false);
const searched = ref(false);
const searchError = ref("");
const fdcSearchMessage = ref("");
const selectedFood = ref(null);
const selectedPortions = ref([]);
const logForm = ref({ meal: "breakfast", time: localTimeValue(), portionId: "", quantity: "1", ounces: formatPortionOunces(100) || "3.53" });
const logging = ref(false);
const logError = ref("");
const customForm = ref(emptyCustomForm());
const savingCustom = ref(false);
const customError = ref("");
const customNotice = ref("");
const deletingId = ref(null);
const { isNarrow } = useMobileShell();
const chartRangeDays = ref(7);
const historyDays = ref([]);
const historyLoading = ref(false);
const historyError = ref("");

const eatenOnLabel = computed(() => (eatenOn.value === todayIso() ? "Today" : eatenOn.value));

const customGramsPreview = computed(() => formatPlanGrams(logForm.value.ounces));
const customServingGramsPreview = computed(() => formatPlanGrams(customForm.value.serving_oz));
const visibleFoods = computed(() => foods.value);

const macroRows = computed(() => {
  const consumed = comparison.value?.consumed || {};
  const targets = comparison.value?.targets;
  const remaining = comparison.value?.remaining;
  const rows = [
    {
      key: "kcal",
      label: "Calories",
      consumed: consumed.kcal,
      target: targets?.kcal,
      remainingLabel: remainingTextKcal(remaining?.kcal),
      consumedLabel: `${formatMacro(consumed.kcal, 0)} kcal`,
      targetLabel: targets?.kcal != null ? `${formatMacro(targets.kcal, 0)} kcal` : "",
    },
    {
      key: "protein_g",
      label: "Protein",
      consumed: consumed.protein_g,
      target: targets?.protein_g,
      remainingLabel: remainingMassText(remaining?.protein_g),
      consumedLabel: formatWeightOzGrams(consumed.protein_g) || "0 oz",
      targetLabel: targets?.protein_g != null ? formatWeightOzGrams(targets.protein_g) : "",
    },
    {
      key: "fat_g",
      label: "Fat",
      consumed: consumed.fat_g,
      target: targets?.fat_g,
      remainingLabel: remainingMassText(remaining?.fat_g),
      consumedLabel: formatWeightOzGrams(consumed.fat_g) || "0 oz",
      targetLabel: targets?.fat_g != null ? formatWeightOzGrams(targets.fat_g) : "",
    },
    {
      key: "carb_g",
      label: "Carbohydrate",
      consumed: consumed.carb_g,
      target: targets?.carb_g,
      remainingLabel: remainingMassText(remaining?.carb_g),
      consumedLabel: formatWeightOzGrams(consumed.carb_g) || "0 oz",
      targetLabel: targets?.carb_g != null ? formatWeightOzGrams(targets.carb_g) : "",
    },
  ];
  return rows.map((row) => {
    const target = row.target == null ? null : Number(row.target);
    const value = Number(row.consumed) || 0;
    const percent = target && target > 0 ? Math.min(100, (value / target) * 100) : 0;
    return {
      ...row,
      percent,
      over: target != null && value > target,
    };
  });
});

const groupedEntries = computed(() => {
  const groups = [];
  const byMeal = new Map();
  for (const entry of entries.value) {
    const meal = entry.meal || entry.meal_type || "other";
    if (!byMeal.has(meal)) byMeal.set(meal, []);
    byMeal.get(meal).push(entry);
  }
  for (const meal of mealOptions.map((item) => item.value)) {
    const list = byMeal.get(meal);
    if (!list?.length) continue;
    list.sort((a, b) => {
      const ta = a.eaten_at ? new Date(a.eaten_at).getTime() : 0;
      const tb = b.eaten_at ? new Date(b.eaten_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return (a.entry_id || 0) - (b.entry_id || 0);
    });
    groups.push({ meal, label: mealLabels[meal], entries: list });
  }
  return groups;
});

let searchTimer = null;
let searchAbort = null;

watch(eatenOn, () => {
  void loadDay();
});

watch(chartRangeDays, () => {
  if (!isNarrow.value) void loadHistory();
});

watch(isNarrow, (narrow) => {
  if (!narrow) void loadHistory();
});

watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void searchFoods(value);
  }, 400);
});

onMounted(() => {
  void loadDay();
  void searchFoods("");
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  searchAbort?.abort();
});

function applyPlan(plan) {
  if (!plan) {
    planForm.value = emptyPlanForm();
    return;
  }
  planForm.value = {
    name: plan.name || "Daily plan",
    kcal: String(plan.kcal ?? ""),
    protein_oz: formatPortionOunces(plan.protein_g) || "0",
    fat_oz: formatPortionOunces(plan.fat_g) || "0",
    carb_oz: formatPortionOunces(plan.carb_g) || "0",
  };
}

async function loadHistory() {
  historyLoading.value = true;
  historyError.value = "";
  try {
    const data = await $fetch("/api/physical/nutrition/history", {
      query: { date: eatenOn.value, days: chartRangeDays.value },
    });
    historyDays.value = data?.days || [];
  } catch (error) {
    historyError.value = parseFetchError(error, "Failed to load nutrition chart.");
    historyDays.value = [];
  } finally {
    historyLoading.value = false;
  }
}

async function loadDay() {
  loading.value = true;
  loadError.value = "";
  try {
    const tasks = [$fetch("/api/physical/nutrition/daily", { query: { date: eatenOn.value } })];
    if (!isNarrow.value) tasks.push(loadHistory());
    const [data] = await Promise.all(tasks);
    entries.value = data?.entries || [];
    comparison.value = data?.comparison || null;
    applyPlan(data?.plan || null);
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to load nutrition for this day.");
  } finally {
    loading.value = false;
  }
}

async function savePlan() {
  savingPlan.value = true;
  planError.value = "";
  planNotice.value = "";
  try {
    const data = await $fetch("/api/physical/nutrition/plan", {
      method: "PUT",
      body: {
        name: planForm.value.name,
        kcal: Number(planForm.value.kcal),
        protein_g: ouncesToGrams(planForm.value.protein_oz) ?? 0,
        fat_g: ouncesToGrams(planForm.value.fat_oz) ?? 0,
        carb_g: ouncesToGrams(planForm.value.carb_oz) ?? 0,
      },
    });
    applyPlan(data?.plan || null);
    planNotice.value = "Plan saved.";
    await loadDay();
  } catch (error) {
    planError.value = parseFetchError(error, "Failed to save nutrition plan.");
  } finally {
    savingPlan.value = false;
  }
}

async function searchFoods(query) {
  const q = String(query || "").trim();
  if (q.length === 1) {
    searchAbort?.abort();
    searching.value = false;
    searched.value = false;
    searchError.value = "";
    fdcSearchMessage.value = "";
    return;
  }
  searchAbort?.abort();
  const ac = new AbortController();
  searchAbort = ac;
  searching.value = q.length >= 2;
  searchError.value = "";
  fdcSearchMessage.value = "";
  searched.value = q.length >= 2;
  try {
    const data = await $fetch("/api/physical/nutrition/foods", {
      query: q ? { q } : {},
      signal: ac.signal,
    });
    if (searchAbort !== ac) return;
    foods.value = data?.foods || [];
    fdcSearchMessage.value = data?.fdc_search?.message || "";
  } catch (error) {
    if (searchAbort !== ac || error?.name === "AbortError" || error?.cause?.name === "AbortError") return;
    foods.value = [];
    fdcSearchMessage.value = "";
    searchError.value = parseFetchError(error, "Failed to search foods.");
  } finally {
    if (searchAbort === ac) searching.value = false;
  }
}

function applySelectedFood(food, portions = []) {
  selectedFood.value = food;
  selectedPortions.value = portions;
  logForm.value = {
    meal: logForm.value.meal || "breakfast",
    time: logForm.value.time || localTimeValue(),
    portionId: portions[0] ? String(portions[0].portion_id) : "",
    quantity: "1",
    ounces: formatPortionOunces(food.serving_g || portions[0]?.gram_weight || 100) || "3.53",
  };
}

function isSelectedFood(food) {
  if (!selectedFood.value) return false;
  if (isCustomFood(food) || isCustomFood(selectedFood.value)) {
    return Number(selectedFood.value.user_food_id) === Number(food.user_food_id);
  }
  return Number(selectedFood.value.fdc_id) === Number(food.fdc_id);
}

async function selectFood(food) {
  applySelectedFood(food, food.portions || []);
  logError.value = "";
  try {
    const query = isCustomFood(food)
      ? { user_food_id: food.user_food_id }
      : { fdc_id: food.fdc_id };
    const data = await $fetch("/api/physical/nutrition/foods", { query });
    applySelectedFood(data?.food || food, data?.food?.portions || food.portions || []);
  } catch (error) {
    logError.value = parseFetchError(error, "Failed to load food portions.");
  }
}

function scaleMacro(per100, grams) {
  const n = Number(per100);
  const g = Number(grams);
  if (!Number.isFinite(n) || !Number.isFinite(g) || g <= 0) return null;
  return (n * g) / 100;
}

function customFoodPayload() {
  const servingG = ouncesToGrams(customForm.value.serving_oz);
  return {
    name: customForm.value.name,
    brand: customForm.value.brand,
    serving_label: customForm.value.serving_label,
    serving_g: servingG,
    kcal: Number(customForm.value.kcal),
    protein_g: Number(customForm.value.protein_g),
    fat_g: Number(customForm.value.fat_g),
    carb_g: Number(customForm.value.carb_g),
  };
}

async function saveCustomFood(alsoLog) {
  const payload = customFoodPayload();
  const macros = [payload.kcal, payload.protein_g, payload.fat_g, payload.carb_g];
  if (!payload.name || !(payload.serving_g > 0)) {
    customError.value = "Enter a name and serving weight.";
    return;
  }
  if (macros.some((n) => !Number.isFinite(n) || n < 0) || customForm.value.kcal === "") {
    customError.value = "Enter calories and macros for one serving.";
    return;
  }
  savingCustom.value = true;
  customError.value = "";
  customNotice.value = "";
  try {
    const data = await $fetch("/api/physical/nutrition/user-foods", {
      method: "POST",
      body: payload,
    });
    const food = data?.food;
    if (!food) throw new Error("Missing custom food.");
    customForm.value = emptyCustomForm();
    applySelectedFood(food, food.portions || []);
    foods.value = [
      food,
      ...foods.value.filter((item) => Number(item.user_food_id) !== Number(food.user_food_id)),
    ];
    if (alsoLog) {
      await logSelectedFood();
      customNotice.value = "Saved and added to today’s log.";
    } else {
      customNotice.value = "Saved to your foods.";
    }
  } catch (error) {
    customError.value = parseFetchError(error, "Failed to save custom food.");
  } finally {
    savingCustom.value = false;
  }
}

async function logSelectedFood() {
  const food = selectedFood.value;
  if (!food || (!food.fdc_id && !food.user_food_id)) {
    throw new Error("Select a food first.");
  }
  const usingPortion = Boolean(logForm.value.portionId);
  const quantity = usingPortion ? Number(logForm.value.quantity) : 1;
  const portion = usingPortion
    ? selectedPortions.value.find((item) => String(item.portion_id) === String(logForm.value.portionId))
    : null;
  const gramWeight = usingPortion
    ? Number(portion?.gram_weight) * quantity
    : ouncesToGrams(logForm.value.ounces);
  if (!Number.isFinite(gramWeight) || gramWeight <= 0) {
    throw new Error("Enter ounces or choose a serving.");
  }
  await $fetch("/api/physical/nutrition/intake", {
    method: "POST",
    body: {
      eaten_on: eatenOn.value,
      eaten_at: eatenAtIso(eatenOn.value, logForm.value.time),
      meal_type: logForm.value.meal,
      fdc_id: food.fdc_id || null,
      user_food_id: food.user_food_id || null,
      portion_id: usingPortion ? Number(logForm.value.portionId) : null,
      quantity,
      gram_weight: gramWeight,
      food_name: food.description,
      portion_label: usingPortion
        ? portion?.measure_name || portion?.unit || portion?.label || "portion"
        : "custom weight",
      kcal_per_100g: food.kcal_per_100g,
      protein_g_per_100g: food.protein_g_per_100g,
      fat_g_per_100g: food.fat_g_per_100g,
      carb_g_per_100g: food.carb_g_per_100g,
      kcal: scaleMacro(food.kcal_per_100g, gramWeight),
      protein_g: scaleMacro(food.protein_g_per_100g, gramWeight),
      fat_g: scaleMacro(food.fat_g_per_100g, gramWeight),
      carb_g: scaleMacro(food.carb_g_per_100g, gramWeight),
    },
  });
  await loadDay();
}

async function logFood() {
  if (!selectedFood.value || (!selectedFood.value.fdc_id && !selectedFood.value.user_food_id)) return;
  logging.value = true;
  logError.value = "";
  try {
    await logSelectedFood();
  } catch (error) {
    logError.value = parseFetchError(error, "Failed to log food.");
  } finally {
    logging.value = false;
  }
}

async function deleteEntry(entryId) {
  deletingId.value = entryId;
  loadError.value = "";
  try {
    await $fetch(`/api/physical/nutrition/intake/${entryId}`, { method: "DELETE" });
    await loadDay();
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to remove that food.");
  } finally {
    deletingId.value = null;
  }
}
</script>
