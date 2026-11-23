# Calculation methodology

All formulas live in `backend/app/calc.py` and are covered by tests in `backend/tests/`.

## Core principles (no double counting)
- **Transfers** between two accounts change neither income, expenses, nor savings. They move
  balance from one account to another (debit `-amount` from source, credit to destination).
- **Investment purchases / SIP / switch-in** are *contributions*: they are NOT household
  expenses and never appear in expense totals or category breakdowns.
- **Redemptions** are withdrawals: NOT income.
- **Dividends** are recorded as investment transactions and counted as *realized gains*, not
  family income (avoiding double counting against the fund's value).
- **Asset purchases** tracked in Assets are not counted as consumption expenses. Record an
  asset in the Assets module; if it was bought from a bank account it may optionally also be
  recorded as a transfer-style movement, but it is never an "expense" in reports.
- **Net worth** = bank & cash balances (opening + all flows) + current investment values +
  current asset values − total liabilities outstanding. Each rupee is counted in exactly one
  bucket.

## Monthly summary (per month, per member or whole family)
- Income = Σ income transactions dated in month
- Expenses = Σ expense transactions dated in month
- Savings = Income − Expenses
- Savings rate = Savings ÷ Income × 100 (only when income > 0, else "—")
- Investment contributions / withdrawn = Σ investment flows in month
- Net cash flow = (Income − Expenses) − contributions + withdrawals
- Month-end bank balance per account = opening balance + every transaction dated ≤ month end
- Month-end net worth = bank (≤ month end) + investments valued at latest **recorded**
  valuation ≤ month end (falling back to cost basis, flagged as estimated), + assets −
  liabilities. **Today's valuations are never used to fake historical snapshots** — the
  "Estimated?" column and the amber banner show honestly where valuations are missing.

## Investment returns
- Average cost per unit = total purchases ÷ total units purchased.
- Cost of sold units = avg cost × units sold.
- Realized gain = (redemption proceeds − cost of sold units) + dividends.
- Unrealized gain = current value − avg cost × units held (or, without unit data,
  current value − net invested capital).
- Total gain = realized + unrealized. Return % = total gain ÷ net invested capital × 100.
- **XIRR** is computed on dated cash flows (purchases negative; redemptions and dividends
  positive; for open holdings the current value is a positive flow on the valuation date).
  Bisection root-finding gives the annualized rate. With only outflows or no dates/XIRR
  solution, the result is `null` and the UI shows **"—" / Insufficient data** rather than a
  misleading number.
- Redemptions reduce remaining cost exactly by the average cost of the units sold, so
  closed positions show realized gain only — never "value − all historical purchases".

## Yearly summary
Roll-up of all 12 monthly summaries (every year is fully populated, even years with no
activity), plus income/expense category breakdown and year-end net worth.

## YTD figures (dashboard)
YTD income / expenses / contributions are summed from **1 January of the year being viewed**
up to the end of the selected period — not blindly from the current calendar year. Only when
no year is selected does the dashboard fall back to the current calendar year. Selecting a
fully-past month shows that year's figures up to that month-end, so historical views are
never silently zero.

## Limitations by design
- No bank feeds / NAV APIs — all values are what you record (privacy + offline requirement).
- Historical net worth depends on recorded valuations; unrecorded points fall back to cost
  and are flagged, never invented.
