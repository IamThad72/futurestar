import assert from "node:assert/strict";
import test from "node:test";
import { parseTransactionSentence } from "../utils/transactionSentence.js";
import { buildMonthClose, monthCloseSentence } from "../utils/monthCloseFacts.js";
import { candidateMerchants } from "../utils/budgetLineSuggestions.js";
import { describeHoldings } from "../utils/holdingsNote.js";
import { parseSessionSentence } from "../utils/sessionSentence.js";
import { dueServices } from "../utils/serviceDue.js";
import { mirrorFacts, mirrorSentence } from "../utils/spiritualMirror.js";
import { pickFoodsForGap } from "../utils/mealGap.js";
import { summarizeTraining, todaySentence } from "../utils/todayNote.js";

test("a spoken transaction keeps the amount, yesterday, and the merchant", () => {
  const draft = parseTransactionSentence("Kroger 64.18 yesterday", "2026-11-15");
  assert.deepEqual(draft, { amount: 64.18, date: "2026-11-14", description: "Kroger" });
});

test("month close names the largest overage and an uncategorized merchant", () => {
  const facts = buildMonthClose(
    [{ category: "Food", sub_category: "Groceries", monthly_amount: 100 }],
    [
      { category: "Food", sub_category: "Groceries", amount: 140, description: "Kroger" },
      { category: "Uncategorized", sub_category: "", amount: 12, description: "Corner store" },
    ],
  );
  assert.equal(facts.over.label, "Food / Groceries");
  assert.equal(facts.over.amount, 40);
  assert.equal(facts.unmatched[0].name, "Corner store");
  assert.match(monthCloseSentence(facts, "November 2026"), /Food \/ Groceries is \$40\.00 over budget/);
});

test("repeated merchants that already match a line are skipped", () => {
  const rows = candidateMerchants(
    [
      { description: "netflix.com", count: 4, average: 15.99 },
      { description: "kroger", count: 2, average: 40 },
      { description: "payroll deposit", count: 6, average: 2000 },
    ],
    ["Groceries", "Netflix"],
  );
  assert.equal(rows.length, 0);
});

test("holdings note uses share of current value and the largest gain", () => {
  const lines = describeHoldings([
    { name: "VTI", currentValue: 80, gainDollars: 20 },
    { name: "Cash", currentValue: 20, gainDollars: -5 },
  ]);
  assert.match(lines[0], /VTI is 80% of current value/);
  assert.match(lines[1], /largest unrealized gain is VTI/);
  assert.match(lines[1], /largest unrealized loss is Cash/);
});

test("a spoken session splits sets and minutes", () => {
  const moves = parseSessionSentence("3x8 squat at 185, then 20 minutes on the bike");
  assert.equal(moves.length, 2);
  assert.equal(moves[0].name, "squat");
  assert.equal(moves[0].sets, 3);
  assert.equal(moves[0].reps, 8);
  assert.equal(moves[0].weight, 185);
  assert.equal(moves[1].name, "bike");
  assert.equal(moves[1].durationSeconds, 1200);
});

test("a service is due when the mileage interval has passed", () => {
  const due = dueServices({
    today: "2026-11-15",
    currentMileage: 12000,
    recommended: [{ service_name: "Engine oil and filter change", interval_miles: 5000, interval_months: 6 }],
    known: [{ service_name: "Oil and filter", service_date: "2026-01-01", mileage: 5000 }],
  });
  assert.equal(due.length, 1);
  assert.match(due[0].reason, /miles/);
});

test("the weekly mirror counts virtues and repeated words", () => {
  const facts = mirrorFacts([
    { virtue: "Patience", tomorrow: "Call home", troubled: "hurry at work", shortfall: "" },
    { virtue: "Patience", tomorrow: "", troubled: "hurry again", shortfall: "hurry" },
  ]);
  assert.equal(facts.virtues[0].name, "Patience");
  assert.equal(facts.virtues[0].count, 2);
  assert.equal(facts.tomorrowFilled, 1);
  assert.ok(facts.words.some((word) => word.word === "hurry"));
  assert.match(mirrorSentence(facts), /Patience 2 times/);
});

test("foods that fit the remaining calories are preferred for protein", () => {
  const picked = pickFoodsForGap(
    [
      { name: "yogurt", kcal: 100, protein_g: 15 },
      { name: "soda", kcal: 150, protein_g: 0 },
      { name: "feast", kcal: 900, protein_g: 40 },
    ],
    { kcal: 400, protein_g: 30 },
  );
  assert.equal(picked[0].name, "yogurt");
  assert.ok(picked.every((food) => food.name !== "feast"));
});

test("today names a missing session and a protein gap", () => {
  const training = summarizeTraining(
    [
      { sessionId: 1, day: "2026-11-14", name: "Lift", exerciseName: "Squat" },
      { sessionId: 1, day: "2026-11-14", name: "Lift", exerciseName: "Row" },
    ],
    "2026-11-15",
  );
  assert.equal(training.loggedToday, false);
  assert.equal(training.sessions, 1);
  assert.match(todaySentence({ ...training, proteinRemaining: 40 }), /No session is logged today/);
  assert.match(todaySentence({ ...training, proteinRemaining: 40 }), /40 g short/);
  assert.match(todaySentence({ ...training, proteinRemaining: 40 }), /no mobility/);
});
