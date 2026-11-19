const OZ_IN_GRAMS = 28.349523125;

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function gramsFromProduct(product) {
  const unit = String(product?.serving_quantity_unit || "").toLowerCase();
  const qty = numberOrNull(product?.serving_quantity);
  if (qty > 0 && ["g", "gr", "gram", "grams"].includes(unit)) return qty;
  const text = String(product?.serving_size || "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (match) return Number(match[1]);
  if (qty > 0 && ["ml", "milliliter", "milliliters"].includes(unit)) return qty;
  return null;
}

function perServing(nutriments, key, grams) {
  const serving = numberOrNull(nutriments?.[`${key}_serving`]);
  if (serving != null) return serving;
  const per100 = numberOrNull(nutriments?.[`${key}_100g`]);
  if (per100 != null && grams > 0) return (per100 * grams) / 100;
  return null;
}

export function foodFromOpenFoodFacts(payload) {
  const product = payload?.product || payload;
  if (!product || payload?.status === 0) return null;
  const nutriments = product.nutriments || {};
  const labeledGrams = gramsFromProduct(product);
  const grams = labeledGrams || (numberOrNull(nutriments["energy-kcal_100g"]) != null ? 100 : null);
  const kcal = perServing(nutriments, "energy-kcal", grams);
  const name = String(product.product_name || product.product_name_en || "").trim();
  if (!(grams > 0) || kcal == null || !name) return null;
  const brand = String(product.brands || "").split(",")[0].trim();
  const titled = brand && !name.toLowerCase().includes(brand.toLowerCase())
    ? `${brand} ${name}`
    : name;
  const serving = String(product.serving_size || "").trim() || (labeledGrams ? `${Math.round(grams)} g` : "100 g");
  return {
    name: titled.slice(0, 160),
    serving: serving.slice(0, 80),
    serving_g: Math.round(grams * 10) / 10,
    serving_oz: Math.round((grams / OZ_IN_GRAMS) * 100) / 100,
    kcal: Math.round(kcal),
    protein_g: round1(perServing(nutriments, "proteins", grams) ?? 0),
    fat_g: round1(perServing(nutriments, "fat", grams) ?? 0),
    carb_g: round1(perServing(nutriments, "carbohydrates", grams) ?? 0),
  };
}
