/** Choose recent foods that fit the calories and protein still left today. */

export function pickFoodsForGap(foods, remaining) {
  const kcalGap = Number(remaining?.kcal);
  const proteinGap = Number(remaining?.protein_g);
  if (!Number.isFinite(kcalGap) || kcalGap < 40) return [];
  const ranked = (foods || [])
    .filter((food) => Number(food.kcal) > 0 && Number(food.kcal) <= kcalGap + 40)
    .sort((a, b) => {
      if (proteinGap > 8) {
        const aScore = Number(a.protein_g) / Number(a.kcal);
        const bScore = Number(b.protein_g) / Number(b.kcal);
        return bScore - aScore;
      }
      return Number(a.kcal) - Number(b.kcal);
    });
  const picked = [];
  let kcal = 0;
  let protein = 0;
  for (const food of ranked) {
    if (picked.length >= 3) break;
    if (kcal + Number(food.kcal) > kcalGap + 40) continue;
    picked.push(food);
    kcal += Number(food.kcal);
    protein += Number(food.protein_g) || 0;
    if (protein >= Math.max(proteinGap, 0) && kcal >= kcalGap * 0.45) break;
  }
  return picked;
}
