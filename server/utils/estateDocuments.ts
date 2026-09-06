import { createError } from "h3";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { groupAccessClause, soloUserClause } from "./group";

export const MAX_ESTATE_DOC_BYTES = 10 * 1024 * 1024;
export const ESTATE_DOCS_BUCKET = "estate-docs";

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const MIME_TO_EXTS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "text/plain": [".txt"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
};

export type EstateDocBackend = "disk" | "supabase";

export type EstateDocumentRow = {
  doc_id: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  title: string | null;
  notes: string | null;
  created_at: string;
};

type StoredFile = {
  storagePath: string;
  backend: EstateDocBackend;
};

let bucketReady: Promise<void> | null = null;

export function getEstateDocsRoot() {
  return process.env.ESTATE_DOCS_DIR || join(process.cwd(), "uploads", "estate-docs");
}

export function isMissingEstateDocumentsTable(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "42P01";
}

export function mapEstateDocumentsError(error: unknown, fallback: string) {
  if (isMissingEstateDocumentsTable(error)) {
    return createError({
      statusCode: 500,
      statusMessage: "Estate documents are not set up yet. Run database migrations.",
    });
  }
  if (error && typeof error === "object" && "statusCode" in error) {
    return error;
  }
  console.error(fallback, error);
  return createError({ statusCode: 500, statusMessage: fallback });
}

export function resolveUploadType(filename: string, mime: string | undefined) {
  const ext = extname(filename || "").toLowerCase();
  const offeredMime = String(mime || "").split(";")[0].trim().toLowerCase();
  const mimeFromExt = EXT_TO_MIME[ext];
  const extsForMime = offeredMime ? MIME_TO_EXTS[offeredMime] : null;

  if (mimeFromExt && (!offeredMime || offeredMime === "application/octet-stream" || extsForMime?.includes(ext))) {
    return { mime: mimeFromExt, ext };
  }
  if (extsForMime?.length) {
    return { mime: offeredMime, ext: extsForMime.includes(ext) ? ext : extsForMime[0] };
  }
  return null;
}

export function isPreviewableMime(mime: string) {
  const m = String(mime || "").toLowerCase();
  return m === "application/pdf" || m.startsWith("image/");
}

export function sanitizeOriginalName(name: string) {
  const base = String(name || "document").replace(/[/\\]/g, "").trim() || "document";
  return base.slice(0, 255);
}

export function contentDisposition(filename: string, download: boolean) {
  const ascii = sanitizeOriginalName(filename).replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "document";
  const encoded = encodeURIComponent(sanitizeOriginalName(filename));
  const type = download ? "attachment" : "inline";
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function relativeStoragePath(ownerKey: string, ext: string) {
  const safeExt = ext && ext.startsWith(".") ? ext.toLowerCase() : "";
  return `${ownerKey}/${randomUUID()}${safeExt}`;
}

function resolveDiskPath(storagePath: string) {
  const root = resolve(getEstateDocsRoot());
  const abs = resolve(join(root, storagePath));
  const rootCmp = root.toLowerCase();
  const absCmp = abs.toLowerCase();
  const inside =
    absCmp === rootCmp || absCmp.startsWith(`${rootCmp}\\`) || absCmp.startsWith(`${rootCmp}/`);
  if (!inside) {
    throw createError({ statusCode: 400, statusMessage: "Invalid storage path." });
  }
  return abs;
}

async function ensureBucket(admin: SupabaseClient) {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data: buckets, error: listError } = await admin.storage.listBuckets();
      if (listError) throw listError;
      if (buckets?.some((b) => b.name === ESTATE_DOCS_BUCKET)) return;
      const { error } = await admin.storage.createBucket(ESTATE_DOCS_BUCKET, {
        public: false,
        fileSizeLimit: MAX_ESTATE_DOC_BYTES,
      });
      if (error && !/already exists/i.test(error.message || "")) throw error;
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }
  await bucketReady;
}

async function writeDiskFile(storagePath: string, data: Buffer) {
  const abs = resolveDiskPath(storagePath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, data);
}

export async function persistEstateFile(opts: {
  ownerKey: string;
  mime: string;
  ext: string;
  data: Buffer;
}): Promise<StoredFile> {
  const storagePath = relativeStoragePath(opts.ownerKey, opts.ext);
  const admin = getSupabaseAdmin();
  if (admin && process.env.ESTATE_DOCS_STORAGE !== "disk") {
    try {
      await ensureBucket(admin);
      const { error } = await admin.storage.from(ESTATE_DOCS_BUCKET).upload(storagePath, opts.data, {
        contentType: opts.mime,
        upsert: false,
      });
      if (!error) return { storagePath, backend: "supabase" };
      console.error("estate document supabase upload failed", error.message);
    } catch (error) {
      console.error("estate document supabase upload failed", error);
    }
  }
  try {
    await writeDiskFile(storagePath, opts.data);
  } catch (error) {
    console.error("estate document disk upload failed", error);
    throw createError({
      statusCode: 500,
      statusMessage:
        "Could not store the file. Ensure uploads/estate-docs is writable, or set SUPABASE_SERVICE_ROLE_KEY for Storage.",
    });
  }
  return { storagePath, backend: "disk" };
}

export async function readEstateFile(storagePath: string, backend: EstateDocBackend) {
  if (backend === "supabase") {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw createError({ statusCode: 500, statusMessage: "Document storage is not configured." });
    }
    const { data, error } = await admin.storage.from(ESTATE_DOCS_BUCKET).download(storagePath);
    if (error || !data) {
      throw createError({ statusCode: 404, statusMessage: "File not found." });
    }
    return Buffer.from(await data.arrayBuffer());
  }
  try {
    return await readFile(resolveDiskPath(storagePath));
  } catch {
    throw createError({ statusCode: 404, statusMessage: "File not found." });
  }
}

export async function removeEstateFile(storagePath: string, backend: EstateDocBackend) {
  if (backend === "supabase") {
    const admin = getSupabaseAdmin();
    if (!admin) return;
    const { error } = await admin.storage.from(ESTATE_DOCS_BUCKET).remove([storagePath]);
    if (error) console.error("estate document supabase delete failed", error.message);
    return;
  }
  try {
    await unlink(resolveDiskPath(storagePath));
  } catch {
    // Missing file is fine — metadata row is the source of truth.
  }
}

export function estateDocumentsAccess(groupId: number | null) {
  return groupId ? groupAccessClause() : soloUserClause();
}

export function publicEstateDocument(row: {
  doc_id: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  title: string | null;
  notes: string | null;
  created_at: Date | string;
}): EstateDocumentRow {
  return {
    doc_id: Number(row.doc_id),
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    size_bytes: Number(row.size_bytes),
    title: row.title ?? null,
    notes: row.notes ?? null,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at ?? ""),
  };
}
