from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..helpers import rowdicts, clean

router = APIRouter(prefix="/api/liabilities", tags=["liabilities"])

FIELDS = {"name", "lender", "owner_id", "original_amount", "current_outstanding", "interest_rate",
          "emi", "start_date", "end_date", "notes"}
REQUIRED = {"name"}

@router.get("")
def list_liabilities(owner_id: int | None = None):
    q, p = "SELECT l.*, m.name owner_name FROM liabilities l LEFT JOIN members m ON m.id=l.owner_id WHERE 1=1", []
    if owner_id: q += " AND l.owner_id=?"; p.append(owner_id)
    with get_db() as conn:
        rows = rowdicts(conn.execute(q + " ORDER BY l.name", p).fetchall())
        return {"items": rows,
                "totals": {"outstanding": round(sum(r["current_outstanding"] or 0 for r in rows), 2),
                           "emi": round(sum(r["emi"] or 0 for r in rows), 2),
                           "original": round(sum(r["original_amount"] or 0 for r in rows), 2)}}

@router.post("")
def add_liability(payload: dict):
    try:
        data = clean(payload, FIELDS, REQUIRED)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_db() as conn:
        cur = conn.execute("INSERT INTO liabilities(%s) VALUES(%s)" % (
            ",".join(data), ",".join("?" * len(data))), list(data.values()))
        return {"id": cur.lastrowid}

@router.put("/{liability_id}")
def update_liability(liability_id: int, payload: dict):
    data = {k: v for k, v in payload.items() if k in FIELDS}
    with get_db() as conn:
        if data:
            conn.execute("UPDATE liabilities SET %s WHERE id=?" % ",".join(f"{k}=?" for k in data),
                         [*data.values(), liability_id])
        return {"ok": True}

@router.delete("/{liability_id}")
def delete_liability(liability_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM liabilities WHERE id=?", (liability_id,))
        return {"ok": True}
