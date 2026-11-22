# Family Wealth Manager

A professional, local-first personal finance application for managing a family's complete
financial position — income, expenses, bank/cash accounts, mutual funds, SIPs, fixed deposits,
stocks, gold, other investments, physical assets, liabilities, net worth, and reports.

- **Frontend:** React + TypeScript + Tailwind CSS + Recharts + Lucide
- **Backend:** Python FastAPI
- **Database:** SQLite (single file, `backend/data/fwm.db`)
- **Currency:** Indian Rupees (₹, Indian digit grouping: ₹1,00,000)
- **Dates:** stored ISO (YYYY-MM-DD), displayed DD-MM-YYYY
- **Privacy:** runs 100% on your computer; no internet required after installation; no bank
  credentials or full account numbers are ever stored

---

## 1. Install — one time per computer

You need **Python 3.10+** and **Node.js 18+** installed.

```bash
cd family-wealth-manager/backend
pip install -r requirements.txt

cd ../frontend
npm install
npm run build
```

`npm run build` compiles the UI into `frontend/dist`. After this ONE build step, the app runs
fully offline — Node.js is no longer needed to use it.

## 2. Start / launch

```bash
cd family-wealth-manager/backend
uvicorn app.main:app --port 8000
```

Then open **http://localhost:8000** in your browser. That single command serves both the UI
and the API. Close the terminal = app stopped; nothing is lost, data is in SQLite.

Useful variants:
- `uvicorn app.main:app --port 8000` — normal start
- `FWM_DB=/path/to/fwm.db uvicorn app.main:app` — use a specific database file

## 3. Backup

- **In the app:** Settings → *Download full backup (JSON)* (or Reports → Full JSON backup).
- **Restore:** Settings → *Restore from backup* (replaces all current data — confirm dialog).
- **Excel workbook:** Reports → *Export everything to Excel* (one sheet per dataset).
- **File-level backup:** copy `backend/data/fwm.db` while the app is closed.

## 4. Install on other devices (step by step)

The app is local-first: each computer keeps its own database. To use it on another device:

1. **Copy the whole `family-wealth-manager` folder** to the new device (USB drive, LAN share, etc.).
2. Install **Python 3.10+** from https://python.org (tick “Add Python to PATH” during setup).
3. Install **Node.js 18+** from https://nodejs.org (only needed once, for the build step).
4. Open a terminal in the copied folder:
   ```bash
   cd family-wealth-manager/backend && pip install -r requirements.txt
   cd ../frontend && npm install && npm run build
   cd ../backend && uvicorn app.main:app --port 8000
   ```
5. Open http://localhost:8000.

### Option A — sharing one database between two computers (e.g. your PC and a laptop)
1. Put `backend/data/fwm.db` in a synced folder (Syncthing, Google Drive, Dropbox…) and start
   the app with `FWM_DB=/path/to/synced/fwm.db uvicorn app.main:app`.
2. Only one device should write at a time; the JSON backup/restore flow is the safest way to
   move data between machines.

### Option B — Android/iOS tablet or phone (same Wi-Fi)
1. Start the app on the main computer with:
   `uvicorn app.main:app --host 0.0.0.0 --port 8000`
2. On the phone browser, open `http://<computer-LAN-IP>:8000` (e.g. http://192.168.1.5:8000).
   The UI is responsive and works on mobile. This is LAN-only — the app is never exposed to
   the public internet.

## 5. First data to enter (suggested order)

1. **Settings** — verify family members (Father, Mother, Household) / add more.
2. **Accounts** — add each bank account and cash wallet with its opening balance and date.
3. **Assets & Liabilities** — add property, vehicles, loans with outstanding balances.
4. **Investments** — add each mutual fund / stock / FD / gold holding, then record past
   purchase transactions (SIP installments) with dates, units and NAV.
5. **Transactions** — record income, expenses and transfers. You can back-date anything;
   every month from your first recorded transaction is summarized automatically.
6. Open any investment’s **current value** cell to record today’s valuation; do this monthly
   for accurate net worth history.

## 6. Tests

```bash
cd backend
pip install pytest httpx
python -m pytest tests/ -v
```
11 tests cover: transfers excluded from income/expense, income & expense summaries, savings
rate, duplicate warnings, mutual-fund lifecycle with average-cost realized/unrealized gains,
XIRR correctness, redemption-not-income, net worth with no double counting, monthly/yearly
summaries, persistence across sessions, and insufficient-data flags.

See `docs/USER_GUIDE.md` (usage) and `docs/CALCULATIONS.md` (every formula and assumption).
