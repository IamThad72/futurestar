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
          <li>Budget lines, transactions, and estate records that belong only to you</li>
          <li>Estate documents you own</li>
          <li>Faith journals, prayers, and worship notes</li>
          <li>Nutrition and workouts</li>
          <li>Your profile, sessions, and sign-in</li>
        </ul>
      </div>
      <div>
        <p class="font-semibold text-ink">Stays with the household</p>
        <p class="mt-1">
          Shared household money records stay with the household. If other people are in it,
          those shared records are kept for them. If you are the owner and others remain, the
          person who joined next becomes the owner. If you are the only person, the household
          is deleted too.
        </p>
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
      <span class="label-text text-sm">Password (if you set one)</span>
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
        :disabled="!emailMatches || busy"
        :aria-busy="busy"
      >
        {{ busy ? "Deleting..." : "Delete account" }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { computed, ref, useId } from "vue";
import { parseFetchError } from "~/utils/parseFetchError";

const props = defineProps({
  accountEmail: { type: String, default: "" },
});

const emit = defineEmits(["deleted"]);

const confirmEmail = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
const emailId = useId();
const passwordId = useId();

const emailMatches = computed(() => {
  const expected = props.accountEmail.trim().toLowerCase();
  return expected.length > 0 && confirmEmail.value.trim().toLowerCase() === expected;
});

async function submit() {
  error.value = "";
  if (!emailMatches.value || busy.value) return;
  busy.value = true;
  try {
    await $fetch("/api/auth/delete-account", {
      method: "POST",
      body: {
        confirmEmail: confirmEmail.value.trim(),
        password: password.value,
      },
    });
    emit("deleted");
  } catch (cause) {
    error.value = parseFetchError(cause, "Could not delete the account.");
  } finally {
    busy.value = false;
  }
}
</script>
