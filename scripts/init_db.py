"""Create the PostgreSQL database (if missing) and all tables, indexes and constraints.

Usage (inside the venv, from the repository root):
    python scripts/init_db.py

Reads DATABASE_URL from .env. Connects to the server's default `postgres`
database with AUTOCOMMIT to run CREATE DATABASE, then builds the schema.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, inspect, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from backend.core.database import DATABASE_URL  # noqa: E402


def ensure_database() -> None:
    url = make_url(DATABASE_URL)
    if not url.drivername.startswith("postgresql"):
        print(f"Non-PostgreSQL URL ({url.drivername}); skipping CREATE DATABASE.")
        return
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}).scalar()
        if exists:
            print(f"Database '{url.database}' already exists.")
        else:
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
            print(f"Created database '{url.database}'.")
    admin.dispose()


def create_schema() -> None:
    from backend.core import models  # noqa: F401 - registers tables
    from backend.core.database import Base, engine

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    tables = sorted(inspector.get_table_names())
    print(f"{len(tables)} tables: {', '.join(tables)}")
    for table in ("subscriptions", "invoices"):
        for index in inspector.get_indexes(table):
            print(f"  index {table}.{index['name']}: {index['column_names']}")
    for constraint in inspector.get_unique_constraints("invoices"):
        print(f"  unique invoices.{constraint['name']}: {constraint['column_names']}")


if __name__ == "__main__":
    ensure_database()
    create_schema()
