from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..helpers import rowdicts, clean

router = APIRouter(prefix="/api/assets", tags=["assets"])

FIELDS = {"name", "category", "owner_id", "purchase_date", "purchase_price",
          "current_value", "valuation_date", "description", "notes"}
REQUIRED = {"name", "category"}

@router.get("")
def list_assets(category: str | None = None, owner_id: int | None = None):
    q, p = "SELECT a.*, m.name owner_name FROM assets a LEFT JOIN members m ON m.id=a.owner_id WHERE 1=1", []
    if category: q += " AND a.category=?"; p.append(category)
    if owner_id: q += " AND a.owner_id=?"; p.append(owner_id)
    with get_db() as conn:
        rows = rowdicts(conn.execute(q + " ORDER BY a.name", p).fetchall())
        total_purchase = sum(r["purchase_price"] or 0 for r in rows)
        total_current = sum(r["current_value"] if r["current_value"] is not None else r["purchase_price"] for r in rows)
        return {"items": rows, "totals": {"purchase": round(total_purchase, 2),
                 "current": round(total_current, 2), "change": round(total_current - total_purchase, 2)}}

@router.post("")
def add_asset(payload: dict):
    try:
        data = clean(payload, FIELDS, REQUIRED)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_db() as conn:
        cur = conn.execute("INSERT INTO assets(%s) VALUES(%s)" % (
            ",".join(data), ",".join("?" * len(data))), list(data.values()))
        return {"id": cur.lastrowid}

@router.put("/{asset_id}")
def update_asset(asset_id: int, payload: dict):
    data = {k: v for k, v in payload.items() if k in FIELDS}
    with get_db() as conn:
        if data:
            conn.execute("UPDATE assets SET %s WHERE id=?" % ",".join(f"{k}=?" for k in data),
                         [*data.values(), asset_id])
        return {"ok": True}

@router.delete("/{asset_id}")
def delete_asset(asset_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM assets WHERE id=?", (asset_id,))
        return {"ok": True}

@router.get("/categories")
def asset_categories():
    with get_db() as conn:
        return [r["category"] for r in conn.execute("SELECT DISTINCT category FROM assets ORDER BY category")]
