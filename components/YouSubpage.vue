<template>
  <div
    v-if="modelValue && !mobile"
    class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
  >
    <div class="absolute inset-0 bg-black/50" aria-hidden="true" @click="close"></div>
    <div
      class="relative h-full w-full overflow-y-auto overscroll-contain bg-base-100 p-4 pt-6 pb-safe-content shadow-lg sm:h-auto sm:max-h-[90vh] sm:w-auto sm:rounded-lg sm:p-6"
      :class="panelClass"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledBy"
      @click.stop
    >
      <div class="flex items-center justify-between">
        <div class="min-w-0">
          <slot name="heading" />
        </div>
        <button :class="closeClass" type="button" @click="close">Close</button>
      </div>
      <slot />
    </div>
  </div>

  <!--
    Phone sheet. ion-modal (not a teleported ion-page) dismisses on Escape and
    on the hardware back button, traps focus while open, and restores it on
    dismiss. keyboardClose, focusTrap, and backdropDismiss stay at Ionic's
    defaults. The inner ion-page keeps the header above the body; fullscreen
    is false so the body is laid out under the toolbar. Safe-area insets use
    Ionic's --safe-area-inset-* / env() chain in CSS.
    is-open is local so the modal can finish dismiss and restore focus before
    the parent unmounts it.
  -->
  <Teleport v-else to="ion-app">
    <ion-modal class="you-subpage" :is-open="presented" @didDismiss="onDismiss">
      <div class="ion-page">
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>{{ title }}</ion-title>
            <ion-buttons slot="end">
              <button type="button" class="btn btn-ghost btn-sm you-subpage__close" @click="close">Close</button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content :fullscreen="false" class="ion-padding you-subpage__content">
          <slot name="intro" />
          <slot />
        </ion-content>
      </div>
    </ion-modal>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from "vue";
import { IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from "@ionic/vue";
import { consumeSheetTrigger } from "~/utils/sheetFocus";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  labelledBy: { type: String, required: true },
  panelClass: { type: String, default: "" },
  closeClass: { type: String, default: "btn btn-ghost btn-sm" },
});

const emit = defineEmits(["update:modelValue"]);
const { useMobileChrome } = useMobileShell();
const mobile = computed(() => useMobileChrome.value);
const presented = ref(false);
let returnFocus = null;

onMounted(() => {
  returnFocus = consumeSheetTrigger(document.activeElement, document.body);
});

function discardSheet() {
  document.querySelectorAll("ion-modal.you-subpage").forEach((el) => el.remove());
}

onBeforeUnmount(discardSheet);
onUnmounted(() => {
  discardSheet();
  requestAnimationFrame(discardSheet);
});

watch(
  () => props.modelValue,
  (open) => {
    presented.value = Boolean(open);
  },
  { immediate: true },
);

function close() {
  if (mobile.value) {
    presented.value = false;
    return;
  }
  emit("update:modelValue", false);
}

function onDismiss() {
  presented.value = false;
  const trigger = returnFocus;
  returnFocus = null;
  emit("update:modelValue", false);
  setTimeout(() => {
    discardSheet();
    if (trigger?.isConnected) trigger.focus();
  }, 0);
}
</script>
