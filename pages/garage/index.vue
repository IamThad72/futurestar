<template>
  <section class="app-page">
    <p v-if="!auth.ready" class="text-sm text-muted">Loading…</p>
    <template v-else>
      <header class="page-header">
        <div class="page-header__copy">
          <h1>Garage</h1>
          <p class="page-header__lede">Vehicles and the service history that goes with them.</p>
        </div>
        <button v-if="auth.user" type="button" class="btn btn-primary" @click="openAddVehicle">Add a vehicle</button>
      </header>

      <p v-if="loading" class="text-sm text-muted">Loading…</p>
      <LoadErrorPanel v-else-if="error" :message="error" @retry="loadVehicles" />
      <EmptyState
        v-else-if="!sortedVehicles.length"
        title="No vehicles yet."
        sentence="Add a car or truck to keep its service history here."
        :action="auth.user ? 'Add a vehicle' : ''"
        @action="openAddVehicle"
      />
      <EstateRecordList
        v-else
        :items="sortedVehicles"
        item-key="vh_id"
        :columns="columns"
        :sort-state="sortState"
        :map-row="mapVehicleRow"
        empty-text="No vehicles yet."
        click-emits="select"
        @sort="setSort"
        @select="openVehicle"
      />
      <LazyAddEstateRecordModal v-if="addModalMounted" ref="addModalRef" @saved="loadVehicles" />
    </template>
  </section>
</template>

<script setup>
useHead({ title: "Garage" });

const auth = useAuthStore();
const loading = ref(true);
const error = ref("");
const addModalRef = ref(null);
const addModalMounted = ref(false);
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

async function openAddVehicle() {
  if (!auth.user) {
    error.value = SIGN_IN_MESSAGE;
    return;
  }
  addModalMounted.value = true;
  await nextTick();
  addModalRef.value?.open("vehicle");
}

async function loadVehicles() {
  if (!auth.user) {
    vehicles.value = [];
    error.value = "";
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const res = await $fetch("/api/garage/vehicles");
    vehicles.value = res?.vehicles ?? [];
  } catch (e) {
    vehicles.value = [];
    const failure = settleLoadError(e, "The garage could not be loaded. Try again in a moment.");
    error.value = failure.message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => auth.ready,
  (ready) => {
    if (ready) void loadVehicles();
  },
  { immediate: true },
);
</script>
