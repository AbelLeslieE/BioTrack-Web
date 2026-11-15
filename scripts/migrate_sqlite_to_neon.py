"""One-time, guarded migration of the local BioTrack SQLite data to Neon."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, func, select, text

from backend.database import normalise_database_url
from backend.models import Base


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("database/biotrack.db"),
        help="Path to the existing BioTrack SQLite database.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_path = args.source.resolve()
    if not source_path.is_file():
        raise SystemExit(f"Source SQLite database not found: {source_path}")

    load_dotenv()
    direct_url = os.getenv("DATABASE_URL_UNPOOLED")
    if not direct_url:
        raise SystemExit("DATABASE_URL_UNPOOLED is required for the migration.")
    direct_url = normalise_database_url(direct_url)
    if not direct_url.startswith("postgresql+psycopg://"):
        raise SystemExit("The migration target must be a PostgreSQL database.")

    source_engine = create_engine(
        f"sqlite:///{source_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    target_engine = create_engine(direct_url, pool_pre_ping=True)
    Base.metadata.create_all(target_engine)

    with target_engine.connect() as target:
        populated = {
            table.name: target.execute(
                select(func.count()).select_from(table)
            ).scalar_one()
            for table in Base.metadata.sorted_tables
        }
    populated = {name: count for name, count in populated.items() if count}
    if populated:
        details = ", ".join(f"{name}={count}" for name, count in populated.items())
        raise SystemExit(
            "Migration refused because the Neon target already contains data: "
            + details
        )

    migrated: dict[str, int] = {}
    with source_engine.connect() as source, target_engine.begin() as target:
        for table in Base.metadata.sorted_tables:
            rows = [dict(row) for row in source.execute(select(table)).mappings()]
            if rows:
                target.execute(table.insert(), rows)
            migrated[table.name] = len(rows)

        for table in Base.metadata.sorted_tables:
            primary_key = list(table.primary_key.columns)
            if len(primary_key) != 1:
                continue
            column = primary_key[0]
            sequence = target.execute(
                text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                {"table_name": table.name, "column_name": column.name},
            ).scalar_one_or_none()
            if not sequence:
                continue
            maximum = target.execute(select(func.max(column))).scalar_one()
            if maximum is not None:
                target.execute(
                    text(
                        "SELECT setval(CAST(:sequence AS regclass), :value, true)"
                    ),
                    {"sequence": sequence, "value": maximum},
                )

    total = sum(migrated.values())
    summary = ", ".join(
        f"{name}={count}" for name, count in migrated.items() if count
    )
    print(f"Migrated {total} BioTrack records to Neon ({summary}).")


if __name__ == "__main__":
    main()
