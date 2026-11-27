import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAccountCleanup } from "../server/utils/accountDeletion";
import { ESTATE_DOCS_BUCKET, ESTATE_FILE_SAVE_MESSAGE, readEstateFile, removeEstateFile } from "../server/utils/estateDocuments";
import { makeEvent } from "./helpers/event";
import { AccountDeletionDb } from "./helpers/accountDeletionDb";
import uploadDocument from "../server/api/estate-mgmt/documents/index.post";

const SECRET = "service-role-test-secret";

type QueryCall = { text: string; params: unknown[] };
type UploadCall = { bucket: string; path: string; bytes: Buffer; contentType?: string; upsert?: boolean };

vi.mock("../server/utils/db", () => ({
  createDbClient: () => {
    const db = (globalThis as { __estateDb?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> } }).__estateDb;
    if (!db) throw new Error("Estate test database is not initialized.");
    return {
      connect: async () => undefined,
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
      end: async () => undefined,
    };
  },
}));

vi.mock("../server/utils/supabaseAdmin", () => ({
  getSupabaseAdmin: () => (globalThis as { __estateAdmin?: unknown }).__estateAdmin ?? null,
}));

function installDb() {
  const queries: QueryCall[] = [];
  (globalThis as { __estateDb?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> } }).__estateDb = {
    async query(sql: string, params: unknown[] = []) {
      const text = sql.replace(/\s+/g, " ").trim();
      queries.push({ text, params });
      if (text.includes("FROM app_sessions")) {
        return {
          rows: [{ user_id: 7, email: "a@example.com", display_name: "Ada", profile_photo: null }],
          rowCount: 1,
        };
      }
      if (text.includes("FROM group_members")) return { rows: [], rowCount: 0 };
      if (text.startsWith("INSERT INTO estate_documents")) {
        return {
          rows: [{
            doc_id: 41,
            original_filename: params[2],
            mime_type: params[3],
            size_bytes: params[4],
            title: params[7],
            notes: params[8],
            created_at: new Date("2026-03-01T00:00:00.000Z"),
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unhandled SQL in estate test db: ${text}`);
    },
  };
  return queries;
}

function installAdmin(mode: "ok" | "upload-error" | "throw") {
  const uploads: UploadCall[] = [];
  const removed: string[][] = [];
  (globalThis as { __estateAdmin?: unknown }).__estateAdmin = {
    storage: {
      listBuckets: async () => ({ data: [{ name: ESTATE_DOCS_BUCKET, public: false }], error: null }),
      createBucket: async () => ({ data: { name: ESTATE_DOCS_BUCKET }, error: null }),
      from(bucket: string) {
        return {
          upload: async (path: string, body: Buffer, options: { contentType?: string; upsert?: boolean } = {}) => {
            uploads.push({
              bucket,
              path,
              bytes: Buffer.from(body),
              contentType: options.contentType,
              upsert: options.upsert,
            });
            if (mode === "throw") throw new Error(`storage rejected the upload ${SECRET}`);
            if (mode === "upload-error") {
              return { data: null, error: { message: `storage rejected the upload ${SECRET}` } };
            }
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            removed.push(paths);
            return { data: paths, error: null };
          },
        };
      },
    },
  };
  return { uploads, removed };
}

function uploadEvent() {
  const boundary = "----estateform";
  const payload = Buffer.from("%PDF-1.4 estate-file");
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="will.pdf"\r\n` +
        `Content-Type: application/pdf\r\n\r\n`,
    ),
    payload,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const event = makeEvent({
    method: "POST",
    url: "/api/estate-mgmt/documents",
    headers: {
      cookie: "session=test-session",
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
  });
  (event.node.req as { body?: Buffer }).body = body;
  return { event, payload };
}

async function expectStatus(promise: Promise<unknown>, statusCode: number, statusMessage: string) {
  try {
    const value = await promise;
    throw new Error(`expected HTTP ${statusCode} but the handler resolved: ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected HTTP")) throw error;
    expect(error).toMatchObject({ statusCode, statusMessage });
    expect(JSON.stringify(error)).not.toContain(SECRET);
  }
}

function loggedLines() {
  return vi.mocked(console.error).mock.calls.map((entry) => entry.map((part) => String(part)).join(" ")).join("\n");
}

let docsDir = "";

beforeEach(() => {
  docsDir = mkdtempSync(join(tmpdir(), "estate-docs-"));
  process.env.ESTATE_DOCS_DIR = docsDir;
  process.env.ESTATE_DOCS_STORAGE = "disk";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  (globalThis as { __estateAdmin?: unknown }).__estateAdmin = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(docsDir, { recursive: true, force: true });
  delete process.env.ESTATE_DOCS_DIR;
  delete process.env.ESTATE_DOCS_STORAGE;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.restoreAllMocks();
});

describe("estate file uploads", () => {
  it("stores a new file in Supabase and records storage_backend=supabase", async () => {
    const queries = installDb();
    const { uploads } = installAdmin("ok");
    const { event, payload } = uploadEvent();

    const saved = await uploadDocument(event) as { document: { original_filename: string; mime_type: string; size_bytes: number } };

    expect(saved.document.original_filename).toBe("will.pdf");
    expect(saved.document.mime_type).toBe("application/pdf");
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.bucket).toBe(ESTATE_DOCS_BUCKET);
    expect(uploads[0]?.path).toMatch(/^user-7\/[0-9a-f-]{36}\.pdf$/);
    expect(uploads[0]?.contentType).toBe("application/pdf");
    expect(uploads[0]?.upsert).toBe(false);
    expect(uploads[0]?.bytes.includes(payload)).toBe(true);
    expect(saved.document.size_bytes).toBe(uploads[0]?.bytes.length);
    const inserted = queries.filter((query) => query.text.startsWith("INSERT INTO estate_documents"));
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.params[5]).toBe(uploads[0]?.path);
    expect(inserted[0]?.params[6]).toBe("supabase");
    await expect(readFile(join(docsDir, String(uploads[0]?.path)))).rejects.toThrow();
  });

  it("returns 503 and inserts no row when the admin client is missing", async () => {
    const queries = installDb();
    const { event } = uploadEvent();

    await expectStatus(uploadDocument(event), 503, ESTATE_FILE_SAVE_MESSAGE);

    expect(queries.some((query) => query.text.startsWith("INSERT INTO estate_documents"))).toBe(false);
    expect(loggedLines()).toContain("admin client is not configured");
    expect(loggedLines()).not.toContain(ESTATE_FILE_SAVE_MESSAGE);
    expect(loggedLines()).not.toContain(SECRET);
    await expect(readdir(docsDir)).resolves.toEqual([]);
  });

  it("returns 502 and inserts no row when the upload fails", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    const queries = installDb();
    installAdmin("upload-error");

    await expectStatus(uploadDocument(uploadEvent().event), 502, ESTATE_FILE_SAVE_MESSAGE);

    installAdmin("throw");
    await expectStatus(uploadDocument(uploadEvent().event), 502, ESTATE_FILE_SAVE_MESSAGE);

    expect(queries.some((query) => query.text.startsWith("INSERT INTO estate_documents"))).toBe(false);
    const logged = loggedLines();
    expect(logged).toContain("storage rejected the upload");
    expect(logged).toContain("[redacted]");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain(ESTATE_FILE_SAVE_MESSAGE);
    await expect(readdir(docsDir)).resolves.toEqual([]);
  });
});

describe("legacy disk estate files", () => {
  it("still reads and deletes disk rows, including through the daily cleanup job", async () => {
    const rel = "user-9/legacy.pdf";
    await mkdir(dirname(join(docsDir, rel)), { recursive: true });
    await writeFile(join(docsDir, rel), "legacy-bytes");

    await expect(readEstateFile(rel, "disk")).resolves.toEqual(Buffer.from("legacy-bytes"));
    await removeEstateFile(rel, "disk");
    await expect(readEstateFile(rel, "disk")).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: "File not found.",
    });
    await expect(removeEstateFile(rel, "disk")).resolves.toBeUndefined();

    const queued = "user-9/queued.pdf";
    await writeFile(join(docsDir, queued), "queued-bytes");
    const db = new AccountDeletionDb();
    db.rows.pending_storage_deletes.push(
      { storage_path: queued, storage_backend: "disk", deleted_at: null, attempt_count: 0 },
      { storage_path: "user-9/already-gone.pdf", storage_backend: "disk", deleted_at: null, attempt_count: 0 },
    );

    const outcome = await runAccountCleanup(db.client());

    expect(outcome.filesRemoved).toBe(2);
    await expect(readFile(join(docsDir, queued))).rejects.toThrow();
    expect(db.rows.pending_storage_deletes.every((row) => row.deleted_at)).toBe(true);
  });

  it("still removes a supabase object when the admin client exists", async () => {
    const { removed } = installAdmin("ok");
    await removeEstateFile("group-3/kept.pdf", "supabase");
    expect(removed).toEqual([["group-3/kept.pdf"]]);
  });
});
