import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_tmp = tempfile.mkdtemp(prefix="fwm_test_")
os.environ["FWM_DB"] = os.path.join(_tmp, "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db import init_db  # noqa: E402

import pytest  # noqa: E402


@pytest.fixture()
def client():
    import app.db as db
    if os.path.exists(db.DB_PATH):
        os.remove(db.DB_PATH)
    init_db()
    return TestClient(app)


@pytest.fixture()
def client2():
    """Second TestClient sharing the same DB -> verifies persistence."""
    return TestClient(app), os.environ["FWM_DB"]
