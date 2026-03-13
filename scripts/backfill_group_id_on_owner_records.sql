-- Backfill group_id on owner records that were created before the group existed.
-- Run this if linked accounts cannot see data created by the group owner.
-- This updates records where group_id is NULL but the owner belongs to a group.

UPDATE asset_inventory ai
SET group_id = gm.group_id
FROM group_members gm
WHERE ai.user_id = gm.user_id
  AND gm.role = 'owner'
  AND ai.group_id IS NULL;

UPDATE asset_vehicles av
SET group_id = gm.group_id
FROM group_members gm
WHERE av.user_id = gm.user_id
  AND gm.role = 'owner'
  AND av.group_id IS NULL;

UPDATE cash_and_investments ci
SET group_id = gm.group_id
FROM group_members gm
WHERE ci.user_id = gm.user_id
  AND gm.role = 'owner'
  AND ci.group_id IS NULL;

UPDATE debt d
SET group_id = gm.group_id
FROM group_members gm
WHERE d.user_id = gm.user_id
  AND gm.role = 'owner'
  AND d.group_id IS NULL;

UPDATE insurance i
SET group_id = gm.group_id
FROM group_members gm
WHERE i.user_id = gm.user_id
  AND gm.role = 'owner'
  AND i.group_id IS NULL;

UPDATE real_estate re
SET group_id = gm.group_id
FROM group_members gm
WHERE re.user_id = gm.user_id
  AND gm.role = 'owner'
  AND re.group_id IS NULL;

UPDATE estate_entries ee
SET group_id = gm.group_id
FROM group_members gm
WHERE ee.user_id = gm.user_id
  AND gm.role = 'owner'
  AND ee.group_id IS NULL;
