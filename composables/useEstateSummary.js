/** Estate totals for dashboard / summary views (matches estate_mgmt.vue stats). */
import { parseFetchError } from "~/utils/parseFetchError";

export function useEstateSummary() {
  const auth = useAuthStore();
  const loading = ref(true);
  const loadError = ref("");
  const assetInventory = ref([]);
  const assetVehicles = ref([]);
  const cashAndInvestments = ref([]);
  const debt = ref([]);
  const realEstate = ref([]);

  function toNumber(val) {
    if (val == null || val === "") return NaN;
    if (typeof val === "number") return val;
    const s = String(val).replace(/[$,]/g, "").trim();
    return parseFloat(s) || NaN;
  }

  function formatMoney(val) {
    if (val == null || val === "") return "—";
    const n = toNumber(val);
    if (Number.isNaN(n)) return String(val);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  const sumByKey = (arr, key) => arr.reduce((a, r) => a + (toNumber(r[key]) || 0), 0);

  const totalAssetInventory = computed(() => sumByKey(assetInventory.value, "value"));
  const totalAssetVehicles = computed(() => sumByKey(assetVehicles.value, "value"));
  const totalHardAssets = computed(() => totalAssetInventory.value + totalAssetVehicles.value);

  const totalAssets = computed(() => {
    const sum = (arr, key) => arr.reduce((a, r) => a + (toNumber(r[key]) || 0), 0);
    return (
      sum(assetInventory.value, "value") +
      sum(assetVehicles.value, "value") +
      sum(cashAndInvestments.value, "value") +
      sum(realEstate.value, "value")
    );
  });

  const totalDebt = computed(() =>
    debt.value.reduce((a, r) => {
      const amt =
        toNumber(r.loan_ammount) ??
        toNumber(r.balance) ??
        toNumber(r.amount) ??
        toNumber(r.value) ??
        toNumber(r.balance_amt);
      return a + (amt || 0);
    }, 0),
  );

  const netWealth = computed(() => totalAssets.value - totalDebt.value);

  const estateStats = computed(() => [
    { name: "Assets", value: formatMoney(totalAssets.value) },
    { name: "Debt", value: formatMoney(totalDebt.value) },
    { name: "Hard Assets", value: formatMoney(totalHardAssets.value) },
    { name: "Net Wealth", value: formatMoney(netWealth.value) },
  ]);

  async function loadSummary() {
    if (!auth.user) return;
    loading.value = true;
    loadError.value = "";
    try {
      const [inv, vehicles, cash, debtRes, real] = await Promise.all([
        $fetch("/api/records/asset-inventory").then((d) => d?.records ?? []),
        $fetch("/api/records/asset-vehicles").then((d) => d?.records ?? []),
        $fetch("/api/records/cash-and-investments").then((d) => d?.records ?? []),
        $fetch("/api/records/debt").then((d) => d?.records ?? []),
        $fetch("/api/records/real-estate").then((d) => d?.records ?? []),
      ]);
      assetInventory.value = inv;
      assetVehicles.value = vehicles;
      cashAndInvestments.value = cash;
      debt.value = debtRes;
      realEstate.value = real;
    } catch (error) {
      console.error("Failed to load estate summary", error);
      loadError.value = parseFetchError(error, "Failed to load estate summary.");
      assetInventory.value = [];
      assetVehicles.value = [];
      cashAndInvestments.value = [];
      debt.value = [];
      realEstate.value = [];
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    loadError,
    estateStats,
    loadSummary,
  };
}
