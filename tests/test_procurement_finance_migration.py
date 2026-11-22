import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class ProcurementFinanceMigrationTests(unittest.TestCase):
    def test_migration_adds_supplier_finance_tables_and_is_repeatable(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-procurement-migration-") as directory:
            database_path = Path(directory) / "legacy.db"
            connection = sqlite3.connect(database_path)
            connection.executescript(
                """
                CREATE TABLE business_budgets (id INTEGER PRIMARY KEY, allocated_amount REAL NOT NULL DEFAULT 0);
                CREATE TABLE purchase_requests (id INTEGER PRIMARY KEY, quantity REAL NOT NULL DEFAULT 1, unit_cost REAL NOT NULL DEFAULT 0, total_amount REAL NOT NULL DEFAULT 0);
                CREATE TABLE business_transactions (id INTEGER PRIMARY KEY, amount REAL NOT NULL DEFAULT 0);
                CREATE TABLE insurance_claim_batches (id INTEGER PRIMARY KEY, claimed_amount REAL NOT NULL DEFAULT 0, approved_amount REAL NOT NULL DEFAULT 0, received_amount REAL NOT NULL DEFAULT 0, deductions_amount REAL NOT NULL DEFAULT 0);
                """
            )
            connection.close()
            database_url = f"sqlite:///{database_path.as_posix()}"
            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            command = [sys.executable, "-m", "backend.migrations.add_procurement_finance"]

            first = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            second = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            self.assertIn("already applied", second.stdout)

            connection = sqlite3.connect(database_path)
            try:
                tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                self.assertTrue({"business_vendors", "supplier_quotations", "supplier_invoices", "supplier_payments", "business_documents"}.issubset(tables))
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
