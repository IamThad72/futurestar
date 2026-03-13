<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
    <div class="absolute inset-0 bg-black/50" @click="close"></div>
    <div class="relative w-full h-full sm:w-auto sm:h-auto sm:max-w-[46.2rem] sm:max-h-[90vh] overflow-y-auto overscroll-contain bg-base-100 p-4 pt-6 pb-safe-content sm:p-6 shadow-lg sm:rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Linked Accounts</h2>
          <p class="text-sm text-base-content/70">
            Create a group (up to 6 people) so members see the same entries.
          </p>
        </div>
        <button class="btn btn-ghost btn-sm min-h-9 min-w-14" type="button" @click="close">Close</button>
      </div>

      <div v-if="!auth.ready" class="mt-4 text-sm text-base-content/70">
        Loading session...
      </div>

      <div
        v-else-if="!auth.user"
        class="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-content"
      >
        You must be logged in to manage linked accounts.
      </div>

      <div v-else class="mt-4 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm text-base-content/70">
            Manage group membership for shared records.
          </div>
          <button class="btn btn-outline btn-sm" type="button" @click="loadGroupMembers">
            Refresh
          </button>
        </div>

        <div v-if="groupLoading" class="text-sm text-base-content/70">Loading group...</div>

        <div v-else-if="!groupInfo.group_id" class="space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label class="form-control w-full">
              <span class="label-text text-sm">Group Name</span>
              <input
                v-model.trim="newGroupName"
                class="input input-bordered w-full"
                type="text"
                placeholder="Family group"
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text text-sm">Second User Email</span>
              <input
                v-model.trim="newGroupSecondEmail"
                class="input input-bordered w-full"
                type="email"
                placeholder="other@user.com"
              />
            </label>
          </div>
          <button class="btn btn-primary" type="button" @click="createGroup">
            Create Group
          </button>
        </div>

        <div v-else class="space-y-3">
          <div class="text-sm">
            <span class="font-semibold">Group:</span> {{ groupInfo.group_name }}
            <span class="text-base-content/60">({{ groupInfo.role }})</span>
            <span class="text-base-content/50">— {{ groupMembers.length }}/6 members</span>
          </div>

          <div v-if="groupInfo.role === 'owner'" class="rounded-lg border border-base-200 bg-base-200/30 p-3 space-y-2">
            <div v-if="groupMembers.length >= 6" class="text-sm text-base-content/60">
              Group is full (max 6 members). Remove a member to add another.
            </div>
            <template v-else>
              <label class="form-control w-full">
                <span class="label-text text-sm">Add Member (email)</span>
                <input
                  v-model.trim="newMemberEmail"
                  class="input input-bordered input-sm w-full"
                  type="email"
                  placeholder="new@user.com"
                />
              </label>
              <button
                class="btn btn-primary btn-sm"
                type="button"
                :disabled="addingMember"
                @click="addGroupMember"
              >
                {{ addingMember ? "Adding…" : "Add Member" }}
              </button>
            </template>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-semibold">Members</div>
            <ul class="text-sm space-y-2">
              <li
                v-for="member in groupMembers"
                :key="member.user_id"
                class="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-base-200/50"
              >
                <span>
                  {{ member.email }} <span class="text-base-content/60">({{ member.role }})</span>
                </span>
                <button
                  v-if="canRemoveMember(member)"
                  type="button"
                  class="btn btn-ghost btn-xs btn-square min-h-8 min-w-8 text-error hover:bg-error/20"
                  :aria-label="member.user_id === auth.user?.user_id ? 'Leave group' : 'Remove member'"
                  :disabled="removingUserId === member.user_id"
                  @click="removeGroupMember(member)"
                >
                  <svg
                    v-if="removingUserId !== member.user_id"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-4"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  <span v-else class="loading loading-spinner loading-xs"></span>
                </button>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from "vue";
import { useAuthStore } from "~/stores/auth";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const auth = useAuthStore();
const groupLoading = ref(false);
const groupError = ref("");
const groupSuccess = ref("");
const groupInfo = reactive({ group_id: null, group_name: "", role: "" });
const groupMembers = ref([]);
const newGroupName = ref("");
const newGroupSecondEmail = ref("");
const newMemberEmail = ref("");
const removingUserId = ref(null);
const addingMember = ref(false);

const close = () => {
  emit("update:modelValue", false);
};

const loadGroupMembers = async () => {
  groupLoading.value = true;
  groupError.value = "";
  try {
    const response = await $fetch("/api/groups/members");
    groupInfo.group_id = response.group_id ?? null;
    groupInfo.group_name = response.group_name ?? "";
    groupInfo.role = response.role ?? "";
    groupMembers.value = response.members ?? [];
  } catch (err) {
    groupError.value =
      err?.data?.statusMessage || err?.message || "Failed to load group members.";
  } finally {
    groupLoading.value = false;
  }
};

const createGroup = async () => {
  groupError.value = "";
  groupSuccess.value = "";
  if (!newGroupName.value || !newGroupSecondEmail.value) {
    groupError.value = "Group name and second user email are required.";
    return;
  }

  try {
    await $fetch("/api/groups/create", {
      method: "POST",
      body: {
        group_name: newGroupName.value,
        second_user_email: newGroupSecondEmail.value,
      },
    });
    groupSuccess.value = "Group created.";
    newGroupName.value = "";
    newGroupSecondEmail.value = "";
    await loadGroupMembers();
  } catch (err) {
    groupError.value =
      err?.data?.statusMessage || err?.message || "Failed to create group.";
  }
};

const addGroupMember = async () => {
  groupError.value = "";
  groupSuccess.value = "";
  if (!newMemberEmail.value) {
    groupError.value = "Member email is required.";
    return;
  }

  addingMember.value = true;
  try {
    await $fetch("/api/groups/add-member", {
      method: "POST",
      body: { member_email: newMemberEmail.value },
    });
    groupSuccess.value = "Member added.";
    newMemberEmail.value = "";
    await loadGroupMembers();
  } catch (err) {
    groupError.value =
      err?.data?.statusMessage || err?.message || "Failed to add member.";
  } finally {
    addingMember.value = false;
  }
};

const canRemoveMember = (member) => {
  if (member.role === "owner") return false;
  if (groupInfo.role === "owner") return true;
  return member.user_id === auth.user?.user_id;
};

const removeGroupMember = async (member) => {
  groupError.value = "";
  groupSuccess.value = "";
  removingUserId.value = member.user_id;

  try {
    await $fetch("/api/groups/remove-member", {
      method: "POST",
      body: { user_id: member.user_id },
    });
    groupSuccess.value =
      member.user_id === auth.user?.user_id ? "Left group." : "Member removed.";
    await loadGroupMembers();
  } catch (err) {
    groupError.value =
      err?.data?.statusMessage || err?.message || "Failed to remove member.";
  } finally {
    removingUserId.value = null;
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (open && auth.user) {
      void loadGroupMembers();
    }
  },
);

watch(
  () => auth.user,
  (user) => {
    if (user && props.modelValue) {
      void loadGroupMembers();
    } else if (!user) {
      groupInfo.group_id = null;
      groupInfo.group_name = "";
      groupInfo.role = "";
      groupMembers.value = [];
    }
  },
);
</script>
