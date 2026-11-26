import {
  calendarKindForProfile,
  calendarLabel,
  defaultFaithProfile,
  eveningLabel,
  eveningNoun,
  legacyFaithProfile,
} from "~/utils/faithProfile";
import { translationName } from "~/utils/bibleTranslations";

/** One request at a time across every component (the app is client-only: ssr is false). */
let pending = null;

/**
 * The signed-in user's Faith tradition setting, shared across the app.
 * Loaded once per signed-in user; `save` updates it everywhere.
 */
export function useFaithProfile() {
  const auth = useAuthStore();
  const state = useState("faith-profile", () => ({
    userId: null,
    profile: null,
    exists: false,
    unavailable: false,
    loading: false,
    error: "",
  }));

  const profile = computed(() => state.value.profile || defaultFaithProfile());
  const tradition = computed(() => profile.value.tradition);
  const loaded = computed(() => Boolean(state.value.profile) && state.value.userId === auth.user?.user_id);
  const needsChoice = computed(() => loaded.value && !state.value.exists && !state.value.unavailable);
  const calendarKind = computed(() => calendarKindForProfile(profile.value));
  const evening = computed(() => eveningLabel(tradition.value));
  const eveningWord = computed(() => eveningNoun(tradition.value));
  const calendarName = computed(() => calendarLabel(tradition.value));
  const translationLabel = computed(() => translationName(profile.value.translation));

  function apply(data) {
    state.value = {
      ...state.value,
      userId: auth.user?.user_id ?? null,
      profile: data?.profile || defaultFaithProfile(),
      exists: Boolean(data?.exists),
      unavailable: Boolean(data?.unavailable),
      error: "",
    };
  }

  async function load({ force = false } = {}) {
    if (!auth.user) return profile.value;
    if (!force && loaded.value) return profile.value;
    if (pending) return pending;
    state.value = { ...state.value, loading: true, error: "" };
    pending = $fetch("/api/spiritual/profile")
      .then((data) => {
        apply(data);
        return profile.value;
      })
      .catch((error) => {
        // Keep the app usable: behave as before the setting existed.
        state.value = {
          ...state.value,
          userId: auth.user?.user_id ?? null,
          profile: legacyFaithProfile(),
          exists: false,
          unavailable: true,
          error: error?.data?.statusMessage || error?.statusMessage || "Could not load faith settings.",
        };
        return profile.value;
      })
      .finally(() => {
        state.value = { ...state.value, loading: false };
        pending = null;
      });
    return pending;
  }

  async function save(patch) {
    const data = await $fetch("/api/spiritual/profile", { method: "PUT", body: patch });
    apply(data);
    return profile.value;
  }

  return {
    state,
    profile,
    tradition,
    loaded,
    needsChoice,
    calendarKind,
    evening,
    eveningWord,
    calendarName,
    translationLabel,
    load,
    save,
  };
}
