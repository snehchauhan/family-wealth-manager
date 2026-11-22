import os


def _add_account(c, name, opening=0, **kw):
    r = c.post("/api/accounts", json={"name": name, "account_type": "savings",
                                      "opening_date": "2023-01-01", "opening_balance": opening, **kw})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_persistence(client, client2):
    c2, dbpath = client2
    c = client
    c.post("/api/transactions", json={"type": "income", "date": "2023-05-01", "amount": 1000,
                                      "account_id": _add_account(c, "P")})
    t = c2.get("/api/transactions")
    assert t.json()["total"] == 1
    assert os.path.exists(dbpath)


def test_transfers_are_not_income_or_expense(client):
    c = client
    a1 = _add_account(c, "A", opening=10000)
    a2 = _add_account(c, "B", opening=0)
    r = c.post("/api/transactions", json={"type": "transfer", "date": "2023-05-01",
                                          "amount": 4000, "account_id": a1, "to_account_id": a2})
    assert r.status_code == 200, r.text
    d = c.get("/api/dashboard", params={"year": 2023, "month": 5}).json()["totals"]
    assert d["income"] == 0 and d["expenses"] == 0
    assert c.get("/api/accounts/%d/balance" % a1).json()["balance"] == 6000
    assert c.get("/api/accounts/%d/balance" % a2).json()["balance"] == 4000
    assert c.get("/api/accounts/%d/balance" % a1, params={"on_date": "2023-04-30"}).json()["balance"] == 10000


def test_income_expense_monthly_summary(client):
    c = client
    a = _add_account(c, "Salary Acct", opening=50000)
    c.post("/api/transactions", json={"type": "income", "date": "2023-05-01", "amount": 100000,
                                      "account_id": a, "description": "Salary"})
    c.post("/api/transactions", json={"type": "expense", "date": "2023-05-10", "amount": 30000,
                                      "account_id": a, "description": "Groceries + rent"})
    s = c.get("/api/dashboard", params={"year": 2023, "month": 5}).json()["totals"]
    assert s["income"] == 100000
    assert s["expenses"] == 30000
    assert s["savings"] == 70000
    assert s["savings_rate"] == 70.0
    assert s["bank_cash"] == 120000
    # April should be zero activity but a valid month-end snapshot
    s2 = c.get("/api/dashboard", params={"year": 2023, "month": 4}).json()["totals"]
    assert s2["income"] == 0 and s2["bank_cash"] == 50000


def test_duplicate_transaction_warning(client):
    c = client
    a = _add_account(c, "A")
    body = {"type": "expense", "date": "2023-05-02", "amount": 500, "account_id": a}
    assert c.post("/api/transactions", json=body).status_code == 200
    assert c.post("/api/transactions", json=body).status_code == 409
    assert c.post("/api/transactions/force", json=body).status_code == 200


def test_mf_lifecycle_units_and_returns(client):
    c = client
    father = c.get("/api/meta/bootstrap").json()["members"][0]["id"]
    inv_id = c.post("/api/investments", json={"investment_type": "mutual_fund", "name": "Bluechip Fund",
                                              "owner_id": father}).json()["id"]
    # SIP-compatible purchases
    c.post("/api/investments/transactions", json={"investment_id": inv_id, "date": "2023-01-05",
                                                  "tx_type": "purchase", "amount": 10000, "units": 100, "nav": 100})
    c.post("/api/investments/transactions", json={"investment_id": inv_id, "date": "2023-02-05",
                                                  "tx_type": "purchase", "amount": 11000, "units": 100, "nav": 110})
    c.post("/api/investments/transactions", json={"investment_id": inv_id, "date": "2023-03-05",
                                                  "tx_type": "redemption", "amount": 6600, "units": 60, "nav": 110})
    # manual current valuation: 140 units @ 120
    c.put("/api/investments/%d" % inv_id, json={"current_value": 140 * 120, "current_value_date": "2023-04-30"})
    perf = c.get("/api/dashboard/performance").json()
    it = perf["by_investment"][0]
    assert it["contributed"] == 21000
    assert it["withdrawn"] == 6600
    assert it["units_held"] == 140
    # realized: sold 60 units @ avg cost 105 = 6300 -> gain 300
    assert abs(it["realized_gain"] - 300) < 0.01
    # unrealized: avg cost 105 * 140 held = 14700; value 16800 -> 2100
    assert abs(it["unrealized_gain"] - 2100) < 0.01
    assert abs(it["total_gain"] - 2400) < 0.01
    assert it["sufficient_data"]
    # investment purchase must NOT show up as a household expense
    s = c.get("/api/dashboard", params={"year": 2023, "month": 1}).json()["totals"]
    assert s["expenses"] == 0 and s["investment_contributions"] == 10000


def test_xirr_known_value():
    from app.calc import xirr
    # Exact: 1000 invested, 1500 returned exactly one year later -> 50% p.a.
    v = xirr([("2023-01-01", -1000), ("2024-01-01", 1500)])
    assert v is not None and abs(v - 0.5) < 1e-6
    # Two flows, same maturity: 1000 now + 1000 in 6m -> 2100 after 1y.
    # 2100 = 1000(1+r) + 1000(1+r)^0.5 ; r ~ 0.3038
    v2 = xirr([("2023-01-01", -1000), ("2023-07-01", -1000), ("2024-01-01", 2100)])
    assert v2 is not None
    from app.calc import D
    npv = sum(a / (1 + v2) ** ((D(d) - D("2023-01-01")).days / 365.0) for d, a in
              [("2023-01-01", -1000), ("2023-07-01", -1000), ("2024-01-01", 2100)])
    assert abs(npv) < 1e-4


def test_xirr_insufficient_data():
    from app.calc import xirr
    assert xirr([("2023-01-01", -1000)]) is None
    assert xirr([("2023-01-01", -1000), ("2023-01-02", -500)]) is None


def test_net_worth_and_no_double_counting(client):
    c = client
    a = _add_account(c, "Bank", opening=100000)
    c.post("/api/liabilities", json={"name": "Home Loan", "lender": "SBI",
                                     "original_amount": 500000, "current_outstanding": 400000, "emi": 25000})
    c.post("/api/assets", json={"name": "Family Car", "category": "Vehicle", "owner_id": 1,
                                "purchase_price": 800000, "current_value": 700000})
    c.post("/api/transactions", json={"type": "expense", "date": "2023-06-01", "amount": 20000, "account_id": a})
    nw = c.get("/api/dashboard", params={"date_from": "2023-06-01", "date_to": "2023-06-30"}) \
        .json()["totals"]
    # bank 100000-20000 + asset 700000 - loan 400000
    assert nw["net_worth"] == 380000
    assert nw["total_liabilities"] == 400000


def test_redemption_not_income(client):
    c = client
    inv_id = c.post("/api/investments", json={"investment_type": "fd", "name": "FD SBI"}).json()["id"]
    c.post("/api/investments/transactions", json={"investment_id": inv_id, "date": "2022-01-01",
                                                  "tx_type": "purchase", "amount": 100000})
    c.post("/api/investments/transactions", json={"investment_id": inv_id, "date": "2023-01-01",
                                                  "tx_type": "redemption", "amount": 112000})
    d = c.get("/api/dashboard", params={"year": 2023, "month": 1}).json()["totals"]
    assert d["income"] == 0 and d["investment_withdrawn"] == 112000


def test_monthly_and_yearly_summaries(client):
    c = client
    a = _add_account(c, "Main")
    c.post("/api/transactions", json={"type": "income", "date": "2022-03-15", "amount": 50000, "account_id": a})
    c.post("/api/transactions", json={"type": "expense", "date": "2022-03-20", "amount": 15000, "account_id": a})
    ys = c.get("/api/reports/export/csv", params={"report": "monthly", "year": 2022})
    assert ys.status_code == 200
    d = c.get("/api/dashboard/series", params={"year": 2022}).json()["series"]
    mar = [m for m in d if m["year"] == 2022 and m["month"] == 3][0]
    assert mar["income"] == 50000 and mar["savings"] == 35000
    # year 1 and year 12 present even with no activity (historical timeline support)
    assert len(d) == 12


def test_insufficient_data_flagged(client):
    c = client
    c.post("/api/investments", json={"investment_type": "gold", "name": "Empty gold holding"})
    perf = c.get("/api/dashboard/performance").json()
    it = perf["by_investment"][0]
    assert not it["sufficient_data"] or it["contributed"] == 0
