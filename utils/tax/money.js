export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

export function nonNegativeMoney(value) {
  return roundMoney(Math.max(0, money(value)));
}

/**
 * Ordinary tax from cumulative bracket tops (`upTo` null is the last bracket).
 * Slice taxes are adjusted so they sum to the rounded total.
 */
export function taxFromBrackets(taxableIncome, brackets) {
  let remaining = Math.max(0, roundMoney(taxableIncome));
  let raw = 0;
  let prev = 0;
  const slices = [];
  for (const bracket of brackets || []) {
    const cap = bracket.upTo == null ? Number.POSITIVE_INFINITY : Number(bracket.upTo);
    const width = cap - prev;
    const slice = Math.min(remaining, width);
    if (slice > 0) {
      const sliceTax = slice * Number(bracket.rate);
      raw += sliceTax;
      slices.push({
        rate: Number(bracket.rate),
        income: roundMoney(slice),
        tax: sliceTax,
      });
      remaining -= slice;
    }
    prev = cap;
    if (remaining <= 0) break;
  }
  const tax = roundMoney(raw);
  if (slices.length) {
    let assigned = 0;
    for (let i = 0; i < slices.length; i += 1) {
      if (i === slices.length - 1) {
        slices[i].tax = roundMoney(tax - assigned);
      } else {
        slices[i].tax = roundMoney(slices[i].tax);
        assigned = roundMoney(assigned + slices[i].tax);
      }
    }
  }
  return { tax, slices };
}

/** Rate on the next dollar of taxable income. A taxable amount sitting on a bracket top uses the next rate. */
export function marginalBracketRate(taxableIncome, brackets) {
  const income = Math.max(0, roundMoney(taxableIncome));
  const list = brackets || [];
  for (const bracket of list) {
    const cap = bracket.upTo == null ? Number.POSITIVE_INFINITY : Number(bracket.upTo);
    if (income < cap) return Number(bracket.rate);
  }
  return list.length ? Number(list[list.length - 1].rate) : 0;
}
