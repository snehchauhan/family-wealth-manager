from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..helpers import rowdicts, clean, rowdict

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

FIELDS = {"type", "date", "amount", "member_id", "account_id", "to_account_id", "category_id",
          "subcategory", "payment_method", "beneficiary", "description", "notes"}
REQUIRED = {"type", "date", "amount"}

@router.get("")
def list_transactions(type: str | None = None, member_id: int | None = None,
                      account_id: int | None = None, category_id: int | None = None,
                      date_from: str | None = None, date_to: str | None = None,
                      search: str | None = None, limit: int = 500, offset: int = 0):
    q = """SELECT t.*, c.name category_name, a.name account_name, m.name member_name,
                  ta.name to_account_name
           FROM transactions t
           LEFT JOIN categories c ON c.id=t.category_id
           LEFT JOIN accounts a ON a.id=t.account_id
           LEFT JOIN accounts ta ON ta.id=t.to_account_id
           LEFT JOIN members m ON m.id=t.member_id WHERE 1=1"""
    p: list = []
    if type: q += " AND t.type=?"; p.append(type)
    if member_id: q += " AND t.member_id=?"; p.append(member_id)
    if account_id: q += " AND (t.account_id=? OR t.to_account_id=?)"; p += [account_id, account_id]
    if category_id: q += " AND t.category_id=?"; p.append(category_id)
    if date_from: q += " AND t.date>=?"; p.append(date_from)
    if date_to: q += " AND t.date<=?"; p.append(date_to)
    if search:
        q += " AND (t.description LIKE ? OR t.notes LIKE ? OR t.subcategory LIKE ? OR t.beneficiary LIKE ?)"
        s = f"%{search}%"; p += [s, s, s, s]
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) c FROM (" + q + ")", p).fetchone()["c"]
        rows = rowdicts(conn.execute(q + " ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?",
                                     [*p, limit, offset]).fetchall())
        return {"total": total, "items": rows}

def _check(conn, data, exclude_id=None):
    t = data["type"]
    if t not in ("income", "expense", "transfer"):
        raise HTTPException(400, "type must be income, expense or transfer")
    if not data.get("account_id"):
        raise HTTPException(400, "account_id required")
    if t == "transfer" and not data.get("to_account_id"):
        raise HTTPException(400, "to_account_id required for transfers")
    if t == "transfer" and data.get("account_id") == data.get("to_account_id"):
        raise HTTPException(400, "Cannot transfer to the same account")
    if float(data.get("amount") or 0) <= 0:
        raise HTTPException(400, "amount must be positive")
    dup = conn.execute(
        "SELECT id FROM transactions WHERE type=? AND date=? AND amount=? AND account_id IS ? AND to_account_id IS ?"
        + (" AND id<>?" if exclude_id else ""),
        [t, data["date"], float(data["amount"]), data.get("account_id"), data.get("to_account_id")]
        + ([exclude_id] if exclude_id else [])).fetchone()
    if dup and not data.get("_allow_duplicate"):
        raise HTTPException(409, {"message": "Possible duplicate transaction",
                                  "existing_id": dup["id"]})

@router.post("")
def add_transaction(payload: dict):
    try:
        data = clean(payload, FIELDS | {"_allow_duplicate"}, REQUIRED)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_db() as conn:
        _check(conn, data)
        data.pop("_allow_duplicate", None)
        data = {k: v for k, v in data.items() if k in FIELDS}
        cur = conn.execute("INSERT INTO transactions(%s) VALUES(%s)" % (
            ",".join(data), ",".join("?" * len(data))), list(data.values()))
        return {"id": cur.lastrowid}

@router.post("/force")
def add_transaction_forced(payload: dict):
    payload = dict(payload); payload["_allow_duplicate"] = True
    return add_transaction(payload)

@router.put("/{tx_id}")
def update_transaction(tx_id: int, payload: dict):
    data = {k: v for k, v in payload.items() if k in FIELDS}
    with get_db() as conn:
        row = conn.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        merged = {**rowdict(row), **data}
        _check(conn, merged, exclude_id=tx_id)
        if data:
            conn.execute("UPDATE transactions SET %s WHERE id=?" % ",".join(f"{k}=?" for k in data),
                         [*data.values(), tx_id])
        return {"ok": True}

@router.delete("/{tx_id}")
def delete_transaction(tx_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM transactions WHERE id=?", (tx_id,))
        return {"ok": True}
