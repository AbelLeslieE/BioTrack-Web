import unittest
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.models.request import Request
from backend.models.user import User
from backend.routes.asset_routes import get_assets
from backend.routes.request_routes import get_requests
from backend.routes.user_routes import get_users


class RegistryPaginationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        for table in (User.__table__, Asset.__table__, Request.__table__):
            table.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.session.add_all([
            User(
                username=f"user-{index:03d}",
                password_hash="hash",
                role="User",
                is_active=True,
            )
            for index in range(510)
        ])
        self.session.add_all([
            Asset(
                asset_code=f"ASSET-{index:03d}",
                equipment_name="Monitor",
                service_team="Biomedical",
            )
            for index in range(510)
        ])
        self.session.add_all([
            Request(
                ticket_number=f"CALL-{index:03d}",
                service_team="Biomedical",
            )
            for index in range(510)
        ])
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_large_registries_are_returned_in_bounded_pages(self):
        manager = SimpleNamespace(role="Manager", department="Biomedical")
        self.assertEqual(len(get_assets(self.session, manager)), 250)
        self.assertEqual(len(get_assets(self.session, manager, limit=250, offset=500)), 10)
        self.assertEqual(len(get_users(self.session)), 250)
        self.assertEqual(len(get_users(self.session, limit=250, offset=500)), 10)
        self.assertEqual(len(get_requests(self.session)), 250)
        self.assertEqual(len(get_requests(self.session, limit=250, offset=500)), 10)

    def test_page_size_is_capped(self):
        manager = SimpleNamespace(role="Manager", department="Biomedical")
        self.assertEqual(len(get_assets(self.session, manager, limit=5000)), 500)
        self.assertEqual(len(get_users(self.session, limit=5000)), 500)
        self.assertEqual(len(get_requests(self.session, limit=5000)), 500)


if __name__ == "__main__":
    unittest.main()
