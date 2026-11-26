/**
 * Ionicons name registry.
 *
 * Each name maps to { outline, filled }. Values are export names from
 * `ionicons/icons`, or `custom:<id>` for SVGs in CUSTOM_ICON_FILES.
 * Outline is the default. Filled is the selected tab and toggled states.
 * Sharp variants are never used.
 *
 * Legacy Lucide names (activity, landmark, circle-user, sparkles, church,
 * flame, star) stay valid so existing call sites keep working.
 */

export const CUSTOM_PREFIX = "custom:";

export const FALLBACK_EXPORT = "helpCircleOutline";

/** id → path from the repo root. The unit test checks these files exist. */
export const CUSTOM_ICON_FILES = {
  "church-outline": "assets/icons/church-outline.svg",
  "church-filled": "assets/icons/church-filled.svg",
};

const registry = {};

function addPair(name, outline, filled) {
  const entry = { outline, filled };
  registry[name] = entry;
  if (!name.endsWith("-outline")) registry[`${name}-outline`] = entry;
  return entry;
}

addPair("sparkles", "sparklesOutline", "sparkles");
addPair("wallet", "walletOutline", "wallet");
addPair("person-circle", "personCircleOutline", "personCircle");
addPair("fitness", "fitnessOutline", "fitness");
addPair("church", "custom:church-outline", "custom:church-filled");
addPair("flame", "flameOutline", "flame");
addPair("star", "starOutline", "star");

addPair("receipt", "receiptOutline", "receipt");
addPair("options", "optionsOutline", "options");
addPair("calculator", "calculatorOutline", "calculator");
addPair("home", "homeOutline", "home");
addPair("car-sport", "carSportOutline", "carSport");
addPair("document-text", "documentTextOutline", "documentText");
addPair("trending-up", "trendingUpOutline", "trendingUp");
addPair("git-network", "gitNetworkOutline", "gitNetwork");
addPair("sunny", "sunnyOutline", "sunny");
addPair("bookmark", "bookmarkOutline", "bookmark");
addPair("book", "bookOutline", "book");
addPair("moon", "moonOutline", "moon");
addPair("calendar-number", "calendarNumberOutline", "calendarNumber");
addPair("heart", "heartOutline", "heart");
addPair("checkmark-circle", "checkmarkCircleOutline", "checkmarkCircle");
addPair("calendar", "calendarOutline", "calendar");
addPair("nutrition", "nutritionOutline", "nutrition");
addPair("journal", "journalOutline", "journal");
addPair("barbell", "barbellOutline", "barbell");
addPair("bicycle", "bicycleOutline", "bicycle");
addPair("flash", "flashOutline", "flash");
addPair("body", "bodyOutline", "body");
addPair("leaf", "leafOutline", "leaf");
addPair("walk", "walkOutline", "walk");
addPair("person", "personOutline", "person");
addPair("people", "peopleOutline", "people");
addPair("diamond", "diamondOutline", "diamond");
addPair("notifications", "notificationsOutline", "notifications");
addPair("contrast", "contrastOutline", "contrast");
addPair("shield-checkmark", "shieldCheckmarkOutline", "shieldCheckmark");
addPair("help-circle", "helpCircleOutline", "helpCircle");
addPair("log-out", "logOutOutline", "logOut");
addPair("trash", "trashOutline", "trash");
addPair("add", "addOutline", "add");
addPair("create", "createOutline", "create");
addPair("ellipsis-horizontal", "ellipsisHorizontalOutline", "ellipsisHorizontal");
addPair("ellipsis-vertical", "ellipsisVerticalOutline", "ellipsisVertical");
addPair("chevron-forward", "chevronForwardOutline", "chevronForward");
addPair("chevron-back", "chevronBackOutline", "chevronBack");
addPair("chevron-down", "chevronDownOutline", "chevronDown");
addPair("chevron-up", "chevronUpOutline", "chevronUp");
addPair("close", "closeOutline", "close");
addPair("swap-vertical", "swapVerticalOutline", "swapVertical");
addPair("funnel", "funnelOutline", "funnel");
addPair("search", "searchOutline", "search");
addPair("cloud-upload", "cloudUploadOutline", "cloudUpload");
addPair("barcode", "barcodeOutline", "barcode");
addPair("cloud-offline", "cloudOfflineOutline", "cloudOffline");
addPair("refresh", "refreshOutline", "refresh");
addPair("eye", "eyeOutline", "eye");
addPair("open", "openOutline", "open");
addPair("download", "downloadOutline", "download");
addPair("reorder-two", "reorderTwoOutline", "reorderTwo");
addPair("remove", "removeOutline", "remove");
addPair("checkmark", "checkmark", "checkmark");
addPair("add-circle", "addCircleOutline", "addCircle");
addPair("remove-circle", "removeCircleOutline", "removeCircle");
addPair("school", "schoolOutline", "school");

registry.activity = registry.fitness;
registry.landmark = registry.wallet;
registry["circle-user"] = registry["person-circle"];

export const ICON_REGISTRY = registry;

export function eachIconSpec() {
  const specs = [];
  for (const entry of Object.values(ICON_REGISTRY)) {
    specs.push(entry.outline, entry.filled);
  }
  return specs;
}

/**
 * Resolve a call-site name. Unknown names report known: false and the
 * help-circle outline export. Blank names are unknown and have no export,
 * so the component can render nothing (the logged-out Login link).
 */
export function resolveIcon(name, filled = false) {
  const key = String(name || "");
  if (!key) return { known: false, exportName: null, customId: null };
  const entry = ICON_REGISTRY[key];
  const spec = entry ? (filled ? entry.filled : entry.outline) : FALLBACK_EXPORT;
  if (spec.startsWith(CUSTOM_PREFIX)) {
    return {
      known: Boolean(entry),
      exportName: null,
      customId: spec.slice(CUSTOM_PREFIX.length),
    };
  }
  return { known: Boolean(entry), exportName: spec, customId: null };
}

/**
 * Overflow menus: horizontal on iOS, vertical on Android and the web.
 * The web shell keeps the vertical glyph the menus already used.
 */
export function overflowIconName(platform) {
  return platform === "ios" ? "ellipsis-horizontal" : "ellipsis-vertical";
}
