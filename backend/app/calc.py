"""Financial calculation engine.

Assumptions (documented in docs/CALCULATIONS.md):
- Transfers between accounts are neither income nor expense.
- Investment purchases are contributions (cash into the investment), NOT expenses.
- Redemptions are withdrawals; dividends are treated as realized gains.
- Realized P/L uses the average-cost method.
- Unrealized P/L = current market value - net cost of remaining holding.
- XIRR: dated cash flows; purchases/switch_in negative, redemptions/dividends positive,
  plus current value as a positive terminal flow at the valuation date (open holdings only).
- Historical net worth at month-end uses the latest recorded valuation <= month end.
  If none exists, net invested capital (cost) is used and the row is flagged 'estimated'.
"""
import datetime as dt
from dateutil.relativedelta import relativedelta

D = dt.date.fromisoformat

INFLOW_TX = ("purchase", "switch_in")
OUTFLOW_TX = ("redemption", "switch_out")


def xirr(cashflows) -> float | None:
    """cashflows: list of (date, amount). Negative = outflow. Returns annual rate or None."""
    flows = [(D(d), float(a)) for d, a in cashflows if float(a) != 0]
    if len(flows) < 2:
        return None
    flows.sort(key=lambda f: f[0])
    t0 = flows[0][0]
    if not any(a < 0 for _, a in flows) or not any(a > 0 for _, a in flows):
        return None
    years = [((d - t0).days / 365.0, a) for d, a in flows]

    def npv(rate: float) -> float:
        return sum(a / (1.0 + rate) ** t for t, a in years)

    lo, hi = -0.9999, 10.0
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:
        return None
    for _ in range(300):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < 1e-8:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def month_end(year: int, month: int) -> str:
    return str(dt.date(year, month, 1) + relativedelta(months=1) - dt.timedelta(days=1))


def months_between(start: str, end: str) -> list:
    s, e = D(start[:7] + "-01"), D(end[:7] + "-01")
    out, cur = [], s
    while cur <= e:
        out.append((cur.year, cur.month))
        cur += relativedelta(months=1)
    return out


def _member_where(member_id):
    """Returns a SQL fragment that ALWAYS starts with ' AND' and param list."""
    if member_id:
        return " AND member_id = ?", [member_id]
    return "", []


def _investment_flows(conn, year, month, member_id=None):
    start, end = "%04d-%02d-01" % (year, month), month_end(year, month)
    q = """SELECT COALESCE(SUM(CASE WHEN it.tx_type IN ('purchase','switch_in') THEN it.amount ELSE 0 END),0) inflow,
                  COALESCE(SUM(CASE WHEN it.tx_type IN ('redemption','switch_out') THEN it.amount ELSE 0 END),0) outflow
           FROM investment_transactions it JOIN investments i ON i.id = it.investment_id
           WHERE it.date BETWEEN ? AND ?""" + (" AND i.owner_id=?" if member_id else "")
    r = conn.execute(q, [start, end] + ([member_id] if member_id else [])).fetchone()
    return {"contributions": r["inflow"], "withdrawn": r["outflow"]}


def monthly_summary(conn, year, month, member_id=None):
    """Cash-flow summary for one month. Transfers excluded from income/expense."""
    wm, params = _member_where(member_id)
    start, end = "%04d-%02d-01" % (year, month), month_end(year, month)

    def sum_tx(t):
        r = conn.execute(
            "SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type=? AND date BETWEEN ? AND ?" + wm,
            [t, start, end] + params).fetchone()
        return r["s"]

    income = sum_tx("income")
    expenses = sum_tx("expense")
    inv = _investment_flows(conn, year, month, member_id)

    def bank_side(where):
        r = conn.execute(
            """SELECT COALESCE(SUM(t.amount),0) s FROM transactions t JOIN accounts a ON a.id=t.account_id
               WHERE t.date BETWEEN ? AND ? AND a.account_type!='fd' AND""" + where + wm,
            [start, end] + params).fetchone()
        return r["s"]

    bank_inflow = bank_side(" t.type='income'")
    bank_outflow = bank_side(" t.type='expense'")
    transfers_out = bank_side(" t.type='transfer'")

    tin_q = """SELECT COALESCE(SUM(t.amount),0) s FROM transactions t JOIN accounts a ON a.id=t.to_account_id
        WHERE t.type='transfer' AND t.date BETWEEN ? AND ? AND a.account_type!='fd'""" + \
        (" AND a.owner_id=?" if member_id else "")
    transfers_in = conn.execute(tin_q, [start, end] + ([member_id] if member_id else [])).fetchone()["s"]

    net_cash_flow = (income - expenses) - inv["contributions"] + inv["withdrawn"]
    savings = income - expenses
    savings_rate = round(savings / income * 100, 2) if income > 0 else None
    nw = net_worth_snapshot(conn, end, member_id)
    return {
        "year": year, "month": month,
        "income": round(income, 2), "expenses": round(expenses, 2),
        "net_cash_flow": round(net_cash_flow, 2),
        "savings": round(savings, 2), "savings_rate": savings_rate,
        "investment_contributions": round(inv["contributions"], 2),
        "investment_withdrawn": round(inv["withdrawn"], 2),
        "bank_inflow": round(bank_inflow, 2), "bank_outflow": round(bank_outflow, 2),
        "transfers_in": round(transfers_in, 2), "transfers_out": round(transfers_out, 2),
        "month_end_net_worth": nw["net_worth"],
        "net_worth_breakdown": {k: nw[k] for k in ("bank_cash", "investments", "assets", "liabilities")},
        "net_worth_estimated": nw["has_estimates"],
    }


def net_worth_snapshot(conn, on_date, member_id=None):
    """Net worth as of a date, with no double counting:
    bank/cash balances + investment values + physical asset values - liabilities outstanding."""
    wma, pma = _member_where(member_id)

    def _val(scope, ref_id):
        joins = {"investment": "JOIN investments i ON i.id=v.ref_id",
                 "asset": "JOIN assets a ON a.id=v.ref_id",
                 "liability": "JOIN liabilities l ON l.id=v.ref_id"}.get(scope, "")
        extra, w = "", [scope, ref_id, on_date]
        if member_id and scope in ("investment", "asset", "liability"):
            alias = "i" if scope == "investment" else ("a" if scope == "asset" else "l")
            extra = " AND %s.owner_id=?" % alias
            w.append(member_id)
        q = """SELECT v.value, v.date FROM valuations v %s
               WHERE v.scope=? AND v.ref_id=? AND v.date<=?%s
               ORDER BY v.date DESC LIMIT 1""" % (joins, extra)
        r = conn.execute(q, w).fetchone()
        return (r["value"], r["date"]) if r else (None, None)

    bank_total = 0.0
    for acc in conn.execute("SELECT * FROM accounts WHERE 1=1" + wma, pma).fetchall():
        r = conn.execute(
            """SELECT COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END)
                                - SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END)
                                + SUM(CASE WHEN t.type='transfer' AND t.to_account_id=? THEN t.amount ELSE 0 END)
                                - SUM(CASE WHEN t.type='transfer' AND t.account_id=? THEN t.amount ELSE 0 END),0) s
               FROM (SELECT * FROM transactions WHERE date<=? AND (account_id=? OR to_account_id=?)) t""",
            (acc["id"], acc["id"], on_date, acc["id"], acc["id"])).fetchone()
        bank_total += float(acc["opening_balance"]) + r["s"]

    inv_total, has_estimates = 0.0, False
    for inv in conn.execute("SELECT * FROM investments WHERE is_active=1" + wma, pma).fetchall():
        r = conn.execute(
            """SELECT COALESCE(SUM(CASE WHEN tx_type IN ('purchase','switch_in') THEN amount ELSE 0 END)
                                - SUM(CASE WHEN tx_type IN ('redemption','switch_out') THEN amount ELSE 0 END),0) cost
               FROM investment_transactions WHERE investment_id=? AND date<=?""",
            (inv["id"], on_date)).fetchone()
        cost = r["cost"]
        if cost <= 0:
            continue
        vval, _ = _val("investment", inv["id"])
        if vval is None and inv["current_value"] is not None and inv["current_value_date"] \
                and inv["current_value_date"] <= on_date:
            vval = inv["current_value"]
        if vval is None:
            inv_total += cost
            has_estimates = True
        else:
            inv_total += float(vval)

    asset_total = 0.0
    for a in conn.execute("SELECT * FROM assets WHERE 1=1" + wma, pma).fetchall():
        vval, _ = _val("asset", a["id"])
        if vval is None and a["current_value"] is not None \
                and (not a["valuation_date"] or a["valuation_date"] <= on_date):
            vval = a["current_value"]
        if vval is None:
            vval = a["purchase_price"]
            has_estimates = True
        asset_total += float(vval)

    liab_total = 0.0
    for l in conn.execute("SELECT * FROM liabilities WHERE 1=1" + wma, pma).fetchall():
        vval, _ = _val("liability", l["id"])
        liab_total += float(vval if vval is not None else l["current_outstanding"])

    return {
        "date": on_date,
        "bank_cash": round(bank_total, 2),
        "investments": round(inv_total, 2),
        "assets": round(asset_total, 2),
        "liabilities": round(liab_total, 2),
        "net_worth": round(bank_total + inv_total + asset_total - liab_total, 2),
        "has_estimates": has_estimates,
    }


def investment_performance(conn, member_id=None, investment_type=None, investment_id=None):
    """Per-investment and overall performance using average cost + XIRR."""
    q = "SELECT * FROM investments WHERE is_active=1"
    p = []
    if member_id:
        q += " AND owner_id=?"; p.append(member_id)
    if investment_type:
        q += " AND investment_type=?"; p.append(investment_type)
    if investment_id:
        q += " AND id=?"; p.append(investment_id)

    items = []
    agg = dict(contributed=0.0, withdrawn=0.0, dividends=0.0, realized=0.0,
               unrealized=0.0, current_value=0.0)
    for inv in conn.execute(q, p).fetchall():
        txs = conn.execute("SELECT * FROM investment_transactions WHERE investment_id=? ORDER BY date",
                           (inv["id"],)).fetchall()
        contributed = sum(t["amount"] for t in txs if t["tx_type"] in INFLOW_TX)
        withdrawn = sum(t["amount"] for t in txs if t["tx_type"] in OUTFLOW_TX)
        dividends = sum(t["amount"] for t in txs if t["tx_type"] == "dividend")
        units_in = sum(t["units"] for t in txs if t["units"] and t["tx_type"] in INFLOW_TX)
        units_out = sum(t["units"] for t in txs if t["units"] and t["tx_type"] in OUTFLOW_TX)
        units_held = units_in - units_out

        avg_cost = (contributed / units_in) if units_in else None
        cost_of_sold = avg_cost * units_out if (avg_cost and units_out) else 0.0
        cost_held = (avg_cost * units_held) if avg_cost else (contributed - withdrawn)
        if units_out > 0 and units_in == 0:
            cost_held = 0.0
        realized = (withdrawn - cost_of_sold) + dividends

        cur_val, cur_date = inv["current_value"], inv["current_value_date"]
        if cur_val is None:
            v = conn.execute(
                "SELECT value, date FROM valuations WHERE scope='investment' AND ref_id=? ORDER BY date DESC LIMIT 1",
                (inv["id"],)).fetchone()
            if v:
                cur_val, cur_date = v["value"], v["date"]
        vval = float(cur_val) if cur_val is not None else None
        unrealized = (vval - cost_held) if vval is not None else None
        total_gain = realized + (unrealized or 0.0)
        net_invested = contributed - withdrawn
        ret_pct = (round(total_gain / net_invested * 100, 2)
                   if (net_invested > 0 and vval is not None) else None)

        flows = [(t["date"], (-1.0 if t["tx_type"] in INFLOW_TX else 1.0) * t["amount"]) for t in txs]
        if vval is not None and units_out < units_in and cur_date:
            flows.append((cur_date, vval))
        xr = xirr(flows)

        items.append({
            "investment_id": inv["id"], "name": inv["name"], "type": inv["investment_type"],
            "owner_id": inv["owner_id"],
            "contributed": round(contributed, 2), "withdrawn": round(withdrawn, 2),
            "dividends": round(dividends, 2),
            "units_held": units_held if (units_in or units_out) else None,
            "net_invested": round(net_invested, 2),
            "current_value": round(vval, 2) if vval is not None else None,
            "realized_gain": round(realized, 2),
            "unrealized_gain": round(unrealized, 2) if unrealized is not None else None,
            "total_gain": round(total_gain, 2),
            "return_pct": ret_pct,
            "xirr": round(xr, 4) if xr is not None else None,
            "sufficient_data": bool(txs) or vval is not None,
        })
        agg["contributed"] += contributed
        agg["withdrawn"] += withdrawn
        agg["dividends"] += dividends
        agg["realized"] += realized
        if unrealized is not None:
            agg["unrealized"] += unrealized
        if vval is not None:
            agg["current_value"] += vval

    total_gain = agg["realized"] + agg["unrealized"]
    net_invested = agg["contributed"] - agg["withdrawn"]
    return {
        "overall": {
            "contributed": round(agg["contributed"], 2),
            "withdrawn": round(agg["withdrawn"], 2),
            "net_invested": round(net_invested, 2),
            "dividends": round(agg["dividends"], 2),
            "realized_gain": round(agg["realized"], 2),
            "unrealized_gain": round(agg["unrealized"], 2),
            "total_gain": round(total_gain, 2),
            "current_value": round(agg["current_value"], 2),
            "return_pct": (round(total_gain / net_invested * 100, 2) if net_invested > 0 else None),
        },
        "by_investment": items,
    }


def account_balance(conn, account_id, on_date=None):
    base = conn.execute("SELECT opening_balance FROM accounts WHERE id=?", (account_id,)).fetchone()
    if base is None:
        return 0.0
    q = """SELECT COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END)
                        - SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END)
                        + SUM(CASE WHEN t.type='transfer' AND t.to_account_id=? THEN t.amount ELSE 0 END)
                        - SUM(CASE WHEN t.type='transfer' AND t.account_id=? THEN t.amount ELSE 0 END),0) s
           FROM (SELECT * FROM transactions WHERE (account_id=? OR to_account_id=?)) t"""
    params = [account_id, account_id, account_id, account_id]
    if on_date:
        q += " WHERE date<=?"
        params.append(on_date)
    return round(float(base["opening_balance"]) + conn.execute(q, params).fetchone()["s"], 2)


def yearly_summary(conn, year, member_id=None):
    """Annual roll-up of all monthly summaries + category breakdowns."""
    start, end = "%d-01-01" % year, "%d-12-31" % year
    months = [monthly_summary(conn, year, m, member_id) for m in range(1, 13)]
    wm, params = _member_where(member_id)

    def breakdown(kind):
        r = conn.execute(
            """SELECT COALESCE(c.name,'(Uncategorised)') name, SUM(t.amount) amount
               FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
               WHERE t.type=? AND t.date BETWEEN ? AND ? AND""" + wm + """
               GROUP BY c.name ORDER BY amount DESC""",
            [kind, start, end] + params).fetchall()
        return [{"category": r["name"], "amount": round(r["amount"], 2)} for r in r]

    tot = {k: round(sum(m[k] for m in months), 2) for k in
           ("income", "expenses", "savings", "investment_contributions", "investment_withdrawn")}
    perf = investment_performance(conn, member_id)
    return {
        "year": year, "monthly": months, **tot,
        "savings_rate": (round(tot["savings"] / tot["income"] * 100, 2) if tot["income"] > 0 else None),
        "income_categories": breakdown("income"),
        "expense_categories": breakdown("expense"),
        "investment_gain": perf["overall"]["total_gain"],
        "year_end_net_worth": months[-1]["month_end_net_worth"] if months else None,
    }


def monthly_series(conn, start, end, member_id=None):
    """Series of monthly summaries from start to end (for charts and timelines)."""
    out = []
    for y, m in months_between(start, end):
        s = monthly_summary(conn, y, m, member_id)
        out.append(s)
    return out
