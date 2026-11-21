<template>
  <form class="space-y-4" @submit.prevent="submit">
    <p v-if="householdKey" class="text-xs text-base-content/60">
      Household key {{ householdKey }}. A linked account uses <span class="font-mono">g:group id</span>. A solo account uses <span class="font-mono">u:user id</span>.
    </p>
    <p class="text-sm text-base-content/80">
      To match the previous Wooster estimate, choose married filing jointly, one child under 17, Ohio, the standard deduction, City of Wooster at 1.5%, and Wooster CSD at 0%. Ohio uses the municipal wage rule, so 401(k) is not subtracted from city wages. The SQL seed is in <span class="font-mono">data/tax/README.md</span>.
    </p>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="flex flex-col gap-1 text-sm">
        <span>Filing status</span>
        <select v-model="form.filingStatus" class="select select-bordered w-full" :disabled="disabled" required>
          <option disabled value="">Choose</option>
          <option v-for="status in filingStatuses" :key="status" :value="status">
            {{ filingStatusLabels[status] }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>State</span>
        <select v-model="form.stateCode" class="select select-bordered w-full" :disabled="disabled" required>
          <option disabled value="">Choose</option>
          <option v-for="state in states" :key="state.code" :value="state.code">{{ state.name }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>Children under 17</span>
        <input v-model.number="form.childrenUnder17" type="number" min="0" max="20" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>Other dependents</span>
        <input v-model.number="form.otherDependents" type="number" min="0" max="20" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>Deduction method</span>
        <select v-model="form.deductionMethod" class="select select-bordered w-full" :disabled="disabled">
          <option value="standard">Standard deduction</option>
          <option value="itemized">Itemized deduction</option>
        </select>
      </label>
      <label v-if="form.deductionMethod === 'itemized'" class="flex flex-col gap-1 text-sm">
        <span>Itemized deduction</span>
        <input v-model.number="form.itemizedDeduction" type="number" min="0" step="0.01" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>Paychecks per year</span>
        <select v-model="form.paychecksPerYear" class="select select-bordered w-full" :disabled="disabled">
          <option value="">Not set</option>
          <option value="12">12 monthly</option>
          <option value="24">24 twice a month</option>
          <option value="26">26 every two weeks</option>
          <option value="52">52 weekly</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>Local wage basis</span>
        <select v-model="form.localWageRule" class="select select-bordered w-full" :disabled="disabled">
          <option value="">Default for this state</option>
          <option v-for="rule in localRules" :key="rule.id" :value="rule.id">{{ rule.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>City or village</span>
        <input v-model="form.localJurisdiction" type="text" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>County</span>
        <input v-model="form.localCounty" type="text" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>ZIP</span>
        <input v-model="form.localZip" type="text" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>School district</span>
        <input v-model="form.schoolDistrict" type="text" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>City tax rate (%)</span>
        <input v-model="form.cityPercent" type="number" min="0" max="15" step="0.01" class="input input-bordered w-full" :disabled="disabled" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>School district rate (%)</span>
        <input v-model="form.schoolPercent" type="number" min="0" max="15" step="0.01" class="input input-bordered w-full" :disabled="disabled" />
      </label>
    </div>
    <button type="submit" class="btn btn-primary min-h-11" :disabled="disabled || saving">
      {{ saving ? "Saving…" : "Save tax profile" }}
    </button>
  </form>
</template>

<script setup>
import { LOCAL_WAGE_RULES } from "~/utils/tax/deductions";
import { FILING_STATUSES, FILING_STATUS_LABELS, US_STATES } from "~/utils/tax/profile";

const props = defineProps({
  profile: { type: Object, default: null },
  householdKey: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(["save"]);

const filingStatuses = FILING_STATUSES;
const filingStatusLabels = FILING_STATUS_LABELS;
const states = US_STATES;
const localRules = LOCAL_WAGE_RULES;

function emptyForm() {
  return {
    filingStatus: "",
    stateCode: "",
    childrenUnder17: 0,
    otherDependents: 0,
    deductionMethod: "standard",
    itemizedDeduction: 0,
    paychecksPerYear: "",
    localWageRule: "",
    localJurisdiction: "",
    localCounty: "",
    localZip: "",
    schoolDistrict: "",
    cityPercent: 0,
    schoolPercent: 0,
  };
}

const form = ref(emptyForm());

function percentFromRate(rate) {
  return Math.round((Number(rate) || 0) * 10000) / 100;
}

function rateFromPercent(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 10000) / 1000000;
}

function applyProfile(profile) {
  if (!profile) {
    form.value = emptyForm();
    return;
  }
  form.value = {
    filingStatus: profile.filingStatus || profile.filing_status || "",
    stateCode: profile.stateCode || profile.state_code || "",
    childrenUnder17: Number(profile.childrenUnder17 ?? profile.children_under_17) || 0,
    otherDependents: Number(profile.otherDependents ?? profile.other_dependents) || 0,
    deductionMethod: profile.deductionMethod || profile.deduction_method || "standard",
    itemizedDeduction: Number(profile.itemizedDeduction ?? profile.itemized_deduction) || 0,
    paychecksPerYear:
      profile.paychecksPerYear || profile.paychecks_per_year
        ? String(profile.paychecksPerYear || profile.paychecks_per_year)
        : "",
    localWageRule: profile.localWageRule || profile.local_wage_rule || "",
    localJurisdiction: profile.localJurisdiction || profile.local_jurisdiction || "",
    localCounty: profile.localCounty || profile.local_county || "",
    localZip: profile.localZip || profile.local_zip || "",
    schoolDistrict: profile.schoolDistrict || profile.school_district || "",
    cityPercent: percentFromRate(profile.cityRate ?? profile.city_rate),
    schoolPercent: percentFromRate(profile.schoolDistrictRate ?? profile.school_district_rate),
  };
}

watch(() => props.profile, applyProfile, { immediate: true });

function submit() {
  emit("save", {
    filing_status: form.value.filingStatus,
    state_code: form.value.stateCode,
    children_under_17: form.value.childrenUnder17,
    other_dependents: form.value.otherDependents,
    deduction_method: form.value.deductionMethod,
    itemized_deduction: form.value.itemizedDeduction,
    paychecks_per_year: form.value.paychecksPerYear ? Number(form.value.paychecksPerYear) : null,
    local_wage_rule: form.value.localWageRule || null,
    local_jurisdiction: form.value.localJurisdiction,
    local_county: form.value.localCounty,
    local_zip: form.value.localZip,
    school_district: form.value.schoolDistrict,
    city_rate: rateFromPercent(form.value.cityPercent),
    school_district_rate: rateFromPercent(form.value.schoolPercent),
  });
}
</script>
