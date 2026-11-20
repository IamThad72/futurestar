# Tax estimate rules

These JSON files are the inputs for `utils/tax/estimate.js`. They are published figures used to **estimate** tax. They are not a filing method, and they omit credits, deductions, and adjustments that are not listed here.

## Federal

`federal/2025.json` and `federal/2026.json`

| Item | 2025 | 2026 | Source |
| --- | --- | --- | --- |
| Ordinary brackets | Rev. Proc. 2024-40 §2.01 (unchanged by later 2025 legislation) | Rev. Proc. 2025-32 §4.01 | [Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf), [Rev. Proc. 2025-32](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf) |
| Standard deduction | $15,750 / $23,625 / $31,500 | $16,100 / $24,150 / $32,200 | Rev. Proc. 2025-32 §3.01 (2025, replacing Rev. Proc. 2024-40 §2.15 after the One, Big, Beautiful Bill Act, P.L. 119-21) and §4.14 (2026). Qualifying surviving spouse uses the joint amount. |
| Child tax credit | $2,200 per qualifying child; up to $1,700 refundable | Same | P.L. 119-21 §70104 set $2,200 for 2025. Rev. Proc. 2025-32 §4.05 confirms $2,200 and a $1,700 refundable amount for 2026 (no inflation increase). |
| Credit for other dependents | $500 | $500 | IRC §24(h)(4), as made permanent by P.L. 119-21. The phaseout below applies to the combined child tax credit and this credit. |
| Credit phaseout | $400,000 joint; $200,000 for every other status. Credit drops by $50 per $1,000 (or fraction) over the threshold. | Same | IRC §24(b) and §24(h)(3). Thresholds are not inflation-adjusted. |
| Additional child tax credit earned-income formula | 15% of earned income over $2,500, capped at the refundable amount per child | Same | IRC §24(d). Earned income here is W-2 wages plus net self-employment. |
| Self-employment tax | 15.3% (12.4% Social Security + 2.9% Medicare) on 92.35% of net profit. Social Security wage base $176,100. | Same rates. Wage base $184,500. | IRS “Self-employment tax” and SSA COLA fact sheets: [2025](https://www.ssa.gov/news/en/cola/factsheets/2025.html), [2026](https://www.ssa.gov/news/en/cola/factsheets/2026.html). Net earnings under $400 are treated as no self-employment tax. |
| Additional Medicare tax | 0.9% over $250,000 joint, $125,000 married filing separately, $200,000 for other statuses | Same | [IRS Topic No. 560](https://www.irs.gov/taxtopics/tc560). Wages use the threshold first; self-employment net earnings use what remains. The 0.9% tax is not part of the deductible half of self-employment tax. |

The deductible half of self-employment tax (the Social Security and Medicare portions, not the additional Medicare tax) is subtracted in arriving at AGI.

## States

`states/2025.json` and `states/2026.json`

No wage income tax: Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, and Wyoming. New Hampshire’s interest and dividends tax was repealed for tax years beginning in 2025. Washington’s capital-gains tax is not estimated.

Flat-rate states use the rate, standard deduction, personal exemption, zero-rate band, and flat credits compiled by the Tax Foundation from state statutes and instructions:

- [2025 rates and brackets](https://taxfoundation.org/data/all/state/state-income-tax-rates/) (table as of January 1, 2025, with the rate corrections below)
- [2026 rates and brackets](https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/) (table as of January 1, 2026)

The estimator starts from federal AGI. It subtracts the listed deduction, personal exemption, and zero-rate band, multiplies by the flat rate, then subtracts any listed flat credit. Head of household uses the single-filer amount when a state table does not publish a separate head-of-household figure. Married filing separately uses the single amount. This omits additions, subtractions, phaseouts, and local add-on taxes.

Rate corrections applied on top of the January 2025 table, from later enacted law described by the Tax Foundation and state summaries:

- Georgia: 5.19% for 2025 and 2026. H.B. 111 lowered the 2025 rate from 5.39% to 5.19% retroactive to January 1, 2025. The 2026 Tax Foundation table still shows 5.19%.
- Idaho: 5.3% for 2025 and 2026. H.B. 40 (March 2025) reduced the rate from 5.695% retroactive to January 1, 2025.
- Utah: 4.5% for 2025 and 2026. H.B. 106 (March 2025) reduced the rate from 4.55% retroactive to January 1, 2025. The taxpayer credit is the published flat credit only; its income phaseout is not modeled.

Arizona’s 2026 standard deduction in the Tax Foundation table is the pre-TCJA federal amount ($8,350 / $16,700). That is what static-conformity states fall back to until they adopt a post-OBBBA Internal Revenue Code date. If Arizona later conforms to the 2026 federal standard deduction, this estimate will be high.

## Ohio

Ohio is not treated as a flat percentage of AGI. Brackets follow the statute and the Department of Taxation instructions.

2026, matching the estimator this app used before tax profiles (ORC 5747.02 as amended by H.B. 96, and ORC 5747.025):

- No tax on Ohio taxable nonbusiness income of $26,050 or less.
- Above that, $332 plus 2.75% of the excess over $26,050.
- Personal exemption per person: $2,350 if MAGI is $40,000 or less, $2,100 if MAGI is $80,000 or less, $1,850 above that, and $0 when MAGI is $500,000 or more.
- Exemption count is the taxpayer, plus a spouse when filing jointly, plus children under 17 and other dependents.
- $20 exemption credit per exemption when MAGI minus exemptions is under $30,000 (ORC 5747.022).
- Joint filing credit for a joint return, up to $650, using the same income bands as the prior estimator, and only when MAGI is under $500,000. The estimate assumes each spouse has at least $500 of qualifying Ohio income.

2025, from ORC 5747.02 and the [2025 Ohio IT 1040 booklet](https://dam.assets.ohio.gov/image/upload/tax.ohio.gov/forms/ohio_individual/individual/2025/it1040-booklet.pdf):

- $0 through $26,050: no tax.
- More than $26,050 through $100,000: $342 plus 2.75% of the excess over $26,050.
- More than $100,000: $2,394.32 plus 3.125% of the excess over $100,000.
- Exemption per person from the booklet (inflation-adjusted amounts for the year): $2,400 / $2,150 / $1,900, and $0 at MAGI of $750,000 or more.
- Joint filing credit phases the same way, with a $750,000 MAGI cap.

Ohio business income (the 3% business rate) is not separated from nonbusiness income. Federal AGI is used as Ohio AGI. Ohio adjustments are not applied.

## Local

There is no jurisdiction table. Local tax is the rate the user enters, times W-2 wages plus net self-employment. A Wooster resident who previously had a 1.5% city tax and no school district income tax reproduces that result by entering 1.5% and the same wage base. City name, school district, and ZIP are labels only.
