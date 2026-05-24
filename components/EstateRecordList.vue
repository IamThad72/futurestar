<template>
  <div class="estate-record-list">
    <div v-if="columns.length" class="estate-record-list__sort">
      <button
        v-for="col in columns"
        :key="col.k"
        type="button"
        class="estate-record-list__sort-btn"
        :class="{ 'estate-record-list__sort-btn--active': sortState.key === col.k }"
        @click="$emit('sort', col.k)"
      >
        {{ col.l }}
        <span v-if="sortState.key === col.k" class="estate-record-list__sort-dir">
          {{ sortState.dir === "asc" ? "▲" : "▼" }}
        </span>
      </button>
    </div>

    <ion-list v-if="displayItems.length" lines="full" class="estate-record-list__ion">
      <ion-item
        v-for="{ item, view } in displayItems"
        :key="String(item[itemKey])"
        button
        detail
        class="estate-record-list__item"
        @click="$emit('edit', item)"
      >
        <ion-label>
          <h2 class="estate-record-list__title">
            <span class="estate-record-list__title-text">{{ view.title }}</span>
            <ion-badge
              v-if="view.titleSuffix"
              :class="['estate-record-list__badge', view.titleSuffixBadgeClass || view.titleSuffixClass]"
            >
              {{ view.titleSuffix }}
            </ion-badge>
          </h2>
          <p
            v-if="view.subtitle"
            :class="['estate-record-list__subtitle', view.subtitleClass]"
          >
            {{ view.subtitle }}
          </p>
          <p
            v-for="(line, idx) in view.lines"
            :key="idx"
            class="estate-record-list__line"
          >
            <span v-if="line.label" class="estate-record-list__line-label">{{ line.label }}:</span>
            <template v-if="line.segments?.length">
              <span
                v-for="(segment, segIdx) in line.segments"
                :key="segIdx"
                :class="['estate-record-list__line-value', segment.class]"
              >
                {{ segment.text }}
              </span>
            </template>
            <span v-else :class="['estate-record-list__line-value', line.valueClass]">{{ line.value }}</span>
          </p>
        </ion-label>
        <ion-note
          v-if="view.note"
          slot="end"
          :class="['estate-record-list__note', view.noteClass]"
        >
          {{ view.note }}
        </ion-note>
      </ion-item>
    </ion-list>

    <p v-else class="estate-record-list__empty">{{ emptyText }}</p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { IonBadge, IonItem, IonLabel, IonList, IonNote } from "@ionic/vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  itemKey: { type: String, required: true },
  columns: { type: Array, default: () => [] },
  sortState: { type: Object, default: () => ({ key: "", dir: "asc" }) },
  mapRow: { type: Function, required: true },
  emptyText: { type: String, default: "No records" },
});

defineEmits(["edit", "sort"]);

const displayItems = computed(() =>
  props.items.map((item) => ({
    item,
    view: props.mapRow(item) ?? { title: "—", lines: [] },
  })),
);
</script>

<style scoped>
.estate-record-list {
  padding-inline: 8px;
}

.estate-record-list__sort {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.estate-record-list__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 18%, transparent);
  border-radius: 9999px;
  background: var(--color-base-100, #fbffff);
  color: var(--color-base-content, #151616);
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.25rem;
  cursor: pointer;
}

@media (min-width: 768px) {
  .estate-record-list__sort-btn {
    font-size: 0.75rem;
    padding: 0.3125rem 0.75rem;
  }
}

.estate-record-list__sort-btn--active {
  border-color: var(--color-primary, #1e3a8a);
  background: color-mix(in srgb, var(--color-primary, #1e3a8a) 10%, var(--color-base-100, #fbffff));
  color: var(--color-primary, #1e3a8a);
}

.estate-record-list__sort-dir {
  font-size: 0.625rem;
}

.estate-record-list__empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 0.875rem;
  color: color-mix(in srgb, var(--color-base-content, #151616) 55%, transparent);
  font-style: italic;
}

.estate-record-list__ion {
  margin: 0;
  background: transparent;
}

@media (min-width: 640px) {
  .estate-record-list__ion {
    margin: 0;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
  }
}

.estate-record-list__item {
  --background: var(--color-base-100, #fbffff);
  --color: var(--color-base-content, #151616);
  --border-color: color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
  --padding-start: 0;
  --inner-padding-end: 0;
}

.estate-record-list__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
}

.estate-record-list__title-text {
  min-width: 0;
}

.estate-record-list__badge {
  --padding-start: 0.5rem;
  --padding-end: 0.5rem;
  --padding-top: 0.25rem;
  --padding-bottom: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: none;
  border-radius: 9999px;
}

.estate-record-list__badge--expense {
  --background: #f87171;
  --color: #ffffff;
}

.estate-record-list__badge--income {
  --background: #059669;
  --color: #ffffff;
}

.estate-record-list__badge--investment {
  --background: #7c3aed;
  --color: #ffffff;
}

.estate-record-list__badge--savings {
  --background: #0284c7;
  --color: #ffffff;
}

.estate-record-list__badge--tax {
  --background: #d97706;
  --color: #ffffff;
}

.estate-record-list__badge--insurance {
  --background: #4b5563;
  --color: #ffffff;
}

.estate-record-list__subtitle {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--color-base-content, #151616) 72%, transparent);
  text-transform: capitalize;
}

.estate-record-list__line {
  margin: 0.125rem 0 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--color-base-content, #151616) 62%, transparent);
}

.estate-record-list__line-label {
  font-weight: 600;
}

.estate-record-list__line-value--budgeted {
  color: var(--color-primary, #1e3a8a);
  font-weight: 600;
}

.estate-record-list__line-sep {
  color: color-mix(in srgb, var(--color-base-content, #151616) 45%, transparent);
  font-weight: 400;
}

.estate-record-list__line-dif-label {
  color: color-mix(in srgb, var(--color-base-content, #151616) 62%, transparent);
  font-weight: 600;
  font-size: 0.75rem;
}

.estate-record-list__line-value--over {
  color: #f87171;
  font-weight: 600;
}

.estate-record-list__line-value--under {
  color: #059669;
  font-weight: 600;
}

.estate-record-list__line-value--on-budget {
  color: #6b7280;
  font-weight: 600;
}

.estate-record-list__note {
  align-self: center;
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-base-content, #151616);
  padding-inline-start: 0.75rem;
}

.estate-record-list__note--over {
  --color: #f87171;
  color: #f87171 !important;
}

.estate-record-list__note--under {
  --color: #059669;
  color: #059669 !important;
}

.estate-record-list__note--on-budget {
  --color: #6b7280;
  color: #6b7280 !important;
}
</style>
