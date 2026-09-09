<template>
  <main v-if="!isNarrow" class="account-map-page">
    <div v-if="!auth.ready" class="px-1 py-8 text-sm text-gray-500">Loading session...</div>
    <div
      v-else-if="!auth.user"
      class="mx-4 my-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      You must be logged in to use Account Map.
    </div>

    <template v-else>
      <header class="account-map-header">
        <div>
          <h1 class="text-base font-semibold text-gray-900 md:text-lg dark:text-white">Account Map</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Build budgets visually — connect estate records and budget lines, then set one budget active for Setup and Tracker.
          </p>
        </div>
        <div class="account-map-toolbar">
          <HeadlessMenu as="div" class="account-map-budget-menu">
            <HeadlessMenuButton class="account-map-budget-menu__trigger" :disabled="budgetBusy">
              <span class="account-map-budget-menu__meta">
                <span class="account-map-budget-menu__label">Budget</span>
                <span class="account-map-budget-menu__value">
                  {{ selectedBudget?.name || "Select…" }}
                </span>
              </span>
              <span class="account-map-budget-menu__chevron" aria-hidden="true">▾</span>
            </HeadlessMenuButton>
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <HeadlessMenuItems class="account-map-budget-menu__panel">
                <div class="account-map-budget-menu__section">
                  <p class="account-map-budget-menu__section-label">Switch budget</p>
                  <HeadlessMenuItem
                    v-for="b in budgets"
                    :key="b.budget_id"
                    v-slot="{ active }"
                    as="template"
                  >
                    <button
                      type="button"
                      class="account-map-budget-menu__item"
                      :class="{
                        'account-map-budget-menu__item--active': active,
                        'account-map-budget-menu__item--selected': b.budget_id === selectedBudgetId,
                      }"
                      :disabled="budgetBusy"
                      @click="selectBudget(b.budget_id)"
                    >
                      <span class="account-map-budget-menu__item-name">{{ b.name }}</span>
                      <span v-if="b.is_active" class="account-map-budget-menu__item-tag">active</span>
                    </button>
                  </HeadlessMenuItem>
                </div>

                <div class="account-map-budget-menu__divider" />

                <div class="account-map-budget-menu__section">
                  <p class="account-map-budget-menu__section-label">Budget</p>
                  <HeadlessMenuItem v-slot="{ active }" as="template">
                    <button
                      type="button"
                      class="account-map-budget-menu__item"
                      :class="{ 'account-map-budget-menu__item--active': active }"
                      :disabled="budgetBusy"
                      @click="openCreateBudget"
                    >
                      New budget
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }" as="template">
                    <button
                      type="button"
                      class="account-map-budget-menu__item"
                      :class="{ 'account-map-budget-menu__item--active': active }"
                      :disabled="budgetBusy || !selectedBudget"
                      @click="renameSelectedBudget"
                    >
                      Rename
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }" as="template">
                    <button
                      type="button"
                      class="account-map-budget-menu__item"
                      :class="{ 'account-map-budget-menu__item--active': active }"
                      :disabled="budgetBusy || !selectedBudget || selectedIsActive"
                      @click="activateSelectedBudget"
                    >
                      Set as active
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }" as="template">
                    <button
                      type="button"
                      class="account-map-budget-menu__item"
                      :class="{ 'account-map-budget-menu__item--active': active }"
                      :disabled="budgetBusy || !selectedBudget"
                      @click="openApplyMonths"
                    >
                      Apply to months…
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }" as="template">
                    <button
                      type="button"
                      class="account-map-budget-menu__item account-map-budget-menu__item--danger"
                      :class="{ 'account-map-budget-menu__item--active': active }"
                      :disabled="budgetBusy || !selectedBudget || selectedIsActive || budgets.length <= 1"
                      @click="deleteSelectedBudget"
                    >
                      Delete
                    </button>
                  </HeadlessMenuItem>
                </div>

                <div class="account-map-budget-menu__divider" />

                <div class="account-map-budget-menu__section">
                  <p class="account-map-budget-menu__section-label">Map</p>
                  <HeadlessMenuItem v-slot="{ active }" as="template">
                    <button
                      type="button"
                      class="account-map-budget-menu__item"
                      :class="{ 'account-map-budget-menu__item--active': active }"
                      :disabled="savingLayout || !selectedBudgetId"
                      @click="saveLayout"
                    >
                      {{ savingLayout ? "Saving…" : "Save layout" }}
                    </button>
                  </HeadlessMenuItem>
                  <HeadlessMenuItem v-slot="{ active }" as="template">
                    <button
                      type="button"
                      class="account-map-budget-menu__item"
                      :class="{ 'account-map-budget-menu__item--active': active }"
                      @click="autoLayout"
                    >
                      Auto layout
                    </button>
                  </HeadlessMenuItem>
                </div>
              </HeadlessMenuItems>
            </transition>
          </HeadlessMenu>
        </div>
      </header>

      <div
        v-if="showCreateBudget"
        class="account-map-modal-backdrop"
        @click.self="showCreateBudget = false"
      >
        <div class="account-map-modal">
          <h2 class="text-sm font-semibold">New budget</h2>
          <label class="form-control mt-2">
            <span class="label-text text-xs">Name</span>
            <input v-model="newBudgetName" type="text" class="input input-bordered input-sm" maxlength="80" />
          </label>
          <label class="form-control mt-2">
            <span class="label-text text-xs">Copy from</span>
            <select v-model="copyFromBudgetId" class="select select-bordered select-sm">
              <option :value="null">Start empty</option>
              <option v-for="b in budgets" :key="b.budget_id" :value="b.budget_id">{{ b.name }}</option>
            </select>
          </label>
          <div class="mt-3 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-xs sm:btn-sm md:btn-md lg:btn-lg xl:btn-xs" @click="showCreateBudget = false">Cancel</button>
            <button type="button" class="btn btn-primary btn-xs sm:btn-sm md:btn-md lg:btn-lg xl:btn-xs" :disabled="budgetBusy" @click="createBudget">
              Create
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="showApplyMonths"
        class="account-map-modal-backdrop"
        @click.self="showApplyMonths = false"
      >
        <div class="account-map-modal account-map-modal--wide">
          <h2 class="text-sm font-semibold">Apply “{{ selectedBudget?.name }}” to months</h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Overrides which plan Tracker uses for those months. Months without an override use the active default budget.
          </p>
          <label class="form-control mt-3">
            <span class="label-text text-xs">Year</span>
            <select v-model="applyMonthsYear" class="select select-bordered select-sm" @change="loadAssignmentsForSelectedBudget">
              <option v-for="y in applyYearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </label>
          <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            <label
              v-for="m in 12"
              :key="m"
              class="flex items-center gap-1.5 rounded-md border border-base-200 px-2 py-1.5 text-xs"
            >
              <input v-model="applyMonthsSelected" type="checkbox" class="checkbox checkbox-xs" :value="m" />
              <span>{{ monthNamesShort[m - 1] }}</span>
            </label>
          </div>
          <div v-if="selectedBudgetAssignments.length" class="mt-3">
            <p class="text-xs font-medium text-gray-600 dark:text-gray-300">Already assigned to this budget</p>
            <ul class="mt-1 flex flex-wrap gap-1.5">
              <li
                v-for="a in selectedBudgetAssignments"
                :key="`${a.year}-${a.month}`"
                class="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-[0.65rem]"
              >
                {{ monthNamesShort[a.month - 1] }} {{ a.year }}
                <button
                  type="button"
                  class="opacity-70 hover:opacity-100"
                  :disabled="budgetBusy"
                  title="Clear override"
                  @click="clearMonthAssignment(a.year, a.month)"
                >
                  ×
                </button>
              </li>
            </ul>
          </div>
          <p v-if="applyMonthsError" class="mt-2 text-xs text-red-600">{{ applyMonthsError }}</p>
          <div class="mt-3 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-xs sm:btn-sm" @click="showApplyMonths = false">Cancel</button>
            <button
              type="button"
              class="btn btn-primary btn-xs sm:btn-sm"
              :disabled="budgetBusy || !applyMonthsSelected.length"
              @click="applySelectedMonths"
            >
              {{ budgetBusy ? "Saving…" : "Apply" }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="px-1 py-8 text-sm text-gray-500">Loading map...</div>
      <div v-else-if="error" class="mx-4 my-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {{ error }}
        <button type="button" class="btn btn-ghost btn-xs ml-2" @click="loadMap">Retry</button>
      </div>

      <div
        v-else
        class="account-map-body"
        :class="{ 'account-map-body--palette-open': !paletteCollapsed }"
      >
        <button
          v-if="paletteCollapsed"
          type="button"
          class="account-map-palette-rail"
          title="Open records panel"
          aria-label="Open records panel"
          @click="paletteCollapsed = false"
        >
          <span class="account-map-palette-rail__label">Records</span>
          <span aria-hidden="true">›</span>
        </button>

        <div
          v-if="!paletteCollapsed"
          class="account-map-palette-backdrop"
          @click="paletteCollapsed = true"
        />

        <aside
          class="account-map-palette"
          :class="{ 'account-map-palette--open': !paletteCollapsed }"
          :aria-hidden="paletteCollapsed"
        >
          <div class="account-map-palette__header">
            <div class="account-map-palette__heading">
              <h2 class="account-map-palette__title">Records</h2>
              <p class="account-map-palette__hint">Drag onto the canvas or click to place.</p>
            </div>
            <button
              type="button"
              class="account-map-palette__toggle"
              title="Close records panel"
              aria-label="Close records panel"
              @click="paletteCollapsed = true"
            >
              ‹
            </button>
          </div>

          <div class="account-map-palette__body">
            <div class="account-map-palette__add">
              <h3>Add new</h3>
              <button type="button" class="btn btn-outline btn-xs w-full" @click="showEstateTypePicker = true">
                Estate record
              </button>
              <button
                type="button"
                class="btn btn-outline btn-xs w-full mt-1"
                :disabled="!selectedBudgetId"
                @click="openAddBudgetItem"
              >
                Budget item
              </button>
            </div>

            <div
              v-for="group in paletteGroups"
              :key="group.name"
              class="account-map-palette__group"
              :class="{ 'account-map-palette__group--open': isPaletteGroupOpen(group.name) }"
            >
              <button
                type="button"
                class="account-map-palette__group-toggle"
                :aria-expanded="isPaletteGroupOpen(group.name)"
                @click="togglePaletteGroup(group.name)"
              >
                <span>{{ group.name }}</span>
                <span class="account-map-palette__group-meta">
                  {{ group.items.length }}
                  <span class="account-map-palette__chevron" aria-hidden="true">▾</span>
                </span>
              </button>
              <div v-show="isPaletteGroupOpen(group.name)" class="account-map-palette__group-body">
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  class="account-map-palette__item"
                  draggable="true"
                  @dragstart="onPaletteDragStart($event, item)"
                  @click="placeNode(item)"
                >
                  <span class="account-map-palette__item-label">{{ item.label }}</span>
                  <span v-if="item.amountLabel" class="account-map-palette__item-amt">{{ item.amountLabel }}</span>
                </button>
                <p v-if="!group.items.length" class="account-map-palette__empty">None yet</p>
              </div>
            </div>
          </div>
        </aside>

        <section
          ref="canvasWrapRef"
          class="account-map-canvas-wrap"
          @dragover.prevent
          @drop="onCanvasDrop"
          @pointermove="trackPointer"
        >
          <ClientOnly>
            <LazyAccountMapFlow
              v-if="selectedBudgetId != null"
              v-model:nodes="nodes"
              v-model:edges="edges"
              :node-types="nodeTypes"
              :default-edge-options="defaultEdgeOptions"
              @connect="onConnect"
              @edge-click="onEdgeClick"
              @node-click="onNodeClick"
              @pane-click="closePanels"
              @node-drag-stop="onNodesDragStop"
            />
          </ClientOnly>

          <div
            v-if="selectedNode"
            class="account-map-edge-panel"
            :style="nodePanelStyle"
          >
            <p class="text-sm font-semibold truncate">{{ selectedNode.label }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ selectedNode.group }} · on this map only</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary btn-xs" :disabled="editBusy" @click="editSelectedNode">
                {{ editBusy ? "…" : "Edit" }}
              </button>
              <button type="button" class="btn btn-error btn-xs" @click="removeSelectedNodeFromMap">
                Remove
              </button>
              <button type="button" class="btn btn-ghost btn-xs" @click="closeNodePanel">Close</button>
            </div>
          </div>

          <div
            v-if="selectedEdge"
            class="account-map-edge-panel"
            :style="edgePanelStyle"
          >
            <p class="text-sm font-semibold">Connection type</p>
            <p class="text-xs text-gray-500 mt-0.5 truncate">{{ selectedEdge.label || selectedEdge.edge_kind }}</p>
            <div class="account-map-edge-kinds mt-2">
              <button
                v-for="k in edgeKindOptions"
                :key="k.value"
                type="button"
                class="account-map-edge-kind"
                :class="{ 'account-map-edge-kind--active': selectedEdgeKind === k.value }"
                :title="k.description"
                @click="selectEdgeKind(k.value)"
              >
                {{ k.label }}
              </button>
            </div>
            <div class="mt-3 flex gap-2">
              <button type="button" class="btn btn-error btn-xs" :disabled="deletingEdge" @click="deleteSelectedEdge">
                {{ deletingEdge ? "..." : "Delete" }}
              </button>
              <button type="button" class="btn btn-ghost btn-xs" @click="closeEdgePanel">Close</button>
            </div>
          </div>
        </section>
      </div>

      <div
        v-if="showEstateTypePicker"
        class="account-map-modal-backdrop"
        @click.self="showEstateTypePicker = false"
      >
        <div class="account-map-modal">
          <h2 class="text-sm font-semibold">Add estate record</h2>
          <p class="text-xs text-gray-500 mt-1">Choose a record type to create.</p>
          <div class="mt-3 flex flex-col gap-1.5">
            <button
              v-for="opt in estateTypeOptions"
              :key="opt.value"
              type="button"
              class="btn btn-ghost btn-sm justify-start"
              @click="openAddEstateRecord(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
          <div class="mt-3 flex justify-end">
            <button type="button" class="btn btn-ghost btn-xs" @click="showEstateTypePicker = false">Cancel</button>
          </div>
        </div>
      </div>

      <LazyAddBudgetItemModal
        v-if="modalsMounted.addBudget"
        ref="addBudgetModalRef"
        :budget-id="selectedBudgetId"
        @created="onBudgetItemCreated"
      />
      <LazyAddEstateRecordModal
        v-if="modalsMounted.addEstate"
        ref="addEstateModalRef"
        @created="onEstateRecordCreated"
      />
      <LazyEditBudgetItemModal
        v-if="modalsMounted.editBudget"
        ref="editBudgetModalRef"
        :budget-id="selectedBudgetId"
        @saved="onBudgetItemEdited"
      />
      <LazyEditEstateRecordModal
        v-if="modalsMounted.editEstate"
        ref="editEstateModalRef"
        @saved="onEstateRecordEdited"
        @deleted="onEstateRecordEdited"
      />
    </template>
  </main>
</template>

<script setup>
import { markRaw, nextTick } from "vue";
import AccountMapNode from "~/components/AccountMapNode.vue";

useHead({ title: "Account Map" });

const auth = useAuthStore();
const { isNarrow } = useMobileShell();
const { go } = useAppNavigate();

watch(
  isNarrow,
  (narrow) => {
    if (narrow) void go("/financial", { replace: true });
  },
  { immediate: true },
);

const loading = ref(true);
const error = ref("");
const savingLayout = ref(false);
const deletingEdge = ref(false);
const editBusy = ref(false);
const budgetBusy = ref(false);
const budgets = ref([]);
const selectedBudgetId = ref(null);
const showCreateBudget = ref(false);
const newBudgetName = ref("");
const copyFromBudgetId = ref(null);
const showApplyMonths = ref(false);
const applyMonthsYear = ref(new Date().getFullYear());
const applyMonthsSelected = ref([]);
const applyMonthsError = ref("");
const selectedBudgetAssignments = ref([]);
const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const applyYearOptions = computed(() => {
  const years = [];
  for (let y = 2026; y <= 2032; y++) years.push(y);
  return years;
});
const showEstateTypePicker = ref(false);
const addBudgetModalRef = ref(null);
const addEstateModalRef = ref(null);
const editBudgetModalRef = ref(null);
const editEstateModalRef = ref(null);
const modalsMounted = reactive({
  addBudget: false,
  addEstate: false,
  editBudget: false,
  editEstate: false,
});

async function ensureModal(key) {
  if (!modalsMounted[key]) {
    modalsMounted[key] = true;
    await nextTick();
  }
}
const paletteCollapsed = ref(true);
const openPaletteGroups = ref({ Estate: true, Budget: true });
const rawNodes = ref([]);
const mapEdges = ref([]);
const nodes = ref([]);
const edges = ref([]);
const selectedEdge = ref(null);
const selectedEdgeKind = ref("transfer");
const selectedNode = ref(null);
const edgePanelPos = ref({ x: 16, y: 16 });
const nodePanelPos = ref({ x: 16, y: 16 });
const canvasWrapRef = ref(null);
const lastPointer = ref(null);
const placedIds = ref(new Set());
const hiddenIds = ref(new Set());
const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 260;

const selectedBudget = computed(() => {
  const id = Number(selectedBudgetId.value);
  return budgets.value.find((b) => Number(b.budget_id) === id) || null;
});
const selectedIsActive = computed(() => Boolean(selectedBudget.value?.is_active));

function budgetBody(extra = {}) {
  return { ...extra, budget_id: Number(selectedBudgetId.value) };
}

const nodeTypes = {
  account: markRaw(AccountMapNode),
};

const defaultEdgeOptions = {
  animated: false,
  type: "smoothstep",
  style: { stroke: "#64748b", strokeWidth: 1.5 },
  labelStyle: { fill: "#475569", fontSize: 10, fontWeight: 600 },
  labelBgStyle: { fill: "#f8fafc" },
  labelBgPadding: [4, 2],
  labelBgBorderRadius: 4,
};

const edgeKindOptions = [
  { value: "flow", label: "flow", description: "Pre and post tax contributions from gross income" },
  { value: "deposit", label: "deposit", description: "Money deposited from income subtype (interest)" },
  { value: "transfer", label: "transfer", description: "Money moved between two accounts" },
  { value: "secures", label: "secures", description: "The asset tied to debt" },
  { value: "purchase", label: "purchase", description: "Credit or checking purchases" },
  { value: "refund", label: "refund", description: "Money returned from a purchase" },
  { value: "debt_payment", label: "debt payment", description: "Payments to credit cards or loans" },
];

const estateTypeOptions = [
  { value: "asset", label: "Asset inventory" },
  { value: "vehicle", label: "Vehicle" },
  { value: "cash", label: "Cash or investment" },
  { value: "debt", label: "Debt" },
  { value: "real_estate", label: "Real estate" },
  { value: "insurance", label: "Insurance" },
];

const edgePanelStyle = computed(() => ({
  left: `${edgePanelPos.value.x}px`,
  top: `${edgePanelPos.value.y}px`,
}));

const nodePanelStyle = computed(() => ({
  left: `${nodePanelPos.value.x}px`,
  top: `${nodePanelPos.value.y}px`,
}));

function clampPanelPosition(x, y) {
  const wrap = canvasWrapRef.value;
  const width = wrap?.clientWidth || 640;
  const height = wrap?.clientHeight || 480;
  return {
    x: Math.min(Math.max(8, x), Math.max(8, width - PANEL_WIDTH - 8)),
    y: Math.min(Math.max(8, y), Math.max(8, height - PANEL_HEIGHT - 8)),
  };
}

function setPanelNearPoint(clientX, clientY, target = "edge") {
  const wrap = canvasWrapRef.value;
  if (!wrap) {
    const fallback = { x: 16, y: 16 };
    if (target === "node") nodePanelPos.value = fallback;
    else edgePanelPos.value = fallback;
    return;
  }
  const bounds = wrap.getBoundingClientRect();
  const pos = clampPanelPosition(clientX - bounds.left + 12, clientY - bounds.top + 12);
  if (target === "node") nodePanelPos.value = pos;
  else edgePanelPos.value = pos;
}

function trackPointer(event) {
  lastPointer.value = { clientX: event.clientX, clientY: event.clientY };
}

function openEdgePanel(edge, point) {
  closeNodePanel();
  selectedEdge.value = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? edge.data?.sourceHandle,
    targetHandle: edge.targetHandle ?? edge.data?.targetHandle,
    edge_kind: edge.edge_kind || edge.data?.edge_kind || "transfer",
    persistence: edge.persistence || edge.data?.persistence,
    freeform_edge_id: edge.freeform_edge_id ?? edge.data?.freeform_edge_id,
    label: edge.label || edge.data?.label,
  };
  selectedEdgeKind.value = selectedEdge.value.edge_kind;
  const anchor = point?.clientX != null ? point : lastPointer.value;
  if (anchor?.clientX != null && anchor?.clientY != null) {
    setPanelNearPoint(anchor.clientX, anchor.clientY, "edge");
  } else {
    edgePanelPos.value = { x: 16, y: 16 };
  }
}

function closeEdgePanel() {
  selectedEdge.value = null;
}

function closeNodePanel() {
  selectedNode.value = null;
}

function closePanels() {
  closeEdgePanel();
  closeNodePanel();
}

function onNodeClick({ event, node }) {
  if (!node) return;
  closeEdgePanel();
  selectedNode.value = {
    id: node.id,
    label: node.data?.label || node.id,
    group: node.data?.group || "",
    nodeType: node.data?.nodeType || "",
    recordId: node.data?.recordId ?? null,
  };
  const anchor = event?.clientX != null ? event : lastPointer.value;
  if (anchor?.clientX != null && anchor?.clientY != null) {
    setPanelNearPoint(anchor.clientX, anchor.clientY, "node");
  } else {
    nodePanelPos.value = { x: 16, y: 16 };
  }
}

const ESTATE_EDIT_TYPE = {
  asset_inventory: "asset",
  asset_vehicles: "vehicle",
  cash_and_investments: "cash",
  debt: "debt",
  real_estate: "real_estate",
  insurance: "insurance",
};

const ESTATE_LIST_API = {
  asset_inventory: { path: "/api/records/asset-inventory", idKey: "ai_id" },
  asset_vehicles: { path: "/api/records/asset-vehicles", idKey: "vh_id" },
  cash_and_investments: { path: "/api/records/cash-and-investments", idKey: "ci_id" },
  debt: { path: "/api/records/debt", idKey: "dbt_id" },
  real_estate: { path: "/api/records/real-estate", idKey: "re_id" },
  insurance: { path: "/api/records/insurance", idKey: "ins_id" },
};

async function editSelectedNode() {
  if (!selectedNode.value) return;
  const { nodeType, recordId, group } = selectedNode.value;
  if (!nodeType || recordId == null) {
    error.value = "Cannot edit this record.";
    return;
  }
  editBusy.value = true;
  error.value = "";
  try {
    if (group === "Budget" || nodeType === "income" || nodeType === "expense") {
      const data = await $fetch("/api/budget/list", {
        query: selectedBudgetId.value != null ? { budget_id: selectedBudgetId.value } : undefined,
      });
      const list = nodeType === "income" ? data?.income ?? [] : data?.expenses ?? [];
      const item = list.find((row) => Number(row.id) === Number(recordId));
      if (!item) throw new Error("Budget item not found.");
      closeNodePanel();
      await ensureModal("editBudget");
      editBudgetModalRef.value?.open(item, nodeType);
      return;
    }

    const cfg = ESTATE_LIST_API[nodeType];
    const editType = ESTATE_EDIT_TYPE[nodeType];
    if (!cfg || !editType) {
      error.value = "Editing is not supported for this record type.";
      return;
    }
    const data = await $fetch(cfg.path);
    const records = data?.records ?? data ?? [];
    const record = (Array.isArray(records) ? records : []).find(
      (row) => Number(row[cfg.idKey]) === Number(recordId),
    );
    if (!record) throw new Error("Estate record not found.");
    closeNodePanel();
    await ensureModal("editEstate");
    editEstateModalRef.value?.open(editType, record);
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.data?.message || e?.message || "Failed to open editor.";
  } finally {
    editBusy.value = false;
  }
}

async function onBudgetItemEdited() {
  await loadMap();
}

async function onEstateRecordEdited() {
  await loadMap();
}

function removeSelectedNodeFromMap() {
  if (!selectedNode.value) return;
  const id = selectedNode.value.id;
  nodes.value = nodes.value.filter((n) => n.id !== id);
  edges.value = edges.value.filter((e) => e.source !== id && e.target !== id);
  const nextPlaced = new Set(placedIds.value);
  nextPlaced.delete(id);
  placedIds.value = nextPlaced;
  const nextHidden = new Set(hiddenIds.value);
  nextHidden.add(id);
  hiddenIds.value = nextHidden;
  closeNodePanel();
  void saveLayout();
}

async function selectEdgeKind(kind) {
  if (!selectedEdge.value || selectedEdgeKind.value === kind) return;
  selectedEdgeKind.value = kind;
  await recreateSelectedEdge();
}

function formatMoney(val) {
  if (val == null || val === "") return "";
  const n = Number(val);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function toFlowNode(item, position) {
  return {
    id: item.id,
    type: "account",
    position: position || { x: 80, y: 80 },
    data: {
      nodeType: item.type,
      group: item.group,
      label: item.label,
      subtitle: item.subtitle,
      amountLabel: item.amount != null ? formatMoney(item.amount) : "",
      recordId: item.recordId,
    },
  };
}

function toFlowEdge(edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? edge.data?.sourceHandle ?? "source-right",
    targetHandle: edge.targetHandle ?? edge.data?.targetHandle ?? "target-left",
    label: edge.label || edge.edge_kind,
    data: {
      edge_kind: edge.edge_kind,
      persistence: edge.persistence,
      freeform_edge_id: edge.freeform_edge_id,
      label: edge.label,
      sourceHandle: edge.sourceHandle ?? edge.data?.sourceHandle ?? "source-right",
      targetHandle: edge.targetHandle ?? edge.data?.targetHandle ?? "target-left",
    },
    ...defaultEdgeOptions,
  };
}

const paletteGroups = computed(() => {
  const placed = placedIds.value;
  const estate = rawNodes.value.filter((n) => n.group === "Estate" && !placed.has(n.id));
  const budget = rawNodes.value.filter((n) => n.group === "Budget" && !placed.has(n.id));
  const withLabels = (list) =>
    list.map((n) => ({
      ...n,
      amountLabel: n.amount != null ? formatMoney(n.amount) : "",
    }));
  return [
    { name: "Estate", items: withLabels(estate) },
    { name: "Budget", items: withLabels(budget) },
  ];
});

function isPaletteGroupOpen(name) {
  return !!openPaletteGroups.value[name];
}

function togglePaletteGroup(name) {
  openPaletteGroups.value = {
    ...openPaletteGroups.value,
    [name]: !openPaletteGroups.value[name],
  };
}

function defaultPositions(list) {
  const cols = 3;
  return Object.fromEntries(
    list.map((n, i) => [
      n.id,
      {
        x: 40 + (i % cols) * 240,
        y: 40 + Math.floor(i / cols) * 120,
      },
    ]),
  );
}

function applyGraph(payload) {
  rawNodes.value = payload?.nodes ?? [];
  const layoutPositions = payload?.layout?.positions || {};
  const savedHandles =
    payload?.layout?.edgeHandles && typeof payload.layout.edgeHandles === "object"
      ? payload.layout.edgeHandles
      : {};
  const hidden = new Set(
    Array.isArray(payload?.layout?.hidden) ? payload.layout.hidden.map(String) : [],
  );
  hiddenIds.value = hidden;

  mapEdges.value = (payload?.edges ?? []).map((e) => {
    const handles = savedHandles[e.id] || {};
    return {
      ...e,
      sourceHandle: handles.sourceHandle || e.sourceHandle || "source-right",
      targetHandle: handles.targetHandle || e.targetHandle || "target-left",
    };
  });

  const connected = new Set();
  for (const e of mapEdges.value) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const defaults = defaultPositions(rawNodes.value);
  const hasSavedLayout = Object.keys(layoutPositions).length > 0 || hidden.size > 0;
  const initialIds = new Set(
    hasSavedLayout
      ? Object.keys(layoutPositions)
      : [...connected, ...rawNodes.value.slice(0, 12).map((n) => n.id)],
  );
  if (!hasSavedLayout) {
    for (const id of connected) initialIds.add(id);
  }
  for (const id of hidden) initialIds.delete(id);

  const byId = Object.fromEntries(rawNodes.value.map((n) => [n.id, n]));
  const nextNodes = [];
  for (const id of initialIds) {
    const item = byId[id];
    if (!item) continue;
    nextNodes.push(toFlowNode(item, layoutPositions[id] || defaults[id]));
  }
  const placed = new Set(nextNodes.map((n) => n.id));
  nodes.value = nextNodes;
  edges.value = mapEdges.value
    .filter((e) => placed.has(e.source) && placed.has(e.target))
    .map(toFlowEdge);
  placedIds.value = placed;
}

function placeNode(item, position) {
  if (placedIds.value.has(item.id)) return;
  const pos = position || {
    x: 60 + (nodes.value.length % 4) * 220,
    y: 60 + Math.floor(nodes.value.length / 4) * 110,
  };
  nodes.value = [...nodes.value, toFlowNode(item, pos)];
  placedIds.value = new Set([...placedIds.value, item.id]);
  if (hiddenIds.value.has(item.id)) {
    const nextHidden = new Set(hiddenIds.value);
    nextHidden.delete(item.id);
    hiddenIds.value = nextHidden;
  }
  // Restore edges that touch this node once both ends are on the map
  const placed = placedIds.value;
  edges.value = mapEdges.value
    .filter((e) => placed.has(e.source) && placed.has(e.target))
    .map(toFlowEdge);
  void saveLayout();
}

async function openAddBudgetItem() {
  await ensureModal("addBudget");
  addBudgetModalRef.value?.open();
}

async function openAddEstateRecord(type) {
  showEstateTypePicker.value = false;
  await ensureModal("addEstate");
  addEstateModalRef.value?.open(type);
}

async function placeCreatedRecord(nodeType, id) {
  if (!nodeType || id == null || !Number.isFinite(Number(id))) {
    await loadMap();
    return;
  }
  const key = `${nodeType}:${Number(id)}`;
  await loadMap();
  const item = rawNodes.value.find((n) => n.id === key);
  if (item) placeNode(item);
}

async function onBudgetItemCreated(payload) {
  await placeCreatedRecord(payload?.type, payload?.id);
}

async function onEstateRecordCreated(payload) {
  await placeCreatedRecord(payload?.type, payload?.id);
}

async function loadBudgets() {
  const data = await $fetch("/api/budgets");
  budgets.value = data?.budgets ?? [];
  const activeId = data?.active_budget_id ?? budgets.value.find((b) => b.is_active)?.budget_id ?? null;
  if (
    selectedBudgetId.value == null ||
    !budgets.value.some((b) => b.budget_id === selectedBudgetId.value)
  ) {
    selectedBudgetId.value = activeId ?? budgets.value[0]?.budget_id ?? null;
  }
}

async function loadMap() {
  loading.value = true;
  error.value = "";
  closePanels();
  try {
    await loadBudgets();
    if (!selectedBudgetId.value) {
      rawNodes.value = [];
      mapEdges.value = [];
      nodes.value = [];
      edges.value = [];
      placedIds.value = new Set();
      hiddenIds.value = new Set();
      return;
    }
    const data = await $fetch("/api/account-map", {
      query: { budget_id: selectedBudgetId.value },
    });
    try {
      applyGraph(data);
    } catch (graphErr) {
      console.error("account map applyGraph failed", graphErr);
      throw graphErr;
    }
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to load account map.";
  } finally {
    loading.value = false;
  }
}

async function selectBudget(budgetId) {
  const next = Number(budgetId);
  if (!Number.isFinite(next) || next === selectedBudgetId.value) return;
  selectedBudgetId.value = next;
  loading.value = true;
  error.value = "";
  closePanels();
  try {
    const data = await $fetch("/api/account-map", {
      query: { budget_id: selectedBudgetId.value },
    });
    try {
      applyGraph(data);
    } catch (graphErr) {
      console.error("account map applyGraph failed", graphErr);
      throw graphErr;
    }
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to load account map.";
  } finally {
    loading.value = false;
  }
}

function openCreateBudget() {
  newBudgetName.value = "";
  copyFromBudgetId.value = selectedBudgetId.value;
  showCreateBudget.value = true;
}

async function createBudget() {
  const name = newBudgetName.value.trim();
  if (!name) {
    error.value = "Budget name is required.";
    return;
  }
  budgetBusy.value = true;
  error.value = "";
  try {
    const body = { name };
    if (copyFromBudgetId.value != null && copyFromBudgetId.value !== "") {
      body.copy_from_budget_id = Number(copyFromBudgetId.value);
    }
    const res = await $fetch("/api/budgets", { method: "POST", body });
    showCreateBudget.value = false;
    selectedBudgetId.value = res?.budget?.budget_id ?? selectedBudgetId.value;
    await loadMap();
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to create budget.";
  } finally {
    budgetBusy.value = false;
  }
}

async function renameSelectedBudget() {
  if (!selectedBudget.value) return;
  const name = window.prompt("Rename budget", selectedBudget.value.name);
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    error.value = "Budget name is required.";
    return;
  }
  budgetBusy.value = true;
  error.value = "";
  try {
    await $fetch(`/api/budgets/${selectedBudget.value.budget_id}`, {
      method: "PUT",
      body: { name: trimmed },
    });
    await loadBudgets();
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to rename budget.";
  } finally {
    budgetBusy.value = false;
  }
}

async function activateSelectedBudget() {
  if (!selectedBudget.value || selectedBudget.value.is_active) return;
  budgetBusy.value = true;
  error.value = "";
  try {
    await $fetch(`/api/budgets/${selectedBudget.value.budget_id}/activate`, { method: "POST" });
    await loadBudgets();
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to activate budget.";
  } finally {
    budgetBusy.value = false;
  }
}

async function loadAssignmentsForSelectedBudget() {
  if (!selectedBudgetId.value) {
    selectedBudgetAssignments.value = [];
    return;
  }
  try {
    const data = await $fetch("/api/budgets/month-assignments", {
      query: { budget_id: selectedBudgetId.value, year: applyMonthsYear.value },
    });
    selectedBudgetAssignments.value = data?.assignments ?? [];
    applyMonthsSelected.value = selectedBudgetAssignments.value.map((a) => a.month);
  } catch (e) {
    applyMonthsError.value = e?.data?.statusMessage || e?.message || "Failed to load month assignments.";
    selectedBudgetAssignments.value = [];
  }
}

async function openApplyMonths() {
  if (!selectedBudget.value) return;
  applyMonthsError.value = "";
  const y = new Date().getFullYear();
  applyMonthsYear.value = y >= 2026 && y <= 2032 ? y : 2026;
  applyMonthsSelected.value = [];
  showApplyMonths.value = true;
  await loadAssignmentsForSelectedBudget();
}

async function applySelectedMonths() {
  if (!selectedBudget.value || !applyMonthsSelected.value.length) return;
  budgetBusy.value = true;
  applyMonthsError.value = "";
  try {
    const months = [...new Set(applyMonthsSelected.value.map(Number))].filter((m) => m >= 1 && m <= 12);
    await Promise.all(
      months.map((month) =>
        $fetch("/api/budgets/month-assignment", {
          method: "PUT",
          body: {
            year: applyMonthsYear.value,
            month,
            budget_id: selectedBudget.value.budget_id,
          },
        }),
      ),
    );
    // Clear months in this year that were previously assigned but unchecked
    const previously = new Set(selectedBudgetAssignments.value.map((a) => a.month));
    const keep = new Set(months);
    const toClear = [...previously].filter((m) => !keep.has(m));
    await Promise.all(
      toClear.map((month) =>
        $fetch("/api/budgets/month-assignment", {
          method: "DELETE",
          query: { year: applyMonthsYear.value, month },
        }),
      ),
    );
    await loadAssignmentsForSelectedBudget();
  } catch (e) {
    applyMonthsError.value = e?.data?.statusMessage || e?.message || "Failed to apply budget to months.";
  } finally {
    budgetBusy.value = false;
  }
}

async function clearMonthAssignment(year, month) {
  budgetBusy.value = true;
  applyMonthsError.value = "";
  try {
    await $fetch("/api/budgets/month-assignment", {
      method: "DELETE",
      query: { year, month },
    });
    await loadAssignmentsForSelectedBudget();
  } catch (e) {
    applyMonthsError.value = e?.data?.statusMessage || e?.message || "Failed to clear month assignment.";
  } finally {
    budgetBusy.value = false;
  }
}

async function deleteSelectedBudget() {
  if (!selectedBudget.value || selectedBudget.value.is_active) return;
  if (!window.confirm(`Delete budget “${selectedBudget.value.name}”? Its plan lines and map will be removed.`)) {
    return;
  }
  budgetBusy.value = true;
  error.value = "";
  try {
    await $fetch(`/api/budgets/${selectedBudget.value.budget_id}`, { method: "DELETE" });
    selectedBudgetId.value = null;
    await loadMap();
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to delete budget.";
  } finally {
    budgetBusy.value = false;
  }
}

function onPaletteDragStart(event, item) {
  event.dataTransfer?.setData("application/account-map-node", item.id);
  event.dataTransfer.effectAllowed = "copy";
}

function onCanvasDrop(event) {
  const id = event.dataTransfer?.getData("application/account-map-node");
  if (!id) return;
  const item = rawNodes.value.find((n) => n.id === id);
  if (!item) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const position = {
    x: Math.max(20, event.clientX - bounds.left - 90),
    y: Math.max(20, event.clientY - bounds.top - 30),
  };
  placeNode(item, position);
}

async function onConnect(connection) {
  if (!connection?.source || !connection?.target || !selectedBudgetId.value) return;
  try {
    const res = await $fetch("/api/account-map/edges", {
      method: "POST",
      body: budgetBody({ source: connection.source, target: connection.target }),
    });
    if (res?.edge) {
      const withHandles = {
        ...res.edge,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      };
      mapEdges.value = [...mapEdges.value.filter((e) => e.id !== res.edge.id), withHandles];
      edges.value = [...edges.value.filter((e) => e.id !== res.edge.id), toFlowEdge(withHandles)];
      openEdgePanel(withHandles);
      void saveLayout();
    }
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to create connection.";
  }
}

function onEdgeClick({ event, edge }) {
  if (!edge) return;
  openEdgePanel(
    {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      edge_kind: edge.data?.edge_kind || "transfer",
      persistence: edge.data?.persistence,
      freeform_edge_id: edge.data?.freeform_edge_id,
      label: edge.data?.label || edge.label,
    },
    event,
  );
}

async function deleteSelectedEdge() {
  if (!selectedEdge.value) return;
  deletingEdge.value = true;
  try {
    await $fetch("/api/account-map/edges", {
      method: "DELETE",
      body: budgetBody({
        id: selectedEdge.value.id,
        persistence: selectedEdge.value.persistence,
        freeform_edge_id: selectedEdge.value.freeform_edge_id,
        source: selectedEdge.value.source,
        target: selectedEdge.value.target,
      }),
    });
    edges.value = edges.value.filter((e) => e.id !== selectedEdge.value.id);
    mapEdges.value = mapEdges.value.filter((e) => e.id !== selectedEdge.value.id);
    closeEdgePanel();
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to delete connection.";
  } finally {
    deletingEdge.value = false;
  }
}

async function recreateSelectedEdge() {
  if (!selectedEdge.value) return;
  const prev = selectedEdge.value;
  const panel = { ...edgePanelPos.value };
  try {
    await $fetch("/api/account-map/edges", {
      method: "DELETE",
      body: budgetBody({
        id: prev.id,
        persistence: prev.persistence,
        freeform_edge_id: prev.freeform_edge_id,
        source: prev.source,
        target: prev.target,
      }),
    });
    const res = await $fetch("/api/account-map/edges", {
      method: "POST",
      body: budgetBody({
        source: prev.source,
        target: prev.target,
        edge_kind: selectedEdgeKind.value,
      }),
    });
    edges.value = edges.value.filter((e) => e.id !== prev.id);
    mapEdges.value = mapEdges.value.filter((e) => e.id !== prev.id);
    if (res?.edge) {
      const withHandles = {
        ...res.edge,
        sourceHandle: prev.sourceHandle ?? prev.data?.sourceHandle,
        targetHandle: prev.targetHandle ?? prev.data?.targetHandle,
      };
      edges.value = [...edges.value, toFlowEdge(withHandles)];
      mapEdges.value = [...mapEdges.value, withHandles];
      openEdgePanel(withHandles);
      edgePanelPos.value = panel;
      void saveLayout();
    }
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to update connection.";
  }
}

function currentLayoutPayload() {
  const positions = {};
  for (const n of nodes.value) {
    positions[n.id] = { x: n.position.x, y: n.position.y };
  }
  const edgeHandles = {};
  for (const e of edges.value) {
    const sourceHandle = e.sourceHandle ?? e.data?.sourceHandle;
    const targetHandle = e.targetHandle ?? e.data?.targetHandle;
    if (sourceHandle || targetHandle) {
      edgeHandles[e.id] = {
        sourceHandle: sourceHandle || "source-right",
        targetHandle: targetHandle || "target-left",
      };
    }
  }
  // Keep handles for edges not currently on the canvas (hidden nodes)
  for (const e of mapEdges.value) {
    if (edgeHandles[e.id]) continue;
    const sourceHandle = e.sourceHandle ?? e.data?.sourceHandle;
    const targetHandle = e.targetHandle ?? e.data?.targetHandle;
    if (sourceHandle || targetHandle) {
      edgeHandles[e.id] = {
        sourceHandle: sourceHandle || "source-right",
        targetHandle: targetHandle || "target-left",
      };
    }
  }
  return {
    positions,
    hidden: [...hiddenIds.value],
    edgeHandles,
  };
}

async function saveLayout() {
  savingLayout.value = true;
  try {
    await $fetch("/api/account-map/layout", {
      method: "PUT",
      body: budgetBody({ layout: currentLayoutPayload() }),
    });
  } catch (e) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to save layout.";
  } finally {
    savingLayout.value = false;
  }
}

function onNodesDragStop() {
  // Soft autosave layout after drag
  void saveLayout();
}

function autoLayout() {
  const defaults = defaultPositions(nodes.value.map((n) => ({ id: n.id })));
  nodes.value = nodes.value.map((n) => ({
    ...n,
    position: defaults[n.id] || n.position,
  }));
  void saveLayout();
}

watch(
  () => Boolean(auth.ready && auth.user) && !isNarrow.value,
  (ok) => {
    if (ok) void loadMap();
    else if (auth.ready) loading.value = false;
  },
  { immediate: true },
);
</script>

<style scoped>
.account-map-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 4rem);
}

.account-map-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
}

.account-map-body {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.account-map-palette-backdrop {
  position: absolute;
  inset: 0;
  z-index: 6;
  border: none;
  margin: 0;
  padding: 0;
  background: color-mix(in srgb, var(--color-base-content, #151616) 28%, transparent);
  cursor: pointer;
}

.account-map-palette {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 7;
  width: min(16rem, 88vw);
  border-right: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 14%, transparent);
  padding: 0.75rem;
  overflow: auto;
  background: color-mix(in srgb, var(--color-base-200, #f1f5f9) 55%, var(--color-base-100, #ffffff));
  box-shadow: 8px 0 24px color-mix(in srgb, var(--color-base-content, #151616) 12%, transparent);
  transform: translateX(-105%);
  transition: transform 0.22s ease;
  pointer-events: none;
}

.account-map-palette--open {
  transform: translateX(0);
  pointer-events: auto;
}

.account-map-palette__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.account-map-palette__heading {
  min-width: 0;
}

.account-map-palette__title {
  font-size: 0.875rem;
  font-weight: 700;
}

.account-map-palette__hint {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: color-mix(in srgb, var(--color-base-content, #151616) 55%, transparent);
}

.account-map-palette__toggle,
.account-map-palette-rail {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: unset !important;
  min-width: unset !important;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 16%, transparent);
  border-radius: 0.375rem;
  background: var(--color-base-100, #ffffff);
  color: var(--color-base-content, #151616);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.account-map-palette__toggle:hover,
.account-map-palette-rail:hover {
  background: color-mix(in srgb, var(--color-base-content, #151616) 6%, transparent);
}

.account-map-palette-rail {
  position: absolute;
  top: 0.75rem;
  left: 0;
  z-index: 5;
  width: 2.25rem;
  height: auto;
  min-height: 5.5rem;
  flex-direction: column;
  gap: 0.65rem;
  border-radius: 0 0.5rem 0.5rem 0;
  border-left: none;
  padding: 0.65rem 0.25rem;
  box-shadow: 2px 2px 10px color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
}

.account-map-palette-rail__label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.account-map-palette__group {
  margin-top: 0.875rem;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 12%, transparent);
  border-radius: 0.375rem;
  background: var(--color-base-100, #ffffff);
  overflow: hidden;
}

.account-map-palette__group-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: unset !important;
  min-width: unset !important;
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 0.45rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--color-base-content, #151616) 70%, transparent);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.account-map-palette__group-toggle:hover {
  background: color-mix(in srgb, var(--color-base-content, #151616) 5%, transparent);
}

.account-map-palette__group-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-variant-numeric: tabular-nums;
}

.account-map-palette__chevron {
  display: inline-block;
  transition: transform 0.15s ease;
}

.account-map-palette__group:not(.account-map-palette__group--open) .account-map-palette__chevron {
  transform: rotate(-90deg);
}

.account-map-palette__group-body {
  padding: 0 0.45rem 0.45rem;
  border-top: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 8%, transparent);
}

.account-map-palette__add h3 {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--color-base-content, #151616) 55%, transparent);
  margin-bottom: 0.375rem;
}

.account-map-palette__item {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  text-align: left;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 12%, transparent);
  border-radius: 0.375rem;
  background: var(--color-base-100, #ffffff);
  padding: 0.375rem 0.5rem;
  margin-top: 0.375rem;
  margin-bottom: 0;
  cursor: grab;
  font-size: 0.75rem;
}

.account-map-palette__item:active {
  cursor: grabbing;
}

.account-map-palette__item-label {
  font-weight: 600;
  line-height: 1.25;
}

.account-map-palette__item-amt {
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--color-base-content, #151616) 62%, transparent);
  white-space: nowrap;
}

.account-map-palette__empty {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  font-style: italic;
  color: color-mix(in srgb, var(--color-base-content, #151616) 50%, transparent);
}

.account-map-palette__add {
  margin: 0 0 0.875rem;
  padding: 0 0 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
}

.account-map-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.account-map-budget-menu {
  position: relative;
}

.account-map-budget-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-height: unset !important;
  min-width: unset !important;
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 16%, transparent);
  border-radius: 0.5rem;
  background: var(--color-base-100, #ffffff);
  padding: 0.4rem 0.7rem;
  color: var(--color-base-content, #151616);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.account-map-budget-menu__trigger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-base-content, #151616) 4%, var(--color-base-100, #ffffff));
}

.account-map-budget-menu__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.account-map-budget-menu__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.05rem;
  min-width: 8.5rem;
  text-align: left;
}

.account-map-budget-menu__label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-base-content, #151616) 55%, transparent);
}

.account-map-budget-menu__value {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.2;
}

.account-map-budget-menu__chevron {
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--color-base-content, #151616) 55%, transparent);
}

.account-map-budget-menu__panel {
  position: absolute;
  right: 0;
  z-index: 30;
  margin-top: 0.4rem;
  width: 15.5rem;
  origin: top right;
  border-radius: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 12%, transparent);
  background: var(--color-base-100, #ffffff);
  padding: 0.375rem;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
  outline: none;
}

.account-map-budget-menu__section {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.account-map-budget-menu__section-label {
  padding: 0.35rem 0.65rem 0.2rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-base-content, #151616) 50%, transparent);
}

.account-map-budget-menu__divider {
  height: 1px;
  margin: 0.35rem 0.35rem;
  background: color-mix(in srgb, var(--color-base-content, #151616) 12%, transparent);
}

.account-map-budget-menu__item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: unset !important;
  min-width: unset !important;
  margin: 0;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  padding: 0.45rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25rem;
  text-align: left;
  color: var(--color-base-content, #151616);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.account-map-budget-menu__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.account-map-budget-menu__item--active,
.account-map-budget-menu__item--selected {
  background: color-mix(in srgb, var(--color-base-content, #151616) 6%, transparent);
}

.account-map-budget-menu__item--selected {
  font-weight: 650;
}

.account-map-budget-menu__item--danger {
  color: var(--color-error, #dc2626);
}

.account-map-budget-menu__item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-map-budget-menu__item-tag {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #166534;
}

.account-map-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 35%, transparent);
  padding: 1rem;
}

.account-map-modal {
  width: min(22rem, 100%);
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 14%, transparent);
  background: var(--color-base-100, #ffffff);
  padding: 1rem;
  box-shadow: 0 12px 32px color-mix(in srgb, var(--color-base-content, #151616) 16%, transparent);
}

.account-map-modal--wide {
  width: min(28rem, 100%);
}

.account-map-canvas-wrap {
  position: relative;
  min-height: 28rem;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, #0284c7 8%, transparent), transparent 40%),
    var(--color-base-100, #ffffff);
}

.account-map-canvas {
  width: 100%;
  height: 100%;
  min-height: 28rem;
}

.account-map-edge-panel {
  position: absolute;
  z-index: 5;
  width: 13.75rem;
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 14%, transparent);
  border-radius: 0.5rem;
  background: var(--color-base-100, #ffffff);
  padding: 0.75rem;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-base-content, #151616) 12%, transparent);
}

.account-map-edge-kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.account-map-edge-kind {
  border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 16%, transparent);
  border-radius: 9999px;
  background: var(--color-base-100, #ffffff);
  color: var(--color-base-content, #151616);
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.25rem;
  cursor: pointer;
}

.account-map-edge-kind--active {
  border-color: var(--color-primary, #06b6d4);
  background: color-mix(in srgb, var(--color-primary, #06b6d4) 12%, var(--color-base-100, #ffffff));
  color: var(--color-primary, #06b6d4);
}
</style>
