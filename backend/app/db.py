import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.environ.get("FWM_DB", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "fwm.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'member'
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,             -- income | expense
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id),
  UNIQUE(kind, name, parent_id)
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  bank_name TEXT,
  owner_id INTEGER REFERENCES members(id),
  account_type TEXT NOT NULL DEFAULT 'savings',  -- savings|current|fd|cash|other
  opening_balance REAL NOT NULL DEFAULT 0,
  opening_date TEXT NOT NULL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);
-- type: income | expense | transfer
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  date TEXT NOT NULL,                       -- YYYY-MM-DD
  amount REAL NOT NULL,
  member_id INTEGER REFERENCES members(id),
  account_id INTEGER REFERENCES accounts(id),
  to_account_id INTEGER REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  subcategory TEXT,
  payment_method TEXT,                      -- cash|upi|bank_transfer|debit_card|credit_card|other
  beneficiary TEXT,
  description TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_type TEXT NOT NULL,   -- mutual_fund|stocks|fd|gold|bonds|property|<custom>
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES members(id),
  institution TEXT,                -- AMC / broker / bank
  scheme_type TEXT,                -- equity|debt|hybrid|...
  folio TEXT,                      -- folio / demat ref
  symbol TEXT,                     -- stock symbol
  gold_type TEXT,
  quantity REAL,                   -- stocks/gold units
  unit_label TEXT,                 -- 'units','shares','grams' etc
  principal REAL,                  -- FD principal (informational)
  interest_rate REAL,              -- FD rate %
  start_date TEXT,                 -- FD start
  maturity_date TEXT,              -- FD maturity
  compounding TEXT,                -- FD: monthly|quarterly|half_yearly|yearly — default quarterly
  maturity_amount REAL,            -- FD known maturity value
  fd_status TEXT,                  -- FD: active|matured|closed
  current_value REAL,              -- manually entered current market value
  current_value_date TEXT,         -- date of the above valuation
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS investment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  tx_type TEXT NOT NULL,           -- purchase|redemption|dividend|switch_in|switch_out
  amount REAL NOT NULL,
  units REAL,                      -- units bought/sold (if known)
  nav REAL,                        -- NAV / price per unit (if known)
  account_id INTEGER REFERENCES accounts(id),  -- linked bank/cash account (informational link)
  description TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS sip_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL,         -- monthly|quarterly
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active|paused|stopped
  notes TEXT
);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  owner_id INTEGER REFERENCES members(id),
  purchase_date TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  current_value REAL,
  valuation_date TEXT,
  description TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS liabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  lender TEXT,
  owner_id INTEGER REFERENCES members(id),
  original_amount REAL NOT NULL DEFAULT 0,
  current_outstanding REAL NOT NULL DEFAULT 0,
  interest_rate REAL,
  emi REAL,
  start_date TEXT,
  end_date TEXT,
  notes TEXT
);
-- Historical month-end valuations for investments/assets/liabilities (scope, ref_id, date, value)
CREATE TABLE IF NOT EXISTS valuations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,             -- investment|asset|liability|account
  ref_id INTEGER NOT NULL,
  date TEXT NOT NULL,              -- YYYY-MM-DD (usually month end)
  value REAL NOT NULL,
  UNIQUE(scope, ref_id, date)
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_invtx_inv ON investment_transactions(investment_id);
"""

DEFAULT_INCOME_CATEGORIES = ["Salary", "Business Income", "Rental Income", "Interest Income",
    "Dividends", "Pension", "Freelance Income", "Other Income"]
DEFAULT_EXPENSE_CATEGORIES = ["Groceries", "Electricity", "Water", "Gas", "Rent", "Medical",
    "Insurance", "Education", "Transportation", "Fuel", "Shopping", "Food", "Travel",
    "Entertainment", "Household Maintenance", "EMI", "Taxes", "Personal Expenses", "Other Expenses"]
INVESTMENT_TYPES = ["mutual_fund", "stocks", "fd", "gold", "bonds", "property", "other"]
ACCOUNT_TYPES = ["savings", "current", "fd", "cash", "other"]
PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "debit_card", "credit_card", "other"]
TX_TYPES = ["purchase", "redemption", "dividend", "switch_in", "switch_out"]


def connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def seed(conn: sqlite3.Connection):
    for name, kind in [("Father", "member"), ("Mother", "member"), ("Household", "household")]:
        conn.execute("INSERT OR IGNORE INTO members(name, kind) VALUES(?,?)", (name, kind))
    for name in DEFAULT_INCOME_CATEGORIES:
        conn.execute("INSERT OR IGNORE INTO categories(kind,name) VALUES('income',?)", (name,))
    for name in DEFAULT_EXPENSE_CATEGORIES:
        conn.execute("INSERT OR IGNORE INTO categories(kind,name) VALUES('expense',?)", (name,))


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)
        seed(conn)
