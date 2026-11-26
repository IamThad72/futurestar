-- Read-only audit. Not a migration. Do not register this file in
-- scripts/run-migrations.mjs. It does not insert, update, or delete.
--
-- People who already belong to more than one household. Account deletion
-- refuses these until they transfer ownership and leave the extra household.

SELECT user_id, COUNT(DISTINCT group_id) AS households
FROM group_members
GROUP BY user_id
HAVING COUNT(DISTINCT group_id) > 1
ORDER BY user_id;
