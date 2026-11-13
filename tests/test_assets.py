import unittest
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.routes.asset_routes import get_asset


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


if __name__ == "__main__":
    unittest.main()
