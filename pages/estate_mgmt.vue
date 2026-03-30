<template>
  <section class="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8 p-4 sm:p-6">
    <header class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h1 class="text-xl sm:text-2xl font-semibold">Estate Management</h1>
        <button
          v-if="auth.user"
          type="button"
          class="btn btn-outline btn-sm shrink-0 sm:btn-md"
          @click="openManageAssetCategoriesModal"
        >
          Manage Asset Categories
        </button>
      </div>
      <p class="text-sm text-base-content/70">
        Overview of your estate records across all categories.
      </p>
    </header>

    <div v-if="!auth.ready" class="rounded-lg border border-base-200 bg-base-300 p-4">
      <span class="text-sm text-base-content/70">Loading session...</span>
    </div>

    <div
      v-else-if="!auth.user"
      class="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-content"
    >
      You must be logged in to use estate management.
    </div>

    <template v-else>
      <div v-if="loading" class="text-sm text-base-content/70">Loading...</div>

      <div v-else class="space-y-8">
        <!-- Net Wealth -->
        <div class="rounded-lg border border-base-200 bg-base-300 overflow-hidden">
          <h2 class="table-category-title border-b border-base-200 bg-accent px-4 py-3 text-sm font-semibold flex justify-between items-center text-secondary-content">
            <span>Net Wealth</span>
            <span class="font-bold text-secondary-content">{{ formatMoney(netWealth) }}</span>
          </h2>
          <div class="overflow-x-auto">
            <ion-grid class="ion-no-padding summary-grid summary-grid-2 summary-grid-mobile">
              <ion-row v-for="(row, i) in netWealthRows" :key="row.category" :class="['summary-grid-row', 'bg-base-100']">
                <ion-col>{{ row.category }}</ion-col>
                <ion-col></ion-col>
                <ion-col></ion-col>
                <ion-col></ion-col>
                <ion-col></ion-col>
                <ion-col></ion-col>
                <ion-col></ion-col>
                <ion-col></ion-col>
                <ion-col class="summary-net-wealth-total text-center">{{ formatMoney(row.total) }}</ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </div>

        <!-- Asset Inventory -->
        <div class="rounded-lg border border-base-200 bg-base-300 overflow-hidden">
          <h2 class="table-category-title border-b border-base-200 bg-info/40 px-4 py-3 text-sm font-semibold flex justify-between items-center flex-wrap gap-2 text-secondary-content">
            <span class="flex items-center gap-2">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openAddModal('asset')" title="Add Asset"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></button>
              <span>Asset Inventory</span>
            </span>
            <span class="font-bold text-secondary-content">{{ formatMoney(totalAssetInventory) }}</span>
          </h2>
          <!-- Mobile card layout -->
          <div class="md:hidden summary-section-scroll overflow-y-auto space-y-2 p-3">
            <div v-for="r in sortedAssetInventory" :key="r.ai_id" class="rounded-lg border border-base-200 bg-base-100 p-3 flex items-start gap-2 text-sm">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer shrink-0 mt-0.5" @click="openEditModal('asset_inventory', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex justify-between items-start gap-2">
                  <span class="font-semibold truncate flex-1">{{ r.title }}</span>
                  <span class="font-bold shrink-0">{{ formatMoney(r.value) }}</span>
                </div>
                <div class="text-base-content/80"><span class="font-medium">Classification:</span> {{ r.asset_classification ?? r.classification_type ?? '—' }}</div>
                <div v-if="r.location" class="text-base-content/70"><span class="font-medium">Location:</span> {{ r.location }}</div>
              </div>
            </div>
            <p v-if="assetInventory.length === 0" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <!-- Desktop grid -->
          <div class="hidden md:block summary-section-scroll overflow-x-auto overflow-y-auto">
            <ion-grid class="ion-no-padding summary-grid summary-grid-6">
              <ion-row class="summary-grid-header bg-base-200/80">
                <ion-col class="summary-edit-col"></ion-col>
                <ion-col v-for="col in [{k:'title',l:'Title'},{k:'classification',l:'Classification'},{k:'value',l:'Value'},{k:'location',l:'Location'}]" :key="col.k" class="cursor-pointer select-none hover:bg-base-200/50" @click="setSort('assetInventory', col.k)">{{ col.l }} {{ sortState.assetInventory.key === col.k ? (sortState.assetInventory.dir === 'asc' ? '▲' : '▼') : '' }}</ion-col>
              </ion-row>
              <ion-row v-for="(r, i) in sortedAssetInventory" :key="r.ai_id" :class="['summary-grid-row', 'bg-base-100']">
                <ion-col class="summary-edit-col">
                  <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openEditModal('asset_inventory', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
                </ion-col>
                <ion-col>{{ r.title }}</ion-col>
                <ion-col class="capitalize">{{ r.asset_classification ?? r.classification_type ?? '—' }}</ion-col>
                <ion-col class="font-bold">{{ formatMoney(r.value) }}</ion-col>
                <ion-col>{{ r.location }}</ion-col>
              </ion-row>
              <ion-row v-if="assetInventory.length === 0" class="summary-grid-row bg-base-100">
                <ion-col :size="12" class="text-base-content/60">No records</ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </div>

        <!-- Asset Vehicles -->
        <div class="rounded-lg border border-base-200 bg-base-300 overflow-hidden">
          <h2 class="table-category-title border-b border-base-200 bg-info/40 px-4 py-3 text-sm font-semibold flex justify-between items-center flex-wrap gap-2 text-secondary-content">
            <span class="flex items-center gap-2">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openAddModal('vehicle')" title="Add Vehicle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></button>
              <span>Asset Vehicles</span>
            </span>
            <span class="font-bold text-secondary-content">{{ formatMoney(totalAssetVehicles) }}</span>
          </h2>
          <div class="md:hidden summary-section-scroll overflow-y-auto space-y-2 p-3">
            <div v-for="r in sortedAssetVehicles" :key="r.vh_id" class="rounded-lg border border-base-200 bg-base-300 p-3 flex items-start gap-2 text-sm">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer shrink-0 mt-0.5" @click="openEditModal('asset_vehicles', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex justify-between items-start gap-2">
                  <span class="font-semibold">{{ r.year }} {{ r.make }} {{ r.model }}</span>
                  <span class="font-bold shrink-0">{{ formatMoney(r.value) }}</span>
                </div>
                <div v-if="r.vin" class="text-base-content/70 text-xs"><span class="font-medium">VIN:</span> {{ r.vin }}</div>
                <div class="text-base-content/80"><span class="font-medium">Trust:</span> {{ r.trust_designated ? 'Y' : 'N' }}</div>
              </div>
            </div>
            <p v-if="assetVehicles.length === 0" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <div class="hidden md:block summary-section-scroll overflow-x-auto overflow-y-auto">
            <ion-grid class="ion-no-padding summary-grid summary-grid-6">
              <ion-row class="summary-grid-header bg-base-200/80">
                <ion-col class="summary-edit-col"></ion-col>
                <ion-col v-for="col in [{k:'make',l:'Make'},{k:'model',l:'Model'},{k:'vin',l:'VIN'},{k:'value',l:'Value'},{k:'trust_designated',l:'Trust'}]" :key="col.k" class="cursor-pointer select-none hover:bg-base-200/50" @click="setSort('assetVehicles', col.k)">{{ col.l }} {{ sortState.assetVehicles.key === col.k ? (sortState.assetVehicles.dir === 'asc' ? '▲' : '▼') : '' }}</ion-col>
              </ion-row>
              <ion-row v-for="(r, i) in sortedAssetVehicles" :key="r.vh_id" :class="['summary-grid-row', 'bg-base-100']">
                <ion-col class="summary-edit-col">
                  <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openEditModal('asset_vehicles', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
                </ion-col>
                <ion-col>{{ r.make }}</ion-col>
                <ion-col>{{ r.model }}</ion-col>
                <ion-col>{{ r.vin }}</ion-col>
                <ion-col class="font-bold">{{ formatMoney(r.value) }}</ion-col>
                <ion-col>{{ r.trust_designated ? 'Y' : 'N' }}</ion-col>
              </ion-row>
              <ion-row v-if="assetVehicles.length === 0" class="summary-grid-row bg-base-100">
                <ion-col :size="12" class="text-base-content/60">No records</ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </div>

        <!-- Cash and Investments -->
        <div class="rounded-lg border border-base-200 bg-base-300 overflow-hidden">
          <h2 class="table-category-title border-b border-base-200 bg-info/40 px-4 py-3 text-sm font-semibold flex justify-between items-center flex-wrap gap-2 text-secondary-content">
            <span class="flex items-center gap-2">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openAddModal('cash')" title="Add Cash/Investment"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></button>
              <span>Cash and Investments</span>
            </span>
            <span class="font-bold text-secondary-content">{{ formatMoney(totalCashAndInvestments) }}</span>
          </h2>
          <div class="md:hidden summary-section-scroll overflow-y-auto space-y-2 p-3">
            <div v-for="(r, i) in sortedCashAndInvestments" :key="r.ci_id ?? 'cai-' + i" class="rounded-lg border border-base-200 bg-base-100 p-3 flex items-start gap-2 text-sm">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer shrink-0 mt-0.5" @click="openEditModal('cash_and_investments', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex justify-between items-start gap-2">
                  <a v-if="r.institution_url && r.institution_url.trim()" :href="r.institution_url" target="_blank" rel="noopener noreferrer" class="font-semibold link link-primary">{{ r.institution }}</a>
                  <span v-else class="font-semibold">{{ r.institution }}</span>
                  <span class="font-bold shrink-0">{{ formatMoney(r.value) }}</span>
                </div>
                <div class="text-base-content/80"><span class="font-medium">Type:</span> <span class="capitalize">{{ r.acct_type }}</span></div>
                <div v-if="r.acct_number" class="text-base-content/70 text-xs"><span class="font-medium">Account #:</span> {{ r.acct_number }}</div>
                <div class="text-base-content/80"><span class="font-medium">Trust:</span> {{ r.trust_designated ? 'Y' : 'N' }}</div>
              </div>
            </div>
            <p v-if="sortedCashAndInvestments.length === 0" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <div class="hidden md:block summary-section-scroll overflow-x-auto overflow-y-auto">
            <ion-grid class="ion-no-padding summary-grid summary-grid-6">
              <ion-row class="summary-grid-header bg-base-200/80">
                <ion-col class="summary-edit-col"></ion-col>
                <ion-col v-for="col in [{k:'acct_type',l:'Type'},{k:'institution',l:'Institution'},{k:'acct_number',l:'Account #'},{k:'value',l:'Value'},{k:'trust_designated',l:'Trust'}]" :key="col.k" class="cursor-pointer select-none hover:bg-base-200/50" @click="setSort('cashAndInvestments', col.k)">{{ col.l }} {{ sortState.cashAndInvestments.key === col.k ? (sortState.cashAndInvestments.dir === 'asc' ? '▲' : '▼') : '' }}</ion-col>
              </ion-row>
              <ion-row v-for="(r, i) in sortedCashAndInvestments" :key="r.ci_id ?? 'cai-' + i" :class="['summary-grid-row', 'bg-base-100']">
                <ion-col class="summary-edit-col">
                  <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openEditModal('cash_and_investments', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
                </ion-col>
                <ion-col class="capitalize">{{ r.acct_type }}</ion-col>
                <ion-col>
                  <a v-if="r.institution_url && r.institution_url.trim()" :href="r.institution_url" target="_blank" rel="noopener noreferrer" class="link link-primary">{{ r.institution }}</a>
                  <template v-else>{{ r.institution }}</template>
                </ion-col>
                <ion-col>{{ r.acct_number }}</ion-col>
                <ion-col class="font-bold">{{ formatMoney(r.value) }}</ion-col>
                <ion-col>{{ r.trust_designated ? 'Y' : 'N' }}</ion-col>
              </ion-row>
              <ion-row v-if="sortedCashAndInvestments.length === 0" class="summary-grid-row bg-base-100">
                <ion-col :size="12" class="text-base-content/60">No records</ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </div>

        <!-- Debt -->
        <div class="rounded-lg border border-base-200 bg-base-300 overflow-hidden">
          <h2 class="table-category-title border-b border-base-200 bg-info/40 px-4 py-3 text-sm font-semibold flex justify-between items-center flex-wrap gap-2 text-secondary-content">
            <span class="flex items-center gap-2">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openAddModal('debt')" title="Add Debt"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></button>
              <span>Debt</span>
            </span>
            <span class="font-bold text-secondary-content">{{ formatMoney(totalDebtTable) }}</span>
          </h2>
          <div class="md:hidden summary-section-scroll overflow-y-auto space-y-2 p-3">
            <div v-for="r in sortedDebt" :key="r.dbt_id" class="rounded-lg border border-base-200 bg-base-100 p-3 flex items-start gap-2 text-sm">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer shrink-0 mt-0.5" @click="openEditModal('debt', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex justify-between items-start gap-2">
                  <a v-if="r.address_url && r.address_url.trim()" :href="r.address_url" target="_blank" rel="noopener noreferrer" class="font-semibold link link-primary">{{ r.institution }}</a>
                  <span v-else class="font-semibold">{{ r.institution }}</span>
                  <span class="font-bold shrink-0">{{ formatMoney(r.loan_ammount) }}</span>
                </div>
                <div class="text-base-content/80"><span class="font-medium">Loan #:</span> {{ r.loan_number }}</div>
                <div class="text-base-content/80"><span class="font-medium">Type:</span> <span class="capitalize">{{ r.loan_type }}</span></div>
                <div v-if="getLinkedAssetLabel(r)" class="text-base-content/70"><span class="font-medium">Linked:</span> {{ getLinkedAssetLabel(r) }}</div>
              </div>
            </div>
            <p v-if="debt.length === 0" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <div class="hidden md:block summary-section-scroll overflow-x-auto overflow-y-auto">
            <ion-grid class="ion-no-padding summary-grid summary-grid-7">
              <ion-row class="summary-grid-header bg-base-200/80">
                <ion-col class="summary-edit-col"></ion-col>
                <ion-col v-for="col in [{k:'institution',l:'Institution'},{k:'loan_number',l:'Loan #'},{k:'loan_type',l:'Loan Type'},{k:'loan_ammount',l:'Loan Amount'},{k:'linked_asset',l:'Linked Asset'},{k:'customer_support_no',l:'Support #'}]" :key="col.k" class="cursor-pointer select-none hover:bg-base-200/50" @click="setSort('debt', col.k)">{{ col.l }} {{ sortState.debt.key === col.k ? (sortState.debt.dir === 'asc' ? '▲' : '▼') : '' }}</ion-col>
              </ion-row>
              <ion-row v-for="(r, i) in sortedDebt" :key="r.dbt_id" :class="['summary-grid-row', 'bg-base-100']">
                <ion-col class="summary-edit-col">
                  <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openEditModal('debt', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
                </ion-col>
                <ion-col>
                  <a v-if="r.address_url && r.address_url.trim()" :href="r.address_url" target="_blank" rel="noopener noreferrer" class="link link-primary">{{ r.institution }}</a>
                  <template v-else>{{ r.institution }}</template>
                </ion-col>
                <ion-col>{{ r.loan_number }}</ion-col>
                <ion-col class="capitalize">{{ r.loan_type }}</ion-col>
                <ion-col class="font-bold">{{ formatMoney(r.loan_ammount) }}</ion-col>
                <ion-col>{{ getLinkedAssetLabel(r) }}</ion-col>
                <ion-col>{{ r.customer_support_no }}</ion-col>
              </ion-row>
              <ion-row v-if="debt.length === 0" class="summary-grid-row bg-base-100">
                <ion-col :size="12" class="text-base-content/60">No records</ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </div>

        <!-- Real Estate -->
        <div class="rounded-lg border border-base-200 bg-base-300 overflow-hidden">
          <h2 class="table-category-title border-b border-base-200 bg-info/40 px-4 py-3 text-sm font-semibold flex justify-between items-center flex-wrap gap-2 text-secondary-content">
            <span class="flex items-center gap-2">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openAddModal('real_estate')" title="Add Real Estate"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></button>
              <span>Real Estate</span>
            </span>
            <span class="font-bold text-secondary-content">{{ formatMoney(totalRealEstateValue) }}</span>
          </h2>
          <div class="md:hidden summary-section-scroll overflow-y-auto space-y-2 p-3">
            <div v-for="r in sortedRealEstate" :key="r.re_id" class="rounded-lg border border-base-200 bg-base-100 p-3 flex items-start gap-2 text-sm">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer shrink-0 mt-0.5" @click="openEditModal('real_estate', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex justify-between items-start gap-2">
                  <span class="font-semibold">{{ [r.number, r.street].filter(Boolean).join(' ') || '—' }}, {{ r.city }}</span>
                  <span class="font-bold shrink-0">{{ formatMoney(r.value) }}</span>
                </div>
                <div class="text-base-content/80"><span class="font-medium">State:</span> {{ r.state }} <span class="font-medium">Zip:</span> {{ r.zipcode }}</div>
                <div class="text-base-content/80"><span class="font-medium">Trust:</span> {{ r.trust_designated ? 'Y' : 'N' }}</div>
              </div>
            </div>
            <p v-if="realEstate.length === 0" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <div class="hidden md:block summary-section-scroll overflow-x-auto overflow-y-auto">
            <ion-grid class="ion-no-padding summary-grid summary-grid-7">
              <ion-row class="summary-grid-header bg-base-200/80">
                <ion-col class="summary-edit-col"></ion-col>
                <ion-col v-for="col in [{k:'address',l:'Address'},{k:'city',l:'City'},{k:'state',l:'State'},{k:'zipcode',l:'Zip'},{k:'value',l:'Value'},{k:'trust_designated',l:'Trust'}]" :key="col.k" class="cursor-pointer select-none hover:bg-base-200/50" @click="setSort('realEstate', col.k)">{{ col.l }} {{ sortState.realEstate.key === col.k ? (sortState.realEstate.dir === 'asc' ? '▲' : '▼') : '' }}</ion-col>
              </ion-row>
              <ion-row v-for="(r, i) in sortedRealEstate" :key="r.re_id" :class="['summary-grid-row', 'bg-base-100']">
                <ion-col class="summary-edit-col">
                  <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openEditModal('real_estate', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
                </ion-col>
                <ion-col>{{ [r.number, r.street].filter(Boolean).join(' ') || '—' }}</ion-col>
                <ion-col>{{ r.city }}</ion-col>
                <ion-col>{{ r.state }}</ion-col>
                <ion-col>{{ r.zipcode }}</ion-col>
                <ion-col class="font-bold">{{ formatMoney(r.value) }}</ion-col>
                <ion-col>{{ r.trust_designated ? 'Y' : 'N' }}</ion-col>
              </ion-row>
              <ion-row v-if="realEstate.length === 0" class="summary-grid-row bg-base-100">
                <ion-col :size="12" class="text-base-content/60">No records</ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </div>

        <!-- Insurance -->
        <div class="rounded-lg border border-base-200 bg-base-300 overflow-hidden">
          <h2 class="table-category-title border-b border-base-200 bg-info/40 px-4 py-3 text-sm font-semibold flex justify-between items-center flex-wrap gap-2 text-secondary-content">
            <span class="flex items-center gap-2">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openAddModal('insurance')" title="Add Insurance"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></button>
              <span>Insurance</span>
            </span>
          </h2>
          <div class="md:hidden summary-section-scroll overflow-y-auto space-y-2 p-3">
            <div v-for="r in sortedInsurance" :key="r.ins_id" class="rounded-lg border border-base-200 bg-base-100 p-3 flex items-start gap-2 text-sm">
              <button type="button" class="p-0 border-0 bg-transparent cursor-pointer shrink-0 mt-0.5" @click="openEditModal('insurance', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex justify-between items-start gap-2">
                  <a v-if="r.institution_url && r.institution_url.trim()" :href="r.institution_url" target="_blank" rel="noopener noreferrer" class="font-semibold link link-primary">{{ r.policy_holder }}</a>
                  <span v-else class="font-semibold">{{ r.policy_holder }}</span>
                  <span class="font-bold shrink-0 text-secondary">{{ formatMoney(r.policy_amt) }}</span>
                </div>
                <div class="text-base-content/80"><span class="font-medium">Policy #:</span> {{ r.polocy_number }}</div>
                <div class="text-base-content/80"><span class="font-medium">Entity:</span> {{ r.entity_covered }}</div>
                <div class="text-base-content/80"><span class="font-medium">Intent:</span> <span class="capitalize">{{ r.intent }}</span></div>
              </div>
            </div>
            <p v-if="insurance.length === 0" class="text-base-content/60 text-sm py-2">No records</p>
          </div>
          <div class="hidden md:block summary-section-scroll overflow-x-auto overflow-y-auto">
            <ion-grid class="ion-no-padding summary-grid summary-grid-6">
              <ion-row class="summary-grid-header bg-base-200/80">
                <ion-col class="summary-edit-col"></ion-col>
                <ion-col v-for="col in [{k:'policy_holder',l:'Policy Holder'},{k:'polocy_number',l:'Policy #'},{k:'entity_covered',l:'Entity Covered'},{k:'policy_amt',l:'Amount'},{k:'intent',l:'Intent'}]" :key="col.k" class="cursor-pointer select-none hover:bg-base-200/50" @click="setSort('insurance', col.k)">{{ col.l }} {{ sortState.insurance.key === col.k ? (sortState.insurance.dir === 'asc' ? '▲' : '▼') : '' }}</ion-col>
              </ion-row>
              <ion-row v-for="(r, i) in sortedInsurance" :key="r.ins_id" :class="['summary-grid-row', 'bg-base-100']">
                <ion-col class="summary-edit-col">
                  <button type="button" class="p-0 border-0 bg-transparent cursor-pointer" @click="openEditModal('insurance', r)" title="Update"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button>
                </ion-col>
                <ion-col>
                  <a v-if="r.institution_url && r.institution_url.trim()" :href="r.institution_url" target="_blank" rel="noopener noreferrer" class="link link-primary">{{ r.policy_holder }}</a>
                  <template v-else>{{ r.policy_holder }}</template>
                </ion-col>
                <ion-col>{{ r.polocy_number }}</ion-col>
                <ion-col>{{ r.entity_covered }}</ion-col>
                <ion-col class="text-secondary font-bold">{{ formatMoney(r.policy_amt) }}</ion-col>
                <ion-col class="capitalize">{{ r.intent }}</ion-col>
              </ion-row>
              <ion-row v-if="insurance.length === 0" class="summary-grid-row bg-base-100">
                <ion-col :size="12" class="text-base-content/60">No records</ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </div>
      </div>
    </template>

    <!-- Add Record Modal -->
    <dialog ref="addModalRef" class="modal" @close="addModalType = null">
      <div class="modal-box w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full">
        <h3 class="text-lg font-bold">{{ addModalTitle }}</h3>

        <!-- Add Asset -->
        <form v-if="addModalType === 'asset'" class="mt-4 space-y-3" @submit.prevent="submitAddAsset">
          <label class="form-control w-full"><span class="label-text text-sm">Classification</span>
            <select class="select select-bordered select-sm w-full" v-model="addAssetForm.classification_type" required>
              <option disabled value="">Select classification...</option>
              <option v-for="c in addAssetClassifications" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
          <label class="form-control w-full"><span class="label-text text-sm">Title</span><input v-model.trim="addAssetForm.title" class="input input-bordered input-sm w-full" required /></label>
          <label class="form-control w-full"><span class="label-text text-sm">Value</span><input v-model.number="addAssetForm.value" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" required /></label>
          <label class="form-control w-full"><span class="label-text text-sm">Description</span><textarea v-model.trim="addAssetForm.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" required /></label>
          <label class="form-control w-full"><span class="label-text text-sm">Location</span><input v-model.trim="addAssetForm.location" class="input input-bordered input-sm w-full" /></label>
          <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>

        <!-- Add Real Estate -->
        <form v-else-if="addModalType === 'real_estate'" class="mt-4 space-y-3" @submit.prevent="submitAddRealEstate">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Number</span><input v-model.trim="addRealEstateForm.number" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Street</span><input v-model.trim="addRealEstateForm.street" class="input input-bordered input-sm w-full" required /></label>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="form-control"><span class="label-text text-sm">City</span><input v-model.trim="addRealEstateForm.city" class="input input-bordered input-sm w-full" required /></label>
            <label class="form-control"><span class="label-text text-sm">State</span><input v-model.trim="addRealEstateForm.state" class="input input-bordered input-sm w-full" required /></label>
            <label class="form-control"><span class="label-text text-sm">Zipcode</span><input v-model.trim="addRealEstateForm.zipcode" class="input input-bordered input-sm w-full" required /></label>
          </div>
          <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="addRealEstateForm.value" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" required /></label>
          <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="addRealEstateForm.trust_designated" class="select select-bordered select-sm w-full" required><option value="">Select...</option><option value="Y">Y</option><option value="N">N</option></select></label>
          <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>

        <!-- Add Insurance -->
        <form v-else-if="addModalType === 'insurance'" class="mt-4 space-y-3" @submit.prevent="submitAddInsurance">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Policy Holder</span><input v-model.trim="addInsuranceForm.policy_holder" class="input input-bordered input-sm w-full" required /></label>
            <label class="form-control"><span class="label-text text-sm">Policy #</span><input v-model.trim="addInsuranceForm.polocy_number" class="input input-bordered input-sm w-full" /></label>
          </div>
          <label class="form-control"><span class="label-text text-sm">Entity Covered</span><input v-model.trim="addInsuranceForm.entity_covered" class="input input-bordered input-sm w-full" /></label>
          <label class="form-control"><span class="label-text text-sm">Amount</span><input v-model="addInsuranceForm.policy_amt" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" /></label>
          <label class="form-control"><span class="label-text text-sm">Intent</span><input v-model.trim="addInsuranceForm.intent" class="input input-bordered input-sm w-full" placeholder="e.g. Life, Auto, Home" /></label>
          <label class="form-control"><span class="label-text text-sm">Institution URL</span><input v-model.trim="addInsuranceForm.institution_url" class="input input-bordered input-sm w-full" type="url" /></label>
          <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>

        <!-- Add Debt -->
        <form v-else-if="addModalType === 'debt'" class="mt-4 space-y-3" @submit.prevent="submitAddDebt">
          <label class="form-control"><span class="label-text text-sm">Debt Type</span>
            <select class="select select-bordered select-sm w-full" v-model="addDebtForm.loan_type">
              <option value="">Select debt type...</option>
              <option v-for="t in addDebtTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
          <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model.trim="addDebtForm.institution" class="input input-bordered input-sm w-full" required /></label>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Loan #</span><input v-model.trim="addDebtForm.loan_number" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Loan Amount</span><input v-model="addDebtForm.loan_ammount" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
          </div>
          <label class="form-control"><span class="label-text text-sm">Link to Asset</span>
            <select class="select select-bordered select-sm w-full" v-model="addDebtForm.linked_asset">
              <option value="">None (no link)</option>
              <option v-for="a in linkedAssets" :key="a.type + ':' + a.id" :value="a.type + ':' + a.id">{{ a.label }}</option>
            </select>
          </label>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Borrower</span><input v-model.trim="addDebtForm.borrower" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model.trim="addDebtForm.customer_support_no" class="input input-bordered input-sm w-full" /></label>
          </div>
          <label class="form-control"><span class="label-text text-sm">URL</span><input v-model.trim="addDebtForm.address_url" class="input input-bordered input-sm w-full" type="url" /></label>
          <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>

        <!-- Add Cash/Investment -->
        <form v-else-if="addModalType === 'cash'" class="mt-4 space-y-3" @submit.prevent="submitAddCash">
          <label class="form-control"><span class="label-text text-sm">Category</span>
            <div class="flex gap-4">
              <label class="label cursor-pointer gap-2">
                <input type="radio" name="cash-category" value="Cash" v-model="addCashForm.asset_category" class="radio radio-sm" @change="onAddCashCategoryChange" />
                <span class="label-text">Cash</span>
              </label>
              <label class="label cursor-pointer gap-2">
                <input type="radio" name="cash-category" value="Investment" v-model="addCashForm.asset_category" class="radio radio-sm" @change="onAddCashCategoryChange" />
                <span class="label-text">Investment</span>
              </label>
            </div>
          </label>
          <label class="form-control"><span class="label-text text-sm">Classification (Type)</span>
            <select class="select select-bordered select-sm w-full" v-model="addCashForm.classification_type" required>
              <option disabled value="">Select type...</option>
              <option v-for="c in addCashClassifications" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model.trim="addCashForm.institution" class="input input-bordered input-sm w-full" required /></label>
            <label class="form-control"><span class="label-text text-sm">Account #</span><input v-model.trim="addCashForm.account_number" class="input input-bordered input-sm w-full" required /></label>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="addCashForm.value" class="input input-bordered input-sm w-full" type="number" step="0.01" min="0" required /></label>
            <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model.trim="addCashForm.account_support_number" class="input input-bordered input-sm w-full" required /></label>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Institution URL</span><input v-model.trim="addCashForm.institution_url" class="input input-bordered input-sm w-full" type="url" required /></label>
            <label class="form-control"><span class="label-text text-sm">Account Holder</span><input v-model.trim="addCashForm.account_holder" class="input input-bordered input-sm w-full" required /></label>
          </div>
          <label class="form-control"><span class="label-text text-sm">Account Intent</span><input v-model.trim="addCashForm.account_intent" class="input input-bordered input-sm w-full" required /></label>
          <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="addCashForm.trust_designated" class="select select-bordered select-sm w-full" required><option value="">Select...</option><option value="Y">Y</option><option value="N">N</option></select></label>
          <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving">{{ addSaving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>

        <!-- Add Vehicle (same as Estate Management) -->
        <form v-else-if="addModalType === 'vehicle'" class="mt-4 space-y-3" @submit.prevent="submitAddVehicle">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="form-control"><span class="label-text text-sm">Year</span>
              <select class="select select-bordered select-sm w-full" v-model.number="addVehicleYear" required>
                <option disabled value="">Select year...</option>
                <option v-for="y in addVehicleYears" :key="y" :value="y">{{ y }}</option>
              </select>
            </label>
            <label class="form-control"><span class="label-text text-sm">Make</span>
              <input v-model.trim="addVehicleMakeFilter" class="input input-bordered input-sm w-full" type="text" placeholder="Filter makes..." />
              <select class="select select-bordered select-sm w-full mt-1" v-model="addVehicleMake" :disabled="addVehicleMakesLoading || !addVehicleYear">
                <option disabled value="">{{ addVehicleMakesLoading ? "Loading makes..." : "Select make..." }}</option>
                <option v-for="m in filteredAddVehicleMakes" :key="m" :value="m">{{ m }}</option>
              </select>
            </label>
            <label class="form-control"><span class="label-text text-sm">Type</span>
              <select class="select select-bordered select-sm w-full" v-model="addVehicleType" :disabled="!addVehicleMake || addVehicleTypesLoading">
                <option disabled value="">{{ addVehicleTypesLoading ? "Loading types..." : "Select type..." }}</option>
                <option v-for="t in addVehicleTypes" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Model</span>
              <select v-if="addVehicleModels.length > 0" class="select select-bordered select-sm w-full" v-model="addVehicleModel" :disabled="!addVehicleYear || !addVehicleMake || !addVehicleType || addVehicleModelsLoading">
                <option disabled value="">{{ addVehicleModelsLoading ? "Loading models..." : "Select model..." }}</option>
                <option v-for="m in addVehicleModels" :key="m" :value="m">{{ m }}</option>
              </select>
              <input v-else v-model.trim="addVehicleModel" class="input input-bordered input-sm w-full" type="text" :disabled="!addVehicleYear || !addVehicleMake || !addVehicleType" placeholder="Enter model..." />
            </label>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="form-control"><span class="label-text text-sm">VIN</span><input ref="addVehicleVinInputRef" v-model.trim="addVehicleVin" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.trim="addVehicleValue" class="input input-bordered input-sm w-full" type="text" /></label>
            <label class="form-control"><span class="label-text text-sm">Vehicle Age</span><input class="input input-bordered input-sm w-full" :value="addVehicleAge" readonly /></label>
          </div>
          <label class="form-control"><span class="label-text text-sm">Description</span><textarea v-model.trim="addVehicleDescription" class="textarea textarea-bordered textarea-sm w-full" rows="2" required /></label>
          <label class="form-control"><span class="label-text text-sm">Trust Designated (Y/N)</span>
            <select class="select select-bordered select-sm w-full" v-model="addVehicleTrustDesignated" required>
              <option disabled value="">Select...</option>
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
          </label>
          <div v-if="addError" class="text-sm text-error">{{ addError }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="addModalRef?.close()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="addSaving || !canSubmitAddVehicle">{{ addSaving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>

    <dialog ref="addVehicleVinDuplicateRef" class="modal" @close="onAddVehicleVinDuplicateClose">
      <div class="modal-box">
        <p class="py-2">This vehicle already exists in the database. Please try again.</p>
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

    <!-- Update Record Modal -->
    <dialog ref="updateModalRef" class="modal" @close="editRecord = null">
      <div class="modal-box w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full">
        <h3 class="text-lg font-bold">Update Record</h3>
        <div v-if="editRecord" class="mt-4 space-y-3">
          <div v-if="editRecordType === 'asset_inventory'" class="grid grid-cols-1 gap-3 sm:grid-cols-2" :key="'ai-' + (editRecord?.ai_id ?? '')">
            <label class="form-control sm:col-span-2"><span class="label-text text-sm">Title</span><input v-model="editRecord.title" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Classification</span><input v-model="editRecord.classification" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Value</span><input :value="editRecord.assetValue" @input="e => { const v = e.target.value; editRecord.assetValue = v === '' ? '' : (parseFloat(v) || '') }" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
            <label class="form-control sm:col-span-2"><span class="label-text text-sm">Description</span><textarea v-model="editRecord.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" /></label>
            <label class="form-control sm:col-span-2"><span class="label-text text-sm">Location</span><input v-model="editRecord.location" class="input input-bordered input-sm w-full" /></label>
          </div>
          <div v-else-if="editRecordType === 'asset_vehicles'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Year</span><input v-model.number="editRecord.year" class="input input-bordered input-sm w-full" type="number" /></label>
            <label class="form-control"><span class="label-text text-sm">Make</span><input v-model="editRecord.make" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Model</span><input v-model="editRecord.model" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">VIN</span><input v-model="editRecord.vin" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="editRecord.value" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
            <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="editRecord.trust_designated" class="select select-bordered select-sm w-full"><option :value="true">Y</option><option :value="false">N</option></select></label>
            <label class="form-control sm:col-span-2"><span class="label-text text-sm">Description</span><textarea v-model="editRecord.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" /></label>
          </div>
          <div v-else-if="editRecordType === 'cash_and_investments'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model="editRecord.institution" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Account #</span><input v-model="editRecord.acct_number" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Type</span><input v-model="editRecord.acct_type" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Value</span><input :value="editRecord.cashValue" @input="e => { const v = e.target.value; editRecord.cashValue = v === '' ? '' : (parseFloat(v) || '') }" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
            <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="editRecord.trust_designated" class="select select-bordered select-sm w-full"><option :value="true">Y</option><option :value="false">N</option></select></label>
            <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model="editRecord.acct_support_number" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control sm:col-span-2"><span class="label-text text-sm">URL</span><input v-model="editRecord.institution_url" class="input input-bordered input-sm w-full" type="url" /></label>
          </div>
          <div v-else-if="editRecordType === 'debt'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Institution</span><input v-model="editRecord.institution" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Loan #</span><input v-model="editRecord.loan_number" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Loan Type</span><input v-model="editRecord.loan_type" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Loan Amount</span><input v-model="editRecord.debtLoanAmmount" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
            <label class="form-control sm:col-span-2"><span class="label-text text-sm">Link to Asset</span><select v-model="editRecord.linked_asset" class="select select-bordered select-sm w-full"><option value="">None (no link)</option><option v-for="a in linkedAssets" :key="a.type + ':' + a.id" :value="a.type + ':' + a.id">{{ a.label }}</option></select></label>
            <label class="form-control"><span class="label-text text-sm">Borrower</span><input v-model="editRecord.borrower" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Support #</span><input v-model="editRecord.customer_support_no" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">URL</span><input v-model="editRecord.address_url" class="input input-bordered input-sm w-full" type="url" /></label>
          </div>
          <div v-else-if="editRecordType === 'real_estate'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Number</span><input v-model="editRecord.number" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Street</span><input v-model="editRecord.street" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">City</span><input v-model="editRecord.city" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">State</span><input v-model="editRecord.state" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Zipcode</span><input v-model="editRecord.zipcode" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Value</span><input v-model.number="editRecord.value" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
            <label class="form-control"><span class="label-text text-sm">Trust (Y/N)</span><select v-model="editRecord.trust_designated" class="select select-bordered select-sm w-full"><option :value="true">Y</option><option :value="false">N</option></select></label>
          </div>
          <div v-else-if="editRecordType === 'insurance'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="form-control"><span class="label-text text-sm">Policy Holder</span><input v-model="editRecord.policy_holder" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Policy #</span><input v-model="editRecord.polocy_number" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Entity Covered</span><input v-model="editRecord.entity_covered" class="input input-bordered input-sm w-full" /></label>
            <label class="form-control"><span class="label-text text-sm">Amount</span><input :value="editRecord.insurancePolicyAmt" @input="e => { const v = e.target.value; editRecord.insurancePolicyAmt = v === '' ? '' : (parseFloat(v) || ''); editRecord.policy_amt = editRecord.insurancePolicyAmt !== '' && !Number.isNaN(Number(editRecord.insurancePolicyAmt)) ? Number(editRecord.insurancePolicyAmt) : null }" class="input input-bordered input-sm w-full" type="number" step="0.01" /></label>
            <label class="form-control sm:col-span-2"><span class="label-text text-sm">Intent</span><input v-model="editRecord.intent" class="input input-bordered input-sm w-full" /></label>
          </div>
        </div>
        <div v-if="error" class="mt-2 text-sm text-error">{{ error }}</div>
        <div class="modal-action justify-between">
          <button type="button" class="btn btn-error btn-outline btn-sm min-h-9" :disabled="updateSaving || deleteSaving" @click="deleteRecord">
            {{ deleteSaving ? "Deleting..." : "Delete" }}
          </button>
          <div class="flex gap-2">
            <form method="dialog">
              <button type="button" class="btn btn-ghost min-h-9" @click="updateModalRef?.close()">Cancel</button>
            </form>
            <button type="button" class="btn btn-primary min-h-9" :disabled="updateSaving || deleteSaving" @click="saveEdit">
              {{ updateSaving ? "Saving..." : "Save" }}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>

    <dialog ref="manageAssetCategoriesModalRef" class="modal">
      <div
        class="modal-box w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full"
      >
        <h3 class="text-lg font-bold">Manage Asset Categories</h3>
        <p class="text-sm text-base-content/70 mt-1 mb-4">
          Choose a category and classification, then enter details for your entry.
        </p>
        <EstateAssetCategoriesPanel layout="modal" @records-updated="onEstatePanelRecordsUpdated" />
        <div class="modal-action">
          <form method="dialog">
            <button type="submit" class="btn btn-outline">Close</button>
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
useHead({ title: "Estate Management" });

const auth = useAuthStore();
const loading = ref(true);
const updateModalRef = ref(null);
const addModalRef = ref(null);
const manageAssetCategoriesModalRef = ref(null);
const addModalType = ref(null);
const addSaving = ref(false);
const addError = ref("");
const updateSaving = ref(false);
const deleteSaving = ref(false);
const editRecord = ref(null);
const editRecordType = ref("");
const assetInventory = ref([]);
const assetVehicles = ref([]);
const cashAndInvestments = ref([]);
const debt = ref([]);
const realEstate = ref([]);
const insurance = ref([]);
const linkedAssets = ref([]);
const error = ref("");

// Add modal state
const addAssetForm = reactive({ classification_type: "", title: "", value: "", description: "", location: "" });
const addAssetClassifications = ref([]);
const addRealEstateForm = reactive({ number: "", street: "", city: "", state: "", zipcode: "", value: "", trust_designated: "" });
const addInsuranceForm = reactive({ policy_holder: "", polocy_number: "", entity_covered: "", policy_amt: "", intent: "", institution_url: "" });
const addDebtForm = reactive({ institution: "", loan_number: "", loan_ammount: "", loan_type: "", linked_asset: "", borrower: "", customer_support_no: "", address_url: "" });
const addDebtTypes = ref([]);
const addCashForm = reactive({
  asset_category: "Cash",
  classification_type: "",
  institution: "",
  account_number: "",
  value: "",
  account_support_number: "",
  institution_url: "",
  account_holder: "",
  account_intent: "",
  trust_designated: "",
});
const addCashClassifications = ref([]);
const addVehicleYear = ref("");
const addVehicleMake = ref("");
const addVehicleMakeFilter = ref("");
const addVehicleModel = ref("");
const addVehicleType = ref("");
const addVehicleVin = ref("");
const addVehicleValue = ref("");
const addVehicleDescription = ref("");
const addVehicleTrustDesignated = ref("");
const addVehicleMakes = ref([]);
const addVehicleModels = ref([]);
const addVehicleTypes = ref([]);
const addVehicleMakesLoading = ref(false);
const addVehicleModelsLoading = ref(false);
const addVehicleTypesLoading = ref(false);
const addVehicleVinDuplicateRef = ref(null);
const addVehicleVinInputRef = ref(null);
const addVehicleYears = computed(() => {
  const y = new Date().getFullYear();
  return Array.from({ length: 31 }, (_, i) => y - i);
});
const addVehicleAge = computed(() => {
  if (!addVehicleYear.value) return "";
  return String(new Date().getFullYear() - Number(addVehicleYear.value));
});
const filteredAddVehicleMakes = computed(() => {
  const f = addVehicleMakeFilter.value.trim().toLowerCase();
  if (!f) return addVehicleMakes.value;
  return addVehicleMakes.value.filter((m) => m.toLowerCase().includes(f));
});
const canSubmitAddVehicle = computed(() =>
  Boolean(
    addVehicleYear.value &&
    addVehicleMake.value &&
    addVehicleModel.value &&
    addVehicleType.value &&
    addVehicleValue.value !== "" &&
    addVehicleAge.value &&
    addVehicleDescription.value &&
    addVehicleTrustDesignated.value,
  ),
);

const addModalTitle = computed(() => {
  const t = addModalType.value;
  if (t === "asset") return "Add Asset";
  if (t === "vehicle") return "Add Vehicle";
  if (t === "cash") return "Add Cash or Investment";
  if (t === "debt") return "Add Debt";
  if (t === "real_estate") return "Add Real Estate";
  if (t === "insurance") return "Add Insurance";
  return "Add Record";
});

function formatMoney(val) {
  if (val == null || val === '') return '—';
  const n = toNumber(val);
  if (Number.isNaN(n)) return String(val);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function toNumber(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[$,]/g, '').trim();
  return parseFloat(s) || NaN;
}
function getLinkedAssetLabel(r) {
  if (!r?.linked_asset_type || !r?.linked_asset_id) return '—';
  const a = linkedAssets.value.find((x) => x.type === r.linked_asset_type && x.id === Number(r.linked_asset_id));
  return a ? a.label : '—';
}

const sortState = reactive({
  assetInventory: { key: 'title', dir: 'asc' },
  assetVehicles: { key: 'make', dir: 'asc' },
  cashAndInvestments: { key: 'institution', dir: 'asc' },
  debt: { key: 'institution', dir: 'asc' },
  realEstate: { key: 'city', dir: 'asc' },
  insurance: { key: 'policy_holder', dir: 'asc' },
});

function setSort(table, key) {
  const s = sortState[table];
  if (s.key === key) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
  else { s.key = key; s.dir = 'asc'; }
}

function sortCompare(a, b, key, dir, getVal) {
  const va = getVal(a, key);
  const vb = getVal(b, key);
  const isNum = typeof va === 'number' && typeof vb === 'number';
  let cmp = 0;
  if (isNum || (typeof va === 'number' && !Number.isNaN(va)) || (typeof vb === 'number' && !Number.isNaN(vb))) {
    const na = typeof va === 'number' ? va : toNumber(va);
    const nb = typeof vb === 'number' ? vb : toNumber(vb);
    cmp = (Number.isNaN(na) ? -Infinity : na) - (Number.isNaN(nb) ? -Infinity : nb);
  } else {
    cmp = String(va ?? '').toLowerCase().localeCompare(String(vb ?? '').toLowerCase());
  }
  return dir === 'asc' ? cmp : -cmp;
}

const sortedAssetInventory = computed(() => {
  const arr = [...assetInventory.value];
  const { key, dir } = sortState.assetInventory;
  const getVal = (r, k) => {
    if (k === 'classification') return r.asset_classification ?? r.classification_type ?? '';
    if (k === 'value') return toNumber(r.value);
    return r[k] ?? '';
  };
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedAssetVehicles = computed(() => {
  const arr = [...assetVehicles.value];
  const { key, dir } = sortState.assetVehicles;
  const getVal = (r, k) => k === 'value' ? toNumber(r.value) : (r[k] ?? '');
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedCashAndInvestments = computed(() => {
  const arr = [...cashAndInvestments.value];
  const { key, dir } = sortState.cashAndInvestments;
  const getVal = (r, k) => (k === 'value' ? toNumber(r.value) : (r[k] ?? ''));
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedDebt = computed(() => {
  const arr = [...debt.value];
  const { key, dir } = sortState.debt;
  const getVal = (r, k) => {
    if (k === 'value' || k === 'loan_ammount') return toNumber(r.loan_ammount);
    if (k === 'linked_asset') return getLinkedAssetLabel(r);
    return r[k] ?? '';
  };
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedRealEstate = computed(() => {
  const arr = [...realEstate.value];
  const { key, dir } = sortState.realEstate;
  const getVal = (r, k) => {
    if (k === 'address') return [r.number, r.street].filter(Boolean).join(' ') || '';
    if (k === 'value') return toNumber(r.value);
    return r[k] ?? '';
  };
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const sortedInsurance = computed(() => {
  const arr = [...insurance.value];
  const { key, dir } = sortState.insurance;
  const getVal = (r, k) => k === 'value' || k === 'policy_amt' ? toNumber(r.policy_amt) : (r[k] ?? '');
  arr.sort((a, b) => sortCompare(a, b, key, dir, getVal));
  return arr;
});

const netWealthRows = computed(() => [
  { category: 'Assets', total: totalAssets.value },
  { category: 'Debt', total: totalDebt.value },
]);

const totalAssets = computed(() => {
  const sum = (arr, key) => arr.reduce((a, r) => a + (toNumber(r[key]) || 0), 0);
  return (
    sum(assetInventory.value, 'value') +
    sum(assetVehicles.value, 'value') +
    sum(cashAndInvestments.value, 'value') +
    sum(realEstate.value, 'value')
  );
});

const totalDebt = computed(() => {
  return debt.value.reduce((a, r) => {
    const amt = toNumber(r.loan_ammount) ?? toNumber(r.balance) ?? toNumber(r.amount) ?? toNumber(r.value) ?? toNumber(r.balance_amt);
    return a + (amt || 0);
  }, 0);
});

const netWealth = computed(() => totalAssets.value - totalDebt.value);

const sumByKey = (arr, key) => arr.reduce((a, r) => a + (toNumber(r[key]) || 0), 0);
const totalAssetInventory = computed(() => sumByKey(assetInventory.value, 'value'));
const totalAssetVehicles = computed(() => sumByKey(assetVehicles.value, 'value'));
const totalCashAndInvestments = computed(() => sumByKey(cashAndInvestments.value, 'value'));
const totalDebtTable = computed(() =>
  debt.value.reduce((a, r) => {
    const amt = toNumber(r.loan_ammount) ?? toNumber(r.balance) ?? toNumber(r.amount) ?? toNumber(r.value) ?? toNumber(r.balance_amt);
    return a + (amt || 0);
  }, 0)
);
const totalRealEstateValue = computed(() => sumByKey(realEstate.value, 'value'));

const API_PATH_MAP = {
  asset_inventory: "asset-inventory",
  asset_vehicles: "asset-vehicles",
  cash_and_investments: "cash-and-investments",
  debt: "debt",
  real_estate: "real-estate",
  insurance: "insurance",
};

const ID_KEY_MAP = {
  asset_inventory: "ai_id",
  asset_vehicles: "vh_id",
  cash_and_investments: "ci_id",
  debt: "dbt_id",
  real_estate: "re_id",
  insurance: "ins_id",
};

async function openAddModal(type) {
  addModalType.value = type;
  addError.value = "";
  if (type === "asset") {
    const r = await $fetch("/api/asset-classifications", { params: { category: "Asset" } });
    addAssetClassifications.value = r?.classifications ?? [];
    addAssetForm.classification_type = "";
    addAssetForm.title = "";
    addAssetForm.value = "";
    addAssetForm.description = "";
    addAssetForm.location = "";
  } else if (type === "real_estate") {
    addRealEstateForm.number = "";
    addRealEstateForm.street = "";
    addRealEstateForm.city = "";
    addRealEstateForm.state = "";
    addRealEstateForm.zipcode = "";
    addRealEstateForm.value = "";
    addRealEstateForm.trust_designated = "";
  } else if (type === "insurance") {
    addInsuranceForm.policy_holder = "";
    addInsuranceForm.polocy_number = "";
    addInsuranceForm.entity_covered = "";
    addInsuranceForm.policy_amt = "";
    addInsuranceForm.intent = "";
    addInsuranceForm.institution_url = "";
  } else if (type === "debt") {
    const r = await $fetch("/api/debt-types");
    addDebtTypes.value = r?.debtTypes ?? [];
    addDebtForm.institution = "";
    addDebtForm.loan_number = "";
    addDebtForm.loan_ammount = "";
    addDebtForm.loan_type = "";
    addDebtForm.linked_asset = "";
    addDebtForm.borrower = "";
    addDebtForm.customer_support_no = "";
    addDebtForm.address_url = "";
  } else if (type === "cash") {
    await loadAddCashClassifications();
    addCashForm.asset_category = "Cash";
    addCashForm.classification_type = "";
    addCashForm.institution = "";
    addCashForm.account_number = "";
    addCashForm.value = "";
    addCashForm.account_support_number = "";
    addCashForm.institution_url = "";
    addCashForm.account_holder = "";
    addCashForm.account_intent = "";
    addCashForm.trust_designated = "";
  } else if (type === "vehicle") {
    addVehicleYear.value = "";
    addVehicleMake.value = "";
    addVehicleMakeFilter.value = "";
    addVehicleModel.value = "";
    addVehicleType.value = "";
    addVehicleVin.value = "";
    addVehicleValue.value = "";
    addVehicleDescription.value = "";
    addVehicleTrustDesignated.value = "";
    addVehicleModels.value = [];
    addVehicleTypes.value = [];
    if (addVehicleMakes.value.length === 0) void loadAddVehicleMakes();
  }
  addModalRef.value?.showModal();
}

function openManageAssetCategoriesModal() {
  manageAssetCategoriesModalRef.value?.showModal();
}

function onEstatePanelRecordsUpdated() {
  void loadSummary();
}

async function loadAddCashClassifications() {
  let cat = addCashForm.asset_category || "Cash";
  if (cat === "Investments") cat = "Investment"; // DB uses Investment
  const r = await $fetch("/api/asset-classifications", { params: { category: cat } });
  addCashClassifications.value = r?.classifications ?? [];
}

function onAddCashCategoryChange() {
  addCashForm.classification_type = "";
  void loadAddCashClassifications();
}

const VIN_DUPLICATE_MSG = "This vehicle already exists in the database. Please try again.";

async function loadAddVehicleMakes() {
  addVehicleMakesLoading.value = true;
  try {
    const res = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json");
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    addVehicleMakes.value = Array.isArray(data?.Results)
      ? data.Results.map((r) => r.Make_Name).filter(Boolean)
      : [];
  } catch {
    addVehicleMakes.value = [];
  } finally {
    addVehicleMakesLoading.value = false;
  }
}

async function loadAddVehicleTypes() {
  if (!addVehicleMake.value) return;
  addVehicleTypesLoading.value = true;
  try {
    const make = encodeURIComponent(addVehicleMake.value);
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMake/${make}?format=json`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    addVehicleTypes.value = Array.isArray(data?.Results)
      ? data.Results.map((r) => r.VehicleTypeName).filter(Boolean)
      : [];
  } catch {
    addVehicleTypes.value = [];
  } finally {
    addVehicleTypesLoading.value = false;
  }
}

async function loadAddVehicleModels() {
  if (!addVehicleMake.value || !addVehicleYear.value || !addVehicleType.value) return;
  addVehicleModelsLoading.value = true;
  try {
    const make = encodeURIComponent(addVehicleMake.value);
    const year = encodeURIComponent(String(addVehicleYear.value));
    const type = encodeURIComponent(addVehicleType.value);
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${year}/vehicletype/${type}?format=json`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    const results = Array.isArray(data?.Results) ? data.Results : [];
    addVehicleModels.value = results.map((r) => r.Model_Name || r.Model_Name?.trim()).filter(Boolean);
  } catch {
    addVehicleModels.value = [];
  } finally {
    addVehicleModelsLoading.value = false;
  }
}

function onAddVehicleVinDuplicateClose() {
  nextTick(() => {
    addVehicleVinInputRef.value?.focus();
  });
}

async function submitAddAsset() {
  addError.value = "";
  addSaving.value = true;
  try {
    await $fetch("/api/estate-mgmt/submit", {
      method: "POST",
      body: {
        classification_type: addAssetForm.classification_type,
        title: addAssetForm.title,
        description: addAssetForm.description,
        value: addAssetForm.value,
        location: addAssetForm.location || undefined,
      },
    });
    addModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add asset.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddRealEstate() {
  addError.value = "";
  addSaving.value = true;
  try {
    await $fetch("/api/estate-mgmt/real-estate", {
      method: "POST",
      body: {
        number: addRealEstateForm.number || undefined,
        street: addRealEstateForm.street,
        city: addRealEstateForm.city,
        state: addRealEstateForm.state,
        zipcode: addRealEstateForm.zipcode,
        value: addRealEstateForm.value,
        trust_designated: addRealEstateForm.trust_designated,
      },
    });
    addModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add real estate.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddInsurance() {
  addError.value = "";
  addSaving.value = true;
  try {
    await $fetch("/api/estate-mgmt/insurance", {
      method: "POST",
      body: {
        policy_holder: addInsuranceForm.policy_holder,
        polocy_number: addInsuranceForm.polocy_number || undefined,
        entity_covered: addInsuranceForm.entity_covered || undefined,
        policy_amt: addInsuranceForm.policy_amt !== "" ? addInsuranceForm.policy_amt : undefined,
        intent: addInsuranceForm.intent || undefined,
        institution_url: addInsuranceForm.institution_url || undefined,
      },
    });
    addModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add insurance.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddDebt() {
  addError.value = "";
  addSaving.value = true;
  try {
    const [linkedType, linkedId] = addDebtForm.linked_asset ? addDebtForm.linked_asset.split(":") : [null, null];
    await $fetch("/api/estate-mgmt/debt", {
      method: "POST",
      body: {
        institution: addDebtForm.institution,
        loan_number: addDebtForm.loan_number || undefined,
        loan_type: addDebtForm.loan_type || undefined,
        loan_ammount: addDebtForm.loan_ammount !== "" ? addDebtForm.loan_ammount : undefined,
        linked_asset_type: linkedType || undefined,
        linked_asset_id: linkedId ? Number(linkedId) : undefined,
        customer_support_no: addDebtForm.customer_support_no || undefined,
        address_url: addDebtForm.address_url || undefined,
        borrower: addDebtForm.borrower || undefined,
      },
    });
    addModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add debt.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddCash() {
  addError.value = "";
  addSaving.value = true;
  try {
    await $fetch("/api/estate-mgmt/cash-investment", {
      method: "POST",
      body: {
        asset_category: addCashForm.asset_category,
        classification_type: addCashForm.classification_type,
        institution: addCashForm.institution,
        account_number: addCashForm.account_number,
        value: addCashForm.value,
        account_support_number: addCashForm.account_support_number,
        institution_url: addCashForm.institution_url,
        account_holder: addCashForm.account_holder,
        account_intent: addCashForm.account_intent,
        trust_designated: addCashForm.trust_designated,
      },
    });
    addModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    addError.value = err?.data?.statusMessage || err?.message || "Failed to add cash/investment.";
  } finally {
    addSaving.value = false;
  }
}

async function submitAddVehicle() {
  addError.value = "";
  addSaving.value = true;
  try {
    await $fetch("/api/estate-mgmt/vehicle", {
      method: "POST",
      body: {
        classification_type: addVehicleType.value,
        year: addVehicleYear.value,
        make: addVehicleMake.value,
        model: addVehicleModel.value,
        vin: addVehicleVin.value || undefined,
        value: addVehicleValue.value,
        age: addVehicleAge.value,
        description: addVehicleDescription.value,
        trust_designated: addVehicleTrustDesignated.value,
      },
    });
    addModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    const msg = err?.data?.statusMessage || err?.message || "Failed to add vehicle.";
    if (msg === VIN_DUPLICATE_MSG) {
      addVehicleVinDuplicateRef.value?.showModal();
    } else {
      addError.value = msg;
    }
  } finally {
    addSaving.value = false;
  }
}

function openEditModal(type, record) {
  error.value = "";
  editRecordType.value = type;
  const cloned = JSON.parse(JSON.stringify(record));
  if (type === "asset_inventory") {
    cloned.classification = cloned.asset_classification ?? cloned.classification_type ?? "";
    const val = cloned.value ?? cloned.asset_value;
    const num = val != null && val !== "" ? toNumber(val) : NaN;
    cloned.assetValue = Number.isNaN(num) ? "" : num;
  }
  if (type === "cash_and_investments") {
    const val = cloned.value ?? cloned.asset_value;
    const num = val != null && val !== "" ? toNumber(val) : NaN;
    cloned.cashValue = Number.isNaN(num) ? "" : num;
  }
  if (type === "debt") {
    const val = cloned.loan_ammount;
    const num = val != null && val !== "" ? toNumber(val) : NaN;
    cloned.debtLoanAmmount = Number.isNaN(num) ? "" : num;
    cloned.linked_asset = (cloned.linked_asset_type && cloned.linked_asset_id)
      ? cloned.linked_asset_type + ":" + cloned.linked_asset_id
      : "";
  }
  if (type === "insurance") {
    const val = cloned.policy_amt;
    const num = val != null && val !== "" ? toNumber(String(val).replace(/[$,]/g, "")) : NaN;
    cloned.insurancePolicyAmt = Number.isNaN(num) ? "" : num;
  }
  editRecord.value = cloned;
  updateModalRef.value?.showModal();
}

async function saveEdit() {
  if (!editRecord.value || !editRecordType.value) return;
  const type = editRecordType.value;
  const idKey = ID_KEY_MAP[type];
  const id = editRecord.value[idKey];
  if (!id) return;

  const path = API_PATH_MAP[type];
  const url = `/api/records/${path}/${id}`;

  let body;
  if (type === "debt") {
    const r = editRecord.value;
    const av = r.debtLoanAmmount;
    const loanAmt = (av !== "" && av != null && !Number.isNaN(Number(av)))
      ? Number(av)
      : (r.loan_ammount != null && r.loan_ammount !== "" ? r.loan_ammount : null);
    const [linkedType, linkedId] = r.linked_asset ? r.linked_asset.split(":") : [null, null];
    body = {
      institution: r.institution ?? null,
      loan_number: r.loan_number ?? null,
      loan_type: r.loan_type ?? null,
      customer_support_no: r.customer_support_no ?? null,
      address_url: r.address_url ?? null,
      borrower: r.borrower ?? null,
      loan_ammount: loanAmt,
      linked_asset_type: linkedType || null,
      linked_asset_id: linkedId ? Number(linkedId) : null,
    };
  } else {
    body = { ...editRecord.value };
    delete body[idKey];
    delete body.user_id;
    delete body.group_id;
    delete body.created_at;

    if (type === "asset_inventory") {
      body.classification_type = body.classification ?? body.asset_classification ?? body.classification_type;
      body.asset_category = body.asset_category ?? "Asset";
      const av = body.assetValue;
      body.value = (av !== "" && av != null && !Number.isNaN(Number(av))) ? Number(av) : body.value;
    }
    if (type === "cash_and_investments") {
      const cv = body.cashValue;
      body.value = (cv !== "" && cv != null && !Number.isNaN(Number(cv))) ? Number(cv) : body.value;
    }
    if (type === "asset_vehicles") body.age = editRecord.value.age ?? (editRecord.value.year ? new Date().getFullYear() - editRecord.value.year : null);
    if (type === "insurance") {
      const av = body.insurancePolicyAmt;
      body.policy_amt = (av !== "" && av != null && !Number.isNaN(Number(av)))
        ? Number(av)
        : (body.policy_amt != null ? toNumber(String(body.policy_amt).replace(/[$,]/g, "")) : null);
      delete body.insurancePolicyAmt;
    }
  }

  updateSaving.value = true;
  try {
    await $fetch(url, { method: "PUT", body });
    updateModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.data?.message || err?.message || "Update failed.";
    return;
  } finally {
    updateSaving.value = false;
  }
}

async function deleteRecord() {
  if (!editRecord.value || !editRecordType.value) return;
  if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) return;

  const type = editRecordType.value;
  const idKey = ID_KEY_MAP[type];
  const id = editRecord.value[idKey];
  if (!id) return;

  const path = API_PATH_MAP[type];
  const url = `/api/records/${path}/${id}`;

  deleteSaving.value = true;
  error.value = "";
  try {
    await $fetch(url, { method: "DELETE" });
    updateModalRef.value?.close();
    void loadSummary();
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || "Delete failed.";
  } finally {
    deleteSaving.value = false;
  }
}

async function loadSummary() {
  if (!auth.user) return;
  loading.value = true;
  try {
    const [inv, vehicles, cash, debtRes, real, ins, linked] = await Promise.all([
      $fetch('/api/records/asset-inventory').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/asset-vehicles').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/cash-and-investments').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/debt').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/real-estate').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/insurance').then((d) => d?.records ?? []).catch(() => []),
      $fetch('/api/records/linked-assets').then((d) => d?.assets ?? []).catch(() => []),
    ]);
    assetInventory.value = inv;
    assetVehicles.value = vehicles;
    cashAndInvestments.value = cash;
    debt.value = debtRes;
    realEstate.value = real;
    insurance.value = ins;
    linkedAssets.value = linked;
  } finally {
    loading.value = false;
  }
}

watch(addVehicleYear, () => {
  addVehicleMake.value = "";
  addVehicleMakeFilter.value = "";
  addVehicleModel.value = "";
  addVehicleModels.value = [];
  addVehicleType.value = "";
  addVehicleTypes.value = [];
});

watch(addVehicleMake, () => {
  addVehicleModel.value = "";
  addVehicleModels.value = [];
  addVehicleType.value = "";
  addVehicleTypes.value = [];
  if (addVehicleMake.value && addVehicleYear.value) void loadAddVehicleModels();
  if (addVehicleMake.value) void loadAddVehicleTypes();
});

watch(addVehicleType, () => {
  addVehicleModel.value = "";
  addVehicleModels.value = [];
  if (addVehicleMake.value && addVehicleYear.value && addVehicleType.value) void loadAddVehicleModels();
});

onMounted(() => {
  if (!auth.ready) auth.fetchSession();
  void loadSummary();
  void loadAddVehicleMakes();
});

watch(() => auth.user, (user) => {
  if (user) void loadSummary();
}, { immediate: false });
</script>

<style scoped>
.summary-section-scroll {
  max-height: 200px;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 640px) {
  .summary-section-scroll {
    max-height: 240px;
  }
}
.table-category-title {
  text-transform: capitalize;
}

/* ion-grid table-like styling */
.summary-grid {
  font-size: 0.875rem;
}
.summary-grid {
  width: 100%;
}
.summary-grid ion-row {
  border-bottom: 1px solid var(--color-base-200, #dadede);
  min-height: 2rem;
}
.summary-grid ion-row:last-child {
  border-bottom: none;
}
.summary-grid-header {
  font-weight: 600;
}
.summary-grid-header ion-col {
  padding: 0.25rem 0.5rem;
}
.summary-grid-row ion-col {
  padding: 0.25rem 0.5rem;
}
.summary-grid-row ion-col:last-child {
  display: flex;
  justify-content: center;
  align-items: center;
}
.summary-edit-col {
  width: 2rem;
  min-width: 2rem;
  max-width: 2rem;
  flex: 0 0 2rem;
  padding: 0.25rem;
}
.summary-net-wealth-total {
  text-align: left;
  justify-content: flex-start !important;
}
.summary-grid-2 { min-width: 28rem; }
.summary-grid-6 { min-width: 54rem; }
.summary-grid-7 { min-width: 63rem; }
.summary-grid-8 { min-width: 72rem; }
@media (max-width: 767px) {
  .summary-grid-mobile {
    min-width: 100%;
  }
}
</style>
