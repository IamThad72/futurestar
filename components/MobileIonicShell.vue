<template>
  <div
    class="mobile-ionic-shell"
    :class="{ 'mobile-ionic-shell--editing': textFieldFocused }"
  >
    <div id="main-content" class="ion-page">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <button
              type="button"
              class="mobile-brand"
              aria-label="Home"
              @click="go(homePath)"
            >
              <AppIcon name="star" :size="24" :stroke-width="1.75" class="mobile-brand__icon" />
            </button>
          </ion-buttons>
          <ion-title>{{ screenTitle }}</ion-title>
          <ion-buttons slot="end">
            <button
              v-if="!auth.user && !route.path.startsWith('/login')"
              type="button"
              class="mobile-login-btn"
              @click="go('/login')"
            >
              Login
            </button>
            <button
              v-else-if="auth.user"
              type="button"
              class="mobile-user-btn"
              aria-label="Open user menu"
              aria-haspopup="menu"
              :aria-expanded="userMenuOpen"
              @click="userMenuOpen = !userMenuOpen"
            >
              <img
                v-if="auth.user?.profile_photo"
                :src="auth.user.profile_photo"
                alt="Profile"
                class="mobile-user-btn__photo"
              />
              <span
                v-else
                class="mobile-user-btn__fallback"
              >
                <AppIcon name="person" :size="20" />
              </span>
            </button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-content ref="contentRef" class="mobile-ionic-content">
        <div
          ref="mainRef"
          class="mobile-ionic-main"
          :class="{ 'mobile-ionic-main--flush-end': isSpiritualHome }"
        >
          <slot />
        </div>
      </ion-content>

      <ion-footer
        v-if="auth.user"
        v-show="!textFieldFocused"
        class="mobile-area-bar"
      >
        <nav class="mobile-area-bar__nav" aria-label="Areas of life">
          <button
            v-for="link in links"
            :key="link.path"
            type="button"
            class="mobile-area-bar__item"
            :data-pillar="link.pillar || undefined"
            :aria-current="link.current ? 'page' : undefined"
            @click="go(link.path)"
          >
            <span class="mobile-area-bar__pill">
              <span class="mobile-area-bar__icon" :class="link.pillar ? `is-${link.pillar}` : 'is-neutral'">
                <AppIcon :name="link.icon" :size="26" :filled="link.current" :stroke-width="1.75" />
              </span>
              <span class="mobile-area-bar__label">{{ link.name }}</span>
            </span>
          </button>
        </nav>
      </ion-footer>
    </div>

    <button
      v-if="userMenuOpen"
      type="button"
      class="mobile-user-menu-backdrop"
      aria-label="Close user menu"
      @click="userMenuOpen = false"
    />
    <div
      v-if="auth.user && userMenuOpen"
      class="app-user-menu mobile-user-menu-panel"
      role="menu"
    >
      <button
        type="button"
        class="app-user-menu__item"
        role="menuitem"
        @click="onOpenAccount"
      >
        Account Management
      </button>
      <button
        type="button"
        class="app-user-menu__item"
        role="menuitem"
        @click="onOpenLinked"
      >
        Linked Accounts
      </button>
      <button
        type="button"
        class="app-user-menu__item"
        role="menuitem"
        @click="logout"
      >
        Logout
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { homePathForUser } from "~/utils/primaryNav";
import { isDuplicateScreenTitle } from "~/utils/titleDedupe";

const emit = defineEmits(["open-account", "open-linked"]);

const {
  auth,
  route,
  isSpiritualHome,
  links,
  screenTitle,
} = useAppNav();
const { go } = useAppNavigate();
const homePath = computed(() => homePathForUser(auth.user));
const contentRef = ref(null);
const mainRef = ref(null);
const userMenuOpen = ref(false);
const textFieldFocused = ref(false);
let blurHideTimer = 0;

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "radio",
  "file",
  "submit",
  "reset",
  "hidden",
  "range",
  "color",
  "image",
]);

function deepActiveElement() {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function isTextEntryEl(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (
    tag === "ION-INPUT" ||
    tag === "ION-TEXTAREA" ||
    tag === "ION-SEARCHBAR" ||
    tag === "ION-SELECT"
  ) {
    return true;
  }
  if (tag === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return Boolean(el.isContentEditable);
}

function onFocusIn(event) {
  if (!isTextEntryEl(event.target)) return;
  window.clearTimeout(blurHideTimer);
  textFieldFocused.value = true;
}

function onFocusOut() {
  window.clearTimeout(blurHideTimer);
  blurHideTimer = window.setTimeout(() => {
    textFieldFocused.value = isTextEntryEl(deepActiveElement());
  }, 50);
}

function onOpenAccount() {
  userMenuOpen.value = false;
  emit("open-account");
}

function onOpenLinked() {
  userMenuOpen.value = false;
  emit("open-linked");
}

async function logout() {
  userMenuOpen.value = false;
  const { signOut } = useSignOut();
  await signOut();
}

watch(
  () => route.fullPath,
  () => {
    userMenuOpen.value = false;
    textFieldFocused.value = false;
    const el = contentRef.value?.$el;
    if (el && typeof el.scrollToTop === "function") {
      el.scrollToTop(0);
    }
  },
);

/*
 * One title per screen on phones: when the page's first H1 repeats the
 * toolbar title (e.g. "Budget Tracker" twice), hide the H1 visually and keep
 * it for screen readers. Pages whose H1 adds information (Today's greeting,
 * a vehicle name) keep it.
 */
const DUPLICATE_TITLE_CLASS = "mobile-title-duplicate";
let titleObserver = null;
let titleFrame = 0;

function syncDuplicateTitle() {
  titleFrame = 0;
  const root = mainRef.value;
  if (!root) return;
  const first = root.querySelector("h1");
  root.querySelectorAll(`h1.${DUPLICATE_TITLE_CLASS}`).forEach((h1) => {
    if (h1 !== first) h1.classList.remove(DUPLICATE_TITLE_CLASS);
  });
  if (!first) return;
  const duplicate = isDuplicateScreenTitle(first.textContent, screenTitle.value, route.path);
  first.classList.toggle(DUPLICATE_TITLE_CLASS, duplicate);
}

function scheduleTitleSync() {
  if (titleFrame) return;
  titleFrame = window.requestAnimationFrame(syncDuplicateTitle);
}

watch(() => [route.path, screenTitle.value], () => nextTick(scheduleTitleSync));

onMounted(() => {
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  if (mainRef.value && typeof MutationObserver !== "undefined") {
    titleObserver = new MutationObserver(scheduleTitleSync);
    titleObserver.observe(mainRef.value, { childList: true, subtree: true, characterData: true });
  }
  scheduleTitleSync();
});

onBeforeUnmount(() => {
  document.removeEventListener("focusin", onFocusIn, true);
  document.removeEventListener("focusout", onFocusOut, true);
  window.clearTimeout(blurHideTimer);
  titleObserver?.disconnect();
  if (titleFrame) window.cancelAnimationFrame(titleFrame);
});
</script>
