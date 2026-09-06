import { Readable } from "node:stream";
import { createError, getQuery, sendStream, setHeader } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import {
  contentDisposition,
  mapEstateDocumentsError,
  readEstateFile,
  type EstateDocBackend,
} from "../../../utils/estateDocuments";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid document ID." });
  }

  const query = getQuery(event);
  const download = query.download === "1" || query.download === "true";

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const params = groupId ? [id, userId, groupId] : [id, userId];
    const result = await client.query(
      `SELECT original_filename, mime_type, storage_path, storage_backend
       FROM estate_documents
       WHERE doc_id = $1 AND ${access}`,
      params,
    );

    const row = result.rows[0];
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: "Document not found." });
    }

    const body = await readEstateFile(String(row.storage_path), row.storage_backend as EstateDocBackend);
    setHeader(event, "Content-Type", String(row.mime_type || "application/octet-stream"));
    setHeader(event, "Content-Length", String(body.length));
    setHeader(event, "Content-Disposition", contentDisposition(String(row.original_filename), download));
    setHeader(event, "Cache-Control", "private, no-store");
    setHeader(event, "X-Content-Type-Options", "nosniff");
    return sendStream(event, Readable.from(body));
  } catch (error: unknown) {
    throw mapEstateDocumentsError(error, "Failed to open document.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
