#!/usr/bin/env node
/**
 * Create (or reset) demo@futurestar.app and populate Financial + Physical sample data.
 * Usage: node scripts/seed-demo-account.mjs
 */
import { createHash, pbkdf2Sync, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

const DEMO_EMAIL = "demo@futurestar.app";
const DEMO_PASSWORD = "demo72";
const DEMO_NAME = "Demo User";
const YEAR = 2026;

const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = "sha512";
const PASSWORD_SALT_BYTES = 32;

function loadEnv() {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
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
  } catch {
    // no .env
  }
}

function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEYLEN,
    PASSWORD_DIGEST,
  ).toString("hex");
  return `${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

function createDbClient() {
  const {
    DATABASE_URL,
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DB_SSL,
  } = process.env;

  if (DATABASE_URL) {
    const url = DATABASE_URL.trim();
    return new Client({
      connectionString: url,
      ssl: url.includes("supabase") ? { rejectUnauthorized: false } : false,
    });
  }

  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    throw new Error("Set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER in .env");
  }

  return new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function jitter(base, spread = 0.08) {
  const factor = 1 + (hash01(`${base}`) * 2 - 1) * spread;
  return Math.round(base * factor * 100) / 100;
}

function hash01(value) {
  const hex = createHash("sha256").update(String(value)).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) / 0xffffffff;
}

async function tableExists(client, table) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return result.rowCount > 0;
}

async function columnSet(client, table) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function pickExercise(client, patterns, used) {
  for (const pattern of patterns) {
    const result = await client.query(
      `SELECT exercise_id, name, equipment_key, gif_url
       FROM exercise_catalog
       WHERE lower(name) ~ $1
       ORDER BY name
       LIMIT 12`,
      [pattern],
    );
    const row = result.rows.find((item) => !used.has(item.exercise_id));
    if (row) {
      used.add(row.exercise_id);
      return row;
    }
  }
  const fallback = await client.query(
    `SELECT exercise_id, name, equipment_key, gif_url
     FROM exercise_catalog
     ORDER BY name
     LIMIT 40`,
  );
  const row = fallback.rows.find((item) => !used.has(item.exercise_id));
  if (row) {
    used.add(row.exercise_id);
    return row;
  }
  return null;
}

async function ensureDemoUser(client) {
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const userCols = await columnSet(client, "app_users");
  const hasSupabase = userCols.has("supabase_user_id");
  const existing = await client.query(
    hasSupabase
      ? `SELECT user_id, supabase_user_id FROM app_users WHERE email = $1`
      : `SELECT user_id FROM app_users WHERE email = $1`,
    [DEMO_EMAIL],
  );
  if (existing.rowCount) {
    const user = existing.rows[0];
    await client.query(
      `UPDATE app_users
       SET password_hash = $1, display_name = $2
       WHERE user_id = $3`,
      [passwordHash, DEMO_NAME, user.user_id],
    );
    return {
      userId: Number(user.user_id),
      supabaseUserId: user.supabase_user_id ?? null,
      created: false,
    };
  }

  const inserted = await client.query(
    `INSERT INTO app_users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING user_id`,
    [DEMO_EMAIL, passwordHash, DEMO_NAME],
  );
  return {
    userId: Number(inserted.rows[0].user_id),
    supabaseUserId: null,
    created: true,
  };
}

async function wipeDemoData(client, userId) {
  const tables = [
    "workout_journal_sessions",
    "workouts",
    "nutrition_intake_entries",
    "nutrition_plans",
    "budget_transactions",
    "fiscal_annual_totals",
    "tax_annual_totals",
    "account_map_edges",
    "account_map_layouts",
    "budget_month_assignments",
    "income",
    "expenses",
    "income_sources",
    "investment_sources",
    "savings_sources",
    "estate_documents",
    "estate_entries",
    "vehicle_service_records",
    "debt",
    "insurance",
    "real_estate",
    "asset_vehicles",
    "cash_and_investments",
    "asset_inventory",
    "budgets",
  ];

  for (const table of tables) {
    if (await tableExists(client, table)) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    }
  }
}

async function insertEstateEntry(client, userId, row) {
  if (!(await tableExists(client, "estate_entries"))) return;
  await client.query(
    `INSERT INTO estate_entries
      (user_id, group_id, asset_category, classification_type, title, description, value, location)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)`,
    [userId, row.category, row.classification, row.title, row.description, row.value, row.location],
  );
}

async function seedFinancial(client, userId) {
  const inventoryCols = await columnSet(client, "asset_inventory");

  const budgetRes = await client.query(
    `INSERT INTO budgets (user_id, group_id, name, is_active)
     VALUES ($1, NULL, 'Household 2026', TRUE)
     RETURNING budget_id`,
    [userId],
  );
  const budgetId = Number(budgetRes.rows[0].budget_id);

  const checking = await client.query(
    `INSERT INTO cash_and_investments
      (asset_category, acct_type, institution, acct_number, value, acct_support_number,
       institution_url, acct_holder, acct_intent, trust_designated, user_id, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
     RETURNING ci_id`,
    [
      "Cash",
      "Checking account",
      "First National Bank",
      "4482",
      8450.32,
      "800-555-0142",
      "https://www.firstnational.example",
      DEMO_NAME,
      "Everyday spending and bill pay",
      false,
      userId,
    ],
  );
  const checkingId = Number(checking.rows[0].ci_id);

  const savings = await client.query(
    `INSERT INTO cash_and_investments
      (asset_category, acct_type, institution, acct_number, value, acct_support_number,
       institution_url, acct_holder, acct_intent, trust_designated, user_id, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
     RETURNING ci_id`,
    [
      "Cash",
      "Savings account",
      "First National Bank",
      "7719",
      22100.0,
      "800-555-0142",
      "https://www.firstnational.example",
      DEMO_NAME,
      "Emergency fund",
      false,
      userId,
    ],
  );
  const savingsId = Number(savings.rows[0].ci_id);

  const brokerage = await client.query(
    `INSERT INTO cash_and_investments
      (asset_category, acct_type, institution, acct_number, value, acct_support_number,
       institution_url, acct_holder, acct_intent, trust_designated, user_id, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
     RETURNING ci_id`,
    [
      "Investment",
      "Brokerage account (taxable)",
      "Vanguard",
      "8821",
      47800.0,
      "877-662-7447",
      "https://www.vanguard.com",
      DEMO_NAME,
      "Taxable index funds",
      false,
      userId,
    ],
  );
  const brokerageId = Number(brokerage.rows[0].ci_id);

  const retirement = await client.query(
    `INSERT INTO cash_and_investments
      (asset_category, acct_type, institution, acct_number, value, acct_support_number,
       institution_url, acct_holder, acct_intent, trust_designated, user_id, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
     RETURNING ci_id`,
    [
      "Investment",
      "Retirement accounts (401(k)/403(b)/457)",
      "Fidelity",
      "1094",
      186400.0,
      "800-343-3548",
      "https://www.fidelity.com",
      DEMO_NAME,
      "Employer 401(k)",
      true,
      userId,
    ],
  );
  const retirementId = Number(retirement.rows[0].ci_id);

  const hsa = await client.query(
    `INSERT INTO cash_and_investments
      (asset_category, acct_type, institution, acct_number, value, acct_support_number,
       institution_url, acct_holder, acct_intent, trust_designated, user_id, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
     RETURNING ci_id`,
    [
      "Investment",
      "Health savings account (HSA)",
      "HealthEquity",
      "3308",
      6400.0,
      "866-346-5800",
      "https://www.healthequity.com",
      DEMO_NAME,
      "Medical savings",
      false,
      userId,
    ],
  );
  const hsaId = Number(hsa.rows[0].ci_id);

  await insertEstateEntry(client, userId, {
    category: "Cash",
    classification: "Checking account",
    title: "First National Bank",
    description: "Everyday spending and bill pay",
    value: 8450.32,
    location: "https://www.firstnational.example",
  });
  await insertEstateEntry(client, userId, {
    category: "Cash",
    classification: "Savings account",
    title: "First National Bank",
    description: "Emergency fund",
    value: 22100,
    location: "https://www.firstnational.example",
  });
  await insertEstateEntry(client, userId, {
    category: "Investment",
    classification: "Brokerage account (taxable)",
    title: "Vanguard",
    description: "Taxable index funds",
    value: 47800,
    location: "https://www.vanguard.com",
  });

  const home = await client.query(
    `INSERT INTO real_estate
      (number, street, city, state, zipcode, value, trust_designated, user_id, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
     RETURNING re_id`,
    ["142", "Maple Street", "Columbus", "OH", "43215", 385000, true, userId],
  );
  const homeId = Number(home.rows[0].re_id);

  const vehicle = await client.query(
    `INSERT INTO asset_vehicles
      (year, make, model, vin, value, age, description, trust_designated, user_id, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
     RETURNING vh_id`,
    [2021, "Honda", "CR-V", "DEMOCRV2021AAAAA1", 24500, 5, "Primary family SUV", false, userId],
  );
  const vehicleId = Number(vehicle.rows[0].vh_id);

  await insertEstateEntry(client, userId, {
    category: "Vehicle",
    classification: "Vehicles (cars/trucks/SUVs)",
    title: "Honda CR-V",
    description: "Primary family SUV",
    value: 24500,
    location: "DEMOCRV2021AAAAA1",
  });

  if (await tableExists(client, "vehicle_service_records")) {
    const services = [
      ["Oil change and filter", "2026-03-12", 42800, 72.4, "Full synthetic"],
      ["Tire rotation", "2026-05-18", 44120, 40.0, null],
      ["Annual inspection", "2026-07-09", 45210, 28.0, "Passed"],
    ];
    for (const [name, date, mileage, cost, notes] of services) {
      await client.query(
        `INSERT INTO vehicle_service_records
          (vh_id, user_id, group_id, service_name, service_date, mileage, cost, notes)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
        [vehicleId, userId, name, date, mileage, cost, notes],
      );
    }
  }

  const mortgage = await client.query(
    `INSERT INTO debt
      (institution, loan_number, loan_type, customer_support_no, address_url, borrower, loan_ammount,
       linked_asset_type, linked_asset_id, user_id, group_id, is_revolving, interest_rate_annual,
       term_months, scheduled_monthly_payment, loan_start_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, FALSE, $11, $12, $13, $14::date)
     RETURNING dbt_id`,
    [
      "Wells Fargo",
      "WF-442198",
      "Mortgage",
      "800-357-6675",
      "https://www.wellsfargo.com",
      DEMO_NAME,
      198400,
      "real_estate",
      homeId,
      userId,
      3.75,
      360,
      1420,
      "2020-06-01",
    ],
  );
  const mortgageId = Number(mortgage.rows[0].dbt_id);

  const autoLoan = await client.query(
    `INSERT INTO debt
      (institution, loan_number, loan_type, customer_support_no, address_url, borrower, loan_ammount,
       linked_asset_type, linked_asset_id, user_id, group_id, is_revolving, interest_rate_annual,
       term_months, scheduled_monthly_payment, loan_start_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, FALSE, $11, $12, $13, $14::date)
     RETURNING dbt_id`,
    [
      "Honda Financial",
      "HF-881002",
      "Auto loan",
      "800-708-6555",
      "https://www.hondafinancialservices.com",
      DEMO_NAME,
      8200,
      "asset_vehicles",
      vehicleId,
      userId,
      4.9,
      60,
      310,
      "2023-09-15",
    ],
  );
  const autoLoanId = Number(autoLoan.rows[0].dbt_id);

  const card = await client.query(
    `INSERT INTO debt
      (institution, loan_number, loan_type, customer_support_no, address_url, borrower, loan_ammount,
       linked_asset_type, linked_asset_id, user_id, group_id, is_revolving, interest_rate_annual,
       term_months, scheduled_monthly_payment, loan_start_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, NULL, TRUE, $9, NULL, $10, $11::date)
     RETURNING dbt_id`,
    [
      "Chase",
      "****4412",
      "Credit card",
      "800-432-3117",
      "https://www.chase.com",
      DEMO_NAME,
      2340,
      userId,
      21.99,
      75,
      "2019-04-01",
    ],
  );
  const cardId = Number(card.rows[0].dbt_id);

  const policies = [
    [DEMO_NAME, "HO-3-55210", "142 Maple Street", 385000, "Homeowners", "https://www.statefarm.com"],
    [DEMO_NAME, "AU-22918", "2021 Honda CR-V", 100000, "Auto liability", "https://www.statefarm.com"],
    [DEMO_NAME, "LIFE-1044", DEMO_NAME, 250000, "Term life", "https://www.northwesternmutual.com"],
  ];
  for (const [holder, number, covered, amount, intent, url] of policies) {
    await client.query(
      `INSERT INTO insurance
        (policy_holder, polocy_number, entity_covered, policy_amt, intent, institution_url, user_id, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
      [holder, number, covered, amount, intent, url, userId],
    );
  }

  const inventoryRows = [
    ["Living room furniture", "Sectional sofa and coffee table", 3200, "Living room"],
    ["Electronics (TVs/computers/tablets)", "55-inch TV, laptop, tablet", 2800, "Home office"],
    ["Jewelry", "Wedding band and watch", 1500, "Home safe"],
    ["Major appliances (refrigerator/oven/washer/dryer)", "Kitchen and laundry set", 4100, "Home"],
  ];
  for (const [classification, title, value, location] of inventoryRows) {
    if (inventoryCols.has("asset_classification")) {
      await client.query(
        `INSERT INTO asset_inventory
          (user_id, group_id, asset_classification, title, description, value, location)
         VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
        [userId, classification, title, title, value, location],
      );
    } else {
      await client.query(
        `INSERT INTO asset_inventory
          (user_id, group_id, asset_category, classification_type, title, description, value, location)
         VALUES ($1, NULL, 'Asset', $2, $3, $4, $5, $6)`,
        [userId, classification, title, title, value, location],
      );
    }
    await insertEstateEntry(client, userId, {
      category: "Asset",
      classification,
      title,
      description: title,
      value,
      location,
    });
  }

  const incomeSource = await client.query(
    `INSERT INTO income_sources (user_id, group_id, name) VALUES ($1, NULL, $2) RETURNING source_id`,
    [userId, "Horizon Software"],
  );
  const incomeSourceId = Number(incomeSource.rows[0].source_id);
  const savingsSource = await client.query(
    `INSERT INTO savings_sources (user_id, group_id, name) VALUES ($1, NULL, $2) RETURNING source_id`,
    [userId, "Emergency fund"],
  );
  const savingsSourceId = Number(savingsSource.rows[0].source_id);
  const investmentSource = await client.query(
    `INSERT INTO investment_sources (user_id, group_id, name) VALUES ($1, NULL, $2) RETURNING source_id`,
    [userId, "Brokerage DCA"],
  );
  const investmentSourceId = Number(investmentSource.rows[0].source_id);

  async function insertIncome(type, category, sub, monthly, desc, destId = null) {
    const result = await client.query(
      `INSERT INTO income
        (user_id, group_id, budget_id, income_type, income_category, sub_category,
         income_category_desc, income_category_monthly_amt, income_category_annual_amt, cash_investment_id)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING income_id`,
      [userId, budgetId, type, category, sub, desc, monthly, monthly * 12, destId],
    );
    return Number(result.rows[0].income_id);
  }

  async function insertExpense(type, category, sub, monthly, desc, destId = null, fromId = null, debtId = null) {
    const result = await client.query(
      `INSERT INTO expenses
        (user_id, group_id, budget_id, expense_type, expense_category, sub_category,
         expense_category_desc, monthly_budget_amt, annual_budget_amt, cash_investment_id,
         from_cash_investment_id, debt_id)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING expense_id`,
      [userId, budgetId, type, category, sub, desc, monthly, monthly * 12, destId, fromId, debtId],
    );
    return Number(result.rows[0].expense_id);
  }

  const incomeIds = {
    salary: await insertIncome("gross", "Pay", "Salary", 6250, "Semi-monthly paycheck", checkingId),
    interest: await insertIncome("interest", "Pay", "Savings interest", 18, "High-yield savings", savingsId),
    federal: await insertIncome("tax", "Tax", "Federal", 750, "Federal withholding"),
    state: await insertIncome("tax", "Tax", "State", 250, "Ohio withholding"),
    ss: await insertIncome("tax", "Tax", "Social Security", 387.5, "FICA OASDI"),
    medicare: await insertIncome("tax", "Tax", "Medicare", 90.63, "FICA Medicare"),
    local: await insertIncome("tax", "Tax", "Local", 93.75, "City tax"),
    k401: await insertIncome("deduction", "Deduction", "401k", 375, "Pre-tax 401(k)", retirementId),
    medical: await insertIncome("deduction", "Deduction", "Medical", 180, "Medical premium"),
    dental: await insertIncome("deduction", "Deduction", "Dental", 40, "Dental premium"),
    vision: await insertIncome("deduction", "Deduction", "Vision", 12, "Vision premium"),
    hsa: await insertIncome("deduction", "Deduction", "HSA", 150, "HSA contribution", hsaId),
  };

  const expenseIds = {
    mortgage: await insertExpense("expense", "Housing", "Mortgage", 1420, "Wells Fargo mortgage", null, checkingId, mortgageId),
    utilities: await insertExpense("expense", "Housing", "Utilities", 220, "Electric, gas, water", null, checkingId),
    internet: await insertExpense("expense", "Housing", "Internet", 80, "Fiber internet", null, checkingId),
    groceries: await insertExpense("expense", "Food", "Groceries", 650, "Weekly groceries", null, checkingId),
    dining: await insertExpense("expense", "Food", "Dining out", 180, "Restaurants and takeout", null, checkingId),
    autoLoan: await insertExpense("expense", "Transport", "Auto loan", 310, "Honda Financial", null, checkingId, autoLoanId),
    gas: await insertExpense("expense", "Transport", "Gas", 160, "Fuel", null, checkingId),
    autoIns: await insertExpense("expense", "Transport", "Auto insurance", 140, "State Farm auto", null, checkingId),
    card: await insertExpense("expense", "Debt", "Credit card", 150, "Chase card payment", null, checkingId, cardId),
    phone: await insertExpense("expense", "Personal", "Phone", 90, "Mobile plan", null, checkingId),
    subs: await insertExpense("expense", "Personal", "Subscriptions", 45, "Streaming and apps", null, checkingId),
    emergency: await insertExpense("savings", "Savings", "Emergency fund", 400, "Transfer to savings", savingsId, checkingId),
    brokerage: await insertExpense("investment", "Investment", "Brokerage", 300, "Monthly index buy", brokerageId, checkingId),
  };

  async function insertTx({
    date,
    amount,
    description,
    incomeId = null,
    expenseId = null,
    destId = null,
    fromId = null,
    debtId = null,
    incomeSource = null,
    savingsSource = null,
    investmentSource = null,
    itemKind,
    itemType,
    category,
    subCategory,
  }) {
    await client.query(
      `INSERT INTO budget_transactions (
         user_id, group_id, income_id, expense_id, transaction_date, amount, description,
         cash_investment_id, debt_id, from_cash_investment_id, income_source_id,
         investment_source_id, savings_source_id, item_kind, item_type, category, sub_category
       ) VALUES ($1, NULL, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        userId,
        incomeId,
        expenseId,
        date,
        amount,
        description,
        destId,
        debtId,
        fromId,
        incomeSource,
        investmentSource,
        savingsSource,
        itemKind,
        itemType,
        category,
        subCategory,
      ],
    );
  }

  for (let month = 1; month <= 8; month += 1) {
    const payDays = [1, 15];
    for (const day of payDays) {
      const date = isoDate(YEAR, month, day);
      const half = 3125;
      await insertTx({
        date,
        amount: half,
        description: "Paycheck",
        incomeId: incomeIds.salary,
        destId: checkingId,
        incomeSource: incomeSourceId,
        itemKind: "income",
        itemType: "gross",
        category: "Pay",
        subCategory: "Salary",
      });
      const taxHalf = [
        [incomeIds.federal, 375, "Federal withholding", "Federal"],
        [incomeIds.state, 125, "State withholding", "State"],
        [incomeIds.ss, 193.75, "Social Security", "Social Security"],
        [incomeIds.medicare, 45.32, "Medicare", "Medicare"],
        [incomeIds.local, 46.88, "Local tax", "Local"],
        [incomeIds.k401, 187.5, "401(k) deferral", "401k"],
      ];
      for (const [id, amount, desc, sub] of taxHalf) {
        await insertTx({
          date,
          amount,
          description: desc,
          incomeId: id,
          destId: id === incomeIds.k401 ? retirementId : null,
          itemKind: "income",
          itemType: id === incomeIds.k401 ? "deduction" : "tax",
          category: id === incomeIds.k401 ? "Deduction" : "Tax",
          subCategory: sub,
        });
      }
    }

    const first = isoDate(YEAR, month, 1);
    await insertTx({
      date: first,
      amount: 180,
      description: "Medical premium",
      incomeId: incomeIds.medical,
      itemKind: "income",
      itemType: "deduction",
      category: "Deduction",
      subCategory: "Medical",
    });
    await insertTx({
      date: first,
      amount: 40,
      description: "Dental premium",
      incomeId: incomeIds.dental,
      itemKind: "income",
      itemType: "deduction",
      category: "Deduction",
      subCategory: "Dental",
    });
    await insertTx({
      date: first,
      amount: 12,
      description: "Vision premium",
      incomeId: incomeIds.vision,
      itemKind: "income",
      itemType: "deduction",
      category: "Deduction",
      subCategory: "Vision",
    });
    await insertTx({
      date: first,
      amount: 150,
      description: "HSA contribution",
      incomeId: incomeIds.hsa,
      destId: hsaId,
      itemKind: "income",
      itemType: "deduction",
      category: "Deduction",
      subCategory: "HSA",
    });
    await insertTx({
      date: isoDate(YEAR, month, daysInMonth(YEAR, month)),
      amount: jitter(18, 0.15),
      description: "Savings interest",
      incomeId: incomeIds.interest,
      destId: savingsId,
      itemKind: "income",
      itemType: "interest",
      category: "Pay",
      subCategory: "Savings interest",
    });

    await insertTx({
      date: isoDate(YEAR, month, 3),
      amount: 1420,
      description: "Mortgage payment",
      expenseId: expenseIds.mortgage,
      fromId: checkingId,
      debtId: mortgageId,
      itemKind: "expense",
      itemType: "expense",
      category: "Housing",
      subCategory: "Mortgage",
    });
    await insertTx({
      date: isoDate(YEAR, month, 8),
      amount: jitter(220),
      description: "Utilities",
      expenseId: expenseIds.utilities,
      fromId: checkingId,
      itemKind: "expense",
      itemType: "expense",
      category: "Housing",
      subCategory: "Utilities",
    });
    await insertTx({
      date: isoDate(YEAR, month, 5),
      amount: 80,
      description: "Internet",
      expenseId: expenseIds.internet,
      fromId: checkingId,
      itemKind: "expense",
      itemType: "expense",
      category: "Housing",
      subCategory: "Internet",
    });
    await insertTx({
      date: isoDate(YEAR, month, 4),
      amount: 310,
      description: "Auto loan",
      expenseId: expenseIds.autoLoan,
      fromId: checkingId,
      debtId: autoLoanId,
      itemKind: "expense",
      itemType: "expense",
      category: "Transport",
      subCategory: "Auto loan",
    });
    await insertTx({
      date: isoDate(YEAR, month, 12),
      amount: 140,
      description: "Auto insurance",
      expenseId: expenseIds.autoIns,
      fromId: checkingId,
      itemKind: "expense",
      itemType: "expense",
      category: "Transport",
      subCategory: "Auto insurance",
    });
    await insertTx({
      date: isoDate(YEAR, month, 18),
      amount: 150,
      description: "Credit card payment",
      expenseId: expenseIds.card,
      fromId: checkingId,
      debtId: cardId,
      itemKind: "expense",
      itemType: "expense",
      category: "Debt",
      subCategory: "Credit card",
    });
    await insertTx({
      date: isoDate(YEAR, month, 7),
      amount: 90,
      description: "Phone",
      expenseId: expenseIds.phone,
      fromId: checkingId,
      itemKind: "expense",
      itemType: "expense",
      category: "Personal",
      subCategory: "Phone",
    });
    await insertTx({
      date: isoDate(YEAR, month, 2),
      amount: 45,
      description: "Subscriptions",
      expenseId: expenseIds.subs,
      fromId: checkingId,
      itemKind: "expense",
      itemType: "expense",
      category: "Personal",
      subCategory: "Subscriptions",
    });
    await insertTx({
      date: isoDate(YEAR, month, 16),
      amount: 400,
      description: "Emergency fund transfer",
      expenseId: expenseIds.emergency,
      destId: savingsId,
      savingsSource: savingsSourceId,
      itemKind: "expense",
      itemType: "savings",
      category: "Savings",
      subCategory: "Emergency fund",
    });
    await insertTx({
      date: isoDate(YEAR, month, 17),
      amount: 300,
      description: "Brokerage contribution",
      expenseId: expenseIds.brokerage,
      destId: brokerageId,
      investmentSource: investmentSourceId,
      itemKind: "expense",
      itemType: "investment",
      category: "Investment",
      subCategory: "Brokerage",
    });

    for (const day of [6, 13, 20, 27]) {
      if (day > daysInMonth(YEAR, month)) continue;
      await insertTx({
        date: isoDate(YEAR, month, day),
        amount: jitter(162.5, 0.12),
        description: "Groceries",
        expenseId: expenseIds.groceries,
        fromId: checkingId,
        itemKind: "expense",
        itemType: "expense",
        category: "Food",
        subCategory: "Groceries",
      });
    }
    for (const day of [9, 22]) {
      await insertTx({
        date: isoDate(YEAR, month, day),
        amount: jitter(90, 0.2),
        description: "Dining out",
        expenseId: expenseIds.dining,
        fromId: checkingId,
        itemKind: "expense",
        itemType: "expense",
        category: "Food",
        subCategory: "Dining out",
      });
    }
    for (const day of [10, 24]) {
      await insertTx({
        date: isoDate(YEAR, month, day),
        amount: jitter(80, 0.15),
        description: "Gas",
        expenseId: expenseIds.gas,
        fromId: checkingId,
        itemKind: "expense",
        itemType: "expense",
        category: "Transport",
        subCategory: "Gas",
      });
    }
  }

  const fiscal = [
    ["income", "gross", 50000],
    ["income", "net", 31369.12],
    ["income", "taxable", 43944],
    ["pretax", "medical", 1440],
    ["pretax", "dental", 320],
    ["pretax", "vision", 96],
    ["pretax", "401k", 3000],
    ["pretax", "hsa", 1200],
    ["posttax", "supplemental_life", 240],
    ["posttax", "stock_option_offset", 0],
  ];
  for (const [section, kind, amount] of fiscal) {
    await client.query(
      `INSERT INTO fiscal_annual_totals
         (budget_id, user_id, group_id, tax_year, section, total_kind, total_amount, updated_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, NOW())`,
      [budgetId, userId, YEAR, section, kind, amount],
    );
  }

  const taxes = [
    ["federal", 6000],
    ["state", 2000],
    ["social_security", 3100],
    ["medicare", 725],
    ["local", 750],
  ];
  for (const [kind, amount] of taxes) {
    await client.query(
      `INSERT INTO tax_annual_totals
         (budget_id, user_id, group_id, tax_year, tax_kind, total_amount, updated_at)
       VALUES ($1, $2, NULL, $3, $4, $5, NOW())`,
      [budgetId, userId, YEAR, kind, amount],
    );
  }

  if (await tableExists(client, "account_map_edges")) {
    const edges = [
      ["income", incomeIds.salary, "cash_and_investments", checkingId, "deposit"],
      ["cash_and_investments", checkingId, "expense", expenseIds.mortgage, "flow"],
      ["expense", expenseIds.mortgage, "debt", mortgageId, "debt_payment"],
      ["debt", mortgageId, "real_estate", homeId, "secures"],
      ["expense", expenseIds.autoLoan, "debt", autoLoanId, "debt_payment"],
      ["debt", autoLoanId, "asset_vehicles", vehicleId, "secures"],
      ["cash_and_investments", checkingId, "cash_and_investments", savingsId, "transfer"],
      ["expense", expenseIds.emergency, "cash_and_investments", savingsId, "deposit"],
      ["expense", expenseIds.brokerage, "cash_and_investments", brokerageId, "deposit"],
    ];
    for (const [fromType, fromId, toType, toId, kind] of edges) {
      await client.query(
        `INSERT INTO account_map_edges
          (user_id, group_id, budget_id, from_type, from_id, to_type, to_id, edge_kind)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [userId, budgetId, fromType, fromId, toType, toId, kind],
      );
    }
  }

  return { budgetId, checkingId, savingsId, brokerageId, retirementId, hsaId };
}

async function seedPhysical(client, userId) {
  await client.query(
    `INSERT INTO nutrition_plans (user_id, name, kcal, protein_g, fat_g, carb_g)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, "Daily plan", 2200, 150, 70, 220],
  );

  const meals = {
    breakfast: [
      ["Oatmeal with berries", 1, 68, "1 bowl", 320, 12, 7, 54, 8],
      ["Greek yogurt", 1, 170, "1 cup", 150, 20, 4, 8, 8],
      ["Scrambled eggs and toast", 1, 180, "2 eggs + 1 slice", 340, 22, 18, 22, 7],
    ],
    lunch: [
      ["Grilled chicken salad", 1, 320, "1 bowl", 480, 42, 18, 22, 12],
      ["Turkey sandwich", 1, 210, "1 sandwich", 430, 28, 12, 46, 12],
      ["Rice bowl with vegetables", 1, 350, "1 bowl", 520, 24, 14, 68, 13],
    ],
    dinner: [
      ["Salmon, rice, and broccoli", 1, 420, "1 plate", 610, 41, 22, 48, 18],
      ["Pasta with turkey meatballs", 1, 380, "1 plate", 640, 36, 18, 72, 18],
      ["Stir-fry chicken and vegetables", 1, 360, "1 plate", 560, 38, 16, 46, 19],
    ],
    snack: [
      ["Apple and peanut butter", 1, 180, "1 apple + 1 tbsp", 190, 5, 8, 24, 16],
      ["Protein shake", 1, 325, "1 scoop", 140, 25, 2, 6, 16],
      ["Trail mix", 1, 40, "1 handful", 180, 6, 12, 14, 20],
    ],
  };

  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(Date.UTC(YEAR, 7, 30));
    day.setUTCDate(day.getUTCDate() - offset);
    const eatenOn = day.toISOString().slice(0, 10);
    const skipDinner = offset === 4;
    for (const [meal, options] of Object.entries(meals)) {
      if (meal === "dinner" && skipDinner) continue;
      const choice = options[offset % options.length];
      const [food, quantity, grams, label, kcal, protein, fat, carb, hour] = choice;
      const eatenAt = new Date(`${eatenOn}T${pad2(hour)}:15:00.000Z`);
      await client.query(
        `INSERT INTO nutrition_intake_entries
          (user_id, eaten_on, eaten_at, meal, quantity, gram_weight, food_name,
           kcal, protein_g, fat_g, carb_g, portion_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [userId, eatenOn, eatenAt, meal, quantity, grams, food, kcal, protein, fat, carb, label],
      );
    }
  }

  const used = new Set();
  const squat = await pickExercise(client, ["\\bsquat\\b", "goblet squat"], used);
  const bench = await pickExercise(client, ["bench press", "\\bpress\\b"], used);
  const row = await pickExercise(client, ["\\brow\\b", "dumbbell row"], used);
  const deadlift = await pickExercise(client, ["deadlift", "rdl"], used);
  const press = await pickExercise(client, ["overhead press", "shoulder press"], used);
  const lunge = await pickExercise(client, ["lunge"], used);
  const plank = await pickExercise(client, ["plank"], used);
  const curl = await pickExercise(client, ["bicep curl", "curl"], used);
  const run = await pickExercise(client, ["run", "jog", "treadmill"], used);
  const bike = await pickExercise(client, ["bike", "cycle", "cycling"], used);
  const stretch = await pickExercise(client, ["hamstring stretch", "stretch"], used);
  const yoga = await pickExercise(client, ["downward", "warrior", "yoga"], used);

  async function createWorkout(name, notes, lines) {
    const workout = await client.query(
      `INSERT INTO workouts (user_id, name, notes) VALUES ($1, $2, $3) RETURNING workout_id`,
      [userId, name, notes],
    );
    const workoutId = Number(workout.rows[0].workout_id);
    let sort = 0;
    for (const line of lines) {
      if (!line?.exercise) continue;
      await client.query(
        `INSERT INTO workout_exercises
          (workout_id, exercise_id, sort_order, sets, reps, weight, weight_unit,
           rest_seconds, duration_seconds, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'lb', $7, $8, NULL)`,
        [
          workoutId,
          line.exercise.exercise_id,
          sort,
          line.sets ?? null,
          line.reps ?? null,
          line.weight ?? null,
          line.rest ?? 90,
          line.duration ?? null,
        ],
      );
      sort += 1;
    }
    return workoutId;
  }

  const strengthId = await createWorkout("Full body strength", "Three times a week gym session", [
    { exercise: squat, sets: 3, reps: 8, weight: 95, rest: 120 },
    { exercise: bench, sets: 3, reps: 8, weight: 70, rest: 90 },
    { exercise: row, sets: 3, reps: 10, weight: 45, rest: 75 },
    { exercise: press, sets: 3, reps: 8, weight: 35, rest: 75 },
    { exercise: lunge, sets: 3, reps: 10, weight: 25, rest: 75 },
    { exercise: plank, sets: 3, reps: null, weight: null, rest: 45, duration: 45 },
  ]);
  const cardioId = await createWorkout("Easy cardio", "Zone 2 finishers", [
    { exercise: run, sets: 1, reps: null, weight: null, rest: 0, duration: 1500 },
    { exercise: bike, sets: 1, reps: null, weight: null, rest: 0, duration: 1200 },
  ]);
  await createWorkout("Mobility reset", "After lifting or rest days", [
    { exercise: stretch, sets: 2, reps: null, weight: null, rest: 20, duration: 45 },
    { exercise: yoga, sets: 2, reps: null, weight: null, rest: 20, duration: 60 },
    { exercise: deadlift, sets: 2, reps: 8, weight: 75, rest: 90 },
    { exercise: curl, sets: 2, reps: 12, weight: 20, rest: 45 },
  ]);

  const journalPlans = [
    { workoutId: strengthId, name: "Full body strength", daysAgo: 12, notes: "Felt strong." },
    { workoutId: cardioId, name: "Easy cardio", daysAgo: 10, notes: "Kept heart rate easy." },
    { workoutId: strengthId, name: "Full body strength", daysAgo: 8, notes: "Added 5 lb on squat." },
    { workoutId: cardioId, name: "Easy cardio", daysAgo: 5, notes: null },
    { workoutId: strengthId, name: "Full body strength", daysAgo: 2, notes: "Cut rest a little." },
  ];

  for (const plan of journalPlans) {
    const performed = new Date(Date.UTC(YEAR, 7, 30, 17, 30, 0));
    performed.setUTCDate(performed.getUTCDate() - plan.daysAgo);
    const session = await client.query(
      `INSERT INTO workout_journal_sessions
        (user_id, workout_id, workout_name, name, notes, performed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING session_id`,
      [userId, plan.workoutId, plan.name, plan.name, plan.notes, performed],
    );
    const sessionId = Number(session.rows[0].session_id);
    const lines = await client.query(
      `SELECT we.exercise_id, we.sort_order, we.sets, we.reps, we.weight, we.weight_unit,
              we.rest_seconds, we.duration_seconds, c.name, c.equipment_key, c.gif_url
       FROM workout_exercises we
       LEFT JOIN exercise_catalog c ON c.exercise_id = we.exercise_id
       WHERE we.workout_id = $1
       ORDER BY we.sort_order`,
      [plan.workoutId],
    );
    for (const line of lines.rows) {
      const logMode = line.duration_seconds != null && !line.reps ? "duration" : "reps";
      const journalEx = await client.query(
        `INSERT INTO workout_journal_exercises
          (session_id, exercise_id, exercise_name, equipment_key, gif_url, log_mode, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING journal_exercise_id`,
        [
          sessionId,
          line.exercise_id,
          line.name || line.exercise_id,
          line.equipment_key,
          line.gif_url,
          logMode,
          line.sort_order,
        ],
      );
      const journalExerciseId = Number(journalEx.rows[0].journal_exercise_id);
      const setCount = Number(line.sets || 1);
      for (let i = 0; i < setCount; i += 1) {
        const bump = i === setCount - 1 ? 0 : 0;
        await client.query(
          `INSERT INTO workout_journal_sets
            (journal_exercise_id, sort_order, reps, weight, weight_unit, duration_seconds, rest_seconds)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            journalExerciseId,
            i,
            line.reps,
            line.weight != null ? Number(line.weight) + bump : null,
            line.weight_unit || "lb",
            line.duration_seconds,
            line.rest_seconds,
          ],
        );
      }
    }
  }
}

async function syncSupabaseAuth(appUserId, existingSupabaseId) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log("Supabase admin not configured; web login still works via local app_users.");
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let supabaseUserId = existingSupabaseId;
  if (!supabaseUserId) {
    const created = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: DEMO_NAME },
    });
    if (created.error) {
      const message = String(created.error.message || "");
      const already =
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("registered") ||
        created.error.code === "email_exists";
      if (!already) {
        console.warn(`Supabase createUser skipped: ${message}`);
        return null;
      }
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = listed.data?.users?.find(
        (user) => user.email?.trim().toLowerCase() === DEMO_EMAIL,
      );
      supabaseUserId = match?.id ?? null;
    } else {
      supabaseUserId = created.data?.user?.id ?? null;
    }
  }

  if (supabaseUserId) {
    const updated = await admin.auth.admin.updateUserById(supabaseUserId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: DEMO_NAME },
    });
    if (updated.error) {
      console.warn(`Supabase password update skipped: ${updated.error.message}`);
    }
  }

  return supabaseUserId;
}

loadEnv();

const client = createDbClient();
await client.connect();

try {
  await client.query("BEGIN");
  const { userId, supabaseUserId, created } = await ensureDemoUser(client);
  console.log(`${created ? "Created" : "Updated"} ${DEMO_EMAIL} (user_id=${userId})`);
  await wipeDemoData(client, userId);
  await seedFinancial(client, userId);
  await seedPhysical(client, userId);
  await client.query("COMMIT");

  const linkedId = await syncSupabaseAuth(userId, supabaseUserId);
  const userCols = await columnSet(client, "app_users");
  if (linkedId && userCols.has("supabase_user_id")) {
    await client.query(`UPDATE app_users SET supabase_user_id = $1 WHERE user_id = $2`, [
      linkedId,
      userId,
    ]);
    console.log("Linked Supabase Auth user.");
  }

  console.log("Demo Financial and Physical data loaded.");
  console.log(`Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Demo seed failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
