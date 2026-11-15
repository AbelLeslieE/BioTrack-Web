import unittest
import asyncio
import inspect
from io import BytesIO
from types import SimpleNamespace

import pandas as pd
from fastapi import HTTPException, UploadFile
from fastapi.params import Query
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.routes.asset_routes import create_asset, get_asset, get_assets, update_asset, upload_asset_excel
from backend.services.excel_import_service import import_assets_from_excel
from backend.services.service_team import team_for_user


class AssetRouteTests(unittest.TestCase):
    def test_manager_service_team_normalization_preserves_it_acronym(self):
        manager = SimpleNamespace(role="Manager")
        self.assertEqual(team_for_user(manager, "IT"), "IT")
        self.assertEqual(team_for_user(manager, "it"), "IT")

    def test_manager_can_update_it_asset_details(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        try:
            asset = Asset(
                asset_code="IT-OLD",
                equipment_no="OLD-1",
                equipment_name="Old Switch",
                service_team="IT",
            )
            session.add(asset)
            session.commit()

            result = update_asset(
                asset.id,
                {
                    "asset_code": "IT-NEW",
                    "equipment_no": "IT-001",
                    "equipment_name": "Core Network Switch",
                    "service_team": "IT",
                    "manufacturer": "Cisco",
                    "purchase_value": "1000",
                    "tax_amount": "180",
                    "calibration_required": False,
                },
                session,
                SimpleNamespace(role="Manager", department=None),
            )

            self.assertTrue(result["success"])
            session.refresh(asset)
            self.assertEqual(asset.asset_code, "IT-NEW")
            self.assertEqual(asset.equipment_name, "Core Network Switch")
            self.assertEqual(asset.service_team, "IT")
            self.assertEqual(asset.net_value, 1180)
        finally:
            session.close()
            engine.dispose()

    @staticmethod
    def _asset_workbook(equipment_number="IT-TEST-001"):
        workbook = BytesIO()
        dataframe = pd.DataFrame([
            {
                "Equipment No": equipment_number,
                "Equipment": "Network Switch",
                "Classification": "IT",
                "Eq Type": "High",
                "Manufacture": "Test Vendor",
                "Value": 1000,
                "Tax Amount": 180,
            }
        ])
        with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
            dataframe.to_excel(writer, index=False, startrow=6)
        return workbook.getvalue()

    def test_manager_it_excel_upload_accepts_team_query_parameter(self):
        parameter = inspect.signature(upload_asset_excel).parameters["service_team"]
        self.assertIsInstance(parameter.default, Query)

        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()

        try:
            result = asyncio.run(upload_asset_excel(
                file=UploadFile(
                    filename="it-assets.xlsx",
                    file=BytesIO(self._asset_workbook()),
                ),
                service_team="IT",
                service_team_form=None,
                db=session,
                current_user=SimpleNamespace(role="Manager", department=None),
            ))
            self.assertEqual(result["imported"], 1)

            imported = session.query(Asset).one()
            self.assertEqual(imported.service_team, "IT")
            self.assertEqual(imported.equipment_no, "IT-TEST-001")
        finally:
            session.close()
            engine.dispose()

    def test_excel_upload_allows_multiple_missing_serial_numbers(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        workbook = BytesIO()
        dataframe = pd.DataFrame([
            {"Equipment No": "IT-101", "Equipment": "Laptop", "Manuf.SlNo": ""},
            {"Equipment No": "IT-102", "Equipment": "Monitor", "Manuf.SlNo": None},
        ])
        with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
            dataframe.to_excel(writer, index=False, startrow=6)
        workbook.seek(0)

        try:
            result = import_assets_from_excel(workbook, session, "IT")
            self.assertTrue(result["success"])
            self.assertEqual(result["imported"], 2)
            self.assertEqual(session.query(Asset).filter(Asset.serial_number.is_(None)).count(), 2)
        finally:
            session.close()
            engine.dispose()

    def test_excel_upload_skips_real_duplicate_serial_numbers(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        workbook = BytesIO()
        dataframe = pd.DataFrame([
            {"Equipment No": "BIO-101", "Equipment": "Monitor A", "Manuf.SlNo": "SER-101"},
            {"Equipment No": "BIO-102", "Equipment": "Monitor B", "Manuf.SlNo": "SER-101"},
        ])
        with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
            dataframe.to_excel(writer, index=False, startrow=6)
        workbook.seek(0)

        try:
            result = import_assets_from_excel(workbook, session, "Biomedical")
            self.assertTrue(result["success"])
            self.assertEqual(result["imported"], 1)
            self.assertEqual(result["skipped"], 1)
            self.assertEqual(session.query(Asset).count(), 1)
        finally:
            session.close()
            engine.dispose()

    def test_manual_asset_creation_allows_multiple_missing_serial_numbers(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        manager = SimpleNamespace(role="Manager", department=None)

        try:
            for equipment_id in ("IT-MANUAL-1", "IT-MANUAL-2"):
                result = create_asset(
                    {
                        "equipmentId": equipment_id,
                        "equipmentName": "Network device",
                        "serialNumber": "  ",
                        "service_team": "IT",
                    },
                    session,
                    manager,
                )
                self.assertTrue(result["success"])

            self.assertEqual(session.query(Asset).filter(Asset.serial_number.is_(None)).count(), 2)
        finally:
            session.close()
            engine.dispose()

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
