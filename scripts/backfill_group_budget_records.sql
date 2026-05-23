-- Backfill group_id on budget records for users already in linked account groups.
UPDATE income i
SET group_id = gm.group_id
FROM group_members gm
WHERE i.user_id = gm.user_id AND i.group_id IS NULL;

UPDATE expenses e
SET group_id = gm.group_id
FROM group_members gm
WHERE e.user_id = gm.user_id AND e.group_id IS NULL;

UPDATE budget_transactions t
SET group_id = gm.group_id
FROM group_members gm
WHERE t.user_id = gm.user_id AND t.group_id IS NULL;

UPDATE income_sources s
SET group_id = gm.group_id
FROM group_members gm
WHERE s.user_id = gm.user_id AND s.group_id IS NULL;

UPDATE investment_sources s
SET group_id = gm.group_id
FROM group_members gm
WHERE s.user_id = gm.user_id AND s.group_id IS NULL;

UPDATE savings_sources s
SET group_id = gm.group_id
FROM group_members gm
WHERE s.user_id = gm.user_id AND s.group_id IS NULL;
