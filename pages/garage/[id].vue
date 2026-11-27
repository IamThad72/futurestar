<template>
  <section class="app-page">
    <p v-if="!auth.ready || loading" class="text-sm text-muted">Loading…</p>
    <template v-else>
      <header class="page-header">
        <div class="page-header__copy">
          <NuxtLink to="/garage" class="text-sm font-medium text-muted no-underline hover:text-primary">Garage</NuxtLink>
          <h1>{{ vehicle ? vehicleTitle : "Vehicle" }}</h1>
          <p class="page-header__lede">{{ vehicle?.vin ? `VIN ${vehicle.vin}` : "Service history for this vehicle." }}</p>
        </div>
        <button v-if="vehicle && (auth.user || auth.sessionEnded)" type="button" class="btn btn-primary" @click="openAddModal">Add Service</button>
        <p v-if="writeNotice" class="text-sm text-error" role="alert">{{ writeNotice }}</p>
      </header>

      <LoadErrorPanel v-if="error" :message="error" @retry="loadDetail" />
      <EmptyState
        v-else-if="!vehicle"
        title="No vehicle to show."
        sentence="Open a vehicle from the garage, or add one there."
        action="Back to garage"
        to="/garage"
      />

      <div v-else class="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <section>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Known services</h2>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Service records you have entered for this vehicle.</p>
          <ul v-if="dueItems.length" class="mt-4 space-y-2">
            <li v-for="item in dueItems" :key="item.service_name" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ item.service_name }}</p>
              <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{{ item.reason }}</p>
              <button v-if="auth.user || auth.sessionEnded" type="button" class="btn btn-ghost btn-xs mt-2" @click="openDueService(item)">Add this service</button>
            </li>
          </ul>

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
                <HeadlessMenu as="div" class="relative flex-none">
                  <HeadlessMenuButton
                    class="budget-row-menu__trigger relative block rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                    :disabled="deleteSavingId === svc.vsr_id"
                  >
                    <span class="sr-only">Options for {{ svc.service_name }}</span>
                    <span v-if="deleteSavingId === svc.vsr_id" class="text-xs" aria-hidden="true">…</span>
                    <AppIcon v-else :name="overflowIcon" :size="20" />
                  </HeadlessMenuButton>
                  <HeadlessMenuItems class="budget-row-menu absolute right-0 z-10 mt-2 w-44 origin-top-right focus:outline-none">
                    <div class="budget-row-menu__list">
                      <HeadlessMenuItem v-slot="{ active }" class="w-full">
                        <button
                          type="button"
                          class="budget-row-menu__item"
                          :class="{ 'budget-row-menu__item--active': active }"
                          @click="openEditModal(svc)"
                        >
                          Edit<span class="sr-only">, {{ svc.service_name }}</span>
                        </button>
                      </HeadlessMenuItem>
                      <HeadlessMenuItem v-slot="{ active }" class="w-full">
                        <button
                          type="button"
                          class="budget-row-menu__item budget-row-menu__item--danger"
                          :class="{ 'budget-row-menu__item--active': active }"
                          @click="deleteService(svc)"
                        >
                          Delete<span class="sr-only">, {{ svc.service_name }}</span>
                        </button>
                      </HeadlessMenuItem>
                    </div>
                  </HeadlessMenuItems>
                </HeadlessMenu>
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
              <input v-model="form.mileage" class="input input-bordered input-sm w-full" type="number" inputmode="numeric" min="0" step="1" />
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
  </section>
</template>

<script setup>
import { Capacitor } from "@capacitor/core";
import { dueServices } from "~/utils/serviceDue";
import { overflowIconName } from "~/utils/iconRegistry";

useHead({ title: "Vehicle Details" });

const { confirm: askUser } = useConfirm();

const auth = useAuthStore();
const writeNotice = ref("");
const overflowIcon = overflowIconName(Capacitor.getPlatform());
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

const dueItems = computed(() => {
  const miles = knownServices.value.reduce((max, row) => {
    const n = Number(row.mileage);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, -1);
  return dueServices({
    today: new Date().toISOString().slice(0, 10),
    currentMileage: miles >= 0 ? miles : null,
    recommended: recommendedServices.value,
    known: knownServices.value,
  });
});

function openDueService(item) {
  if (!auth.user) {
    writeNotice.value = auth.sessionEnded ? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE;
    return;
  }
  writeNotice.value = "";
  editingService.value = null;
  resetForm();
  form.service_name = item.service_name;
  if (item.mileage != null) form.mileage = String(item.mileage);
  serviceModalRef.value?.showModal();
}

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
  if (!auth.user) {
    writeNotice.value = auth.sessionEnded ? SESSION_ENDED_MESSAGE : SIGN_IN_MESSAGE;
    return;
  }
  writeNotice.value = "";
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
    vehicle.value = null;
    const failure = settleLoadError(e, "The vehicle could not be loaded. Try again in a moment.");
    error.value = failure.message;
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
  if (!svc?.vsr_id || deleteSavingId.value != null) return;
  deleteSavingId.value = svc.vsr_id;
  const ok = await askUser({
    header: "Delete service?",
    message: `Delete "${svc.service_name}"?`,
    confirmText: "Delete",
    destructive: true,
  });
  if (!ok) {
    deleteSavingId.value = null;
    return;
  }
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
  () => Boolean(auth.ready && vehicleId.value),
  (ok) => {
    if (ok) void loadDetail();
    else if (auth.ready) loading.value = false;
  },
  { immediate: true },
);

watch(vehicleId, () => {
  if (auth.ready) void loadDetail();
});
</script>
