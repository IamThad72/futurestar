import { roundMoney } from "./federalTaxEstimate.js";

/** City of Wooster / Wayne County / ZIP 44691 local income tax. */

export const WOOSTER_LOCAL_TAX = {
  city: "Wooster",
  county: "Wayne County",
  zip: "44691",
  schoolDistrict: "Wooster CSD",
  schoolDistrictCode: "8510",
  cityRate: 0.015,
  schoolDistrictRate: 0,
};

/**
 * Municipal qualifying wages (ORC 718 / IRC 3121): pretax medical, dental, vision,
 * and HSA reduce the base; traditional 401(k) does not.
 */
export function woosterQualifyingWages({
  gross = 0,
  medical = 0,
  dental = 0,
  vision = 0,
  hsa = 0,
  taxableFallback = 0,
} = {}) {
  const g = roundMoney(Math.max(0, gross));
  if (g <= 0) return roundMoney(Math.max(0, taxableFallback));
  return roundMoney(
    Math.max(
      0,
      g -
        Math.max(0, Number(medical) || 0) -
        Math.max(0, Number(dental) || 0) -
        Math.max(0, Number(vision) || 0) -
        Math.max(0, Number(hsa) || 0),
    ),
  );
}

/**
 * Wooster resident local tax: 1.5% city tax on qualifying wages.
 * Wooster CSD has no school district income tax; Wayne County has no income tax.
 */
export function estimateWoosterLocalTax({
  qualifyingWages = 0,
  localWithheld = 0,
} = {}) {
  const wages = roundMoney(Math.max(0, qualifyingWages));
  const cityTax = roundMoney(wages * WOOSTER_LOCAL_TAX.cityRate);
  const schoolDistrictTax = roundMoney(wages * WOOSTER_LOCAL_TAX.schoolDistrictRate);
  const estimatedLocalTax = roundMoney(cityTax + schoolDistrictTax);
  const withheld = roundMoney(Math.max(0, localWithheld));
  const balance = roundMoney(estimatedLocalTax - withheld);

  return {
    city: WOOSTER_LOCAL_TAX.city,
    county: WOOSTER_LOCAL_TAX.county,
    zip: WOOSTER_LOCAL_TAX.zip,
    schoolDistrict: WOOSTER_LOCAL_TAX.schoolDistrict,
    schoolDistrictCode: WOOSTER_LOCAL_TAX.schoolDistrictCode,
    cityRate: WOOSTER_LOCAL_TAX.cityRate,
    schoolDistrictRate: WOOSTER_LOCAL_TAX.schoolDistrictRate,
    qualifyingWages: wages,
    cityTax,
    schoolDistrictTax,
    estimatedLocalTax,
    localWithheld: withheld,
    balance,
  };
}
