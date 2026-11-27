<template>
  <div class="space-y-6">
    <div class="app-sticky-action flex flex-wrap items-center gap-3">
      <label class="form-control w-full max-w-[11rem]">
        <input v-model="eatenOn" type="date" class="input input-bordered w-full" aria-label="Day" />
      </label>
      <button type="button" class="training-chip btn btn-primary btn-sm rounded-full" @click="eatenOn = todayIso()">Today</button>
      <p v-if="kcalLeftLabel" class="text-sm font-semibold tabular-nums text-gray-900 sm:ml-auto dark:text-white">
        {{ kcalLeftLabel }}
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section ref="logCardEl" class="app-card px-4 py-4 lg:col-start-1 lg:row-start-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ editingEntryId ? "Edit log entry" : "Log food" }}
          </h2>
          <button
            v-if="!editingEntryId"
            type="button"
            class="training-chip btn btn-outline btn-sm rounded-full"
            @click="openAddFoodModal"
          >
            Add food
          </button>
        </div>
        <p v-if="!editingEntryId" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Describe a meal, or choose a saved food. You'll review a description before it is logged.
        </p>
        <form class="mt-3 grid gap-3" @submit.prevent="submitComposer">
          <label v-if="!editingEntryId" class="form-control">
            <span class="label py-1"><span class="label-text text-sm">Describe a meal</span></span>
            <textarea
              v-model="describeText"
              rows="2"
              class="textarea textarea-bordered w-full"
              placeholder="1 container Chobani greek yogurt, 5.3 oz"
              maxlength="800"
            />
          </label>
          <p v-if="foodsError" class="text-sm text-red-600 dark:text-red-400">{{ foodsError }}</p>
          <p v-else-if="loadingFoods" class="text-sm text-gray-500 dark:text-gray-400">Loading foods…</p>
          <p v-else-if="!foods.length && !editingEntryId" class="text-sm text-gray-500 dark:text-gray-400">
            No saved foods yet. Add food keeps one you can log again.
          </p>
          <template v-else>
            <div class="form-control">
              <span class="label py-1"><span id="log-food-label" class="label-text text-sm">Food</span></span>
              <Combobox v-model="logForm.foodId" nullable>
                <div class="relative">
                  <ComboboxInput
                    class="input input-bordered w-full pr-10"
                    placeholder="Choose a food"
                    autocomplete="off"
                    aria-labelledby="log-food-label"
                    :display-value="foodDisplayValue"
                    @change="foodSearchQuery = $event.target.value"
                  />
                  <ComboboxButton class="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center px-3 text-base-content/60" aria-label="Show foods">
                    <AppIcon name="chevron-down" :size="18" />
                  </ComboboxButton>
                  <ComboboxOptions
                    class="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-base-300 bg-base-100 py-1 shadow-lg"
                  >
                    <p v-if="!filteredLogFoods.length" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No foods match that search.
                    </p>
                    <ComboboxOption
                      v-for="food in filteredLogFoods"
                      :key="food.user_food_id"
                      :value="String(food.user_food_id)"
                      v-slot="{ active, selected }"
                      as="li"
                    >
                      <div
                        class="cursor-pointer px-3 py-2 text-sm"
                        :class="active ? 'bg-primary/10' : ''"
                      >
                        <span class="block font-medium" :class="selected ? 'text-primary' : 'text-gray-900 dark:text-white'">
                          {{ foodLabel(food) }}
                        </span>
                        <span class="block text-xs text-gray-500 dark:text-gray-400">{{ foodMeta(food) }}</span>
                      </div>
                    </ComboboxOption>
                  </ComboboxOptions>
                </div>
              </Combobox>
            </div>
            <label class="form-control">
              <span class="label py-1"><span class="label-text text-sm">Servings</span></span>
              <input v-model="logForm.servings" type="number" inputmode="decimal" min="0.01" step="0.01" class="input input-bordered w-full" />
            </label>
            <p v-if="selectedFood" class="text-xs text-gray-500 dark:text-gray-400">
              {{ foodMeta(selectedFood) }}
            </p>
            <button
              v-if="selectedFood && !editingEntryId"
              type="button"
              class="training-chip btn btn-ghost btn-xs justify-self-start rounded-full"
              @click="startEditFood(selectedFood)"
            >
              Edit food
            </button>
            <p v-if="logPreview" class="text-sm tabular-nums text-gray-700 dark:text-gray-200">
              {{ formatMacro(logPreview.kcal, 0) }} kcal ·
              P {{ formatMacro(logPreview.protein_g, 1) }} g ·
              F {{ formatMacro(logPreview.fat_g, 1) }} g ·
              C {{ formatMacro(logPreview.carb_g, 1) }} g
            </p>
          </template>
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
          <p v-if="describeError && describeIntent === 'meal'" class="text-sm text-red-600 dark:text-red-400">{{ describeError }}</p>
          <p v-else-if="describeMessage" class="text-sm text-gray-600 dark:text-gray-300">{{ describeMessage }}</p>
          <p v-if="logError" class="text-sm text-red-600 dark:text-red-400">{{ logError }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="!editingEntryId"
              type="submit"
              class="training-chip btn btn-primary btn-sm rounded-full"
              :disabled="describing || !describeText.trim()"
            >
              {{ describing && describeIntent === "meal" ? "Reading…" : "Review foods" }}
            </button>
            <button
              v-if="!editingEntryId"
              type="button"
              class="training-chip btn btn-outline btn-sm rounded-full"
              :disabled="logging || !selectedFood"
              @click="logFood"
            >
              {{ logging ? "Saving…" : "Add to log" }}
            </button>
            <button
              v-if="editingEntryId"
              type="submit"
              class="training-chip btn btn-primary btn-sm rounded-full"
              :disabled="logging || !selectedFood"
            >
              {{ logging ? "Saving…" : "Save log entry" }}
            </button>
            <button
              v-if="editingEntryId"
              type="button"
              class="training-chip btn btn-ghost btn-sm rounded-full"
              :disabled="logging"
              @click="cancelEditEntry"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section class="app-card px-4 py-4 lg:col-start-2 lg:row-start-1">
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
                :class="editingEntryId === entry.entry_id ? 'ring-1 ring-primary/40' : ''"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ entry.food_description }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ entryServingLine(entry) }}
                  </p>
                  <p class="text-xs tabular-nums text-gray-600 dark:text-gray-300">
                    {{ formatMacro(entry.kcal, 0) }} kcal ·
                    P {{ formatMacro(entry.protein_g, 1) }} g ·
                    F {{ formatMacro(entry.fat_g, 1) }} g ·
                    C {{ formatMacro(entry.carb_g, 1) }} g
                  </p>
                </div>
                <div class="flex shrink-0 gap-1">
                  <button
                    type="button"
                    class="training-chip btn btn-ghost btn-xs rounded-full"
                    @click="startEditEntry(entry)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="training-chip btn btn-ghost btn-xs rounded-full text-red-600 dark:text-red-400"
                    :disabled="deletingId === entry.entry_id"
                    @click="deleteEntry(entry.entry_id)"
                  >
                    Remove
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </section>

      <section class="app-card min-w-0 px-4 py-4 lg:col-start-2 lg:row-start-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ eatenOnLabel }} vs plan</h2>
          <button type="button" class="training-chip btn btn-outline btn-sm rounded-full" @click="openPlanModal">
            Edit plan
          </button>
        </div>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ currentPlan?.name || "No daily plan" }}
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="training-chip btn btn-ghost btn-sm rounded-full"
            :disabled="describing"
            @click="suggestRemaining"
          >
            {{ describing && describeIntent === "remaining" ? "Reading…" : "What's left today" }}
          </button>
          <p v-if="describeError && describeIntent === 'remaining'" class="text-sm text-red-600 dark:text-red-400">
            {{ describeError }}
          </p>
        </div>
        <p v-if="!comparison?.targets" class="mt-3 text-sm text-gray-500 dark:text-gray-400">
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
            <p v-if="row.ounceNote" class="text-xs text-gray-500 dark:text-gray-400">{{ row.ounceNote }}</p>
          </li>
        </ul>
      </section>

      <NutritionDailyChart
        v-if="!isNarrow"
        class="min-w-0 lg:col-start-1 lg:row-start-2"
        v-model:days="chartRangeDays"
        :data="historyDays"
        :plan-kcal="currentPlan?.kcal ?? null"
        :loading="historyLoading"
        :error="historyError"
      />
    </div>

    <dialog ref="foodModalEl" class="modal" @close="onFoodModalClose">
      <div class="modal-box flex max-h-[90vh] max-w-lg flex-col overflow-y-auto overscroll-contain">
        <h3 class="text-lg font-semibold">{{ editingFoodId && !addingFood ? "Edit food" : "Add food" }}</h3>
        <p class="mt-1 text-sm text-base-content/60">
          {{
            editingFoodId && !addingFood
              ? "Update this food. New log entries will use the new serving values; existing log entries stay as logged."
              : foodFromPackage
                ? "Check the serving, then save."
                : foodEntryMode === "manual"
                  ? "Enter one serving."
                  : "Scan a package or enter one serving."
          }}
        </p>
        <p v-if="!showFoodFields && !showScanner && foodNotice" class="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
          {{ foodNotice }}
        </p>
        <div v-if="!editingFoodId && !foodEntryMode" class="mt-4 grid gap-2">
          <button type="button" class="training-chip btn btn-primary btn-sm rounded-full" @click="chooseScan">
            Scan a package
          </button>
          <button type="button" class="training-chip btn btn-outline btn-sm rounded-full" @click="chooseManual">
            Enter it yourself
          </button>
        </div>
        <div v-if="showScanner" class="mt-4 grid gap-2 rounded-md bg-gray-50 p-3 dark:bg-white/5">
          <div class="flex flex-wrap items-end gap-2">
            <button
              type="button"
              class="training-chip btn btn-sm rounded-full"
              :class="barcodeScanning ? 'btn-ghost' : 'btn-outline'"
              :disabled="barcodeBusy"
              @click="barcodeScanning ? stopBarcodeScan() : startBarcodeScan()"
            >
              {{ barcodeScanning ? "Stop camera" : "Scan barcode" }}
            </button>
            <label class="form-control min-w-40 flex-1">
              <span class="label py-0"><span class="label-text text-xs">Barcode</span></span>
              <input
                v-model="barcodeText"
                type="text"
                inputmode="numeric"
                maxlength="14"
                class="input input-bordered input-sm w-full"
                placeholder="Type the digits"
                autocomplete="off"
              />
            </label>
            <button
              type="button"
              class="training-chip btn btn-primary btn-sm rounded-full"
              :disabled="barcodeBusy"
              @click="lookupBarcode(barcodeText)"
            >
              {{ barcodeBusy ? "Looking up…" : "Look up" }}
            </button>
          </div>
          <video
            v-show="barcodeScanning"
            ref="barcodeVideo"
            class="max-h-48 w-full rounded-md bg-black object-cover"
            muted
            playsinline
            autoplay
          />
          <p v-if="barcodeError" class="text-sm text-red-600 dark:text-red-400">{{ barcodeError }}</p>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400">
            Scan the package or type the digits.
          </p>
          <button type="button" class="training-chip btn btn-ghost btn-sm justify-self-start rounded-full" @click="chooseManual">
            Enter it yourself
          </button>
        </div>
        <form v-if="showFoodFields" class="mt-4 grid gap-3" novalidate @submit.prevent="saveFood(false)">
          <button
            v-if="foodFromPackage"
            type="button"
            class="training-chip btn btn-ghost btn-sm justify-self-start rounded-full"
            @click="scanAgain"
          >
            Scan again
          </button>
          <label class="form-control">
            <span class="label py-1"><span class="label-text text-sm">Name</span></span>
            <input
              v-model.trim="foodForm.name"
              type="text"
              maxlength="160"
              class="input input-bordered w-full"
              placeholder="e.g. Butter"
              required
            />
          </label>
          <p v-if="foodFromPackage && foodNotice" class="text-sm text-emerald-700 dark:text-emerald-400">
            {{ foodNotice }}
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="form-control">
              <span class="label py-1"><span class="label-text text-sm">Serving</span></span>
              <input
                v-model.trim="foodForm.serving"
                type="text"
                maxlength="80"
                class="input input-bordered w-full"
                placeholder="1 tablespoon"
                required
              />
            </label>
            <label class="form-control">
              <span class="label py-1">
                <span class="label-text text-sm">Weight (g)</span>
                <span v-if="foodServingOuncesPreview" class="label-text-alt text-xs text-gray-500">
                  ≈ {{ foodServingOuncesPreview }} oz
                </span>
              </span>
              <input
                v-model="foodForm.serving_g"
                type="number" inputmode="decimal"
                min="0.1"
                step="0.1"
                class="input input-bordered w-full"
                required
              />
            </label>
          </div>
          <label class="form-control">
            <span class="label py-1"><span class="label-text text-sm">Calories</span></span>
            <input v-model="foodForm.kcal" type="number" inputmode="numeric" min="0" step="1" class="input input-bordered w-full" required />
          </label>
          <div class="grid grid-cols-3 gap-3">
            <label class="form-control">
              <span class="label py-1"><span class="label-text text-sm">Protein (g)</span></span>
              <input v-model="foodForm.protein_g" type="number" inputmode="decimal" min="0" step="0.1" class="input input-bordered w-full" required />
            </label>
            <label class="form-control">
              <span class="label py-1"><span class="label-text text-sm">Fat (g)</span></span>
              <input v-model="foodForm.fat_g" type="number" inputmode="decimal" min="0" step="0.1" class="input input-bordered w-full" required />
            </label>
            <label class="form-control">
              <span class="label py-1"><span class="label-text text-sm">Carbs (g)</span></span>
              <input v-model="foodForm.carb_g" type="number" inputmode="decimal" min="0" step="0.1" class="input input-bordered w-full" required />
            </label>
          </div>
          <p v-if="foodError" class="text-sm text-red-600 dark:text-red-400">{{ foodError }}</p>
          <p v-else-if="foodNotice && !foodFromPackage" class="text-sm text-emerald-700 dark:text-emerald-400">{{ foodNotice }}</p>
          <div class="modal-action sticky bottom-0 mt-2 bg-base-100 pb-1">
            <button
              type="button"
              class="training-chip btn btn-ghost btn-sm rounded-full"
              :disabled="savingFood"
              @click="closeFoodModal"
            >
              Cancel
            </button>
            <button
              v-if="addingFood"
              type="button"
              class="training-chip btn btn-outline btn-sm rounded-full"
              :disabled="savingFood"
              @click="saveFood(true)"
            >
              {{ savingFood ? "Saving…" : "Save and log" }}
            </button>
            <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full" :disabled="savingFood">
              {{ savingFood ? "Saving…" : editingFoodId && !addingFood ? "Save food" : "Save" }}
            </button>
          </div>
        </form>
        <div v-else class="modal-action">
          <button type="button" class="training-chip btn btn-ghost btn-sm rounded-full" @click="closeFoodModal">
            Cancel
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>

    <dialog ref="describeModalEl" class="modal" @close="onDescribeModalClose">
      <div class="modal-box flex max-h-[90vh] max-w-lg flex-col overflow-hidden">
        <h3 class="text-lg font-semibold">Review foods</h3>
        <p class="mt-1 text-sm text-base-content/60">
          Adjust the servings or the size. Nothing is logged until you add them.
        </p>
        <p v-if="describeUnmatched.length" class="mt-3 text-sm text-amber-700 dark:text-amber-400">
          Could not match: {{ describeUnmatched.join(", ") }}.
        </p>
        <div class="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-0.5">
          <div
            v-for="(row, index) in describeProposals"
            :key="row.key"
            class="rounded-md bg-gray-50 px-3 py-3 dark:bg-white/5"
          >
            <div class="flex items-start justify-between gap-2">
              <label class="form-control min-w-0 flex-1">
                <span class="label py-0"><span class="label-text text-xs">Food</span></span>
                <input v-model.trim="row.name" type="text" maxlength="160" class="input input-bordered input-sm w-full" />
              </label>
              <button
                type="button"
                class="training-chip btn btn-ghost btn-xs mt-6 rounded-full text-red-600 dark:text-red-400"
                @click="removeProposal(index)"
              >
                Remove
              </button>
            </div>
            <p v-if="row.requestedServing" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              From your description: {{ row.requestedServing }}
            </p>
            <div class="mt-2 grid gap-2 sm:grid-cols-3">
              <label class="form-control">
                <span class="label py-0"><span class="label-text text-xs">Servings</span></span>
                <input v-model="row.quantity" type="number" inputmode="decimal" min="0.01" step="0.01" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control">
                <span class="label py-0">
                  <span class="label-text text-xs">Size (oz)</span>
                  <span v-if="proposalServingGrams(row)" class="label-text-alt text-xs text-gray-500">
                    ≈ {{ proposalServingGrams(row) }} g
                  </span>
                </span>
                <input v-model="row.servingOz" type="number" inputmode="decimal" min="0.01" step="0.01" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control">
                <span class="label py-0"><span class="label-text text-xs">Serving</span></span>
                <input v-model.trim="row.portionLabel" type="text" maxlength="160" class="input input-bordered input-sm w-full" />
              </label>
            </div>
            <div v-if="row.unmatched" class="mt-2 grid gap-2 sm:grid-cols-4">
              <label class="form-control">
                <span class="label py-0"><span class="label-text text-xs">Calories</span></span>
                <input v-model="row.kcal" type="number" inputmode="numeric" min="0" step="1" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control">
                <span class="label py-0"><span class="label-text text-xs">Protein (g)</span></span>
                <input v-model="row.protein" type="number" inputmode="decimal" min="0" step="0.1" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control">
                <span class="label py-0"><span class="label-text text-xs">Fat (g)</span></span>
                <input v-model="row.fat" type="number" inputmode="decimal" min="0" step="0.1" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control">
                <span class="label py-0"><span class="label-text text-xs">Carbs (g)</span></span>
                <input v-model="row.carb" type="number" inputmode="decimal" min="0" step="0.1" class="input input-bordered input-sm w-full" />
              </label>
              <p class="sm:col-span-4 text-xs text-gray-500 dark:text-gray-400">
                Per serving. These are saved on the food before it is logged.
              </p>
            </div>
            <p class="mt-2 text-xs tabular-nums text-gray-600 dark:text-gray-300">
              <template v-if="proposalPreview(row)">
                {{ formatMacro(proposalPreview(row).kcal, 0) }} kcal ·
                P {{ formatMacro(proposalPreview(row).protein_g, 1) }} g ·
                F {{ formatMacro(proposalPreview(row).fat_g, 1) }} g ·
                C {{ formatMacro(proposalPreview(row).carb_g, 1) }} g
                <span v-if="proposalTotalWeight(row)"> · {{ proposalTotalWeight(row) }}</span>
              </template>
              <template v-else-if="row.unmatched">Enter the macros for one serving.</template>
              <template v-else>Enter a serving count and a size.</template>
            </p>
          </div>
        </div>
        <p v-if="describeReviewError" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ describeReviewError }}</p>
        <div class="modal-action sticky bottom-0 mt-4 bg-base-100 pb-1">
          <button
            type="button"
            class="training-chip btn btn-ghost btn-sm rounded-full"
            :disabled="describeSaving"
            @click="closeDescribeModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="training-chip btn btn-primary btn-sm rounded-full"
            :disabled="describeSaving || !describeProposals.length"
            @click="confirmDescribedFoods"
          >
            {{ describeSaving ? "Adding…" : "Add to log" }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>

    <dialog ref="planModalEl" class="modal" @close="onPlanModalClose">
      <div class="modal-box max-h-[90vh] max-w-lg overflow-y-auto overscroll-contain">
        <h3 class="text-lg font-semibold">{{ planMode === "new" ? "New daily plan" : "Edit daily plan" }}</h3>
        <p class="mt-1 text-sm text-base-content/60">
          {{
            planMode === "new"
              ? "Enter a name and targets. Saving replaces your current plan. Charts and today vs plan use the new targets."
              : "Update this plan. Charts and today vs plan use the saved targets."
          }}
        </p>
        <div v-if="currentPlan" class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="training-chip btn btn-sm rounded-full"
            :class="planMode === 'edit' ? 'btn-primary' : 'btn-ghost bg-base-200'"
            @click="useCurrentPlan"
          >
            Modify current
          </button>
          <button
            type="button"
            class="training-chip btn btn-sm rounded-full"
            :class="planMode === 'new' ? 'btn-primary' : 'btn-ghost bg-base-200'"
            @click="startNewPlan"
          >
            New plan
          </button>
        </div>
        <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="savePlan">
          <label class="form-control sm:col-span-2">
            <span class="label py-1"><span class="label-text text-sm">Name</span></span>
            <input
              v-model.trim="planForm.name"
              type="text"
              maxlength="80"
              class="input input-bordered w-full"
              placeholder="e.g. Maintenance"
              required
            />
          </label>
          <label class="form-control">
            <span class="label py-1"><span class="label-text text-sm">Calories (kcal)</span></span>
            <input v-model="planForm.kcal" type="number" inputmode="numeric" min="0" step="1" class="input input-bordered w-full" required />
          </label>
          <label class="form-control">
            <span class="label py-1">
              <span class="label-text text-sm">Protein (oz)</span>
              <span class="label-text-alt text-xs text-gray-500">≈ {{ formatPlanGrams(planForm.protein_oz) }} g</span>
            </span>
            <input v-model="planForm.protein_oz" type="number" inputmode="decimal" min="0" step="0.01" class="input input-bordered w-full" required />
          </label>
          <label class="form-control">
            <span class="label py-1">
              <span class="label-text text-sm">Fat (oz)</span>
              <span class="label-text-alt text-xs text-gray-500">≈ {{ formatPlanGrams(planForm.fat_oz) }} g</span>
            </span>
            <input v-model="planForm.fat_oz" type="number" inputmode="decimal" min="0" step="0.01" class="input input-bordered w-full" required />
          </label>
          <label class="form-control">
            <span class="label py-1">
              <span class="label-text text-sm">Carbohydrate (oz)</span>
              <span class="label-text-alt text-xs text-gray-500">≈ {{ formatPlanGrams(planForm.carb_oz) }} g</span>
            </span>
            <input v-model="planForm.carb_oz" type="number" inputmode="decimal" min="0" step="0.01" class="input input-bordered w-full" required />
          </label>
          <div class="modal-action sm:col-span-2 mt-0">
            <p v-if="planError" class="mr-auto self-center text-sm text-red-600 dark:text-red-400">{{ planError }}</p>
            <button
              type="button"
              class="training-chip btn btn-ghost btn-sm rounded-full"
              :disabled="savingPlan"
              @click="closePlanModal"
            >
              Cancel
            </button>
            <button type="submit" class="training-chip btn btn-primary btn-sm rounded-full" :disabled="savingPlan">
              {{ savingPlan ? "Saving…" : planMode === "new" ? "Replace plan" : "Save plan" }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/vue";
import { finishBarcodeScan, releaseBarcodeHardware } from "~/utils/barcodeScan";
import { parseFetchError } from "~/utils/parseFetchError";
import {
  formatPortionGrams,
  formatPortionOunces,
  formatWeightOzGrams,
  ouncesToGrams,
} from "~/utils/foodPortionLabel";

const emit = defineEmits(["plan-change"]);

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

function isoToLocalTime(iso) {
  if (!iso) return localTimeValue();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return localTimeValue();
  return localTimeValue(d);
}

function emptyLogForm() {
  return { foodId: "", servings: "1", meal: "breakfast", time: localTimeValue() };
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

function foodLabel(food) {
  return food?.description || food?.name || "";
}

function foodMeta(food) {
  const serving = food?.serving_label || "1 serving";
  const per = perServingMacros(food);
  return `${serving} · ${formatMacro(per.kcal, 0)} kcal · P ${formatMacro(per.protein_g, 1)} g · F ${formatMacro(per.fat_g, 1)} g · C ${formatMacro(per.carb_g, 1)} g`;
}

function perServingMacros(food) {
  if (!food) return { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0 };
  if (food.kcal != null || food.protein_g != null || food.fat_g != null || food.carb_g != null) {
    return {
      kcal: Number(food.kcal) || 0,
      protein_g: Number(food.protein_g) || 0,
      fat_g: Number(food.fat_g) || 0,
      carb_g: Number(food.carb_g) || 0,
    };
  }
  const grams = Number(food.serving_g);
  return {
    kcal: scaleMacro(food.kcal_per_100g, grams) || 0,
    protein_g: scaleMacro(food.protein_g_per_100g, grams) || 0,
    fat_g: scaleMacro(food.fat_g_per_100g, grams) || 0,
    carb_g: scaleMacro(food.carb_g_per_100g, grams) || 0,
  };
}

function scaleMacro(per100, grams) {
  const n = Number(per100);
  const g = Number(grams);
  if (!Number.isFinite(n) || !Number.isFinite(g) || g <= 0) return null;
  return (n * g) / 100;
}

function scaleByServings(perServing, servings) {
  const n = Number(perServing);
  const s = Number(servings);
  if (!Number.isFinite(n) || !Number.isFinite(s) || s <= 0) return 0;
  return Math.round(n * s * 10000) / 10000;
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

function gramAmount(grams) {
  return `${formatPortionGrams(grams) || "0"} g`;
}

function remainingMassText(remainingGrams) {
  if (remainingGrams == null) return "";
  const n = Number(remainingGrams);
  if (!Number.isFinite(n)) return "";
  const label = gramAmount(Math.abs(n));
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

function emptyFoodForm() {
  return {
    name: "",
    serving: "1 serving",
    serving_g: "",
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
const currentPlan = ref(null);
const planMode = ref("edit");
const planModalEl = ref(null);
const savingPlan = ref(false);
const planError = ref("");
const planNotice = ref("");
const foods = ref([]);
const loadingFoods = ref(false);
const foodsError = ref("");
const logForm = ref(emptyLogForm());
const foodSearchQuery = ref("");
const logging = ref(false);
const logError = ref("");
const describeText = ref("");
const describing = ref(false);
const describeError = ref("");
const describeIntent = ref("meal");
const describeMessage = ref("");
const describeModalEl = ref(null);
const describeProposals = ref([]);
const describeUnmatched = ref([]);
const describeSaving = ref(false);
const describeReviewError = ref("");
let describeKey = 0;
const editingEntryId = ref(null);
const foodForm = ref(emptyFoodForm());
const savingFood = ref(false);
const foodError = ref("");
const foodNotice = ref("");
const editingFoodId = ref(null);
const addingFood = ref(false);
const foodEntryMode = ref("");
const foodFromPackage = ref(false);
const foodModalEl = ref(null);
const barcodeVideo = ref(null);
const barcodeText = ref("");
const barcodeScanning = ref(false);
const barcodeBusy = ref(false);
const barcodeError = ref("");
let barcodeControls = null;
let barcodeScanId = 0;
const logCardEl = ref(null);
const deletingId = ref(null);
const { isNarrow } = useMobileShell();
onBeforeUnmount(() => stopBarcodeScan());
const chartRangeDays = ref(7);
const historyDays = ref([]);
const historyLoading = ref(false);
const historyError = ref("");

const eatenOnLabel = computed(() => (eatenOn.value === todayIso() ? "Today" : eatenOn.value));
const kcalLeftLabel = computed(() => {
  const text = remainingTextKcal(comparison.value?.remaining?.kcal);
  if (text) return text;
  if (!comparison.value) return "";
  return `${formatMacro(comparison.value?.consumed?.kcal, 0)} kcal logged`;
});
const foodServingOuncesPreview = computed(() => {
  const grams = Number(foodForm.value.serving_g);
  if (!(grams > 0)) return "";
  return formatPortionOunces(grams);
});
const showFoodFields = computed(() => Boolean(editingFoodId.value) || foodEntryMode.value === "manual" || foodFromPackage.value);
const showScanner = computed(() => !editingFoodId.value && foodEntryMode.value === "scan" && !foodFromPackage.value);
const selectedFood = computed(() => {
  const id = logForm.value.foodId;
  if (id == null || id === "") return null;
  return foods.value.find((food) => String(food.user_food_id) === String(id)) || null;
});
const filteredLogFoods = computed(() => {
  const q = foodSearchQuery.value.trim().toLowerCase();
  if (!q) return foods.value;
  return foods.value.filter((food) => {
    const label = foodLabel(food).toLowerCase();
    const serving = String(food.serving_label || "").toLowerCase();
    return label.includes(q) || serving.includes(q);
  });
});

function foodDisplayValue(id) {
  if (id == null || id === "") return "";
  const food = foods.value.find((item) => String(item.user_food_id) === String(id));
  return food ? foodLabel(food) : "";
}

watch(
  () => logForm.value.foodId,
  (id) => {
    foodSearchQuery.value = "";
    if (id == null) logForm.value.foodId = "";
  },
);
const logPreview = computed(() => {
  const food = selectedFood.value;
  const servings = Number(logForm.value.servings);
  if (!food || !Number.isFinite(servings) || servings <= 0) return null;
  const per = perServingMacros(food);
  return {
    kcal: scaleByServings(per.kcal, servings),
    protein_g: scaleByServings(per.protein_g, servings),
    fat_g: scaleByServings(per.fat_g, servings),
    carb_g: scaleByServings(per.carb_g, servings),
  };
});

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
      consumedLabel: gramAmount(consumed.protein_g),
      targetLabel: targets?.protein_g != null ? gramAmount(targets.protein_g) : "",
    },
    {
      key: "fat_g",
      label: "Fat",
      consumed: consumed.fat_g,
      target: targets?.fat_g,
      remainingLabel: remainingMassText(remaining?.fat_g),
      consumedLabel: gramAmount(consumed.fat_g),
      targetLabel: targets?.fat_g != null ? gramAmount(targets.fat_g) : "",
    },
    {
      key: "carb_g",
      label: "Carbohydrate",
      consumed: consumed.carb_g,
      target: targets?.carb_g,
      remainingLabel: remainingMassText(remaining?.carb_g),
      consumedLabel: gramAmount(consumed.carb_g),
      targetLabel: targets?.carb_g != null ? gramAmount(targets.carb_g) : "",
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
      ounceNote: row.key === "kcal" || target == null ? "" : `≈ ${formatPortionOunces(target) || "0"} oz`,
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

watch(eatenOn, () => {
  if (editingEntryId.value) cancelEditEntry();
  void loadDay();
});

watch(chartRangeDays, () => {
  if (!isNarrow.value) void loadHistory();
});

watch(isNarrow, (narrow) => {
  if (!narrow) void loadHistory();
});

onMounted(() => {
  void loadDay();
  void loadFoods();
});

function fillPlanForm(plan) {
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

function applyPlan(plan) {
  currentPlan.value = plan || null;
  fillPlanForm(plan);
  emit("plan-change", plan?.name || "");
}

function useCurrentPlan() {
  planMode.value = "edit";
  planError.value = "";
  fillPlanForm(currentPlan.value);
}

function startNewPlan() {
  planMode.value = "new";
  planError.value = "";
  planForm.value = {
    ...emptyPlanForm(),
    name: "",
  };
}

function openPlanModal() {
  planError.value = "";
  planNotice.value = "";
  if (currentPlan.value) {
    planMode.value = "edit";
    fillPlanForm(currentPlan.value);
  } else {
    planMode.value = "new";
    fillPlanForm(null);
  }
  nextTick(() => planModalEl.value?.showModal());
}

function closePlanModal() {
  planModalEl.value?.close();
}

function onPlanModalClose() {
  planError.value = "";
  planNotice.value = "";
  fillPlanForm(currentPlan.value);
  planMode.value = currentPlan.value ? "edit" : "new";
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
    const failure = settleLoadError(error, "Failed to load nutrition chart.");
    historyError.value = failure.message;
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
    const failure = settleLoadError(error, "Failed to load nutrition for this day.");
    loadError.value = failure.message;
    if (failure.auth) {
      entries.value = [];
      comparison.value = null;
    }
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
    closePlanModal();
    await loadDay();
  } catch (error) {
    planError.value = parseFetchError(error, "Failed to save nutrition plan.");
  } finally {
    savingPlan.value = false;
  }
}

async function loadFoods() {
  loadingFoods.value = true;
  foodsError.value = "";
  try {
    const data = await $fetch("/api/physical/nutrition/foods", { query: { limit: 50 } });
    foods.value = data?.foods || [];
    if (
      logForm.value.foodId &&
      !editingEntryId.value &&
      !foods.value.some((food) => String(food.user_food_id) === String(logForm.value.foodId))
    ) {
      logForm.value.foodId = "";
    }
  } catch (error) {
    foods.value = [];
    foodsError.value = settleLoadError(error, "Failed to load foods.").message;
  } finally {
    loadingFoods.value = false;
  }
}

function foodPayload() {
  return {
    name: foodForm.value.name,
    serving_label: foodForm.value.serving,
    serving_g: Number(foodForm.value.serving_g),
    kcal: Number(foodForm.value.kcal),
    protein_g: Number(foodForm.value.protein_g),
    fat_g: Number(foodForm.value.fat_g),
    carb_g: Number(foodForm.value.carb_g),
  };
}

function applyFoodToList(food) {
  foods.value = [food, ...foods.value.filter((item) => Number(item.user_food_id) !== Number(food.user_food_id))];
}

function chooseScan() {
  foodEntryMode.value = "scan";
  foodFromPackage.value = false;
  foodNotice.value = "";
  barcodeError.value = "";
  stopBarcodeScan();
}

function chooseManual() {
  foodEntryMode.value = "manual";
  foodFromPackage.value = false;
  foodNotice.value = "";
  stopBarcodeScan();
}

function scanAgain() {
  foodFromPackage.value = false;
  foodNotice.value = "";
  barcodeError.value = "";
  stopBarcodeScan();
}

function openAddFoodModal() {
  cancelEditFood();
  addingFood.value = true;
  nextTick(() => foodModalEl.value?.showModal());
}

function closeFoodModal() {
  foodModalEl.value?.close();
}

function onFoodModalClose() {
  cancelEditFood();
}

function fillFoodForm(food) {
  foodForm.value = {
    name: foodLabel(food),
    serving: food.serving_label || food.serving || "1 serving",
    serving_g: formatPortionGrams(food.serving_g) || "",
    kcal: food.kcal != null ? String(food.kcal) : "",
    protein_g: food.protein_g != null ? String(food.protein_g) : "",
    fat_g: food.fat_g != null ? String(food.fat_g) : "",
    carb_g: food.carb_g != null ? String(food.carb_g) : "",
  };
}

function startEditFood(food) {
  addingFood.value = false;
  editingFoodId.value = food.user_food_id;
  foodEntryMode.value = "manual";
  foodFromPackage.value = false;
  foodError.value = "";
  foodNotice.value = "";
  fillFoodForm(food);
  nextTick(() => foodModalEl.value?.showModal());
}

function stopBarcodeScan() {
  barcodeScanId += 1;
  barcodeScanning.value = false;
  releaseBarcodeHardware(barcodeControls, barcodeVideo.value);
  barcodeControls = null;
}

async function startBarcodeScan() {
  barcodeError.value = "";
  releaseBarcodeHardware(barcodeControls, barcodeVideo.value);
  barcodeControls = null;
  const scanId = ++barcodeScanId;
  barcodeScanning.value = true;
  await nextTick();
  if (scanId !== barcodeScanId) return;
  const video = barcodeVideo.value;
  if (!video) {
    barcodeScanning.value = false;
    barcodeError.value = "The camera could not start. Type the barcode instead.";
    return;
  }
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const reader = new BrowserMultiFormatReader();
    const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
      if (scanId !== barcodeScanId || !result) return;
      const text = result.getText();
      stopBarcodeScan();
      barcodeText.value = text;
      lookupBarcode(text);
    });
    const settled = finishBarcodeScan({
      scanId,
      currentScanId: barcodeScanId,
      controls,
      video,
    });
    if (!settled) return;
    barcodeControls = settled;
  } catch {
    if (scanId !== barcodeScanId) return;
    stopBarcodeScan();
    barcodeError.value = "The camera could not start. Type the barcode instead.";
  }
}

async function lookupBarcode(code) {
  const digits = String(code || "").replace(/\D/g, "");
  barcodeText.value = digits;
  if (digits.length < 8 || digits.length > 14) {
    barcodeError.value = "Enter the 8 to 14 digits under the barcode.";
    return;
  }
  barcodeBusy.value = true;
  barcodeError.value = "";
  try {
    const data = await $fetch("/api/physical/nutrition/barcode", { query: { code: digits } });
    const food = data?.food;
    if (!food) {
      barcodeError.value = "No nutrition was found for that barcode. Enter the food by hand.";
      return;
    }
    const grams = food.serving_g != null ? Number(food.serving_g) : ouncesToGrams(food.serving_oz);
    foodForm.value = {
      name: food.name || "",
      serving: food.serving || "1 serving",
      serving_g: grams != null ? formatPortionGrams(grams) || "" : "",
      kcal: food.kcal != null ? String(food.kcal) : "",
      protein_g: food.protein_g != null ? String(food.protein_g) : "",
      fat_g: food.fat_g != null ? String(food.fat_g) : "",
      carb_g: food.carb_g != null ? String(food.carb_g) : "",
    };
    foodFromPackage.value = true;
    stopBarcodeScan();
    foodNotice.value = "Filled from the package. Check the serving, then save.";
    foodError.value = "";
  } catch (error) {
    barcodeError.value = parseFetchError(error, "No nutrition was found for that barcode. Enter the food by hand.");
  } finally {
    barcodeBusy.value = false;
  }
}

function cancelEditFood() {
  stopBarcodeScan();
  editingFoodId.value = null;
  addingFood.value = false;
  foodEntryMode.value = "";
  foodFromPackage.value = false;
  foodForm.value = emptyFoodForm();
  foodError.value = "";
  foodNotice.value = "";
  barcodeText.value = "";
  barcodeError.value = "";
}

async function logSavedFood(food) {
  const per = perServingMacros(food);
  await $fetch("/api/physical/nutrition/intake", {
    method: "POST",
    body: {
      eaten_on: eatenOn.value,
      eaten_at: eatenAtIso(eatenOn.value, logForm.value.time),
      meal_type: logForm.value.meal,
      user_food_id: food.user_food_id,
      portion_id: food.user_food_id,
      quantity: 1,
      gram_weight: Number(food.serving_g),
      food_name: foodLabel(food),
      portion_label: food.serving_label || "1 serving",
      kcal: per.kcal,
      protein_g: per.protein_g,
      fat_g: per.fat_g,
      carb_g: per.carb_g,
    },
  });
  await loadDay();
}

async function saveFood(andLog) {
  const payload = foodPayload();
  const macros = [payload.kcal, payload.protein_g, payload.fat_g, payload.carb_g];
  if (!payload.name || !(payload.serving_g > 0)) {
    foodError.value = "Enter a name and a serving weight in grams.";
    return;
  }
  if (macros.some((n) => !Number.isFinite(n) || n < 0) || foodForm.value.kcal === "") {
    foodError.value = "Enter calories and macros for one serving.";
    return;
  }
  const foodId = editingFoodId.value;
  savingFood.value = true;
  foodError.value = "";
  foodNotice.value = "";
  try {
    const data = foodId
      ? await $fetch(`/api/physical/nutrition/user-foods/${foodId}`, { method: "PUT", body: payload })
      : await $fetch("/api/physical/nutrition/user-foods", { method: "POST", body: payload });
    const food = data?.food;
    if (!food?.user_food_id) throw new Error("Missing food.");
    applyFoodToList(food);
    if (!editingEntryId.value) {
      logForm.value.foodId = String(food.user_food_id);
      logForm.value.servings = logForm.value.servings || "1";
    }
    if (andLog) {
      try {
        await logSavedFood(food);
        closeFoodModal();
        return;
      } catch (error) {
        editingFoodId.value = food.user_food_id;
        fillFoodForm(food);
        foodError.value = parseFetchError(error, "Saved, but it was not added to today's log.");
        return;
      }
    }
    if (foodId) {
      editingFoodId.value = food.user_food_id;
      fillFoodForm(food);
      foodNotice.value = addingFood.value
        ? "Saved."
        : "Food updated. Existing log entries stay as logged.";
    } else {
      editingFoodId.value = null;
      foodEntryMode.value = "";
      foodFromPackage.value = false;
      foodForm.value = emptyFoodForm();
      barcodeText.value = "";
      foodNotice.value = "Saved. Add another, or close this window.";
    }
  } catch (error) {
    foodError.value = parseFetchError(error, foodId ? "Failed to update food." : "Failed to save food.");
  } finally {
    savingFood.value = false;
  }
}

function startEditEntry(entry) {
  const foodId = entry.user_food_id
    || foods.value.find((food) => foodLabel(food) === (entry.food_description || entry.food_name))?.user_food_id
    || "";
  editingEntryId.value = entry.entry_id;
  logError.value = "";
  logForm.value = {
    foodId: foodId ? String(foodId) : "",
    servings: entry.quantity != null ? String(entry.quantity) : "1",
    meal: entry.meal || entry.meal_type || "breakfast",
    time: isoToLocalTime(entry.eaten_at),
  };
  foodSearchQuery.value = "";
  if (!foodId) {
    logError.value = "Pick the food this entry should use.";
  }
  nextTick(() => logCardEl.value?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function cancelEditEntry() {
  editingEntryId.value = null;
  logError.value = "";
  foodSearchQuery.value = "";
  logForm.value = {
    ...emptyLogForm(),
    meal: logForm.value.meal || "breakfast",
    time: logForm.value.time || localTimeValue(),
  };
}

function proposalServingGrams(row) {
  return formatPlanGrams(row?.servingOz);
}

function proposalGrams(row) {
  const ounces = Number(row?.servingOz);
  const quantity = Number(row?.quantity);
  if (!Number.isFinite(ounces) || ounces <= 0 || !Number.isFinite(quantity) || quantity <= 0) return null;
  const one = ouncesToGrams(ounces);
  if (one == null) return null;
  return one * quantity;
}

function proposalPreview(row) {
  if (row?.unmatched) {
    const quantity = Number(row.quantity);
    const kcal = Number(row.kcal);
    const protein = Number(row.protein);
    const fat = Number(row.fat);
    const carb = Number(row.carb);
    if (![quantity, kcal, protein, fat, carb].every((value) => Number.isFinite(value) && value >= 0) || !(quantity > 0)) {
      return null;
    }
    return {
      kcal: kcal * quantity,
      protein_g: protein * quantity,
      fat_g: fat * quantity,
      carb_g: carb * quantity,
    };
  }
  const grams = proposalGrams(row);
  if (grams == null) return null;
  return {
    kcal: scaleMacro(row.kcal_per_100g, grams) || 0,
    protein_g: scaleMacro(row.protein_g_per_100g, grams) || 0,
    fat_g: scaleMacro(row.fat_g_per_100g, grams) || 0,
    carb_g: scaleMacro(row.carb_g_per_100g, grams) || 0,
  };
}

function proposalTotalWeight(row) {
  const grams = proposalGrams(row);
  return grams ? formatWeightOzGrams(grams) : "";
}

function proposalFromItem(item) {
  describeKey += 1;
  const servingG = Number(item?.serving_g);
  return {
    key: describeKey,
    name: String(item?.name || ""),
    quantity: item?.quantity != null ? String(item.quantity) : "1",
    servingOz: Number.isFinite(servingG) && servingG > 0 ? formatPortionOunces(servingG) || "" : "",
    portionLabel: String(item?.portion_label || "1 serving"),
    requestedServing: item?.requested_serving ? String(item.requested_serving) : "",
    fdc_id: item?.fdc_id ?? null,
    user_food_id: item?.user_food_id ?? null,
    portion_id: item?.portion_id ?? null,
    kcal_per_100g: item?.kcal_per_100g ?? null,
    protein_g_per_100g: item?.protein_g_per_100g ?? null,
    fat_g_per_100g: item?.fat_g_per_100g ?? null,
    carb_g_per_100g: item?.carb_g_per_100g ?? null,
    unmatched: false,
    kcal: "",
    protein: "",
    fat: "",
    carb: "",
  };
}

function proposalFromUnmatched(name) {
  describeKey += 1;
  return {
    key: describeKey,
    name: String(name || ""),
    quantity: "1",
    servingOz: "",
    portionLabel: "1 serving",
    requestedServing: "",
    fdc_id: null,
    user_food_id: null,
    portion_id: null,
    kcal_per_100g: null,
    protein_g_per_100g: null,
    fat_g_per_100g: null,
    carb_g_per_100g: null,
    unmatched: true,
    kcal: "",
    protein: "",
    fat: "",
    carb: "",
  };
}

function openDescribed(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const unmatched = Array.isArray(result?.unmatched) ? result.unmatched.filter(Boolean) : [];
  describeUnmatched.value = unmatched;
  describeProposals.value = [...items.map(proposalFromItem), ...unmatched.map(proposalFromUnmatched)];
  describeReviewError.value = "";
  if (!describeProposals.value.length) {
    describeError.value = "Could not match those foods. Add them as saved foods, or try a simpler name.";
    return;
  }
  nextTick(() => describeModalEl.value?.showModal());
}

function removeProposal(index) {
  describeProposals.value = describeProposals.value.filter((_, itemIndex) => itemIndex !== index);
}

function closeDescribeModal() {
  describeModalEl.value?.close();
}

function onDescribeModalClose() {
  describeSaving.value = false;
  describeReviewError.value = "";
}

function submitComposer() {
  if (editingEntryId.value || (selectedFood.value && !describeText.value.trim())) {
    void logFood();
    return;
  }
  void logFromDescription();
}

async function logFromDescription() {
  const text = describeText.value.trim();
  if (text.length < 2 || describing.value) return;
  describeIntent.value = "meal";
  describing.value = true;
  describeError.value = "";
  describeMessage.value = "";
  try {
    const result = await $fetch("/api/physical/nutrition/intake/describe", {
      method: "POST",
      body: {
        text,
        meal: logForm.value.meal,
      },
    });
    openDescribed(result);
  } catch (error) {
    describeError.value = parseFetchError(error, "Failed to read that meal.");
  } finally {
    describing.value = false;
  }
}

async function suggestRemaining() {
  if (describing.value) return;
  describeIntent.value = "remaining";
  describing.value = true;
  describeError.value = "";
  describeMessage.value = "";
  try {
    const result = await $fetch("/api/physical/nutrition/intake/suggest", {
      method: "POST",
      body: { date: eatenOn.value },
    });
    openDescribed(result);
  } catch (error) {
    describeError.value = parseFetchError(error, "Could not suggest foods for what is left.");
  } finally {
    describing.value = false;
  }
}

async function confirmDescribedFoods() {
  if (describeSaving.value || !describeProposals.value.length) return;
  const rows = describeProposals.value;
  for (const row of rows) {
    if (!String(row.name || "").trim() || !proposalPreview(row) || proposalGrams(row) == null) {
      describeReviewError.value = "Each food needs a name, a serving count, and a size.";
      return;
    }
  }
  describeSaving.value = true;
  describeReviewError.value = "";
  const savedNames = [];
  try {
    const eatenAt = eatenAtIso(eatenOn.value, logForm.value.time);
    for (const row of rows) {
      const grams = proposalGrams(row);
      let userFoodId = row.user_food_id;
      let kcalPer100 = row.kcal_per_100g;
      let proteinPer100 = row.protein_g_per_100g;
      let fatPer100 = row.fat_g_per_100g;
      let carbPer100 = row.carb_g_per_100g;
      if (row.unmatched) {
        const servingG = ouncesToGrams(Number(row.servingOz));
        const created = await $fetch("/api/physical/nutrition/user-foods", {
          method: "POST",
          body: {
            name: row.name.trim(),
            serving_label: row.portionLabel || "1 serving",
            serving_g: servingG,
            kcal: Number(row.kcal),
            protein_g: Number(row.protein),
            fat_g: Number(row.fat),
            carb_g: Number(row.carb),
          },
        });
        userFoodId = created?.food?.user_food_id ?? null;
        kcalPer100 = created?.food?.kcal_per_100g ?? null;
        proteinPer100 = created?.food?.protein_g_per_100g ?? null;
        fatPer100 = created?.food?.fat_g_per_100g ?? null;
        carbPer100 = created?.food?.carb_g_per_100g ?? null;
      }
      await $fetch("/api/physical/nutrition/intake", {
        method: "POST",
        body: {
          eaten_on: eatenOn.value,
          eaten_at: eatenAt,
          meal_type: logForm.value.meal,
          fdc_id: row.unmatched ? null : row.fdc_id,
          user_food_id: userFoodId,
          portion_id: row.unmatched ? null : row.portion_id,
          quantity: Number(row.quantity),
          gram_weight: grams,
          food_name: row.name.trim(),
          portion_label: row.portionLabel || "1 serving",
          kcal_per_100g: kcalPer100,
          protein_g_per_100g: proteinPer100,
          fat_g_per_100g: fatPer100,
          carb_g_per_100g: carbPer100,
        },
      });
      savedNames.push(row.name.trim());
      describeProposals.value = describeProposals.value.filter((item) => item.key !== row.key);
    }
    describeText.value = "";
    describeMessage.value = savedNames.length ? `Added ${savedNames.join(", ")}.` : "Added that meal.";
    closeDescribeModal();
    await loadDay();
  } catch (error) {
    if (savedNames.length) await loadDay();
    const reason = parseFetchError(error, "Failed to add that meal.");
    describeReviewError.value = savedNames.length
      ? `${reason} Added ${savedNames.join(", ")}. The foods still listed were not added.`
      : reason;
  } finally {
    describeSaving.value = false;
  }
}

async function logFood() {
  const food = selectedFood.value;
  const servings = Number(logForm.value.servings);
  const preview = logPreview.value;
  if (!food?.user_food_id || !preview) {
    logError.value = "Pick a food and enter servings.";
    return;
  }
  logging.value = true;
  logError.value = "";
  try {
    const gramWeight = Number(food.serving_g) * servings;
    const body = {
      eaten_on: eatenOn.value,
      eaten_at: eatenAtIso(eatenOn.value, logForm.value.time),
      meal_type: logForm.value.meal,
      user_food_id: food.user_food_id,
      portion_id: food.user_food_id,
      quantity: servings,
      gram_weight: gramWeight,
      food_name: foodLabel(food),
      portion_label: food.serving_label || "1 serving",
      kcal: preview.kcal,
      protein_g: preview.protein_g,
      fat_g: preview.fat_g,
      carb_g: preview.carb_g,
    };
    if (editingEntryId.value) {
      await $fetch(`/api/physical/nutrition/intake/${editingEntryId.value}`, { method: "PUT", body });
      editingEntryId.value = null;
    } else {
      await $fetch("/api/physical/nutrition/intake", { method: "POST", body });
    }
    await loadDay();
    cancelEditEntry();
  } catch (error) {
    logError.value = parseFetchError(error, editingEntryId.value ? "Failed to update food log." : "Failed to log food.");
  } finally {
    logging.value = false;
  }
}

async function deleteEntry(entryId) {
  deletingId.value = entryId;
  loadError.value = "";
  try {
    await $fetch(`/api/physical/nutrition/intake/${entryId}`, { method: "DELETE" });
    if (editingEntryId.value === entryId) cancelEditEntry();
    await loadDay();
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to remove that food.");
  } finally {
    deletingId.value = null;
  }
}

const planName = computed(() => currentPlan.value?.name || "");

defineExpose({ openAddFoodModal, openPlanModal, planName });
</script>
