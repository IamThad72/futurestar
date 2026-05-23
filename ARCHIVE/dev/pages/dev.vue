<template>
  <div class="p-6 max-w-3xl space-y-6">
    <h2 class="text-xl font-semibold">Estate Entry</h2>

    <div>
      <label class="block text-sm font-medium mb-1">Selection Type</label>
      <select class="select select-bordered w-full" v-model="estateType">
        <option disabled value="">Select a type…</option>
        <option v-for="t in estateTypes" :key="t" :value="t">
          {{ t }}
        </option>
      </select>
    </div>

    <form v-if="estateType === 'Vehicle'" class="space-y-4" @submit.prevent="handleVehicleSubmit">
      <h3 class="text-lg font-semibold">Vehicle Details</h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Year</label>
          <select class="select select-bordered w-full" v-model.number="vehicleYear">
            <option disabled value="">Select year…</option>
            <option v-for="year in vehicleYears" :key="year" :value="year">
              {{ year }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Make</label>
          <select
            class="select select-bordered w-full"
            v-model="vehicleMake"
            :disabled="makesLoading || !vehicleYear"
          >
            <option disabled value="">
              {{ makesLoading ? "Loading makes…" : "Select make…" }}
            </option>
            <option v-for="make in vehicleMakes" :key="make" :value="make">
              {{ make }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Model</label>
          <select
            class="select select-bordered w-full"
            v-model="vehicleModel"
            :disabled="!vehicleYear || !vehicleMake || modelsLoading || vehicleModels.length === 0"
          >
            <option disabled value="">
              {{ modelsLoading ? "Loading models…" : "Select model…" }}
            </option>
            <option v-for="model in vehicleModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">VIN</label>
          <input class="input input-bordered w-full" v-model.trim="vehicleVin" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Value</label>
          <input class="input input-bordered w-full" v-model.trim="vehicleValue" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Vehicle Age</label>
          <input class="input input-bordered w-full" :value="vehicleAge" readonly />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Description</label>
        <textarea class="textarea textarea-bordered w-full" rows="3" v-model.trim="vehicleDescription"></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Trust Designated (Y/N)</label>
        <select class="select select-bordered w-full" v-model="vehicleTrustDesignated">
          <option disabled value="">Select…</option>
          <option value="Y">Y</option>
          <option value="N">N</option>
        </select>
      </div>

      <div class="flex gap-3 pt-2">
        <button class="btn btn-primary" type="submit">Submit</button>
        <button class="btn btn-outline" type="button" @click="clearVehicleForm">Clear</button>
      </div>
    </form>

    <form
      v-else-if="estateType"
      class="space-y-4"
      @submit.prevent="handleGenericSubmit"
    >
      <h3 class="text-lg font-semibold">{{ estateType }} Details</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Name</label>
          <input class="input input-bordered w-full" v-model.trim="genericName" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Value</label>
          <input class="input input-bordered w-full" v-model.trim="genericValue" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Description</label>
        <textarea class="textarea textarea-bordered w-full" rows="3" v-model.trim="genericDescription"></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Trust Designated (Y/N)</label>
        <select class="select select-bordered w-full" v-model="genericTrustDesignated">
          <option disabled value="">Select…</option>
          <option value="Y">Y</option>
          <option value="N">N</option>
        </select>
      </div>

      <div class="flex gap-3 pt-2">
        <button class="btn btn-primary" type="submit">Submit</button>
        <button class="btn btn-outline" type="button" @click="clearGenericForm">Clear</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

const estateTypes = ["Asset", "Cash", "Insurance", "Loan", "Real Estate", "Vehicle"] as const
const estateType = ref<string>("")

const vehicleMake = ref<string>("")
const vehicleModel = ref<string>("")
const vehicleYear = ref<number | "">("")
const vehicleVin = ref<string>("")
const vehicleValue = ref<string>("")
const vehicleDescription = ref<string>("")
const vehicleTrustDesignated = ref<string>("")

const vehicleMakes = ref<string[]>([])
const makesLoading = ref(false)
const vehicleModels = ref<string[]>([])
const modelsLoading = ref(false)
const topMakes = [
  "Ford",
  "Chevrolet",
  "GMC",
  "Cadillac",
  "Chrysler",
  "Dodge",
  "Jeep",
  "Ram",
  "Buick",
  "Lincoln",
  "Tesla",
  "Honda",
  "Toyota",
  "Nissan",
  "Hyundai",
  "Kia",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Lexus",
  "Acura",
  "Mazda",
  "Subaru",
  "Volvo",
  "Porsche",
  "Jaguar",
  "Land Rover",
  "Mini",
  "Mitsubishi",
  "Infiniti",
  "Alfa Romeo",
  "Fiat",
  "Genesis",
  "Polestar",
]

const currentYear = new Date().getFullYear()
const vehicleYears = Array.from({ length: 31 }, (_, i) => currentYear - i)

const vehicleAge = computed(() => {
  if (!vehicleYear.value) return ""
  return String(currentYear - Number(vehicleYear.value))
})

watch(vehicleYear, () => {
  vehicleMake.value = ""
  vehicleModel.value = ""
  vehicleModels.value = []
})

watch(vehicleMake, () => {
  vehicleModel.value = ""
  vehicleModels.value = []
  if (vehicleMake.value && vehicleYear.value) {
    void loadVehicleModels()
  }
})

async function loadVehicleMakes() {
  makesLoading.value = true
  try {
    const response = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json")
    if (!response.ok) {
      throw new Error(`Failed to load makes: ${response.status}`)
    }
    const data = await response.json()
    const makes = Array.isArray(data?.Results)
      ? data.Results.map((item: { Make_Name?: string }) => item.Make_Name).filter(Boolean)
      : []
    const topSet = new Set(topMakes.map((make) => make.toLowerCase()))
    vehicleMakes.value = makes.filter((make) => topSet.has(make.toLowerCase()))
  } catch {
    vehicleMakes.value = []
  } finally {
    makesLoading.value = false
  }
}

async function loadVehicleModels() {
  if (!vehicleMake.value || !vehicleYear.value) return
  modelsLoading.value = true
  try {
    const make = encodeURIComponent(vehicleMake.value)
    const year = encodeURIComponent(String(vehicleYear.value))
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${year}?format=json`
    )
    if (!response.ok) {
      throw new Error(`Failed to load models: ${response.status}`)
    }
    const data = await response.json()
    vehicleModels.value = Array.isArray(data?.Results)
      ? data.Results.map((item: { Model_Name?: string }) => item.Model_Name).filter(Boolean)
      : []
  } catch {
    vehicleModels.value = []
  } finally {
    modelsLoading.value = false
  }
}

onMounted(() => {
  void loadVehicleMakes()
})

const genericName = ref<string>("")
const genericValue = ref<string>("")
const genericDescription = ref<string>("")
const genericTrustDesignated = ref<string>("")

function clearVehicleForm() {
  vehicleMake.value = ""
  vehicleModel.value = ""
  vehicleYear.value = ""
  vehicleVin.value = ""
  vehicleValue.value = ""
  vehicleDescription.value = ""
  vehicleTrustDesignated.value = ""
}

function clearGenericForm() {
  genericName.value = ""
  genericValue.value = ""
  genericDescription.value = ""
  genericTrustDesignated.value = ""
}

function handleVehicleSubmit() {
  // Placeholder for submit integration
}

function handleGenericSubmit() {
  // Placeholder for submit integration
}
</script>


