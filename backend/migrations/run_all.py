"""Run every reviewed BioTrack migration in dependency order.

Each migration is idempotent and remains directly executable for recovery.
This runner provides one canonical upgrade command so deployments cannot omit a
step when moving an existing database to the current application version.
"""

from __future__ import annotations

from importlib import import_module


MIGRATIONS = (
    "add_electrical_engineer_support",
    "separate_engineering_assets_inventory",
    "scope_inventory_bpk_to_service_team",
    "add_spare_parts_stock_consumption",
    "add_pm_department_responses",
    "add_service_operations_features",
    "add_central_store_workflow",
    "add_security_hardening",
)


def run_all() -> list[tuple[str, bool]]:
    results: list[tuple[str, bool]] = []
    for name in MIGRATIONS:
        module = import_module(f"backend.migrations.{name}")
        changed = bool(module.migrate())
        results.append((name, changed))
    return results


def main() -> None:
    for name, changed in run_all():
        print(f"{name}: {'updated' if changed else 'already current'}")


if __name__ == "__main__":
    main()
