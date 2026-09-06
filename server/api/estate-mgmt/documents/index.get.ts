import { createDbClient } from "../../../utils/db";
import { getSessionUserId } from "../../../utils/auth";
import { getUserGroupId } from "../../../utils/group";
import {
  estateDocumentsAccess,
  mapEstateDocumentsError,
  publicEstateDocument,
} from "../../../utils/estateDocuments";

export default defineEventHandler(async (event) => {
  const userId = await getSessionUserId(event);
  const client = createDbClient();

  try {
    await client.connect();
    const groupId = await getUserGroupId(client, userId);
    const access = estateDocumentsAccess(groupId);
    const params = groupId ? [userId, groupId] : [userId];
    const result = await client.query(
      `SELECT doc_id, original_filename, mime_type, size_bytes, title, notes, created_at
       FROM estate_documents
       WHERE ${access}
       ORDER BY created_at DESC, doc_id DESC`,
      params,
    );
    return { documents: result.rows.map(publicEstateDocument) };
  } catch (error: unknown) {
    throw mapEstateDocumentsError(error, "Failed to load documents.");
  } finally {
    await client.end().catch(() => undefined);
  }
});
