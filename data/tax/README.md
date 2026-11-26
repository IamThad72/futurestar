# Tax estimate rules

These files feed the Tax page. They are published figures used to estimate tax. They are not a filing method, and they omit credits, deductions, and adjustments that are not listed here.

Income on the page is the household year-to-date gross from `fiscal_annual_totals`. Withholding is the household year-to-date amount from `tax_annual_totals`. Net-pay lines stay out of gross (`looksLikeNetIncome`). A full-year view annualizes those amounts by paychecks so far and paychecks per year, or uses the active budget's annual amounts when a paycheck count is not available.

## Deduction types

`deduction_types.json` replaces the hard-coded pre-tax and post-tax keyword lists.

| Class | Examples | Federal and state wages | Social Security and Medicare | Local wages |
| --- | --- | --- | --- | --- |
| Section 125 | Medical, dental, vision, HSA through payroll, FSA, commuter | Reduced | Reduced | Jurisdiction rule |
| Traditional retirement | 401(k), 403(b), 457, TSP | Reduced | Not reduced | Not reduced |
| Post-tax | Roth 401(k), supplemental life, union dues, garnishments, stock or RSU offset | Not reduced | Not reduced | Not reduced |

W-2 Box 1 is gross minus every pre-tax type. Box 3 and Box 5 subtract Section 125 only. Box 3 is capped at the Social Security wage base in the federal file. Employee Social Security is 6.2% of Box 3 and employee Medicare is 1.45% of Box 5, plus 0.9% Additional Medicare above the filing-status threshold. The page flags withholding that exceeds that expectation by more than $1.

A household can override one line's classification in `tax_deduction_overrides`. The override is used the next time that line is saved. Stored year-to-date totals are not rebuilt. The Tax page no longer includes an editor for this. The table stays, and so do `GET` and `PUT /api/tax/deduction-overrides`, because fiscal totals and household linking still use the rows.

## Local wages

`local_wage_rules.json`

Ohio (`OH`) uses municipal qualifying wages: gross minus Section 125. Traditional 401(k), 403(b), 457, and TSP stay in the local base. That is the same rule the previous Wooster estimate used. Other states default to W-2 Box 1 unless the profile picks another rule. City rate and school district rate come from the profile. Nothing is assumed.

## Federal and state

`federal/2025.json`, `federal/2026.json`, `states/2025.json`, `states/2026.json`

Federal brackets, the standard deduction, the child tax credit, and the Social Security wage base follow Rev. Proc. 2024-40 and Rev. Proc. 2025-32, with the Social Security wage base from the SSA COLA fact sheets ($176,100 for 2025 and $184,500 for 2026). Additional Medicare thresholds are the IRS figures ($250,000 joint, $125,000 married filing separately, $200,000 otherwise).

No wage income tax: Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, and Wyoming. Washington's capital-gains tax is not estimated.

Flat-rate states use the rate, standard deduction, personal exemption, zero-rate band, and flat credits compiled by the Tax Foundation. The estimate starts from income after pre-tax. It does not apply state additions, subtractions, or phaseouts. Any other state shows "State estimate not yet available" and does not invent a number.

Ohio is not a flat percentage of AGI. For 2026 the brackets match the estimate this app used before tax profiles: no tax through $26,050, then $332 plus 2.75%. The personal exemption is $2,350, $2,100, or $1,850 by MAGI, and $0 at $500,000. The exemption count is the taxpayer, plus a spouse on a joint return, plus children under 17 and other dependents. The joint filing credit applies to a joint return under the $500,000 MAGI cap and assumes each spouse has at least $500 of qualifying Ohio income.

Years after 2026 reuse the 2026 files and the page says so.

## Profile the owner can save

The calculator does not hard-code a household. Saving this profile for the household key shown on the Tax page reproduces the previous married-filing-jointly, one-child, Ohio, Wooster result:

- Filing status: married filing jointly
- Children under 17: 1 (other dependents 0). Ohio exemptions are then 3: taxpayer, spouse, and that child.
- Deduction: standard
- State: Ohio, which selects the municipal wage rule and the joint filing credit
- City: Wooster, Wayne County, ZIP 44691, city rate 1.5% (stored as 0.015)
- School district: Wooster CSD, rate 0%

The commented `INSERT` in `scripts/create_tax_household_profiles.sql` is the same seed. Replace `YOUR_USER_ID` with the app user id. A linked-account key is `g:GROUP_ID` instead of `u:YOUR_USER_ID`. The script creates `tax_household_profiles` and `tax_deduction_overrides`, widens the allowed fiscal deduction kinds, and does not drop a table or delete rows. Run it in the Supabase SQL editor, or with `npm run migrate`.

People using the app never see that script path. When the profile table is missing, the Tax page says "Tax profile storage is not set up yet. Withholding below is unchanged." Saving a profile returns the same sentence. There is no line-classification step in the app. If a caller hits the deduction-overrides route before that table exists, the response is "Line classification storage is not set up yet." The server log names `scripts/create_tax_household_profiles.sql` (or `npm run migrate`).

## Known gaps

- Graduated state income taxes other than Ohio are not calculated.
- Flat-state estimates skip additions, subtractions, most credits, and phaseouts. Utah's taxpayer credit does not phase out here.
- Ohio uses income after pre-tax as Ohio AGI. Business income is not split out. The joint filing credit assumes each spouse has at least $500 of qualifying income.
- Self-employment tax, interest, pensions, the qualified business income deduction, AMT, the EITC, the NIIT, and preferential capital-gains rates are not part of this paycheck estimate.
- Excess Social Security withholding is flagged. It is not added to the federal refund.
- A classification override does not rewrite totals already stored for the year.
- Local tax is the city rate plus the school district rate the profile stores. There is no city or school-district lookup table.
