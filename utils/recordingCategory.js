/** Category identity for actuals, independent of which budget plan is open. */

export function classificationMatchKey(itemType, category, subCategory) {
  const type = String(itemType ?? "")
    .trim()
    .toLowerCase();
  const cat = String(category ?? "")
    .trim()
    .toLowerCase();
  const sub = String(subCategory ?? "")
    .trim()
    .toLowerCase();
  return `${type}|${cat}|${sub}`;
}

export function recordingMatchKey(itemKind, itemType, category, subCategory) {
  const kind = itemKind === "income" ? "income" : "expense";
  return `${kind}|${classificationMatchKey(itemType, category, subCategory)}`;
}

export function classSelectionKey(itemKind, itemType, category, subCategory) {
  return (
    "class:" +
    encodeURIComponent(
      JSON.stringify({
        item_kind: itemKind === "income" ? "income" : "expense",
        item_type: String(itemType ?? "").trim(),
        category: String(category ?? "").trim(),
        sub_category: subCategory != null && String(subCategory).trim() ? String(subCategory).trim() : null,
      }),
    )
  );
}

export function parseClassSelectionKey(key) {
  const raw = String(key ?? "");
  if (!raw.startsWith("class:")) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(6)));
    const itemKind = parsed?.item_kind === "income" ? "income" : parsed?.item_kind === "expense" ? "expense" : null;
    const category = String(parsed?.category ?? "").trim();
    if (!itemKind || !category) return null;
    const defaultType = itemKind === "income" ? "gross" : "expense";
    const itemType = String(parsed?.item_type ?? "").trim() || defaultType;
    const sub =
      parsed?.sub_category != null && String(parsed.sub_category).trim()
        ? String(parsed.sub_category).trim()
        : null;
    return {
      item_kind: itemKind,
      item_type: itemType,
      category,
      sub_category: sub,
    };
  } catch {
    return null;
  }
}

export function categoryOptionValue(item) {
  if (item?.id != null && item.id !== "" && Number(item.id) > 0) return String(item.id);
  if (item?.selection_key) return String(item.selection_key);
  const kind = item?.item_kind === "income" || item?.type === "income" ? "income" : "expense";
  const itemType =
    item?.item_type ||
    (kind === "income" ? item?.income_type || "gross" : item?.expense_type || "expense");
  return classSelectionKey(kind, itemType, item?.category, item?.sub_category);
}
