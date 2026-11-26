<template>
  <form class="min-w-0 space-y-4" data-testid="delete-account-panel" @submit.prevent="submit">
    <div class="space-y-2 text-sm text-base-content">
      <p>
        This permanently erases your Future Star account. It cannot be undone.
        Deleting the app does not delete the account.
      </p>
      <div>
        <p class="font-semibold text-ink">Erased</p>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          <li v-for="item in erased" :key="item">{{ item }}</li>
        </ul>
      </div>
      <div>
        <p class="font-semibold text-ink">Stays with the household</p>
        <p class="mt-1">{{ kept }}</p>
      </div>
      <div>
        <p class="font-semibold text-ink">What is kept afterwards</p>
        <p class="mt-1">{{ retention }}</p>
      </div>
    </div>

    <label class="form-control w-full min-w-0" :for="emailId">
      <span class="label-text text-sm">Type your email to confirm</span>
      <input
        :id="emailId"
        v-model="confirmEmail"
        data-testid="delete-account-email"
        type="email"
        name="confirmEmail"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="next"
        class="input input-bordered mt-1 w-full bg-base-100 text-base-content"
        :disabled="busy"
      />
    </label>

    <label class="form-control w-full min-w-0" :for="passwordId">
      <span class="label-text text-sm">Password</span>
      <input
        :id="passwordId"
        v-model="password"
        data-testid="delete-account-password"
        type="password"
        name="password"
        autocomplete="current-password"
        enterkeyhint="done"
        class="input input-bordered mt-1 w-full bg-base-100 text-base-content"
        :disabled="busy"
      />
    </label>

    <p v-if="error" class="text-sm text-error" role="alert" data-testid="delete-account-error">{{ error }}</p>

    <div class="sticky bottom-0 mt-4 bg-base-100 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <button
        type="submit"
        class="btn btn-error min-h-11 w-full"
        data-testid="delete-account-submit"
        :disabled="!canSubmit"
        :aria-busy="busy"
      >
        {{ busy ? "Deleting..." : "Delete account" }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { computed, ref, useId, watch } from "vue";
import { ERASED_ON_DELETE, KEPT_ON_DELETE, RETENTION_ON_DELETE } from "~/utils/accountDeletionCopy";
import { parseFetchError } from "~/utils/parseFetchError";

const props = defineProps({
  accountEmail: { type: String, default: "" },
});

const confirmEmail = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
const emailId = useId();
const passwordId = useId();

const emit = defineEmits(["deleted", "busy"]);

const erased = ERASED_ON_DELETE;
const kept = KEPT_ON_DELETE;
const retention = RETENTION_ON_DELETE;

const emailMatches = computed(() => {
  const expected = props.accountEmail.trim().toLowerCase();
  return expected.length > 0 && confirmEmail.value.trim().toLowerCase() === expected;
});

const canSubmit = computed(() => emailMatches.value && password.value.length > 0 && !busy.value);

watch(busy, (value) => emit("busy", value));

async function submit() {
  error.value = "";
  if (!canSubmit.value) return;
  busy.value = true;
  try {
    const response = await $fetch("/api/auth/delete-account", {
      method: "POST",
      body: {
        confirmEmail: confirmEmail.value.trim(),
        password: password.value,
      },
    });
    emit("deleted", { authRemovalPending: Boolean(response?.authRemovalPending) });
  } catch (cause) {
    error.value = parseFetchError(cause, "Could not delete the account.");
  } finally {
    busy.value = false;
  }
}
</script>
