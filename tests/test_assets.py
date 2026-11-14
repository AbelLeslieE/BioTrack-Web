import unittest
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.routes.asset_routes import get_asset, get_assets


class AssetRouteTests(unittest.TestCase):
    def test_missing_asset_returns_http_404(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        try:
            user = SimpleNamespace(role="Manager", department="Biomedical")
            with self.assertRaises(HTTPException) as raised:
                get_asset(999, session, user)
            self.assertEqual(raised.exception.status_code, 404)
        finally:
            session.close()
            engine.dispose()

    def test_manager_sees_all_service_teams_while_engineers_are_scoped(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        try:
            session.add_all([
                Asset(asset_code="BIO-1", equipment_name="Ventilator", service_team="Biomedical"),
                Asset(asset_code="ELEC-1", equipment_name="Generator", service_team="Electrical"),
                Asset(asset_code="IT-1", equipment_name="Server", service_team="IT"),
            ])
            session.commit()

            manager_assets = get_assets(session, SimpleNamespace(role="Manager", department=None))
            biomedical_assets = get_assets(session, SimpleNamespace(role="BME", department=None))
            electrical_assets = get_assets(session, SimpleNamespace(role="Electrical", department=None))
            it_assets = get_assets(session, SimpleNamespace(role="IT", department=None))

            self.assertEqual({asset["service_team"] for asset in manager_assets}, {"Biomedical", "Electrical", "IT"})
            self.assertEqual({asset["service_team"] for asset in biomedical_assets}, {"Biomedical"})
            self.assertEqual({asset["service_team"] for asset in electrical_assets}, {"Electrical"})
            self.assertEqual({asset["service_team"] for asset in it_assets}, {"IT"})
        finally:
            session.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
