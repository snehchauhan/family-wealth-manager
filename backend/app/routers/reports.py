import csv
import io
import json
import datetime as dt
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ..db import get_db, connect, DB_PATH
from ..helpers import rowdicts
from .. import calc

router = APIRouter(prefix="/api/reports", tags=["reports"])

def _csv_response(rows: list[dict], filename: str):
    if not rows:
        rows = [{"info": "no data"}]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}.csv"})

@router.get("/export/csv")
def export_csv(report: str = "transactions", year: int | None = None, month: int | None = None,
               member_id: int | None = None, date_from: str | None = None, date_to: str | None = None):
    with get_db() as conn:
        if report == "transactions":
            q, p = "SELECT * FROM transactions WHERE 1=1", []
            if year: q += " AND strftime('%Y',date)=?"; p.append(str(year))
            if month: q += " AND strftime('%m',date)=?"; p.append("%02d" % month)
            if member_id: q += " AND member_id=?"; p.append(member_id)
            if date_from: q += " AND date>=?"; p.append(date_from)
            if date_to: q += " AND date<=?"; p.append(date_to)
            rows = rowdicts(conn.execute(q + " ORDER BY date", p).fetchall())
            return _csv_response(rows, f"transactions_{report}")
        if report == "monthly":
            y = year or dt.date.today().year
            rows = [calc.monthly_summary(conn, y, m, member_id) for m in range(1, 13)]
            return _csv_response(rows, f"monthly_summary_{y}")
        if report == "yearly":
            years = sorted({r["y"] for r in conn.execute(
                "SELECT DISTINCT CAST(strftime('%Y',date) AS int) y FROM transactions WHERE date IS NOT NULL")})
            rows = [calc.yearly_summary(conn, y, member_id) for y in years]
            simple = [{k: r[k] for k in ("year", "income", "expenses", "savings", "savings_rate",
                      "investment_contributions", "investment_withdrawn", "investment_gain", "year_end_net_worth")}
                      for r in rows]
            return _csv_response(simple, "yearly_summary")
        if report == "investments":
            perf = calc.investment_performance(conn, member_id)
            return _csv_response(perf["by_investment"], "investment_performance")
        if report == "networth":
            today = dt.date.today()
            hs = calc.net_worth_snapshot(conn, today.isoformat(), member_id)
            return _csv_response([hs], "networth_current")
        if report == "accounts":
            rows = rowdicts(conn.execute("SELECT * FROM accounts ORDER BY name").fetchall())
            for r in rows:
                r["current_balance"] = calc.account_balance(conn, r["id"])
            return _csv_response(rows, "accounts")
        raise HTTPException(400, f"unknown report '{report}'")

@router.get("/export/excelWorkbook")
def export_excel_workbook():
    """Complete workbook: one sheet per dataset."""
    try:
        from openpyxl import Workbook
    except ImportError:
        raise HTTPException(500, "openpyxl not installed. Run: pip install openpyxl")
    wb = Workbook()
    wb.remove(wb.active)
    conn = connect()
    try:
        sheets = {
            "Transactions": "SELECT * FROM transactions ORDER BY date",
            "Accounts": "SELECT * FROM accounts ORDER BY name",
            "Investments": "SELECT * FROM investments ORDER BY name",
            "InvestmentTx": "SELECT * FROM investment_transactions ORDER BY date",
            "SipPlans": "SELECT * FROM sip_plans",
            "Assets": "SELECT * FROM assets",
            "Liabilities": "SELECT * FROM liabilities",
            "Members": "SELECT * FROM members",
            "Categories": "SELECT * FROM categories",
            "Valuations": "SELECT * FROM valuations ORDER BY date",
        }
        for name, sql in sheets.items():
            ws = wb.create_sheet(name)
            cur = conn.execute(sql)
            cols = [d[0] for d in cur.description]
            ws.append(cols)
            for row in cur.fetchall():
                ws.append([row[c] for c in cols])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
    finally:
        conn.close()
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=family_wealth_backup.xlsx"})

@router.get("/export/backup")
def export_backup():
    """Complete JSON backup of every table."""
    conn = connect()
    try:
        data = {"exported_at": dt.datetime.now().isoformat(), "app": "Family Wealth Manager", "version": 1}
        for t in ("members", "categories", "accounts", "transactions", "investments",
                  "investment_transactions", "sip_plans", "assets", "liabilities", "valuations"):
            data[t] = rowdicts(conn.execute("SELECT * FROM %s" % t).fetchall())
    finally:
        conn.close()
    return StreamingResponse(io.StringIO(json.dumps(data, indent=1, default=str)), media_type="application/json",
                             headers={"Content-Disposition": "attachment; filename=family_wealth_backup.json"})

@router.post("/restore")
def restore_backup(payload: dict):
    """Restore from JSON backup. WARNING: replaces all current data."""
    tables = ["members", "categories", "accounts", "transactions", "investments",
              "investment_transactions", "sip_plans", "assets", "liabilities", "valuations"]
    if not all(t in payload for t in ("members", "transactions")):
        raise HTTPException(400, "Not a valid Family Wealth Manager backup file")
    conn = connect()
    try:
        for t in reversed(tables):
            conn.execute("DELETE FROM %s" % t)
        for t in tables:
            for row in payload.get(t, []):
                cols = {k: v for k, v in row.items() if k != "id"}
                if not cols:
                    continue
                ph = ",".join("?" * len(cols))
                conn.execute("INSERT INTO %s(%s) VALUES(%s)" % (t, ",".join(cols), ph), list(cols.values()))
        conn.execute("INSERT OR IGNORE INTO members(name,kind) VALUES('Household','household')")
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}

@router.get("/export/printable")
def printable_report(year: int, member_id: int | None = None):
    """Print-ready HTML report (use browser Print -> Save as PDF)."""
    conn = connect()
    try:
        ys = calc.yearly_summary(conn, year, member_id)
        perf = calc.investment_performance(conn, member_id)
    finally:
        conn.close()
    def fmt(x): return "₹{:,.2f}".format(x or 0)
    rows_html = "".join(
        f"<tr><td>{m['month']:02d}</td><td>{fmt(m['income'])}</td><td>{fmt(m['expenses'])}</td>"
        f"<td>{fmt(m['savings'])}</td><td>{fmt(m['investment_contributions'])}</td>"
        f"<td>{fmt(m['month_end_net_worth'])}</td></tr>" for m in ys["monthly"])
    perf_rows = "".join(
        f"<tr><td>{it['name']}</td><td>{it['type']}</td><td>{fmt(it['contributed'])}</td>"
        f"<td>{fmt(it['withdrawn'])}</td><td>{fmt(it['current_value']) if it['current_value'] is not None else '—'}</td>"
        f"<td>{fmt(it['total_gain'])}</td><td>{('%.2f%%' % it['return_pct']) if it['return_pct'] is not None else 'Insufficient data'}</td></tr>"
        for it in perf["by_investment"])
    html = f"""<html><head><title>Annual Report {year}</title>
    <style>body{{font-family:Arial,sans-serif;margin:24px}}table{{border-collapse:collapse;width:100%;margin:12px 0}}
    td,th{{border:1px solid #999;padding:6px 10px;text-align:right}}th{{background:#eee}}h1{{font-size:20px}}</style>
    </head><body><h1>Family Wealth Manager — Annual Report {year}</h1>
    <h3>Summary</h3><ul>
    <li>Income: {fmt(ys['income'])}</li><li>Expenses: {fmt(ys['expenses'])}</li>
    <li>Savings: {fmt(ys['savings'])} ({ys['savings_rate'] or '—'}%)</li>
    <li>Investment contributions: {fmt(ys['investment_contributions'])}</li>
    <li>Year-end net worth: {fmt(ys['year_end_net_worth'])}</li></ul>
    <h3>Monthly breakdown</h3><table><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Savings</th><th>Invested</th><th>Net Worth</th></tr>{rows_html}</table>
    <h3>Investment performance</h3><table><tr><th>Name</th><th>Type</th><th>Contributed</th><th>Withdrawn</th><th>Current Value</th><th>Total Gain</th><th>Return %</th></tr>{perf_rows}</table>
    </body></html>"""
    return StreamingResponse(iter([html]), media_type="text/html")

@router.get("/yearly-preview")
def yearly_preview(member_id: int | None = None):
    """Year-by-year comparison rows for all years that have any activity."""
    conn = connect()
    try:
        years_tx = {r["y"] for r in conn.execute(
            "SELECT DISTINCT CAST(strftime('%Y',date) AS int) y FROM transactions WHERE date IS NOT NULL")}
        years_inv = {r["y"] for r in conn.execute(
            "SELECT DISTINCT CAST(strftime('%Y',date) AS int) y FROM investment_transactions WHERE date IS NOT NULL")}
        years = sorted(years_tx | years_inv)
        return [calc.yearly_summary(conn, y, member_id) for y in years]
    finally:
        conn.close()
