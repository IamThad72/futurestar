import assert from "node:assert/strict";
import test from "node:test";
import { foodFromOpenFoodFacts } from "../utils/openFoodFacts.js";

test("maps a labeled serving from Open Food Facts", () => {
  const food = foodFromOpenFoodFacts({
    status: 1,
    product: {
      product_name: "Greek yogurt",
      brands: "Example",
      serving_size: "150 g",
      serving_quantity: 150,
      serving_quantity_unit: "g",
      nutriments: {
        "energy-kcal_serving": 130,
        proteins_serving: 15,
        fat_serving: 4,
        carbohydrates_serving: 8,
      },
    },
  });
  assert.equal(food.name, "Example Greek yogurt");
  assert.equal(food.serving, "150 g");
  assert.equal(food.kcal, 130);
  assert.equal(food.protein_g, 15);
  assert.ok(food.serving_oz > 5);
});

test("scales per-100g values when the serving numbers are missing", () => {
  const food = foodFromOpenFoodFacts({
    product: {
      product_name: "Oats",
      serving_size: "40 g",
      nutriments: {
        "energy-kcal_100g": 380,
        proteins_100g: 13,
        fat_100g: 7,
        carbohydrates_100g: 60,
      },
    },
  });
  assert.equal(food.kcal, 152);
  assert.equal(food.protein_g, 5.2);
  assert.equal(food.carb_g, 24);
});

test("uses 100 g when the package only lists per-100g nutrition", () => {
  const food = foodFromOpenFoodFacts({
    product: {
      product_name: "Nutella",
      brands: "Ferrero",
      nutriments: {
        "energy-kcal_100g": 539,
        proteins_100g: 6.3,
        fat_100g: 30.9,
        carbohydrates_100g: 57.5,
      },
    },
  });
  assert.equal(food.serving, "100 g");
  assert.equal(food.kcal, 539);
  assert.equal(food.fat_g, 30.9);
});

test("returns null when the product has no usable serving", () => {
  assert.equal(foodFromOpenFoodFacts({ status: 0 }), null);
  assert.equal(foodFromOpenFoodFacts({ product: { product_name: "Mystery" } }), null);
});
