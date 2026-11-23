import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class NativeAccountingMigrationTests(unittest.TestCase):
    def test_migration_creates_all_accounting_tables_and_is_repeatable(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-accounting-migration-") as directory:
            database_path = Path(directory) / "legacy.db"
            database_url = f"sqlite:///{database_path.as_posix()}"
            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            command = [sys.executable, "-m", "backend.migrations.add_native_accounting"]

            first = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            second = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            self.assertIn("already applied", second.stdout)

            connection = sqlite3.connect(database_path)
            try:
                tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                self.assertTrue({
                    "finance_companies",
                    "finance_accounts",
                    "finance_cost_centers",
                    "finance_tax_templates",
                    "finance_journal_entries",
                    "finance_journal_lines",
                }.issubset(tables))
            finally:
                connection.close()

    def test_banking_migration_is_repeatable(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-banking-migration-") as directory:
            database_path = Path(directory) / "legacy.db"
            database_url = f"sqlite:///{database_path.as_posix()}"
            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            accounting = subprocess.run([sys.executable, "-m", "backend.migrations.add_native_accounting"], cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(accounting.returncode, 0, accounting.stdout + accounting.stderr)
            command = [sys.executable, "-m", "backend.migrations.add_native_banking"]
            first = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            second = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            self.assertIn("already applied", second.stdout)
            connection = sqlite3.connect(database_path)
            try:
                tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                self.assertTrue({"finance_bank_accounts", "finance_bank_transactions"}.issubset(tables))
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()

