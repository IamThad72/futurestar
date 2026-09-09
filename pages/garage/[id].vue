<template>
  <main>
    <div v-if="!auth.ready" class="mx-auto max-w-7xl px-1 py-8 sm:px-6 lg:px-8">
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading session...</p>
    </div>

    <div
      v-else-if="!auth.user"
      class="mx-auto max-w-7xl px-1 py-8 sm:px-6 lg:px-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      You must be logged in to use the garage.
    </div>

    <template v-else>
      <header class="pb-4 pt-6 sm:pb-6">
        <div class="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4 px-1 sm:px-6 lg:px-8">
          <div>
            <NuxtLink
              to="/garage"
              class="text-sm font-medium text-gray-500 hover:text-gray-800 md:text-base dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Garage
            </NuxtLink>
            <h1 class="mt-1 text-base font-semibold text-gray-900 md:text-lg dark:text-white">
              {{ vehicleTitle }}
            </h1>
            <p v-if="vehicle?.vin" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">VIN {{ vehicle.vin }}</p>
          </div>
          <button type="button" class="estate-action-btn" @click="openAddModal">Add Service</button>
        </div>
      </header>

      <div v-if="loading" class="mx-auto max-w-7xl px-1 py-8 text-sm text-gray-500 sm:px-6 lg:px-8 dark:text-gray-400">
        Loading vehicle...
      </div>
      <div v-else-if="error" class="mx-auto max-w-7xl px-1 py-8 sm:px-6 lg:px-8">
        <p class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {{ error }}
        </p>
      </div>

      <div v-else class="mx-auto grid max-w-7xl gap-8 px-1 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 sm:px-6 lg:px-8">
        <section>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Known services</h2>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Service records you have entered for this vehicle.</p>

          <ul v-if="knownServices.length" class="mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:divide-white/10 dark:border-white/10">
            <li v-for="svc in knownServices" :key="svc.vsr_id" class="py-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ svc.service_name }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ formatDate(svc.service_date) }}
                    <span v-if="svc.mileage != null"> · {{ formatMiles(svc.mileage) }}</span>
                    <span v-if="svc.cost != null"> · {{ formatMoney(svc.cost) }}</span>
                  </p>
                  <p v-if="svc.notes" class="mt-1 text-xs text-gray-600 dark:text-gray-300">{{ svc.notes }}</p>
                </div>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-ghost btn-xs" @click="openEditModal(svc)">Edit</button>
                  <button type="button" class="btn btn-ghost btn-xs text-error" :disabled="deleteSavingId === svc.vsr_id" @click="deleteService(svc)">
                    {{ deleteSavingId === svc.vsr_id ? "..." : "Delete" }}
                  </button>
                </div>
              </div>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm italic text-gray-500 dark:text-gray-400">No service records yet.</p>
        </section>

        <aside class="lg:border-l lg:border-gray-100 lg:pl-8 dark:lg:border-white/10">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Recommended services</h2>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Suggested service plan from local OEM guidance for this make (no external lookup).
            <template v-if="String(recommendedSource || '').includes('acura')">
              Acura items follow the Maintenance Minder™ table in the
              <a
                class="underline hover:text-gray-700 dark:hover:text-gray-200"
                href="https://techinfo.honda.com/rjanisis/pubs/OM/AH/B3S52525OM/enu/B3S52525OMEN.PDF"
                target="_blank"
                rel="noopener noreferrer"
              >2025 Integra owner's manual</a>.
            </template>
            <template v-else-if="String(recommendedSource || '').includes('mini')">
              MINI items follow Condition Based Service (CBS) in the
              <a
                class="underline hover:text-gray-700 dark:hover:text-gray-200"
                href="https://www.miniusa.com/content/dam/mini/PDF/archiveownermanuals/my16/2016_MINI_Hardtop_owner_manual.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >2016 MINI Hardtop owner's manual</a>.
            </template>
            <template v-else-if="String(recommendedSource || '').includes('fj-om35a71u')">
              FJ Cruiser items follow the
              <a
                class="underline hover:text-gray-700 dark:hover:text-gray-200"
                href="https://assets.sipb.toyota.com/publications/en/om-s/OM35A71U/pdf/OM35A71U.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >2013 FJ Cruiser owner's manual</a>
              (MAINT REQD) and the FJ Cruiser Scheduled Maintenance Guide.
            </template>
            <template v-else-if="String(recommendedSource || '').includes('toyota')">
              Toyota items follow the
              <a
                class="underline hover:text-gray-700 dark:hover:text-gray-200"
                href="https://assets.sia.toyota.com/publications/en/omms-s/T-MMS-18CHR/pdf/T-MMS-18C-HR.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >2018 C-HR Warranty &amp; Maintenance Guide</a>.
            </template>
            <template v-else-if="String(recommendedSource || '').includes('mazda')">
              Mazda items follow the
              <a
                class="underline hover:text-gray-700 dark:hover:text-gray-200"
                href="https://www.mazdausa.com/siteassets/pdf/owners-optimized/2013/mazda3-5door/2013-mazda3-maintenance-schedule.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >2013 Mazda3 maintenance schedule</a>
              (USA Schedule 1).
            </template>
          </p>

          <p
            v-if="recommendedUnavailableReason"
            class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {{ recommendedUnavailableReason }}
          </p>

          <ul v-if="recommendedServices.length" class="mt-4 space-y-3">
            <li
              v-for="(svc, idx) in recommendedServices"
              :key="svc.vrsi_id || `${svc.service_name}-${idx}`"
              class="border-b border-gray-100 pb-3 last:border-0 dark:border-white/10"
            >
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ svc.service_name }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ formatInterval(svc) }}</p>
            </li>
          </ul>
          <p v-else-if="!recommendedUnavailableReason" class="mt-4 text-sm italic text-gray-500 dark:text-gray-400">
            No recommended services available.
          </p>
        </aside>
      </div>
    </template>

    <dialog ref="serviceModalRef" class="modal" @close="onModalClose">
      <div class="modal-box w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full">
        <h3 class="font-bold text-lg">{{ editingService ? "Edit Service" : "Add Service" }}</h3>
        <form class="mt-4 space-y-3" @submit.prevent="saveService">
          <label class="form-control">
            <span class="label-text text-sm">Service</span>
            <input v-model.trim="form.service_name" class="input input-bordered input-sm w-full" required />
          </label>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control">
              <span class="label-text text-sm">Date</span>
              <input v-model="form.service_date" class="input input-bordered input-sm w-full" type="date" required />
            </label>
            <label class="form-control">
              <span class="label-text text-sm">Mileage</span>
              <input v-model="form.mileage" class="input input-bordered input-sm w-full" type="number" min="0" step="1" />
            </label>
          </div>
          <label class="form-control">
            <span class="label-text text-sm">Cost</span>
            <input v-model="form.cost" class="input input-bordered input-sm w-full" type="text" inputmode="decimal" placeholder="0.00" />
          </label>
          <label class="form-control">
            <span class="label-text text-sm">Notes</span>
            <textarea v-model.trim="form.notes" class="textarea textarea-bordered textarea-sm w-full" rows="2" />
          </label>
          <p v-if="formError" class="text-sm text-error">{{ formError }}</p>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm" @click="serviceModalRef?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">
              {{ saving ? "Saving..." : "Save" }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
  </main>
</template>

<script setup>
useHead({ title: "Vehicle Details" });

const auth = useAuthStore();
const route = useRoute();
const vehicleId = computed(() => String(route.params.id || ""));

const loading = ref(true);
const error = ref("");
const vehicle = ref(null);
const knownServices = ref([]);
const recommendedServices = ref([]);
const recommendedSource = ref(null);
const recommendedUnavailableReason = ref(null);

const serviceModalRef = ref(null);
const editingService = ref(null);
const saving = ref(false);
const deleteSavingId = ref(null);
const formError = ref("");
const form = reactive({
  service_name: "",
  service_date: "",
  mileage: "",
  cost: "",
  notes: "",
});

const vehicleTitle = computed(() => {
  const v = vehicle.value;
  if (!v) return "Vehicle";
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
});

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

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatMiles(val) {
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `${new Intl.NumberFormat("en-US").format(n)} mi`;
}

function formatInterval(svc) {
  const parts = [];
  if (svc.interval_miles != null) parts.push(`Every ${formatMiles(svc.interval_miles)}`);
  if (svc.interval_months != null) {
    parts.push(svc.interval_months === 1 ? "Every 1 mo" : `Every ${svc.interval_months} mo`);
  }
  if (!parts.length) return "As recommended";
  return parts.join(" / ");
}

function resetForm() {
  form.service_name = "";
  form.service_date = new Date().toISOString().slice(0, 10);
  form.mileage = "";
  form.cost = "";
  form.notes = "";
  formError.value = "";
}

function openAddModal() {
  editingService.value = null;
  resetForm();
  serviceModalRef.value?.showModal();
}

function openEditModal(svc) {
  editingService.value = svc;
  form.service_name = svc.service_name || "";
  form.service_date = svc.service_date ? String(svc.service_date).slice(0, 10) : "";
  form.mileage = svc.mileage != null ? String(svc.mileage) : "";
  form.cost = svc.cost != null ? String(svc.cost) : "";
  form.notes = svc.notes || "";
  formError.value = "";
  serviceModalRef.value?.showModal();
}

function onModalClose() {
  editingService.value = null;
  formError.value = "";
}

async function loadDetail() {
  if (!vehicleId.value || !/^\d+$/.test(vehicleId.value)) {
    error.value = "Invalid vehicle.";
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const res = await $fetch(`/api/garage/vehicles/${vehicleId.value}`);
    vehicle.value = res?.vehicle ?? null;
    knownServices.value = res?.knownServices ?? [];
    recommendedServices.value = res?.recommendedServices ?? [];
    recommendedSource.value = res?.recommendedSource ?? null;
    recommendedUnavailableReason.value = res?.recommendedUnavailableReason ?? null;
    useHead({ title: vehicleTitle.value });
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to load vehicle.";
    vehicle.value = null;
    knownServices.value = [];
    recommendedServices.value = [];
    recommendedSource.value = null;
  } finally {
    loading.value = false;
  }
}

async function saveService() {
  formError.value = "";
  saving.value = true;
  try {
    const body = {
      service_name: form.service_name,
      service_date: form.service_date,
      mileage: form.mileage === "" ? null : Number(form.mileage),
      cost: form.cost === "" ? null : form.cost,
      notes: form.notes || null,
    };
    if (editingService.value?.vsr_id) {
      await $fetch(`/api/garage/services/${editingService.value.vsr_id}`, { method: "PUT", body });
    } else {
      await $fetch(`/api/garage/vehicles/${vehicleId.value}/services`, { method: "POST", body });
    }
    serviceModalRef.value?.close();
    await loadDetail();
  } catch (e) {
    formError.value = e?.data?.statusMessage || e?.message || "Failed to save service.";
  } finally {
    saving.value = false;
  }
}

async function deleteService(svc) {
  if (!svc?.vsr_id) return;
  if (!confirm(`Delete "${svc.service_name}"?`)) return;
  deleteSavingId.value = svc.vsr_id;
  try {
    await $fetch(`/api/garage/services/${svc.vsr_id}`, { method: "DELETE" });
    await loadDetail();
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to delete service.";
  } finally {
    deleteSavingId.value = null;
  }
}

watch(
  () => Boolean(auth.ready && auth.user && vehicleId.value),
  (ok) => {
    if (ok) void loadDetail();
    else if (auth.ready) loading.value = false;
  },
  { immediate: true },
);

watch(vehicleId, () => {
  if (auth.ready && auth.user) void loadDetail();
});
</script>
