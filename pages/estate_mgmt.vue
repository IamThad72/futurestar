<template>
  <section class="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6 p-4 sm:p-6">
    <header class="space-y-2">
      <h1 class="text-xl sm:text-2xl font-semibold">Estate Management</h1>
      <p class="text-sm text-base-content/70">
        Choose a category and classification, then enter details for your entry.
      </p>
    </header>

    <div v-if="!auth.ready" class="rounded-lg border border-base-200 bg-base-300 p-4">
      <span class="text-sm text-base-content/70">Loading session...</span>
    </div>

    <div
      v-else-if="!auth.user"
      class="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-content"
    >
      You must be logged in before submitting this form.
    </div>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form class="space-y-6" @submit.prevent="submitForm">
      <div class="grid grid-cols-1 gap-4">
        <label class="form-control w-full">
          <span class="label-text text-sm">Asset Category</span>
          <select
            class="select select-bordered w-full"
            v-model="selectedCategory"
            :disabled="categoriesLoading"
            required
            @change="loadRecordsForCategory()"
          >
            <option disabled value="">
              {{ categoriesLoading ? "Loading categories..." : "Select category..." }}
            </option>
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="isCashOrInvestment" class="space-y-4">
        <label class="form-control w-full">
          <span class="label-text text-sm">Classification</span>
          <select
            class="select select-bordered w-full"
            v-model="cashInvestmentClassification"
            :disabled="classificationsLoading"
            required
          >
            <option disabled value="">
              {{ classificationPlaceholder }}
            </option>
            <option v-for="item in classifications" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
        </label>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Institution</span>
            <input
              v-model.trim="cashInvestmentForm.institution"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Account Number</span>
            <input
              v-model.trim="cashInvestmentForm.account_number"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Value</span>
            <input
              v-model.number="cashInvestmentForm.value"
              class="input input-bordered w-full"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Account Support Number</span>
            <input
              v-model.trim="cashInvestmentForm.account_support_number"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Institution URL</span>
            <input
              v-model.trim="cashInvestmentForm.institution_url"
              class="input input-bordered w-full"
              type="url"
              required
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Account Holder</span>
            <input
              v-model.trim="cashInvestmentForm.account_holder"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Account Intent</span>
          <input
            v-model.trim="cashInvestmentForm.account_intent"
            class="input input-bordered w-full"
            type="text"
            required
          />
        </label>

        <label class="form-control w-full">
          <span class="label-text text-sm">Trust Designated (Y/N)</span>
          <select
            class="select select-bordered w-full"
            v-model="cashInvestmentForm.trust_designated"
            required
          >
            <option disabled value="">Select...</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </label>
      </div>

      <div v-if="selectedCategory === 'Asset'" class="space-y-4">
        <label class="form-control w-full">
          <span class="label-text text-sm">Classification</span>
          <select
            class="select select-bordered w-full"
            v-model="assetClassification"
            :disabled="classificationsLoading"
            required
          >
            <option disabled value="">
              {{ classificationPlaceholder }}
            </option>
            <option v-for="item in classifications" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
        </label>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Title</span>
            <input
              v-model.trim="form.title"
              class="input input-bordered w-full"
              type="text"
              placeholder="Asset title"
              required
            />
          </label>

          <label class="form-control w-full">
            <span class="label-text text-sm">Value</span>
            <input
              v-model.number="form.value"
              class="input input-bordered w-full"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Description</span>
          <textarea
            v-model.trim="form.description"
            class="textarea textarea-bordered w-full"
            rows="3"
            placeholder="Describe the asset"
            required
          ></textarea>
        </label>

        <label class="form-control w-full">
          <span class="label-text text-sm">Location</span>
          <input
            v-model.trim="form.location"
            class="input input-bordered w-full"
            type="text"
            placeholder="Location (optional)"
          />
        </label>
      </div>

      <div v-else-if="selectedCategory === 'Real Estate'" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Street Number (Optional)</span>
            <input
              v-model.trim="realEstateForm.number"
              class="input input-bordered w-full"
              type="text"
              placeholder="e.g. 123"
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Street</span>
            <input
              v-model.trim="realEstateForm.street"
              class="input input-bordered w-full"
              type="text"
              placeholder="Street name"
              required
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label class="form-control w-full">
            <span class="label-text text-sm">City</span>
            <input
              v-model.trim="realEstateForm.city"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">State</span>
            <input
              v-model.trim="realEstateForm.state"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Zipcode</span>
            <input
              v-model.trim="realEstateForm.zipcode"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Value</span>
          <input
            v-model.number="realEstateForm.value"
            class="input input-bordered w-full"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </label>

        <label class="form-control w-full">
          <span class="label-text text-sm">Trust Designated (Y/N)</span>
          <select
            class="select select-bordered w-full"
            v-model="realEstateForm.trust_designated"
            required
          >
            <option disabled value="">Select...</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </label>
      </div>

      <div v-else-if="isDebtCategory" class="space-y-4">
        <label class="form-control w-full">
          <span class="label-text text-sm">Debt Type</span>
          <select
            class="select select-bordered w-full"
            v-model="debtClassification"
            :disabled="debtTypesLoading"
          >
            <option disabled value="">
              {{ debtTypesLoading ? "Loading debt types..." : "Select debt type..." }}
            </option>
            <option v-for="item in debtTypes" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
        </label>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Institution</span>
            <input
              v-model.trim="debtForm.institution"
              class="input input-bordered w-full"
              type="text"
              required
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Loan Number</span>
            <input
              v-model.trim="debtForm.loan_number"
              class="input input-bordered w-full"
              type="text"
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Loan Amount</span>
          <input
            v-model.trim="debtForm.loan_ammount"
            class="input input-bordered w-full"
            type="number"
            step="0.01"
            placeholder="0.00"
          />
        </label>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Customer Support Number</span>
            <input
              v-model.trim="debtForm.customer_support_no"
              class="input input-bordered w-full"
              type="text"
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Institution URL</span>
            <input
              v-model.trim="debtForm.address_url"
              class="input input-bordered w-full"
              type="url"
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Borrower</span>
          <input
            v-model.trim="debtForm.borrower"
            class="input input-bordered w-full"
            type="text"
            placeholder="Name of Borrower (Optional)"
          />
        </label>

        <label class="form-control w-full">
          <span class="label-text text-sm">Link to Asset</span>
          <select
            class="select select-bordered w-full"
            v-model="debtForm.linked_asset"
            :disabled="linkedAssetsLoading"
          >
            <option value="">
              {{ linkedAssetsLoading ? "Loading assets..." : "None (no link)" }}
            </option>
            <option v-for="a in linkedAssets" :key="a.type + ':' + a.id" :value="a.type + ':' + a.id">
              {{ a.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-else-if="selectedCategory === 'Vehicle'" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label class="form-control w-full">
            <span class="label-text text-sm">Year</span>
            <select class="select select-bordered w-full" v-model.number="vehicleYear">
              <option disabled value="">Select year...</option>
              <option v-for="year in vehicleYears" :key="year" :value="year">
                {{ year }}
              </option>
            </select>
          </label>

          <label class="form-control w-full">
            <span class="label-text text-sm">Make</span>
            <input
              v-model.trim="vehicleMakeFilter"
              class="input input-bordered w-full"
              type="text"
              placeholder="Filter makes..."
            />
            <select
              class="select select-bordered w-full"
              v-model="vehicleMake"
              :disabled="makesLoading || !vehicleYear"
            >
              <option disabled value="">
                {{ makesLoading ? "Loading makes..." : "Select make..." }}
              </option>
              <option v-for="make in filteredVehicleMakes" :key="make" :value="make">
                {{ make }}
              </option>
            </select>
          </label>

          <label class="form-control w-full">
            <span class="label-text text-sm">Type</span>
            <select
              class="select select-bordered w-full"
              v-model="vehicleType"
              :disabled="!vehicleMake || vehicleTypesLoading"
            >
              <option disabled value="">
                {{ vehicleTypesLoading ? "Loading types..." : "Select type..." }}
              </option>
              <option v-for="type in vehicleTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Model</span>
            <select
              v-if="vehicleModels.length > 0"
              class="select select-bordered w-full"
              v-model="vehicleModel"
              :disabled="!vehicleYear || !vehicleMake || !vehicleType || modelsLoading"
            >
              <option disabled value="">
                {{ modelsLoading ? "Loading models..." : "Select model..." }}
              </option>
              <option v-for="model in vehicleModels" :key="model" :value="model">
                {{ model }}
              </option>
            </select>
            <input
              v-else
              v-model.trim="vehicleModel"
              class="input input-bordered w-full"
              type="text"
              :disabled="!vehicleYear || !vehicleMake || !vehicleType"
              placeholder="Enter model..."
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label class="form-control w-full">
            <span class="label-text text-sm">VIN</span>
            <input
              ref="vinInputRef"
              v-model.trim="vehicleVin"
              class="input input-bordered w-full"
              type="text"
            />
          </label>

          <label class="form-control w-full">
            <span class="label-text text-sm">Value</span>
            <input v-model.trim="vehicleValue" class="input input-bordered w-full" type="text" />
          </label>

          <label class="form-control w-full">
            <span class="label-text text-sm">Vehicle Age</span>
            <input class="input input-bordered w-full" :value="vehicleAge" readonly />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Description</span>
          <textarea
            v-model.trim="vehicleDescription"
            class="textarea textarea-bordered w-full"
            rows="3"
          ></textarea>
        </label>

        <label class="form-control w-full">
          <span class="label-text text-sm">Trust Designated (Y/N)</span>
          <select class="select select-bordered w-full" v-model="vehicleTrustDesignated">
            <option disabled value="">Select...</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </label>
      </div>

      <div v-else-if="selectedCategory === 'Insurance'" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Policy Holder</span>
            <input
              v-model.trim="insuranceForm.policy_holder"
              class="input input-bordered w-full"
              type="text"
              placeholder="Name of policy holder"
              required
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Policy Number</span>
            <input
              v-model.trim="insuranceForm.polocy_number"
              class="input input-bordered w-full"
              type="text"
              placeholder="Policy #"
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Entity Covered</span>
          <input
            v-model.trim="insuranceForm.entity_covered"
            class="input input-bordered w-full"
            type="text"
            placeholder="Person or property covered"
          />
        </label>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="form-control w-full">
            <span class="label-text text-sm">Policy Amount</span>
            <input
              v-model.trim="insuranceForm.policy_amt"
              class="input input-bordered w-full"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Intent</span>
            <input
              v-model.trim="insuranceForm.intent"
              class="input input-bordered w-full"
              type="text"
              placeholder="e.g. Life, Auto, Home"
            />
          </label>
        </div>

        <label class="form-control w-full">
          <span class="label-text text-sm">Institution URL</span>
          <input
            v-model.trim="insuranceForm.institution_url"
            class="input input-bordered w-full"
            type="url"
            placeholder="https://..."
          />
        </label>
      </div>

      <div class="flex flex-wrap gap-3">
        <button
          class="btn btn-primary"
          type="submit"
          :disabled="!canSubmit"
        >
          {{ submitting ? "Submitting..." : "Submit" }}
        </button>
        <button class="btn btn-outline" type="button" @click="resetForm">
          Clear
        </button>
      </div>

      <div v-if="error" class="alert alert-error text-sm">
        {{ error }}
      </div>
      <div v-if="success" class="alert alert-success text-sm">
        {{ success }}
      </div>
    </form>

      <!-- Records table for selected category -->
      <div v-if="selectedCategory" class="estate-records-panel rounded-lg border border-base-200 bg-base-300 overflow-hidden flex flex-col">
        <h2 class="border-b border-base-200 bg-base-200/50 px-4 py-3 text-sm font-semibold shrink-0">
          {{ selectedCategory }} Records
        </h2>
        <div v-if="recordsLoading" class="p-4 text-sm text-base-content/70 flex-1 min-h-0">Loading records...</div>
        <div v-else-if="recordsLoadError" class="p-4 text-sm text-error flex-1 min-h-0">{{ recordsLoadError }}</div>
        <div v-else class="estate-records-scroll flex-1 min-h-0 flex flex-col">
          <!-- Asset Inventory -->
          <div v-if="selectedCategory === 'Asset'" class="estate-records-cards">
            <div v-for="r in categoryRecords" :key="r.ai_id" class="estate-record-card rounded-lg border border-base-200 bg-base-100 p-3 space-y-1.5 text-sm">
              <div class="flex justify-between items-start gap-2">
                <span class="font-semibold truncate flex-1">{{ r.title }}</span>
                <span class="font-medium shrink-0">{{ formatMoney(r.value) }}</span>
              </div>
              <div class="text-base-content/80"><span class="font-medium">Classification:</span> {{ r.asset_classification ?? r.classification_type ?? '—' }}</div>
              <div v-if="r.description" class="text-base-content/70 truncate"><span class="font-medium">Description:</span> {{ r.description }}</div>
              <div v-if="r.location" class="text-base-content/70"><span class="font-medium">Location:</span> {{ r.location }}</div>
            </div>
            <p v-if="!categoryRecords.length" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <!-- Asset Vehicles -->
          <div v-else-if="selectedCategory === 'Vehicle'" class="estate-records-cards">
            <div v-for="r in categoryRecords" :key="r.vh_id" class="estate-record-card rounded-lg border border-base-200 bg-base-100 p-3 space-y-1.5 text-sm">
              <div class="flex justify-between items-start gap-2">
                <span class="font-semibold">{{ r.year }} {{ r.make }} {{ r.model }}</span>
                <span class="font-medium shrink-0">{{ formatMoney(r.value) }}</span>
              </div>
              <div v-if="r.vin" class="text-base-content/70 text-xs"><span class="font-medium">VIN:</span> {{ r.vin }}</div>
              <div class="text-base-content/80"><span class="font-medium">Trust:</span> {{ r.trust_designated ? 'Y' : 'N' }}</div>
            </div>
            <p v-if="!categoryRecords.length" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <!-- Cash and Investments -->
          <div v-else-if="['Cash','Investment','Investments'].includes(selectedCategory)" class="estate-records-cards">
            <div v-for="(r, i) in categoryRecords" :key="'cai-' + i" class="estate-record-card rounded-lg border border-base-200 bg-base-100 p-3 space-y-1.5 text-sm">
              <div class="flex justify-between items-start gap-2">
                <span class="font-semibold">{{ r.institution }}</span>
                <span class="font-medium shrink-0">{{ formatMoney(r.value) }}</span>
              </div>
              <div class="text-base-content/80"><span class="font-medium">Category:</span> <span class="capitalize">{{ r.asset_category }}</span></div>
              <div class="text-base-content/80"><span class="font-medium">Type:</span> <span class="capitalize">{{ r.acct_type }}</span></div>
              <div v-if="r.acct_number" class="text-base-content/70 text-xs"><span class="font-medium">Account #:</span> {{ r.acct_number }}</div>
              <div class="text-base-content/80"><span class="font-medium">Trust:</span> {{ r.trust_designated ? 'Y' : 'N' }}</div>
            </div>
            <p v-if="!categoryRecords.length" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <!-- Debt -->
          <div v-else-if="isDebtCategory" class="estate-records-cards">
            <div v-for="r in categoryRecords" :key="r.dbt_id" class="estate-record-card rounded-lg border border-base-200 bg-base-100 p-3 space-y-1.5 text-sm">
              <div class="flex justify-between items-start gap-2">
                <span class="font-semibold">{{ r.institution }}</span>
                <span class="font-bold shrink-0">{{ formatMoney(r.loan_ammount) }}</span>
              </div>
              <div class="text-base-content/80"><span class="font-medium">Loan #:</span> {{ r.loan_number }}</div>
              <div class="text-base-content/80"><span class="font-medium">Type:</span> <span class="capitalize">{{ r.loan_type }}</span></div>
              <div v-if="getLinkedAssetLabel(r)" class="text-base-content/70"><span class="font-medium">Linked:</span> {{ getLinkedAssetLabel(r) }}</div>
              <div v-if="r.borrower" class="text-base-content/70"><span class="font-medium">Borrower:</span> {{ r.borrower }}</div>
            </div>
            <p v-if="!categoryRecords.length" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <!-- Real Estate -->
          <div v-else-if="selectedCategory === 'Real Estate'" class="estate-records-cards">
            <div v-for="r in categoryRecords" :key="r.re_id" class="estate-record-card rounded-lg border border-base-200 bg-base-100 p-3 space-y-1.5 text-sm">
              <div class="flex justify-between items-start gap-2">
                <span class="font-semibold">{{ [r.number, r.street].filter(Boolean).join(' ') || '—' }}, {{ r.city }}</span>
                <span class="font-medium shrink-0">{{ formatMoney(r.value) }}</span>
              </div>
              <div class="text-base-content/80"><span class="font-medium">State:</span> {{ r.state }} <span class="font-medium">Zip:</span> {{ r.zipcode }}</div>
              <div class="text-base-content/80"><span class="font-medium">Trust:</span> {{ r.trust_designated ? 'Y' : 'N' }}</div>
            </div>
            <p v-if="!categoryRecords.length" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <!-- Insurance -->
          <div v-else-if="selectedCategory === 'Insurance'" class="estate-records-cards">
            <div v-for="r in categoryRecords" :key="r.ins_id" class="estate-record-card rounded-lg border border-base-200 bg-base-100 p-3 space-y-1.5 text-sm">
              <div class="flex justify-between items-start gap-2">
                <span class="font-semibold">{{ r.policy_holder }}</span>
                <span class="font-bold shrink-0 text-secondary">{{ formatMoney(r.policy_amt) }}</span>
              </div>
              <div class="text-base-content/80"><span class="font-medium">Policy #:</span> {{ r.polocy_number }}</div>
              <div class="text-base-content/80"><span class="font-medium">Entity:</span> {{ r.entity_covered }}</div>
              <div class="text-base-content/80"><span class="font-medium">Intent:</span> <span class="capitalize">{{ r.intent }}</span></div>
            </div>
            <p v-if="!categoryRecords.length" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <div v-else class="p-4 text-sm text-base-content/60">
            {{ selectedCategory ? 'No records for this category.' : 'Select a category to view records.' }}
          </div>
        </div>
      </div>
    </div>

    <dialog ref="vinDuplicateDialogRef" class="modal" @close="onVinDuplicateDialogClose">
      <div class="modal-box">
        <p class="py-2">
          This vehicle already exists in the database. Please try again.
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button type="submit" class="btn btn-primary">Okay</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  </section>
</template>

<script setup>
const auth = useAuthStore();
const categories = ref([]);
const classifications = ref([]);
const categoriesLoading = ref(false);
const classificationsLoading = ref(false);
const selectedCategory = ref("");
const submitting = ref(false);
const error = ref("");
const success = ref("");

const form = reactive({
  title: "",
  description: "",
  value: "",
  location: "",
});

const cashInvestmentForm = reactive({
  institution: "",
  account_number: "",
  value: "",
  account_support_number: "",
  institution_url: "",
  account_holder: "",
  account_intent: "",
  trust_designated: "",
});
const cashInvestmentClassification = ref("");
const assetClassification = ref("");

const realEstateForm = reactive({
  number: "",
  street: "",
  city: "",
  state: "",
  zipcode: "",
  value: "",
  trust_designated: "",
});

const debtClassification = ref("");
const debtForm = reactive({
  institution: "",
  loan_number: "",
  loan_ammount: "",
  linked_asset: "",
  customer_support_no: "",
  address_url: "",
  borrower: "",
});
const insuranceForm = reactive({
  policy_holder: "",
  polocy_number: "",
  entity_covered: "",
  policy_amt: "",
  intent: "",
  institution_url: "",
});
const debtTypes = ref([]);
const debtTypesLoading = ref(false);
const linkedAssets = ref([]);
const linkedAssetsLoading = ref(false);

const vehicleMake = ref("");
const vehicleMakeFilter = ref("");
const vehicleModel = ref("");
const vehicleYear = ref("");
const vehicleType = ref("");
const vehicleVin = ref("");
const vehicleValue = ref("");
const vehicleDescription = ref("");
const vehicleTrustDesignated = ref("");
const vehicleMakes = ref([]);
const vehicleModels = ref([]);
const vehicleTypes = ref([]);
const makesLoading = ref(false);
const modelsLoading = ref(false);
const vehicleTypesLoading = ref(false);
const vinInputRef = ref(null);
const vinDuplicateDialogRef = ref(null);
const categoryRecords = ref([]);
const recordsLoading = ref(false);
const recordsLoadError = ref("");
const VIN_DUPLICATE_MESSAGE =
  "This vehicle already exists in the database. Please try again.";
const currentYear = new Date().getFullYear();
const vehicleYears = Array.from({ length: 31 }, (_, i) => currentYear - i);

const isCashOrInvestment = computed(() =>
  ["Cash", "Investment", "Investments"].includes(selectedCategory.value),
);
const isAssetCategory = computed(() => selectedCategory.value === "Asset");
const isDebtCategory = computed(() => ["Liability", "Debt"].includes(selectedCategory.value));

const classificationPlaceholder = computed(() => {
  if (!selectedCategory.value) return "Select category first...";
  return classificationsLoading.value ? "Loading classifications..." : "Select classification...";
});

const vehicleAge = computed(() => {
  if (!vehicleYear.value) return "";
  return String(currentYear - Number(vehicleYear.value));
});

function toNumber(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[$,]/g, '').trim();
  return parseFloat(s) || NaN;
}
function formatMoney(val) {
  if (val == null || val === '') return '—';
  const n = toNumber(val);
  if (Number.isNaN(n)) return String(val);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function getLinkedAssetLabel(r) {
  if (!r?.linked_asset_type || !r?.linked_asset_id) return '—';
  const a = linkedAssets.value.find((x) => x.type === r.linked_asset_type && x.id === Number(r.linked_asset_id));
  return a ? a.label : '—';
}

const filteredVehicleMakes = computed(() => {
  const filter = vehicleMakeFilter.value.trim().toLowerCase();
  if (!filter) return vehicleMakes.value;
  return vehicleMakes.value.filter((make) => make.toLowerCase().includes(filter));
});

const canSubmit = computed(() => {
  if (!auth.user) return false;
  if (!selectedCategory.value) return false;
  if (isCashOrInvestment.value) {
    return Boolean(
      cashInvestmentClassification.value &&
        cashInvestmentForm.institution &&
        cashInvestmentForm.account_number &&
        cashInvestmentForm.value !== "" &&
        cashInvestmentForm.account_support_number &&
        cashInvestmentForm.institution_url &&
        cashInvestmentForm.account_holder &&
        cashInvestmentForm.account_intent &&
        cashInvestmentForm.trust_designated,
    );
  }
  if (selectedCategory.value === "Asset") {
    return Boolean(
      assetClassification.value &&
        form.title &&
        form.description &&
        form.value !== "",
    );
  }
  if (selectedCategory.value === "Vehicle") {
    return Boolean(
      vehicleYear.value &&
        vehicleMake.value &&
        vehicleModel.value &&
        vehicleType.value &&
        vehicleValue.value !== "" &&
        vehicleAge.value &&
        vehicleDescription.value &&
        vehicleTrustDesignated.value,
    );
  }
  if (selectedCategory.value === "Real Estate") {
    return Boolean(
      realEstateForm.street &&
        realEstateForm.city &&
        realEstateForm.state &&
        realEstateForm.zipcode &&
        realEstateForm.value !== "" &&
        realEstateForm.trust_designated,
    );
  }
  if (selectedCategory.value === "Insurance") {
    return Boolean(insuranceForm.policy_holder);
  }
  if (isDebtCategory.value) {
    return Boolean(debtClassification.value && debtForm.institution);
  }
  return true;
});

const loadCategories = async () => {
  categoriesLoading.value = true;
  try {
    const response = await $fetch("/api/asset-categories");
    categories.value = response.categories ?? [];
  } catch (err) {
    error.value = "Unable to load asset categories.";
  } finally {
    categoriesLoading.value = false;
  }
};

const loadLinkedAssets = async () => {
  if (!isDebtCategory.value) return;
  linkedAssetsLoading.value = true;
  linkedAssets.value = [];
  try {
    const data = await $fetch("/api/records/linked-assets");
    linkedAssets.value = data?.assets ?? [];
  } catch {
    linkedAssets.value = [];
  } finally {
    linkedAssetsLoading.value = false;
  }
};

const loadDebtTypes = async () => {
  debtTypesLoading.value = true;
  debtTypes.value = [];
  debtClassification.value = "";
  try {
    const response = await $fetch("/api/debt-types");
    debtTypes.value = response?.debtTypes ?? [];
  } catch (err) {
    error.value = "Unable to load debt types.";
  } finally {
    debtTypesLoading.value = false;
  }
};

const loadClassifications = async () => {
  if (!selectedCategory.value) return;
  classificationsLoading.value = true;
  classifications.value = [];
  cashInvestmentClassification.value = "";
  assetClassification.value = "";
  try {
    const response = await $fetch("/api/asset-classifications", {
      params: { category: selectedCategory.value },
    });
    classifications.value = response.classifications ?? [];
  } catch (err) {
    error.value = "Unable to load classifications.";
  } finally {
    classificationsLoading.value = false;
  }
};

const loadVehicleMakes = async () => {
  makesLoading.value = true;
  try {
    const response = await fetch(
      "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json",
    );
    if (!response.ok) {
      throw new Error(`Failed to load makes: ${response.status}`);
    }
    const data = await response.json();
    const makes = Array.isArray(data?.Results)
      ? data.Results.map((item) => item.Make_Name).filter(Boolean)
      : [];
    vehicleMakes.value = makes;
  } catch {
    vehicleMakes.value = [];
  } finally {
    makesLoading.value = false;
  }
};

const loadVehicleModels = async () => {
  if (!vehicleMake.value || !vehicleYear.value || !vehicleType.value) return;
  modelsLoading.value = true;
  try {
    const make = encodeURIComponent(vehicleMake.value);
    const year = encodeURIComponent(String(vehicleYear.value));
    const type = encodeURIComponent(vehicleType.value);
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${year}/vehicletype/${type}?format=json`,
    );
    if (!response.ok) {
      throw new Error(`Failed to load models: ${response.status}`);
    }
    const data = await response.json();
    const results = Array.isArray(data?.Results) ? data.Results : [];
    vehicleModels.value = results
      .map((item) => item.Model_Name || item.Model_Name?.trim())
      .filter(Boolean);
  } catch {
    vehicleModels.value = [];
  } finally {
    modelsLoading.value = false;
  }
};

const loadVehicleTypes = async () => {
  if (!vehicleMake.value) return;
  vehicleTypesLoading.value = true;
  try {
    const make = encodeURIComponent(vehicleMake.value);
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMake/${make}?format=json`,
    );
    if (!response.ok) {
      throw new Error(`Failed to load vehicle types: ${response.status}`);
    }
    const data = await response.json();
    vehicleTypes.value = Array.isArray(data?.Results)
      ? data.Results.map((item) => item.VehicleTypeName).filter(Boolean)
      : [];
  } catch {
    vehicleTypes.value = [];
  } finally {
    vehicleTypesLoading.value = false;
  }
};

const CATEGORY_API_MAP = {
  Asset: '/api/records/asset-inventory',
  Vehicle: '/api/records/asset-vehicles',
  Cash: '/api/records/cash-and-investments',
  Investment: '/api/records/cash-and-investments',
  Investments: '/api/records/cash-and-investments',
  'Real Estate': '/api/records/real-estate',
  Liability: '/api/records/debt',
  Debt: '/api/records/debt',
  Insurance: '/api/records/insurance',
};

const loadRecordsForCategory = async () => {
  if (!auth.user || !selectedCategory.value) return;
  const api = CATEGORY_API_MAP[selectedCategory.value];
  if (!api) {
    categoryRecords.value = [];
    recordsLoadError.value = "";
    return;
  }
  recordsLoading.value = true;
  recordsLoadError.value = "";
  try {
    const data = await $fetch(api);
    categoryRecords.value = data?.records ?? [];
  } catch (err) {
    categoryRecords.value = [];
    recordsLoadError.value = err?.data?.statusMessage || err?.message || "Failed to load records.";
  } finally {
    recordsLoading.value = false;
  }
};

const submitForm = async () => {
  error.value = "";
  success.value = "";

  if (!auth.user) {
    error.value = "You must be logged in to submit.";
    return;
  }

  if (!canSubmit.value) {
    error.value = "Please fill in the required fields.";
    return;
  }

  submitting.value = true;
  try {
    if (isCashOrInvestment.value) {
      await $fetch("/api/estate-mgmt/cash-investment", {
        method: "POST",
        body: {
          asset_category: selectedCategory.value,
          classification_type: cashInvestmentClassification.value,
          institution: cashInvestmentForm.institution,
          account_number: cashInvestmentForm.account_number,
          value: cashInvestmentForm.value,
          account_support_number: cashInvestmentForm.account_support_number,
          institution_url: cashInvestmentForm.institution_url,
          account_holder: cashInvestmentForm.account_holder,
          account_intent: cashInvestmentForm.account_intent,
          trust_designated: cashInvestmentForm.trust_designated,
        },
      });
      success.value = "Entry submitted.";
      void loadRecordsForCategory();
      resetForm();
      return;
    }
    if (selectedCategory.value === "Vehicle") {
      await $fetch("/api/estate-mgmt/vehicle", {
        method: "POST",
        body: {
          classification_type: vehicleType.value,
          year: vehicleYear.value,
          make: vehicleMake.value,
          model: vehicleModel.value,
          vin: vehicleVin.value,
          value: vehicleValue.value,
          age: vehicleAge.value,
          description: vehicleDescription.value,
          trust_designated: vehicleTrustDesignated.value,
        },
      });
      success.value = "Vehicle submitted.";
      void loadRecordsForCategory();
      resetForm();
      return;
    }
    if (selectedCategory.value === "Real Estate") {
      await $fetch("/api/estate-mgmt/real-estate", {
        method: "POST",
        body: {
          number: realEstateForm.number || undefined,
          street: realEstateForm.street,
          city: realEstateForm.city,
          state: realEstateForm.state,
          zipcode: realEstateForm.zipcode,
          value: realEstateForm.value,
          trust_designated: realEstateForm.trust_designated,
        },
      });
      success.value = "Real estate entry submitted.";
      void loadRecordsForCategory();
      resetForm();
      return;
    }
    if (selectedCategory.value === "Insurance") {
      await $fetch("/api/estate-mgmt/insurance", {
        method: "POST",
        body: {
          policy_holder: insuranceForm.policy_holder,
          polocy_number: insuranceForm.polocy_number || undefined,
          entity_covered: insuranceForm.entity_covered || undefined,
          policy_amt: insuranceForm.policy_amt !== "" ? insuranceForm.policy_amt : undefined,
          intent: insuranceForm.intent || undefined,
          institution_url: insuranceForm.institution_url || undefined,
        },
      });
      success.value = "Insurance entry submitted.";
      void loadRecordsForCategory();
      resetForm();
      return;
    }
    if (isDebtCategory.value) {
      const [linkedType, linkedId] = debtForm.linked_asset ? debtForm.linked_asset.split(":") : [null, null];
      await $fetch("/api/estate-mgmt/debt", {
        method: "POST",
        body: {
          institution: debtForm.institution,
          loan_number: debtForm.loan_number || undefined,
          loan_type: debtClassification.value || undefined,
          loan_ammount: debtForm.loan_ammount !== "" ? debtForm.loan_ammount : undefined,
          linked_asset_type: linkedType || undefined,
          linked_asset_id: linkedId ? Number(linkedId) : undefined,
          customer_support_no: debtForm.customer_support_no || undefined,
          address_url: debtForm.address_url || undefined,
          borrower: debtForm.borrower || undefined,
        },
      });
      success.value = "Debt entry submitted.";
      void loadRecordsForCategory();
      resetForm();
      return;
    }
    await $fetch("/api/estate-mgmt/submit", {
      method: "POST",
      body: {
        classification_type: isAssetCategory.value
          ? assetClassification.value
          : selectedCategory.value,
        title: form.title,
        description: form.description,
        value: form.value,
        location: form.location,
      },
    });

    success.value = "Entry submitted.";
    void loadRecordsForCategory();
    resetForm();
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || "Submission failed.";
    if (selectedCategory.value === "Vehicle" && message === VIN_DUPLICATE_MESSAGE) {
      vinDuplicateDialogRef.value?.showModal();
    } else {
      error.value = message;
    }
  } finally {
    submitting.value = false;
  }
};

const onVinDuplicateDialogClose = () => {
  nextTick(() => {
    vinInputRef.value?.focus();
  });
};

const resetForm = () => {
  selectedCategory.value = "";
  cashInvestmentClassification.value = "";
  assetClassification.value = "";
  classifications.value = [];
  form.title = "";
  form.description = "";
  form.value = "";
  form.location = "";
  cashInvestmentForm.institution = "";
  cashInvestmentForm.account_number = "";
  cashInvestmentForm.value = "";
  cashInvestmentForm.account_support_number = "";
  cashInvestmentForm.institution_url = "";
  cashInvestmentForm.account_holder = "";
  cashInvestmentForm.account_intent = "";
  cashInvestmentForm.trust_designated = "";
  vehicleMake.value = "";
  vehicleMakeFilter.value = "";
  vehicleModel.value = "";
  vehicleYear.value = "";
  vehicleType.value = "";
  vehicleVin.value = "";
  vehicleValue.value = "";
  vehicleDescription.value = "";
  vehicleTrustDesignated.value = "";
  vehicleModels.value = [];
  vehicleTypes.value = [];
  realEstateForm.number = "";
  realEstateForm.street = "";
  realEstateForm.city = "";
  realEstateForm.state = "";
  realEstateForm.zipcode = "";
  realEstateForm.value = "";
  realEstateForm.trust_designated = "";
  debtClassification.value = "";
  debtForm.institution = "";
  debtForm.loan_number = "";
  debtForm.loan_ammount = "";
  debtForm.linked_asset = "";
  debtForm.customer_support_no = "";
  debtForm.address_url = "";
  debtForm.borrower = "";
  insuranceForm.policy_holder = "";
  insuranceForm.polocy_number = "";
  insuranceForm.entity_covered = "";
  insuranceForm.policy_amt = "";
  insuranceForm.intent = "";
  insuranceForm.institution_url = "";
};

watch(selectedCategory, () => {
  error.value = "";
  success.value = "";
  recordsLoadError.value = "";
  if (isCashOrInvestment.value || isAssetCategory.value) {
    void loadClassifications();
  } else if (isDebtCategory.value) {
    void loadDebtTypes();
    void loadLinkedAssets();
  } else {
    classifications.value = [];
    cashInvestmentClassification.value = "";
    assetClassification.value = "";
    debtClassification.value = "";
    debtTypes.value = [];
  }
  void loadRecordsForCategory();
});

watch(() => auth.user, () => {
  if (auth.user && selectedCategory.value) {
    void loadRecordsForCategory();
  }
});

onMounted(() => {
  if (!auth.ready) {
    auth.fetchSession();
  }
  void loadCategories();
  void loadVehicleMakes();
});

watch(vehicleYear, () => {
  vehicleMake.value = "";
  vehicleMakeFilter.value = "";
  vehicleModel.value = "";
  vehicleModels.value = [];
  vehicleType.value = "";
  vehicleTypes.value = [];
});

watch(vehicleMake, () => {
  vehicleModel.value = "";
  vehicleModels.value = [];
  vehicleType.value = "";
  vehicleTypes.value = [];
  if (vehicleMake.value && vehicleYear.value) {
    void loadVehicleModels();
  }
  if (vehicleMake.value) {
    void loadVehicleTypes();
  }
});

watch(vehicleType, () => {
  vehicleModel.value = "";
  vehicleModels.value = [];
  if (vehicleMake.value && vehicleYear.value && vehicleType.value) {
    void loadVehicleModels();
  }
});
</script>

<style scoped>
.estate-records-panel {
  height: 12rem; /* mobile: header + ~3 cards */
}
@media (min-width: 768px) {
  .estate-records-panel {
    height: 20rem; /* desktop: header + cards, scrollable */
  }
}
.estate-records-scroll {
  min-height: 0;
  overflow: hidden;
}
/* Cards: vertical scroll on mobile, horizontal scroll on desktop */
.estate-records-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  min-height: 0;
}
@media (min-width: 768px) {
  .estate-records-cards {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 1rem;
  }
}
.estate-record-card {
  flex-shrink: 0;
}
@media (min-width: 768px) {
  .estate-record-card {
    min-width: 280px;
  }
}
</style>
