from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..helpers import rowdicts, clean
from .. import calc

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

FIELDS = {"name", "bank_name", "owner_id", "account_type", "opening_balance", "opening_date", "notes", "is_active"}
REQUIRED = {"name", "account_type", "opening_date"}

@router.get("")
def list_accounts(with_balance: bool = False):
    with get_db() as conn:
        rows = rowdicts(conn.execute("SELECT * FROM accounts ORDER BY name").fetchall())
        if with_balance:
            for r in rows:
                r["current_balance"] = calc.account_balance(conn, r["id"])
        return rows

@router.post("")
def add_account(payload: dict):
    try:
        data = clean(payload, FIELDS, REQUIRED)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_db() as conn:
        cur = conn.execute("INSERT INTO accounts(%s) VALUES(%s)" % (
            ",".join(data), ",".join("?" * len(data))), list(data.values()))
        return {"id": cur.lastrowid}

@router.put("/{account_id}")
def update_account(account_id: int, payload: dict):
    data = {k: v for k, v in payload.items() if k in FIELDS}
    if not data:
        raise HTTPException(400, "Nothing to update")
    with get_db() as conn:
        conn.execute("UPDATE accounts SET %s WHERE id=?" % ",".join(f"{k}=?" for k in data),
                     [*data.values(), account_id])
        return {"ok": True}

@router.delete("/{account_id}")
def delete_account(account_id: int):
    with get_db() as conn:
        used = conn.execute(
            "SELECT COUNT(*) c FROM transactions WHERE account_id=? OR to_account_id=?",
            (account_id, account_id)).fetchone()["c"]
        if used:
            raise HTTPException(409, "Account has transactions. Reassign or delete them first.")
        conn.execute("DELETE FROM accounts WHERE id=?", (account_id,))
        return {"ok": True}

@router.get("/{account_id}/balance")
def balance(account_id: int, on_date: str | None = None):
    with get_db() as conn:
        return {"balance": calc.account_balance(conn, account_id, on_date)}

@router.get("/{account_id}/history")
def history(account_id: int):
    """Month-end balance history."""
    with get_db() as conn:
        acc = conn.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone()
        if not acc:
            raise HTTPException(404, "Account not found")
        rows = conn.execute(
            "SELECT MIN(date) d FROM transactions WHERE account_id=? OR to_account_id=?",
            (account_id, account_id)).fetchone()
        end = __import__("datetime").date.today().isoformat()
        out = []
        if rows["d"]:
            import datetime as dt
            from dateutil.relativedelta import relativedelta
            cur = dt.date.fromisoformat(rows["d"][:7] + "-01")
            while cur.isoformat() <= end:
                me = str(cur + relativedelta(months=1) - relativedelta(days=1))
                out.append({"month": cur.strftime("%Y-%m"), "balance": calc.account_balance(conn, account_id, me)})
                cur += relativedelta(months=1)
        return {"account": rowdicts([acc])[0], "history": out}

@router.get("/{account_id}/transactions")
def account_tx(account_id: int):
    with get_db() as conn:
        return rowdicts(conn.execute(
            """SELECT * FROM transactions WHERE account_id=? OR to_account_id=? ORDER BY date DESC, id DESC""",
            (account_id, account_id)).fetchall())
