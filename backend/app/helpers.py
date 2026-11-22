def rowdict(r):
    return {k: r[k] for k in r.keys()}

def rowdicts(rs):
    return [rowdict(r) for r in rs]

def clean(payload: dict, allowed: set, required: set) -> dict:
    data = {k: v for k, v in payload.items() if k in allowed}
    missing = [f for f in required if data.get(f) in (None, "")]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    return data
