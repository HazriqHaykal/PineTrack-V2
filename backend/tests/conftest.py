"""
Test configuration.

Points the app at a throwaway SQLite file before anything imports app.config,
so the tests (which create and drop tables) can never touch the real database.
"""

import os
import tempfile
from pathlib import Path

_TEST_DB = Path(tempfile.gettempdir()) / "pinetrack_test.db"
_TEST_DB.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key"
