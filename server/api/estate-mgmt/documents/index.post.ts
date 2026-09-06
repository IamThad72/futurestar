import { createError, getHeader, readMultipartFormData } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";
import {
  MAX_ESTATE_DOC_BYTES,
  mapEstateDocumentsError,
  persistEstateFile,
  publicEstateDocument,
  removeEstateFile,
  resolveUploadType,
  sanitizeOriginalName,
} from "../../../utils/estateDocuments";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);

  const contentLength = Number(getHeader(event, "content-length") || 0);
  if (contentLength > MAX_ESTATE_DOC_BYTES + 256 * 1024) {
    throw createError({ statusCode: 413, statusMessage: "File is too large. Maximum size is 10 MB." });
  }

  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "Upload a file." });
  }

  const filePart = parts.find((part) => part.name === "file" && part.filename && part.data);
  if (!filePart?.filename || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: "Choose a file to upload." });
  }

  const data = Buffer.isBuffer(filePart.data) ? filePart.data : Buffer.from(filePart.data);
  if (!data.length) {
    throw createError({ statusCode: 400, statusMessage: "The selected file is empty." });
  }
  if (data.length > MAX_ESTATE_DOC_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "File is too large. Maximum size is 10 MB." });
  }

  const originalFilename = sanitizeOriginalName(filePart.filename);
  const resolved = resolveUploadType(originalFilename, filePart.type);
  if (!resolved) {
    throw createError({
      statusCode: 400,
      statusMessage: "That file type is not allowed. Use PDF, images, Word, Excel, PowerPoint, or text.",
    });
  }

  const titleRaw = parts.find((part) => part.name === "title" && !part.filename)?.data;
  const notesRaw = parts.find((part) => part.name === "notes" && !part.filename)?.data;
  const title = titleRaw ? String(titleRaw).trim().slice(0, 200) || null : null;
  const notes = notesRaw ? String(notesRaw).trim().slice(0, 2000) || null : null;

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const stored = await persistEstateFile({
      ownerKey: groupId ? `group-${groupId}` : `user-${userId}`,
      mime: resolved.mime,
      ext: resolved.ext,
      data,
    });

    try {
      const inserted = await client.query(
        `INSERT INTO estate_documents
          (user_id, group_id, original_filename, mime_type, size_bytes, storage_path, storage_backend, title, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING doc_id, original_filename, mime_type, size_bytes, title, notes, created_at`,
        [
          userId,
          groupId,
          originalFilename,
          resolved.mime,
          data.length,
          stored.storagePath,
          stored.backend,
          title,
          notes,
        ],
      );

      return { document: publicEstateDocument(inserted.rows[0]) };
    } catch (error: unknown) {
      await removeEstateFile(stored.storagePath, stored.backend).catch(() => undefined);
      throw error;
    }
  } catch (error: unknown) {
    throw mapEstateDocumentsError(error, "Failed to upload document.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
