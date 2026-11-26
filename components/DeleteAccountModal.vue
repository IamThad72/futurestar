<template>
  <Teleport to="body">
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" data-testid="delete-account-modal">
      <div class="absolute inset-0 bg-black/50" @click="requestClose" aria-hidden="true"></div>
    <div
      ref="dialogRef"
      class="relative flex h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain bg-base-100 p-4 pt-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      tabindex="-1"
      @click.stop
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 id="delete-account-title" class="text-base font-semibold text-ink">Delete account</h2>
        <button class="btn btn-ghost btn-sm min-h-11 min-w-14" type="button" :disabled="busy" @click="requestClose">Close</button>
      </div>
      <DeleteAccountPanel :account-email="accountEmail" @deleted="onDeleted" @busy="busy = $event" />
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { nextTick, ref } from "vue";
import { deletionDialogDismissAllowed, nextDialogFocusIndex } from "~/utils/deletionGuards";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  accountEmail: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue", "deleted"]);

const dialogRef = ref(null);
const busy = ref(false);
let pushed = false;
let returnFocus = null;

function focusable() {
  const root = dialogRef.value;
  if (!root) return [];
  return [...root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
    (element) => !element.disabled && element.getAttribute("aria-hidden") !== "true",
  );
}

function close() {
  if (import.meta.client && pushed && history.state?.deleteAccountModal) {
    pushed = false;
    history.back();
  } else {
    pushed = false;
  }
  emit("update:modelValue", false);
}

function requestClose() {
  if (!deletionDialogDismissAllowed(busy.value)) return;
  close();
}

function onPopState() {
  if (!pushed) return;
  if (!deletionDialogDismissAllowed(busy.value)) {
    history.pushState({ deleteAccountModal: true }, "");
    return;
  }
  pushed = false;
  emit("update:modelValue", false);
}

function onKey(event) {
  if (event.key === "Escape") {
    if (!deletionDialogDismissAllowed(busy.value)) {
      event.preventDefault();
      return;
    }
    requestClose();
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusable();
  if (!items.length) return;
  const current = items.indexOf(document.activeElement);
  const atStart = current <= 0;
  const atEnd = current === items.length - 1 || current === -1;
  if (!event.shiftKey && !atEnd) return;
  if (event.shiftKey && !atStart) return;
  event.preventDefault();
  const next = nextDialogFocusIndex(current === -1 ? (event.shiftKey ? 0 : items.length - 1) : current, items.length, event.shiftKey);
  items[next]?.focus();
}

function onDeleted(payload) {
  emit("deleted", payload);
}

onMounted(() => {
  if (!import.meta.client || !props.modelValue) return;
  returnFocus = document.activeElement;
  history.pushState({ deleteAccountModal: true }, "");
  pushed = true;
  window.addEventListener("popstate", onPopState);
  window.addEventListener("keydown", onKey);
  nextTick(() => {
    const email = dialogRef.value?.querySelector("[data-testid='delete-account-email']");
    (email || dialogRef.value)?.focus();
  });
});

onUnmounted(() => {
  if (!import.meta.client) return;
  window.removeEventListener("popstate", onPopState);
  window.removeEventListener("keydown", onKey);
  if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
});
</script>
