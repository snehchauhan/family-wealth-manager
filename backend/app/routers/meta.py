from datetime import date as _date

from fastapi import APIRouter, HTTPException
from ..db import get_db, DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES
from ..helpers import rowdicts

router = APIRouter(prefix="/api/meta", tags=["meta"])

@router.get("/bootstrap")
def bootstrap():
    with get_db() as conn:
        return {
            "members": rowdicts(conn.execute("SELECT * FROM members ORDER BY id").fetchall()),
            "categories": rowdicts(conn.execute("SELECT * FROM categories ORDER BY kind, name").fetchall()),
            "investment_types": ["mutual_fund", "stocks", "fd", "gold", "bonds", "property", "other"],
            "account_types": ["savings", "current", "fd", "cash", "other"],
            "payment_methods": ["cash", "upi", "bank_transfer", "debit_card", "credit_card", "other"],
            "investment_tx_types": ["purchase", "redemption", "dividend", "switch_in", "switch_out"],
            "default_income_categories": DEFAULT_INCOME_CATEGORIES,
            "default_expense_categories": DEFAULT_EXPENSE_CATEGORIES,
        }

@router.get("/years")
def available_years():
    with get_db() as conn:
        vals: list[int] = []
        for col, table in (
            ("date", "transactions"),
            ("date", "investment_transactions"),
            ("date", "valuations"),
            ("opening_date", "accounts"),
            ("purchase_date", "assets"),
            ("start_date", "liabilities"),
            ("start_date", "sip_plans"),
        ):
            for v in conn.execute(
                "SELECT DISTINCT SUBSTR({c}, 1, 4) y FROM {t}".format(c=col, t=table)
            ):
                if v["y"] and str(v["y"]).isdigit():
                    vals.append(int(v["y"]))
        this_year = _date.today().year
        lo = min(vals + [this_year - 4])
        hi = max(vals + [2100])
    return {"years": list(range(lo, hi + 1))}

@router.post("/members")
def add_member(payload: dict):
    if not payload.get("name"):
        raise HTTPException(400, "name required")
    with get_db() as conn:
        cur = conn.execute("INSERT INTO members(name, kind) VALUES(?, ?)",
                           (payload["name"].strip(), payload.get("kind", "member")))
        return {"id": cur.lastrowid}

@router.delete("/members/{member_id}")
def del_member(member_id: int):
    with get_db() as conn:
        used = conn.execute("SELECT COUNT(*) c FROM transactions WHERE member_id=?", (member_id,)).fetchone()["c"]
        if used:
            raise HTTPException(409, "Member has transactions; reassign them first.")
        conn.execute("DELETE FROM members WHERE id=?", (member_id,))
        return {"ok": True}

@router.post("/categories")
def add_category(payload: dict):
    kind, name = payload.get("kind"), payload.get("name")
    if kind not in ("income", "expense") or not name:
        raise HTTPException(400, "kind (income|expense) and name required")
    with get_db() as conn:
        cur = conn.execute("INSERT OR IGNORE INTO categories(kind, name, parent_id) VALUES(?,?,?)",
                           (kind, name.strip(), payload.get("parent_id")))
        return {"id": cur.lastrowid}

@router.delete("/categories/{category_id}")
def del_category(category_id: int):
    with get_db() as conn:
        used = conn.execute("SELECT COUNT(*) c FROM transactions WHERE category_id=?", (category_id,)).fetchone()["c"]
        if used:
            raise HTTPException(409, "Category is used by transactions.")
        conn.execute("DELETE FROM categories WHERE id=?", (category_id,))
        return {"ok": True}
