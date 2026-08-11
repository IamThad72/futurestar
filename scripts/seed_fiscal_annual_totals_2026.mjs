/**
 * Seed Income + Pre-tax annual totals for the active budget, fiscal year 2026.
 * Usage: node scripts/seed_fiscal_annual_totals_2026.mjs
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

function loadEnv() {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // ignore
  }
}

loadEnv();

const YEAR = 2026;
const TOTALS = [
  { section: "income", total_kind: "gross", total_amount: 227545.16 },
  { section: "income", total_kind: "net", total_amount: 134318.21 },
  { section: "income", total_kind: "taxable", total_amount: 215699.68 },
  { section: "pretax", total_kind: "medical", total_amount: 3349.12 },
  { section: "pretax", total_kind: "vision", total_amount: 170.4 },
  { section: "pretax", total_kind: "dental", total_amount: 739.04 },
  { section: "pretax", total_kind: "401k", total_amount: 4879.24 },
  { section: "pretax", total_kind: "hsa", total_amount: 2707.68 },
  { section: "posttax", total_kind: "supplemental_life", total_amount: 543.52 },
  { section: "posttax", total_kind: "stock_option_offset", total_amount: 20577.82 },
];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase")
    ? { rejectUnauthorized: false }
    : false,
});

await client.connect();

const budget = await client.query(
  `SELECT budget_id, user_id, group_id, name
   FROM budgets
   WHERE is_active = true
   ORDER BY budget_id
   LIMIT 1`,
);
if (!budget.rowCount) {
  console.error("No active budget found.");
  process.exit(1);
}

const { budget_id: budgetId, user_id: userId, group_id: groupId, name } = budget.rows[0];
console.log(`Seeding fiscal totals for budget ${budgetId} (${name}), year ${YEAR}`);

for (const row of TOTALS) {
  await client.query(
    `INSERT INTO fiscal_annual_totals
       (budget_id, user_id, group_id, tax_year, section, total_kind, total_amount, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (budget_id, tax_year, section, total_kind)
     DO UPDATE SET
       total_amount = EXCLUDED.total_amount,
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       updated_at = NOW()`,
    [budgetId, userId, groupId, YEAR, row.section, row.total_kind, row.total_amount],
  );
  console.log(`  ${row.section}/${row.total_kind} = ${row.total_amount}`);
}

await client.end();
console.log("Done.");
