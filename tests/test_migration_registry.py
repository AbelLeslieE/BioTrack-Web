import unittest
from pathlib import Path

from backend.migrations.run_all import MIGRATIONS


class MigrationRegistryTests(unittest.TestCase):
    def test_every_reviewed_migration_is_in_the_ordered_runner(self):
        migration_directory = Path(__file__).resolve().parents[1] / "backend" / "migrations"
        migration_modules = {
            path.stem
            for path in migration_directory.glob("*.py")
            if path.stem not in {"__init__", "run_all"}
        }
        self.assertEqual(set(MIGRATIONS), migration_modules)
        self.assertEqual(len(MIGRATIONS), len(migration_modules))


if __name__ == "__main__":
    unittest.main()
