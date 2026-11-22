from fastapi import APIRouter, HTTPException
from ..db import get_db
from ..helpers import rowdicts, clean, rowdict
from .. import calc

router = APIRouter(prefix="/api/investments", tags=["investments"])

FIELDS = {"investment_type", "name", "owner_id", "institution", "scheme_type", "folio", "symbol",
          "gold_type", "quantity", "unit_label", "principal", "interest_rate", "start_date",
          "maturity_date", "compounding", "maturity_amount", "fd_status",
          "current_value", "current_value_date", "notes", "is_active"}
REQUIRED = {"investment_type", "name"}

@router.get("")
def list_investments(investment_type: str | None = None, owner_id: int | None = None, active_only: bool = False):
    q = "SELECT * FROM investments WHERE 1=1"
    p: list = []
    if investment_type: q += " AND investment_type=?"; p.append(investment_type)
    if owner_id: q += " AND owner_id=?"; p.append(owner_id)
    if active_only: q += " AND is_active=1"
    with get_db() as conn:
        rows = rowdicts(conn.execute(q + " ORDER BY investment_type, name", p).fetchall())
        perf = {it["investment_id"]: it for it in calc.investment_performance(conn)["by_investment"]}
        for r in rows:
            r["performance"] = perf.get(r["id"])
        return rows

@router.post("")
def add_investment(payload: dict):
    try:
        data = clean(payload, FIELDS, REQUIRED)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_db() as conn:
        cur = conn.execute("INSERT INTO investments(%s) VALUES(%s)" % (
            ",".join(data), ",".join("?" * len(data))), list(data.values()))
        return {"id": cur.lastrowid}

@router.put("/{investment_id}")
def update_investment(investment_id: int, payload: dict):
    data = {k: v for k, v in payload.items() if k in FIELDS}
    if not data:
        raise HTTPException(400, "Nothing to update")
    with get_db() as conn:
        conn.execute("UPDATE investments SET %s WHERE id=?" % ",".join(f"{k}=?" for k in data),
                     [*data.values(), investment_id])
        return {"ok": True}

@router.delete("/{investment_id}")
def delete_investment(investment_id: int, force: bool = False):
    with get_db() as conn:
        n = conn.execute("SELECT COUNT(*) c FROM investment_transactions WHERE investment_id=?",
                         (investment_id,)).fetchone()["c"]
        if n and not force:
            raise HTTPException(409, {"message": "Investment has %d transactions" % n, "needs_force": True})
        conn.execute("DELETE FROM investments WHERE id=?", (investment_id,))
        return {"ok": True}

@router.get("/{investment_id}/transactions")
def inv_txs(investment_id: int):
    with get_db() as conn:
        return rowdicts(conn.execute(
            "SELECT * FROM investment_transactions WHERE investment_id=? ORDER BY date, id",
            (investment_id,)).fetchall())

ITX_FIELDS = {"investment_id", "date", "tx_type", "amount", "units", "nav", "account_id", "description", "notes"}
ITX_REQUIRED = {"investment_id", "date", "tx_type", "amount"}

@router.post("/transactions")
def add_inv_tx(payload: dict):
    try:
        data = clean(payload, ITX_FIELDS, ITX_REQUIRED)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if data["tx_type"] not in ("purchase", "redemption", "dividend", "switch_in", "switch_out"):
        raise HTTPException(400, "invalid tx_type")
    with get_db() as conn:
        if not conn.execute("SELECT 1 FROM investments WHERE id=?", (data["investment_id"],)).fetchone():
            raise HTTPException(404, "Investment not found")
        cur = conn.execute("INSERT INTO investment_transactions(%s) VALUES(%s)" % (
            ",".join(data), ",".join("?" * len(data))), list(data.values()))
        return {"id": cur.lastrowid}

@router.delete("/transactions/{tx_id}")
def del_inv_tx(tx_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM investment_transactions WHERE id=?", (tx_id,))
        return {"ok": True}

@router.put("/transactions/{tx_id}")
def upd_inv_tx(tx_id: int, payload: dict):
    data = {k: v for k, v in payload.items() if k in ITX_FIELDS - {"investment_id"}}
    with get_db() as conn:
        if data:
            conn.execute("UPDATE investment_transactions SET %s WHERE id=?" % ",".join(f"{k}=?" for k in data),
                         [*data.values(), tx_id])
        return {"ok": True}

VAL_FIELDS = {"scope", "ref_id", "date", "value"}

@router.post("/valuations")
def add_valuation(payload: dict):
    """Record a historical month-end valuation (investment|asset|liability|account)."""
    try:
        data = clean(payload, VAL_FIELDS, {"scope", "ref_id", "date", "value"})
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_db() as conn:
        conn.execute("INSERT INTO valuations(scope, ref_id, date, value) VALUES(?,?,?,?) "
                     "ON CONFLICT(scope, ref_id, date) DO UPDATE SET value=excluded.value",
                     (data["scope"], data["ref_id"], data["date"], float(data["value"])))
        return {"ok": True}

@router.get("/{investment_id}/valuations")
def get_valuations(investment_id: int):
    with get_db() as conn:
        return rowdicts(conn.execute(
            "SELECT * FROM valuations WHERE scope='investment' AND ref_id=? ORDER BY date",
            (investment_id,)).fetchall())

SIP_FIELDS = {"investment_id", "amount", "frequency", "start_date", "end_date", "status", "notes"}
SIP_REQUIRED = {"investment_id", "amount", "frequency", "start_date"}

@router.get("/sip/plans")
def list_sips():
    with get_db() as conn:
        rows = rowdicts(conn.execute(
            """SELECT s.*, i.name investment_name, i.owner_id
               FROM sip_plans s JOIN investments i ON i.id=s.investment_id
               ORDER BY s.start_date""").fetchall())
        for s in rows:
            paid = conn.execute(
                """SELECT COUNT(*) c, COALESCE(SUM(amount),0) total FROM investment_transactions
                   WHERE investment_id=? AND tx_type IN ('purchase','switch_in') AND date>=?""",
                   (s["investment_id"], s["start_date"])).fetchone()
            s["recorded_installments"] = paid["c"]
            s["total_contributed"] = paid["total"]
        return rows

@router.post("/sip/plans")
def add_sip(payload: dict):
    try:
        data = clean(payload, SIP_FIELDS, SIP_REQUIRED)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_db() as conn:
        cur = conn.execute("INSERT INTO sip_plans(%s) VALUES(%s)" % (
            ",".join(data), ",".join("?" * len(data))), list(data.values()))
        return {"id": cur.lastrowid}

@router.put("/sip/plans/{sip_id}")
def upd_sip(sip_id: int, payload: dict):
    data = {k: v for k, v in payload.items() if k in SIP_FIELDS - {"investment_id"}}
    with get_db() as conn:
        if data:
            conn.execute("UPDATE sip_plans SET %s WHERE id=?" % ",".join(f"{k}=?" for k in data),
                         [*data.values(), sip_id])
        return {"ok": True}

@router.delete("/sip/plans/{sip_id}")
def del_sip(sip_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM sip_plans WHERE id=?", (sip_id,))
        return {"ok": True}

@router.get("/fd/upcoming")
def upcoming_fds():
    with get_db() as conn:
        return rowdicts(conn.execute(
            """SELECT * FROM investments WHERE investment_type='fd' AND is_active=1
               AND maturity_date IS NOT NULL AND fd_status='active'
               ORDER BY maturity_date""").fetchall())
