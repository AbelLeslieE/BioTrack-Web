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

            controls_command = [sys.executable, "-m", "backend.migrations.add_business_controls"]
            controls_first = subprocess.run(controls_command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(controls_first.returncode, 0, controls_first.stdout + controls_first.stderr)
            controls_second = subprocess.run(controls_command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(controls_second.returncode, 0, controls_second.stdout + controls_second.stderr)
            self.assertIn("already applied", controls_second.stdout)

            connection = sqlite3.connect(database_path)
            try:
                tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                self.assertTrue({"business_vendors", "supplier_quotations", "supplier_invoices", "supplier_payments", "business_documents"}.issubset(tables))
                self.assertTrue({"purchase_orders", "goods_receipts", "business_contracts", "supplier_tax_reconciliations"}.issubset(tables))
                invoice_columns = {row[1] for row in connection.execute("PRAGMA table_info(supplier_invoices)")}
                self.assertTrue({"purchase_order_id", "goods_receipt_id", "match_status", "tds_amount", "net_payable_amount"}.issubset(invoice_columns))
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
