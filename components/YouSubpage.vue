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
    On a phone this sheet used to be position:fixed inside ion-content, so the
    shell toolbar painted over the title. Teleport it onto the shell page and
    use ion-header + ion-content. fullscreen is false so the body is laid out
    under the toolbar (Ionic pads that toolbar with --ion-safe-area-top, which
    this sheet sets from env(safe-area-inset-top)) instead of scrolling underneath it.
  -->
  <Teleport v-else-if="modelValue" to="#main-content">
    <div class="ion-page you-subpage" role="dialog" aria-modal="true" :aria-label="title">
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
  </Teleport>
</template>

<script setup>
import { computed } from "vue";
import { IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/vue";

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  labelledBy: { type: String, required: true },
  panelClass: { type: String, default: "" },
  closeClass: { type: String, default: "btn btn-ghost btn-sm" },
});

const emit = defineEmits(["update:modelValue"]);
const { useMobileChrome } = useMobileShell();
const mobile = computed(() => useMobileChrome.value);

function close() {
  emit("update:modelValue", false);
}
</script>
