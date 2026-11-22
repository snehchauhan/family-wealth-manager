import datetime as dt
from fastapi import APIRouter
from ..db import get_db
from ..helpers import rowdicts
from .. import calc

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("")
def dashboard(member_id: int | None = None, year: int | None = None, month: int | None = None,
              date_from: str | None = None, date_to: str | None = None):
    today = dt.date.today()
    if date_from and date_to:
        start, end = date_from, date_to
    elif year and month:
        start, end = "%04d-%02d-01" % (year, month), calc.month_end(year, month)
    elif year:
        start, end = "%d-01-01" % year, "%d-12-31" % year
    else:
        start, end = "%d-01-01" % today.year, today.isoformat()

    with get_db() as conn:
        wm, params = calc._member_where(member_id)

        def sum_tx(t):
            r = conn.execute(
                "SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type=? AND date BETWEEN ? AND ?" + wm,
                [t, start, end] + params).fetchone()
            return r["s"]

        income, expenses = sum_tx("income"), sum_tx("expense")
        q = """SELECT COALESCE(SUM(CASE WHEN it.tx_type IN ('purchase','switch_in') THEN it.amount ELSE 0 END),0) c,
                      COALESCE(SUM(CASE WHEN it.tx_type IN ('redemption','switch_out') THEN it.amount ELSE 0 END),0) w
               FROM investment_transactions it JOIN investments i ON i.id=it.investment_id
               WHERE it.date BETWEEN ? AND ?""" + (" AND i.owner_id=?" if member_id else "")
        r2 = conn.execute(q, [start, end] + ([member_id] if member_id else [])).fetchone()

        perf = calc.investment_performance(conn, member_id)
        nw = calc.net_worth_snapshot(conn, end, member_id)
        accounts = rowdicts(conn.execute("SELECT * FROM accounts ORDER BY name").fetchall())
        bank_total = sum(calc.account_balance(conn, a["id"], end) for a in accounts
                         if (not member_id or a["owner_id"] == member_id))

        # YTD figures
        ytd_start = "%d-01-01" % today.year
        def ytd(t):
            r = conn.execute(
                "SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type=? AND date BETWEEN ? AND ?" + wm,
                [t, ytd_start, end] + params).fetchone()
            return r["s"]
        ytd_q = """SELECT COALESCE(SUM(CASE WHEN it.tx_type IN ('purchase','switch_in') THEN it.amount ELSE 0 END),0) c
                   FROM investment_transactions it JOIN investments i ON i.id=it.investment_id
                   WHERE it.date BETWEEN ? AND ?""" + (" AND i.owner_id=?" if member_id else "")
        ytd_contrib = conn.execute(ytd_q, [ytd_start, end] + ([member_id] if member_id else [])).fetchone()["c"]

        # Expense category breakdown for the period
        exp_by_cat = rowdicts(conn.execute(
            """SELECT COALESCE(c.name,'(Uncategorised)') name, SUM(t.amount) amount
               FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
               WHERE t.type='expense' AND t.date BETWEEN ? AND ?""" + (" AND t.member_id=?" if member_id else "") + """
               GROUP BY c.name ORDER BY amount DESC""", [start, end] + ([member_id] if member_id else [])).fetchall())

        inv_by_type = {}
        for it in perf["by_investment"]:
            t = inv_by_type.setdefault(it["type"], 0.0)
            if it["current_value"] is not None:
                inv_by_type[it["type"]] = t + it["current_value"]

        return {
            "period": {"from": start, "to": end},
            "totals": {
                "income": round(income, 2),
                "expenses": round(expenses, 2),
                "savings": round(income - expenses, 2),
                "savings_rate": round((income - expenses) / income * 100, 2) if income > 0 else None,
                "investment_contributions": round(r2["c"], 2),
                "investment_withdrawn": round(r2["w"], 2),
                "investment_current_value": perf["overall"]["current_value"],
                "investment_gain": perf["overall"]["total_gain"],
                "bank_cash": round(bank_total, 2),
                "total_assets": round(nw["assets"], 2),
                "total_liabilities": round(nw["liabilities"], 2),
                "net_worth": nw["net_worth"],
                "has_estimates": nw["has_estimates"],
                "ytd_income": round(ytd("income"), 2),
                "ytd_expenses": round(ytd("expense"), 2),
                "ytd_contributions": round(ytd_contrib, 2),
                "monthly_cash_flow": round(income - expenses, 2),
            },
            "expense_by_category": exp_by_cat,
            "investment_by_type": {k: round(v, 2) for k, v in inv_by_type.items()},
        }

@router.get("/series")
def series(years: int = 3, member_id: int | None = None, year: int | None = None):
    with get_db() as conn:
        today = dt.date.today()
        if year:
            start, end = "%d-01-01" % year, "%d-12-31" % year
        else:
            end = today.isoformat()
            start = "%d-01-01" % (today.year - years + 1)
        return {"series": calc.monthly_series(conn, start, end, member_id)}

@router.get("/performance")
def performance(member_id: int | None = None, investment_type: str | None = None):
    with get_db() as conn:
        return calc.investment_performance(conn, member_id, investment_type)

@router.get("/accounts-summary")
def accounts_summary():
    with get_db() as conn:
        rows = rowdicts(conn.execute("SELECT * FROM accounts ORDER BY name").fetchall())
        for r in rows:
            r["current_balance"] = calc.account_balance(conn, r["id"])
        return rows

@router.get("/timeline")
def timeline(member_id: int | None = None):
    """First recorded activity to latest, as monthly net worth timeline."""
    with get_db() as conn:
        wm, params = calc._member_where(member_id)
        r = conn.execute("SELECT MIN(date) d FROM transactions WHERE 1=1" + wm, params).fetchone()
        r2 = conn.execute(
            "SELECT MIN(date) d FROM investment_transactions it JOIN investments i ON i.id=it.investment_id WHERE 1=1"
            + (" AND i.owner_id=?" if member_id else ""),
            [member_id] if member_id else []).fetchone()
        dates = [x["d"] for x in (r, r2) if x["d"]]
        if not dates:
            return {"series": []}
        start = min(dates)[:7] + "-01"
        end = dt.date.today().isoformat()
        return {"series": calc.monthly_series(conn, start, end, member_id)}

@router.get("/networth")
def networth(on_date: str | None = None, member_id: int | None = None):
    on = on_date or dt.date.today().isoformat()
    with get_db() as conn:
        return calc.net_worth_snapshot(conn, on, member_id)
