import { createError } from "h3";
import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId, groupAccessClauseAt, soloUserClauseAt } from "../../../utils/group";
import {
  mapEstateDocumentsError,
  removeEstateFile,
  type EstateDocBackend,
} from "../../../utils/estateDocuments";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const id = getRouterParam(event, "id");
  if (!id || !/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid document ID." });
  }

  const client = createDbClient();
  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const access = groupId ? groupAccessClauseAt("", 2, 3) : soloUserClauseAt("", 2);
    const params = groupId ? [id, userId, groupId] : [id, userId];
    const result = await client.query(
      `DELETE FROM estate_documents
       WHERE doc_id = $1 AND ${access}
       RETURNING storage_path, storage_backend`,
      params,
    );

    const row = result.rows[0];
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: "Document not found." });
    }

    await removeEstateFile(String(row.storage_path), row.storage_backend as EstateDocBackend);
    return { success: true };
  } catch (error: unknown) {
    throw mapEstateDocumentsError(error, "Failed to delete document.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
