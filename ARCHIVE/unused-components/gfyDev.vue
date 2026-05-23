<template>
  <h3>Go F!CK YOURSELF! <AcademicCapIcon class="inline-block h-6 w-6" /></h3>
<div class="p-6 max-w-xl space-y-4">
    <div>
      <label class="block text-sm font-medium mb-1">Estate Type</label>
      <select class="select select-bordered w-full" v-model="vehicleType">
        <option disabled value="">Select a type…</option>
        <option v-for="t in estateTypes" :key="t" :value="t">
          {{ t }}
        </option>
      </select>
    </div>

    <div v-if="vehicleType">
      <label class="block text-sm font-medium mb-1">Model / Option</label>

      <div v-if="loading" class="text-sm opacity-70">Loading…</div>

      <select
        v-else
        class="select select-bordered w-full"
        v-model="vehicleOption"
        :disabled="options.length === 0"
      >
        <option disabled value="">Select an option…</option>
        <option v-for="o in options" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>

      <p v-if="!loading && options.length === 0" class="text-sm opacity-70 mt-2">
        No options found for {{ vehicleType }}.
      </p>
    </div>

    <div class="pt-2 text-sm">
      <div><b>Selected type:</b> {{ vehicleType || "—" }}</div>
      <div><b>Selected option:</b> {{ vehicleOption || "—" }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { EnvelopeIcon, PhoneIcon, PlusCircleIcon, MinusCircleIcon, XCircleIcon, AcademicCapIcon } from '@heroicons/vue/20/solid'

type Option = { label: string; value: string }

const estateTypes = ["Asset", "Cash", "Insurance", "Loan","Real Estate", "Vehicle"] as const
const vehicleType = ref<string>("")
const vehicleOption = ref<string>("")

const options = ref<Option[]>([])
const loading = ref(false)

// Local “linked” data (swap this for an API call if you want)
const localOptions: Record<string, Option[]> = {
  car: [
    { label: "Sedan", value: "sedan" },
    { label: "SUV", value: "suv" },
    { label: "Truck", value: "truck" },
  ],
  bike: [
    { label: "Road Bike", value: "road" },
    { label: "Mountain Bike", value: "mtb" },
    { label: "BMX", value: "bmx" },
  ],
  train: [
    { label: "Metro", value: "metro" },
    { label: "Intercity", value: "intercity" },
    { label: "Freight", value: "freight" },
  ],
}

// Async loader (works for local OR API)
async function loadOptionsFor(type: string) {
  loading.value = true
  try {
    // Local version:
    await new Promise((r) => setTimeout(r, 150)) // tiny delay to mimic API
    options.value = localOptions[type] ?? []

    // API version (example):
    // const { data } = await useFetch<Option[]>('/api/vehicle-options', { query: { type } })
    // options.value = data.value ?? []
  } finally {
    loading.value = false
  }
}

// When the first select changes:
// 1) reset the second selection
// 2) load new options
watch(vehicleType, async (newType) => {
  vehicleOption.value = ""
  options.value = []
  if (!newType) return
  await loadOptionsFor(newType)
})
</script>

