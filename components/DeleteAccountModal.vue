<template>
  <Teleport to="body">
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" data-testid="delete-account-modal">
    <div class="absolute inset-0 bg-black/50" @click="close" aria-hidden="true"></div>
    <div
      class="relative flex h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain bg-base-100 p-4 pt-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      @click.stop
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 id="delete-account-title" class="text-base font-semibold text-ink">Delete account</h2>
        <button class="btn btn-ghost btn-sm min-h-11 min-w-14" type="button" @click="close">Close</button>
      </div>
      <DeleteAccountPanel :account-email="accountEmail" @deleted="onDeleted" />
    </div>
  </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  accountEmail: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue", "deleted"]);

let pushed = false;

function close() {
  if (import.meta.client && pushed && history.state?.deleteAccountModal) {
    pushed = false;
    history.back();
  } else {
    pushed = false;
  }
  emit("update:modelValue", false);
}

function onPopState() {
  if (!pushed) return;
  pushed = false;
  emit("update:modelValue", false);
}

function onKey(event) {
  if (event.key === "Escape") close();
}

function onDeleted() {
  emit("deleted");
}

onMounted(() => {
  if (!import.meta.client || !props.modelValue) return;
  history.pushState({ deleteAccountModal: true }, "");
  pushed = true;
  window.addEventListener("popstate", onPopState);
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  if (!import.meta.client) return;
  window.removeEventListener("popstate", onPopState);
  window.removeEventListener("keydown", onKey);
});
</script>
