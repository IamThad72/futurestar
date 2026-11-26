import assert from "node:assert/strict";
import test from "node:test";
import { isDuplicateScreenTitle } from "../utils/titleDedupe.js";

test("page heading that repeats the toolbar title is a duplicate", () => {
  assert.equal(isDuplicateScreenTitle("Budget Tracker", "Budget Tracker", "/cash_flow_tracker"), true);
  assert.equal(isDuplicateScreenTitle("  Estate   Management\n", "Estate Management", "/estate_mgmt"), true);
  assert.equal(isDuplicateScreenTitle("You", "You", "/account"), true);
  assert.equal(isDuplicateScreenTitle("Tax", "Tax", "/tax/2026"), true);
});

test("section home headings match their short tab titles", () => {
  assert.equal(isDuplicateScreenTitle("Money", "Money", "/financial"), true);
  assert.equal(isDuplicateScreenTitle("Faith", "Faith", "/spiritual"), true);
  assert.equal(isDuplicateScreenTitle("Body", "Body", "/physical/"), true);
  assert.equal(isDuplicateScreenTitle("Money", "Investments", "/financial"), true);
  assert.equal(isDuplicateScreenTitle("Money", "Investments", "/investments"), false);
});

test("headings that add information are kept", () => {
  assert.equal(isDuplicateScreenTitle("Good afternoon, Thaddeus", "Today", "/today"), false);
  assert.equal(isDuplicateScreenTitle("2021 Honda CR-V", "Vehicle", "/garage/4"), false);
  assert.equal(isDuplicateScreenTitle("Estate Management", "Documents", "/estate_mgmt"), false);
  assert.equal(isDuplicateScreenTitle("", "Today", "/today"), false);
});
