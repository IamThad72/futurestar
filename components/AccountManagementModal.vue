<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
    <div class="absolute inset-0 bg-black/50" @click="close" aria-hidden="true"></div>
    <div
      class="relative w-full h-full sm:w-auto sm:h-auto sm:min-w-[20rem] sm:max-w-[35.2rem] sm:max-h-[90vh] sm:shrink-0 overflow-y-auto overscroll-contain bg-base-100 p-4 pt-6 pb-safe-content sm:p-6 shadow-lg sm:rounded-lg text-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-management-title"
      @click.stop
    >
      <div class="flex items-center justify-between">
        <h2 id="account-management-title" class="text-base font-semibold">Account Management</h2>
        <button class="btn btn-ghost btn-sm min-h-8 min-w-12 text-xs" type="button" @click="close">Close</button>
      </div>

      <div v-if="!auth.ready" class="mt-3 text-xs text-base-content/70">Loading...</div>

      <div v-else-if="!auth.user" class="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-content">
        You must be logged in.
      </div>

      <div v-else class="mt-4 space-y-4">
        <!-- Profile Photo -->
        <div class="space-y-2">
          <h3 class="text-xs font-semibold">Profile Photo</h3>
          <div class="flex flex-col sm:flex-row items-start gap-3">
            <div class="flex items-center gap-2">
              <div class="avatar placeholder">
                <div
                  class="w-12 h-12 rounded-full bg-secondary text-secondary-content flex items-center justify-center overflow-hidden"
                  :class="{ 'ring-2 ring-primary': !!photoPreview }"
                >
                  <img
                    v-if="auth.user?.profile_photo || photoDataUrl"
                    :src="photoDataUrl || auth.user?.profile_photo"
                    alt="Profile"
                    class="w-full h-full object-cover"
                  />
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <input
                  ref="photoInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onPhotoSelect"
                />
                <button type="button" class="link link-primary text-sm" @click="photoInputRef?.click()">
                  {{ photoPreview ? 'Change Photo' : 'Add Photo' }}
                </button>
                <button
                  v-if="photoPreview"
                  type="button"
                  class="link link-primary text-sm"
                  :disabled="profileLoading"
                  @click="saveProfilePhoto"
                >
                  {{ profileLoading ? 'Saving...' : 'Save Photo' }}
                </button>
                <button v-if="photoPreview" type="button" class="link link-primary text-sm text-error" @click="clearPhoto">
                  Cancel
                </button>
                <button
                  v-if="auth.user?.profile_photo && !photoPreview"
                  type="button"
                  class="link link-primary text-sm text-error"
                  @click="removeProfilePhoto"
                >
                  Remove Photo
                </button>
              </div>
            </div>

            <!-- Photo crop editor -->
            <div v-if="photoPreview" class="w-full sm:flex-1 space-y-1.5">
              <div class="text-[10px] text-base-content/70">Adjust and crop (180×180)</div>
              <div class="relative bg-base-200 rounded overflow-hidden" style="aspect-ratio: 1; width: 180px; height: 180px;">
                <canvas
                  ref="cropCanvasRef"
                  class="absolute inset-0 w-full h-full cursor-move touch-none"
                  :width="cropSize"
                  :height="cropSize"
                  @mousedown="onCropMouseDown"
                  @mousemove="onCropMouseMove"
                  @mouseup="onCropMouseUp"
                  @mouseleave="onCropMouseUp"
                  @touchstart.prevent="onCropTouchStart"
                  @touchmove.prevent="onCropTouchMove"
                  @touchend.prevent="onCropMouseUp"
                />
              </div>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-1.5 text-xs">
                  <span>Zoom</span>
                  <input
                    v-model.number="cropScale"
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    class="range range-sm range-primary w-20"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Change Email -->
        <details class="group border border-base-200 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between cursor-pointer list-none px-3 py-2 bg-base-200/50 hover:bg-base-200/70 text-xs font-semibold">
            Change Email
            <svg class="size-4 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>
          <div class="p-3 space-y-1.5">
          <form @submit.prevent="updateEmail" class="space-y-1.5">
            <label class="form-control w-full">
              <span class="label-text text-xs">New Email</span>
              <input
                v-model.trim="emailForm.newEmail"
                type="email"
                class="input input-bordered input-sm w-full text-sm"
                placeholder="you@example.com"
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text text-xs">Current Password</span>
              <input
                v-model="emailForm.password"
                type="password"
                class="input input-bordered input-sm w-full text-sm"
                placeholder="Required to confirm"
              />
            </label>
            <p v-if="emailError" class="text-xs text-error">{{ emailError }}</p>
            <p v-if="emailSuccess" class="text-xs text-success">{{ emailSuccess }}</p>
            <button type="submit" class="btn btn-outline btn-sm" :disabled="emailLoading">
              {{ emailLoading ? 'Updating...' : 'Update Email' }}
            </button>
          </form>
          </div>
        </details>

        <!-- Change Password -->
        <details class="group border border-base-200 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between cursor-pointer list-none px-3 py-2 bg-base-200/50 hover:bg-base-200/70 text-xs font-semibold">
            Change Password
            <svg class="size-4 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>
          <div class="p-3 space-y-1.5">
          <form @submit.prevent="updatePassword" class="space-y-1.5">
            <label class="form-control w-full">
              <span class="label-text text-xs">Current Password</span>
              <input
                v-model="passwordForm.currentPassword"
                type="password"
                class="input input-bordered input-sm w-full text-sm"
                placeholder="Current password"
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text text-xs">New Password</span>
              <input
                v-model="passwordForm.newPassword"
                type="password"
                class="input input-bordered input-sm w-full text-sm"
                placeholder="At least 8 characters"
              />
            </label>
            <label class="form-control w-full">
              <span class="label-text text-xs">Confirm New Password</span>
              <input
                v-model="passwordForm.confirmPassword"
                type="password"
                class="input input-bordered input-sm w-full text-sm"
                placeholder="Confirm"
              />
            </label>
            <p v-if="passwordError" class="text-xs text-error">{{ passwordError }}</p>
            <p v-if="passwordSuccess" class="text-xs text-success">{{ passwordSuccess }}</p>
            <button type="submit" class="btn btn-outline btn-sm" :disabled="passwordLoading">
              {{ passwordLoading ? 'Updating...' : 'Update Password' }}
            </button>
          </form>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { useAuthStore } from '~/stores/auth';

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(['update:modelValue']);

const auth = useAuthStore();

const close = () => emit('update:modelValue', false);

// Photo state
const photoInputRef = ref(null);
const cropCanvasRef = ref(null);
const photoPreview = ref(null);
const photoDataUrl = ref(null);
const cropScale = ref(1.5);
const cropSize = 180;
const cropOffset = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const sourceImage = ref(null);

const clearPhoto = () => {
  photoPreview.value = null;
  photoDataUrl.value = null;
  sourceImage.value = null;
};

function loadExistingPhoto(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return;
  const img = new Image();
  img.onload = () => {
    sourceImage.value = img;
    photoPreview.value = dataUrl;
    cropScale.value = 1;
    cropOffset.value = { x: 0, y: 0 };
    nextTick(() => drawCropPreview());
  };
  img.onerror = () => { /* ignore */ };
  img.src = dataUrl;
}

watch(() => props.modelValue, (open) => {
  if (open && auth.user?.profile_photo) {
    loadExistingPhoto(auth.user.profile_photo);
  } else if (!open) {
    clearPhoto();
  }
});

function onPhotoSelect(e) {
  const file = e.target?.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target?.result;
    const img = new Image();
    img.onload = () => {
      sourceImage.value = img;
      photoPreview.value = dataUrl;
      cropScale.value = 1.5;
      cropOffset.value = { x: 0, y: 0 };
      nextTick(() => drawCropPreview());
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function getCropParams() {
  const img = sourceImage.value;
  if (!img) return null;
  const imgW = img.width;
  const imgH = img.height;
  const scale = cropScale.value;
  const drawSize = Math.min(imgW, imgH) / scale;
  const ratio = drawSize / cropSize;
  const ox = cropOffset.value.x * ratio;
  const oy = cropOffset.value.y * ratio;
  const sx = (imgW - drawSize) / 2 - ox;
  const sy = (imgH - drawSize) / 2 - oy;
  return { sx, sy, drawSize };
}

function drawCropPreview() {
  const canvas = cropCanvasRef.value;
  const img = sourceImage.value;
  if (!canvas || !img) return;

  const ctx = canvas.getContext('2d');
  const s = cropSize;
  const p = getCropParams();
  if (!p) return;

  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, p.sx, p.sy, p.drawSize, p.drawSize, 0, 0, s, s);
  ctx.restore();
}

function onCropMouseDown(e) {
  isDragging.value = true;
  dragStart.value = { x: e.offsetX - cropOffset.value.x, y: e.offsetY - cropOffset.value.y };
}

function onCropMouseMove(e) {
  if (!isDragging.value) return;
  cropOffset.value = { x: e.offsetX - dragStart.value.x, y: e.offsetY - dragStart.value.y };
  drawCropPreview();
}

function onCropMouseUp() {
  isDragging.value = false;
}

function onCropTouchStart(e) {
  const t = e.touches[0];
  const rect = cropCanvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  isDragging.value = true;
  dragStart.value = {
    x: t.clientX - rect.left - cropOffset.value.x,
    y: t.clientY - rect.top - cropOffset.value.y,
  };
}

function onCropTouchMove(e) {
  if (!isDragging.value) return;
  const t = e.touches[0];
  const rect = cropCanvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  cropOffset.value = {
    x: t.clientX - rect.left - dragStart.value.x,
    y: t.clientY - rect.top - dragStart.value.y,
  };
  drawCropPreview();
}

function exportCroppedPhoto() {
  const canvas = document.createElement('canvas');
  canvas.width = cropSize;
  canvas.height = cropSize;
  const ctx = canvas.getContext('2d');
  const img = sourceImage.value;
  if (!img || !ctx) return null;

  const p = getCropParams();
  if (!p) return null;

  ctx.beginPath();
  ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, p.sx, p.sy, p.drawSize, p.drawSize, 0, 0, cropSize, cropSize);
  return canvas.toDataURL('image/jpeg', 0.85);
}

watch(cropScale, () => drawCropPreview());
watch(photoPreview, () => nextTick(() => drawCropPreview()));

// Forms
const emailForm = ref({ newEmail: auth.user?.email ?? '', password: '' });
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
const emailError = ref('');
const emailSuccess = ref('');
const passwordError = ref('');
const passwordSuccess = ref('');
const profileError = ref('');
const profileSuccess = ref('');
const emailLoading = ref(false);
const passwordLoading = ref(false);
const profileLoading = ref(false);

watch(() => auth.user?.email, (v) => { emailForm.value.newEmail = v ?? ''; }, { immediate: true });

async function updateEmail() {
  emailError.value = '';
  emailSuccess.value = '';
  if (!emailForm.value.newEmail || !emailForm.value.password) {
    emailError.value = 'Email and password are required.';
    return;
  }
  emailLoading.value = true;
  try {
    await $fetch('/api/auth/update-email', {
      method: 'POST',
      body: { newEmail: emailForm.value.newEmail, password: emailForm.value.password },
    });
    auth.user = { ...auth.user, email: emailForm.value.newEmail };
    emailSuccess.value = 'Email updated.';
    emailForm.value.password = '';
  } catch (e) {
    emailError.value = e?.data?.statusMessage || e?.message || 'Failed to update email.';
  } finally {
    emailLoading.value = false;
  }
}

async function updatePassword() {
  passwordError.value = '';
  passwordSuccess.value = '';
  const { currentPassword, newPassword, confirmPassword } = passwordForm.value;
  if (!currentPassword || !newPassword || !confirmPassword) {
    passwordError.value = 'All fields are required.';
    return;
  }
  if (newPassword !== confirmPassword) {
    passwordError.value = 'New passwords do not match.';
    return;
  }
  if (newPassword.length < 8) {
    passwordError.value = 'New password must be at least 8 characters.';
    return;
  }
  passwordLoading.value = true;
  try {
    await $fetch('/api/auth/update-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    passwordSuccess.value = 'Password updated.';
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  } catch (e) {
    passwordError.value = e?.data?.statusMessage || e?.message || 'Failed to update password.';
  } finally {
    passwordLoading.value = false;
  }
}

async function removeProfilePhoto() {
  profileError.value = '';
  profileSuccess.value = '';
  profileLoading.value = true;
  try {
    await $fetch('/api/auth/update-profile', {
      method: 'POST',
      body: { profilePhoto: '' },
    });
    auth.user = { ...auth.user, profile_photo: null };
    profileSuccess.value = 'Profile photo removed.';
  } catch (e) {
    profileError.value = e?.data?.statusMessage || e?.message || 'Failed to remove photo.';
  } finally {
    profileLoading.value = false;
  }
}

async function saveProfilePhoto() {
  profileError.value = '';
  profileSuccess.value = '';
  const dataUrl = exportCroppedPhoto();
  if (!dataUrl) {
    profileError.value = 'No photo to save.';
    return;
  }
  profileLoading.value = true;
  try {
    await $fetch('/api/auth/update-profile', {
      method: 'POST',
      body: { profilePhoto: dataUrl },
    });
    auth.user = { ...auth.user, profile_photo: dataUrl };
    profileSuccess.value = 'Profile photo saved.';
    photoPreview.value = null;
    photoDataUrl.value = dataUrl;
    sourceImage.value = null;
  } catch (e) {
    profileError.value = e?.data?.statusMessage || e?.message || 'Failed to save photo.';
  } finally {
    profileLoading.value = false;
  }
}

</script>
