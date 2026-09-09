<template>
  <div class="estate-docs">
    <div v-if="loading" class="py-6 text-xs text-gray-500 md:text-sm dark:text-gray-400">
      Loading documents...
    </div>

    <LoadErrorPanel
      v-else-if="loadError"
      class="my-4"
      :message="loadError"
      @retry="loadDocuments"
    />

    <div v-else-if="!documents.length" class="estate-docs-empty">
      No documents yet. Upload a PDF, image, or office file to keep it with this household.
    </div>

    <ion-list v-else lines="full" class="estate-docs-list">
      <ion-item v-for="doc in documents" :key="doc.doc_id" class="estate-docs-item">
        <ion-label>
          <h2 class="estate-docs-title">{{ displayName(doc) }}</h2>
          <p v-if="doc.title && doc.title !== doc.original_filename" class="estate-docs-line">
            {{ doc.original_filename }}
          </p>
          <p v-if="doc.notes" class="estate-docs-line">{{ doc.notes }}</p>
          <p class="estate-docs-line">
            {{ formatSize(doc.size_bytes) }} · {{ formatDate(doc.created_at) }}
          </p>
        </ion-label>
        <div slot="end" class="estate-docs-actions">
          <button
            type="button"
            class="estate-docs-action-btn"
            :aria-label="isPreviewable(doc.mime_type) ? 'View' : 'Open'"
            :title="isPreviewable(doc.mime_type) ? 'View' : 'Open'"
            @click="openDocument(doc)"
          >
            <EyeIcon v-if="isPreviewable(doc.mime_type)" class="size-4" aria-hidden="true" />
            <ArrowTopRightOnSquareIcon v-else class="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="estate-docs-action-btn"
            aria-label="Download"
            title="Download"
            @click="downloadDocument(doc)"
          >
            <ArrowDownTrayIcon class="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="estate-docs-action-btn estate-docs-action-btn--danger"
            aria-label="Delete"
            title="Delete"
            @click="deleteDocument(doc)"
          >
            <TrashIcon class="size-4" aria-hidden="true" />
          </button>
        </div>
      </ion-item>
    </ion-list>

    <dialog ref="uploadModalRef" class="modal" @close="resetUploadForm">
      <div class="modal-box w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full">
        <h3 class="text-lg font-bold">Upload document</h3>
        <p class="text-sm text-base-content/70 mt-1 mb-4">
          Household files appear on Estate Management. PDF, images, Word, Excel, PowerPoint, or text — max 10 MB.
        </p>
        <form class="space-y-3" @submit.prevent="submitUpload">
          <label class="form-control w-full">
            <span class="label-text text-sm">File</span>
            <input
              ref="fileInputRef"
              class="file-input file-input-bordered file-input-sm w-full"
              type="file"
              :accept="acceptTypes"
              required
              @change="onFileChange"
            />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Title (optional)</span>
            <input v-model.trim="uploadForm.title" class="input input-bordered input-sm w-full" maxlength="200" />
          </label>
          <label class="form-control w-full">
            <span class="label-text text-sm">Notes (optional)</span>
            <textarea v-model.trim="uploadForm.notes" class="textarea textarea-bordered textarea-sm w-full" rows="2" maxlength="2000" />
          </label>
          <div v-if="uploadError" class="text-sm text-error">{{ uploadError }}</div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="uploadModalRef?.close()">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary btn-sm min-h-9" :disabled="uploading">
              {{ uploading ? "Uploading..." : "Upload" }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>

    <dialog ref="previewModalRef" class="modal" @close="revokePreview">
      <div class="modal-box w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto overscroll-contain sm:w-full">
        <h3 class="text-lg font-bold">{{ previewTitle }}</h3>
        <div class="mt-4">
          <img
            v-if="previewKind === 'image' && previewUrl"
            :src="previewUrl"
            :alt="previewTitle"
            class="max-h-[70vh] w-auto max-w-full rounded"
          />
          <iframe
            v-else-if="previewKind === 'pdf' && previewUrl"
            :src="previewUrl"
            title="Document preview"
            class="h-[70vh] w-full rounded border border-base-300"
          />
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-outline btn-sm min-h-9" @click="openPreviewInNewTab">
            Open in new tab
          </button>
          <button type="button" class="btn btn-ghost btn-sm min-h-9" @click="previewModalRef?.close()">
            Close
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup>
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";
import { IonItem, IonLabel, IonList } from "@ionic/vue";
import { parseFetchError } from "~/utils/parseFetchError";

const acceptTypes = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
].join(",");

const auth = useAuthStore();
const documents = ref([]);
const loading = ref(false);
const loadError = ref("");
const uploading = ref(false);
const uploadError = ref("");
const uploadModalRef = ref(null);
const previewModalRef = ref(null);
const fileInputRef = ref(null);
const selectedFile = ref(null);
const uploadForm = reactive({ title: "", notes: "" });
const previewUrl = ref("");
const previewKind = ref("");
const previewTitle = ref("");

function displayName(doc) {
  return (doc.title && String(doc.title).trim()) || doc.original_filename || "Document";
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isPreviewable(mime) {
  const m = String(mime || "").toLowerCase();
  return m === "application/pdf" || m.startsWith("image/");
}

function onFileChange(event) {
  selectedFile.value = event.target?.files?.[0] ?? null;
}

function resetUploadForm() {
  uploadForm.title = "";
  uploadForm.notes = "";
  uploadError.value = "";
  selectedFile.value = null;
  if (fileInputRef.value) fileInputRef.value.value = "";
}

function openUpload() {
  resetUploadForm();
  uploadModalRef.value?.showModal();
}

async function loadDocuments() {
  if (!auth.user) return;
  loading.value = true;
  loadError.value = "";
  try {
    const data = await $fetch("/api/estate-mgmt/documents");
    documents.value = data?.documents ?? [];
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to load documents.");
    documents.value = [];
  } finally {
    loading.value = false;
  }
}

async function submitUpload() {
  const file = selectedFile.value || fileInputRef.value?.files?.[0];
  if (!file) {
    uploadError.value = "Choose a file to upload.";
    return;
  }
  uploading.value = true;
  uploadError.value = "";
  try {
    const form = new FormData();
    form.append("file", file);
    if (uploadForm.title) form.append("title", uploadForm.title);
    if (uploadForm.notes) form.append("notes", uploadForm.notes);
    await $fetch("/api/estate-mgmt/documents", { method: "POST", body: form });
    uploadModalRef.value?.close();
    await loadDocuments();
  } catch (error) {
    uploadError.value = parseFetchError(error, "Failed to upload document.");
  } finally {
    uploading.value = false;
  }
}

async function fetchDocumentBlob(doc, download = false) {
  const qs = download ? "?download=1" : "";
  return await $fetch(`/api/estate-mgmt/documents/${doc.doc_id}${qs}`, { responseType: "blob" });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "document";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
  previewKind.value = "";
  previewTitle.value = "";
}

async function openDocument(doc) {
  try {
    const blob = await fetchDocumentBlob(doc, false);
    if (isPreviewable(doc.mime_type)) {
      revokePreview();
      previewUrl.value = URL.createObjectURL(blob);
      previewKind.value = String(doc.mime_type).startsWith("image/") ? "image" : "pdf";
      previewTitle.value = displayName(doc);
      previewModalRef.value?.showModal();
      return;
    }
    triggerDownload(blob, doc.original_filename);
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to open document.");
  }
}

async function downloadDocument(doc) {
  try {
    const blob = await fetchDocumentBlob(doc, true);
    triggerDownload(blob, doc.original_filename);
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to download document.");
  }
}

function openPreviewInNewTab() {
  if (!previewUrl.value) return;
  window.open(previewUrl.value, "_blank", "noopener");
}

async function deleteDocument(doc) {
  if (!confirm(`Delete “${displayName(doc)}”? This cannot be undone.`)) return;
  try {
    await $fetch(`/api/estate-mgmt/documents/${doc.doc_id}`, { method: "DELETE" });
    await loadDocuments();
  } catch (error) {
    loadError.value = parseFetchError(error, "Failed to delete document.");
  }
}

onMounted(() => {
  if (auth.user) void loadDocuments();
});

watch(
  () => auth.user,
  (user) => {
    if (user) void loadDocuments();
    else documents.value = [];
  },
);

defineExpose({ openUpload, loadDocuments });
</script>

<style scoped>
.estate-docs {
  padding-inline: 8px;
}

.estate-docs-empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 0.875rem;
  color: color-mix(in srgb, var(--color-base-content, #151616) 55%, transparent);
  font-style: italic;
}

.estate-docs-list {
  margin: 0;
  background: transparent;
}

@media (min-width: 640px) {
  .estate-docs-list {
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
  }
}

.estate-docs-item {
  --background: var(--color-base-100, #ffffff);
  --color: var(--color-base-content, #151616);
  --border-color: color-mix(in srgb, var(--color-base-content, #151616) 10%, transparent);
  --padding-start: 0.75rem;
  --padding-end: 0.75rem;
  --inner-padding-end: 0.25rem;
}

@media (max-width: 639.98px) {
  .estate-docs-item {
    --padding-start: 0.5rem;
    --padding-end: 0.5rem;
  }
}

.estate-docs-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
}

.estate-docs-line {
  margin: 0.125rem 0 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--color-base-content, #151616) 62%, transparent);
}

.estate-docs-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
  padding-inline-start: 0.75rem;
}

.estate-docs-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  outline: none;
  color: var(--color-base-content, #151616);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.estate-docs-action-btn:hover,
.estate-docs-action-btn:focus,
.estate-docs-action-btn:focus-visible {
  border: none;
  background: transparent;
  box-shadow: none;
  outline: none;
  color: var(--color-primary, #06b6d4);
}

.estate-docs-action-btn--danger:hover,
.estate-docs-action-btn--danger:focus,
.estate-docs-action-btn--danger:focus-visible {
  color: #f87171;
}
</style>
