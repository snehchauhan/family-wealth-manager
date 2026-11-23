import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .db import init_db
from .routers import meta, accounts, transactions, investments, assets, liabilities, dashboard, reports

app = FastAPI(title="Family Wealth Manager", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for r in (meta.router, accounts.router, transactions.router, investments.router,
          assets.router, liabilities.router, dashboard.router, reports.router):
    app.include_router(r)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Family Wealth Manager"}

_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                     "frontend", "dist")

_no_cache = {"Cache-Control": "no-store"}

if os.path.isdir(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets"), html=True), name="assets")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(_dist, "index.html"), headers=_no_cache)

    @app.get("/{path:path}")
    def spa(path: str):
        full = os.path.join(_dist, path)
        if path and os.path.isfile(full):
            if path.startswith("assets/"):
                return FileResponse(full)
            return FileResponse(full, headers=_no_cache)
        return FileResponse(os.path.join(_dist, "index.html"), headers=_no_cache)
