# SQL history (archived)

These scripts were applied manually or via one-off migrations before the current
`scripts/run-migrations.mjs` pipeline. They are kept for reference and disaster recovery.

**Do not delete** unless you are sure your Supabase/PostgreSQL schema already includes
these objects (estate tables, groups, auth sessions, record shares, etc.).

## Active SQL (still in `scripts/`)

Run with: `npm run migrate`

See the `migrations` array in `scripts/run-migrations.mjs` (budget + income/expense
incremental changes only).

## Archived files (this folder)

- `alter_add_group_id_to_records.sql`
- `alter_add_user_id_to_asset_vehicles.sql`
- `alter_add_user_id_to_grouped_records.sql`
- `alter_app_users_add_profile_photo.sql`
- `alter_cash_and_investments_acct_support_number.sql`
- `alter_debt_add_linked_asset.sql`
- `alter_debt_add_loan_ammount.sql`
- `alter_real_estate_drop_mortgage.sql`
- `alter_values_to_money.sql`
- `backfill_group_id_on_owner_records.sql`
- `configure_app_db_access.sql`
- `create_app_sessions.sql`
- `create_app_users.sql`
- `create_asset_classification.sql`
- `create_asset_inventory.sql`
- `create_asset_vehicles.sql`
- `create_debt.sql`
- `create_estate_entries.sql`
- `create_group_members.sql`
- `create_groups.sql`
- `create_insurance.sql`
- `create_real_estate.sql`
- `create_record_shares.sql`
- `update_asset_classification_category.sql`
