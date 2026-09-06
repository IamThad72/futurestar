<template>
  <main>
    <div v-if="!auth.ready" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading session...</p>
    </div>

    <div
      v-else-if="!auth.user"
      class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      You must be logged in to use the garage.
    </div>

    <template v-else>
      <header class="pb-4 pt-6 sm:pb-6">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div>
            <NuxtLink
              to="/estate_mgmt"
              class="text-sm font-medium text-base-content/60 hover:text-primary md:text-base"
            >
              ← Estate Management
            </NuxtLink>
            <h1 class="mt-1 text-lg font-semibold text-base-content md:text-xl">Garage</h1>
            <p class="mt-0.5 text-xs text-base-content/60">
              Select a vehicle to view service history and recommendations.
            </p>
          </div>
        </div>
      </header>

      <div v-if="loading" class="mx-auto max-w-7xl px-4 py-8 text-sm text-gray-500 sm:px-6 lg:px-8 dark:text-gray-400">
        Loading vehicles...
      </div>
      <div v-else-if="error" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {{ error }}
        </p>
      </div>
      <div v-else class="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <EstateRecordList
          :items="sortedVehicles"
          item-key="vh_id"
          :columns="columns"
          :sort-state="sortState"
          :map-row="mapVehicleRow"
          empty-text="No vehicles yet. Add one from Estate Management."
          click-emits="select"
          @sort="setSort"
          @select="openVehicle"
        />
      </div>
    </template>
  </main>
</template>

<script setup>
useHead({ title: "Garage" });

const auth = useAuthStore();
const loading = ref(true);
const error = ref("");
const vehicles = ref([]);
const sortState = ref({ key: "make", dir: "asc" });

const columns = [
  { k: "make", l: "Make" },
  { k: "model", l: "Model" },
  { k: "year", l: "Year" },
  { k: "vin", l: "VIN", desktopOnly: true },
  { k: "value", l: "Value" },
];

function formatMoney(val) {
  if (val == null || val === "") return "—";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function mapVehicleRow(r) {
  const title = [r.year, r.make, r.model].filter(Boolean).join(" ") || "—";
  return {
    title,
    subtitle: r.vin ? `VIN ${r.vin}` : undefined,
    note: formatMoney(r.value),
    lines: r.description ? [{ label: "Notes", value: r.description }] : [],
  };
}

function compareValues(a, b, key) {
  const av = a?.[key];
  const bv = b?.[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
}

const sortedVehicles = computed(() => {
  const list = [...vehicles.value];
  const { key, dir } = sortState.value;
  if (!key) return list;
  list.sort((a, b) => {
    const cmp = compareValues(a, b, key);
    return dir === "asc" ? cmp : -cmp;
  });
  return list;
});

function setSort(key) {
  if (sortState.value.key === key) {
    sortState.value = { key, dir: sortState.value.dir === "asc" ? "desc" : "asc" };
  } else {
    sortState.value = { key, dir: "asc" };
  }
}

function openVehicle(item) {
  if (!item?.vh_id) return;
  void navigateTo(`/garage/${item.vh_id}`);
}

async function loadVehicles() {
  loading.value = true;
  error.value = "";
  try {
    const res = await $fetch("/api/garage/vehicles");
    vehicles.value = res?.vehicles ?? [];
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to load vehicles.";
    vehicles.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => Boolean(auth.ready && auth.user),
  (ok) => {
    if (ok) void loadVehicles();
    else if (auth.ready) loading.value = false;
  },
  { immediate: true },
);
</script>
