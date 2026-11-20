import unittest
import asyncio
import inspect
import tempfile
from datetime import date
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd
import fitz
from fastapi import HTTPException, UploadFile
from fastapi.params import Query
from starlette.datastructures import Headers
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.models.asset_document import AssetDocument
from backend.models.asset_history import AssetHistory
from backend.models.asset_spare import AssetSpare
from backend.models.asset_relocation_request import AssetRelocationRequest
from backend.models.pm_history import PMHistory
from backend.models.pm_schedule import PMSchedule
from backend.routes.asset_routes import (
    bulk_delete_assets,
    create_asset,
    create_asset_relocation_request,
    delete_asset_document,
    get_asset,
    get_asset_relocation_requests,
    get_assets,
    list_asset_documents,
    get_my_asset_relocation_requests,
    review_asset_relocation_request,
    update_asset,
    upload_asset_document,
    upload_asset_excel,
)
from backend.services.excel_import_service import import_assets_from_excel
from backend.services.service_team import team_for_user


class AssetRouteTests(unittest.TestCase):
    def test_asset_document_upload_compresses_stores_and_deletes_file(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        AssetDocument.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        document = fitz.open()
        page = document.new_page()
        page.insert_text((72, 72), "Synthetic BioTrack asset manual")
        pdf_bytes = document.tobytes()
        document.close()
        try:
            asset = Asset(asset_code="DOC-UPLOAD-1", equipment_name="Monitor", service_team="Biomedical")
            session.add(asset)
            session.commit()
            user = SimpleNamespace(role="Manager", username="admin", name="Admin")
            upload = UploadFile(
                filename="manual.pdf",
                file=BytesIO(pdf_bytes),
                headers=Headers({"content-type": "application/pdf"}),
            )
            with tempfile.TemporaryDirectory(prefix="biotrack-asset-doc-") as directory:
                target_directory = Path(directory)
                with patch("backend.routes.asset_routes.ASSET_DOCUMENT_DIRECTORY", target_directory):
                    result = asyncio.run(upload_asset_document(asset.id, "Manual", upload, session, user))
                    stored = session.get(AssetDocument, result["document"]["id"])
                    stored_path = target_directory / stored.file_path
                    self.assertTrue(stored_path.is_file())
                    self.assertLessEqual(stored.stored_size_bytes, 900 * 1024)
                    self.assertEqual(stored.original_size_bytes, len(pdf_bytes))
                    delete_asset_document(stored.id, session, user)
                    self.assertFalse(stored_path.exists())
        finally:
            session.close()
            engine.dispose()

    def test_asset_documents_include_compression_metadata(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        AssetDocument.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        try:
            asset = Asset(asset_code="DOC-1", equipment_name="Ventilator", service_team="Biomedical")
            session.add(asset)
            session.flush()
            session.add(AssetDocument(
                asset_id=asset.id,
                document_name="manual.pdf",
                document_type="Manual",
                file_path="stored.pdf",
                content_type="application/pdf",
                original_size_bytes=1_400_000,
                stored_size_bytes=800_000,
                uploaded_by="Engineer",
            ))
            session.commit()
            result = list_asset_documents(asset.id, session, SimpleNamespace(role="Manager"))
            self.assertEqual(result[0]["stored_size_bytes"], 800_000)
            self.assertEqual(result[0]["original_size_bytes"], 1_400_000)
            self.assertEqual(result[0]["download_url"], "/api/assets/documents/1/download")
        finally:
            session.close()
            engine.dispose()

    def test_department_asset_details_hide_finances_and_include_latest_pm(self):
        engine = create_engine("sqlite:///:memory:")
        for table in (Asset.__table__, PMSchedule.__table__, PMHistory.__table__):
            table.create(engine)
        session = sessionmaker(bind=engine)()
        try:
            asset = Asset(
                asset_code="BIO-PRIVATE-1",
                equipment_no="EQ-001",
                equipment_name="Patient Monitor",
                department="Nephrology",
                service_team="Biomedical",
                purchase_value=85000,
                tax_amount=15300,
                net_value=100300,
                supplier="Private Supplier",
            )
            session.add(asset)
            session.flush()
            schedule = PMSchedule(
                asset_id=asset.id,
                scheduled_date=date(2026, 10, 1),
                completed_date=date(2026, 10, 2),
                frequency_days=90,
                status="Completed",
            )
            session.add(schedule)
            session.flush()
            session.add(PMHistory(
                asset_id=asset.id,
                pm_schedule_id=schedule.id,
                completed_date=date(2026, 10, 2),
            ))
            session.commit()

            department_result = get_asset(
                asset.id,
                session,
                SimpleNamespace(role="User", department="Nephrology"),
            )
            self.assertEqual(department_result["last_pm_date"], date(2026, 10, 2))
            self.assertEqual(department_result["equipment_name"], "Patient Monitor")
            for private_field in ("purchase_value", "tax_amount", "net_value", "supplier", "warranty"):
                self.assertNotIn(private_field, department_result)

            manager_result = get_asset(
                asset.id,
                session,
                SimpleNamespace(role="Manager", department=None),
            )
            self.assertEqual(manager_result["purchase_value"], 85000)
            self.assertEqual(manager_result["last_pm_date"], date(2026, 10, 2))
        finally:
            session.close()
            engine.dispose()

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

    def test_excel_upload_skips_case_and_whitespace_duplicates(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        workbook = BytesIO()
        dataframe = pd.DataFrame([
            {"Equipment No": "  bio-201  ", "Equipment": "Monitor duplicate", "Manuf.SlNo": " ser-201 "},
            {"Equipment No": "BIO-202", "Equipment": "Monitor serial duplicate", "Manuf.SlNo": "SER-201"},
        ])
        with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
            dataframe.to_excel(writer, index=False, startrow=6)
        workbook.seek(0)

        try:
            session.add(Asset(asset_code="BT-BIO-201", equipment_no="BIO-201", equipment_name="Existing", serial_number="SER-201"))
            session.commit()
            result = import_assets_from_excel(workbook, session, "Biomedical")
            self.assertTrue(result["success"])
            self.assertEqual(result["imported"], 0)
            self.assertEqual(result["skipped"], 2)
            self.assertEqual(session.query(Asset).count(), 1)
        finally:
            session.close()
            engine.dispose()

    def test_manager_bulk_delete_removes_assets_and_child_records(self):
        engine = create_engine("sqlite:///:memory:")
        for table in (
            Asset.__table__,
            PMSchedule.__table__,
            PMHistory.__table__,
            AssetDocument.__table__,
            AssetHistory.__table__,
            AssetSpare.__table__,
            AssetRelocationRequest.__table__,
        ):
            table.create(engine)
        session = sessionmaker(bind=engine)()
        manager = SimpleNamespace(role="Manager", username="admin", department=None)

        try:
            first = Asset(asset_code="DUP-A", equipment_name="Duplicate monitor")
            second = Asset(asset_code="DUP-B", equipment_name="Duplicate monitor")
            session.add_all([first, second])
            session.flush()
            schedule = PMSchedule(asset_id=second.id, scheduled_date=pd.Timestamp("2026-12-01").date(), frequency_days=30)
            session.add(schedule)
            session.flush()
            session.add(PMHistory(asset_id=second.id, pm_schedule_id=schedule.id))
            session.add(AssetHistory(asset_id=second.id, action="Imported"))
            session.add(AssetSpare(asset_id=second.id, part_name="Fuse"))
            session.add(AssetDocument(asset_id=second.id, document_name="Manual", file_path="manual.pdf"))
            session.commit()
            first_id = first.id
            second_id = second.id

            result = bulk_delete_assets({"asset_ids": [second_id]}, session, manager)
            self.assertTrue(result["success"])
            self.assertEqual(result["deleted"], 1)
            self.assertIsNotNone(session.get(Asset, first_id))
            self.assertIsNone(session.get(Asset, second_id))
            self.assertEqual(session.query(PMSchedule).count(), 0)
            self.assertEqual(session.query(PMHistory).count(), 0)
            self.assertEqual(session.query(AssetHistory).count(), 0)
            self.assertEqual(session.query(AssetSpare).count(), 0)
            self.assertEqual(session.query(AssetDocument).count(), 0)
            self.assertEqual(session.query(AssetRelocationRequest).count(), 0)
        finally:
            session.close()
            engine.dispose()

    def test_department_relocation_request_is_scoped_and_updates_only_after_approval(self):
        engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(engine)
        AssetRelocationRequest.__table__.create(engine)
        session = sessionmaker(bind=engine)()
        user = SimpleNamespace(role="User", username="dia", department="Nephrology")
        electrical = SimpleNamespace(role="Electrical", username="electrician", department="Engineering")
        biomedical = SimpleNamespace(role="BME", username="biomed", department="Engineering")

        try:
            asset = Asset(
                asset_code="EL-MOVE-1",
                equipment_name="Isolation transformer",
                service_team="Electrical",
                department="Nephrology",
                location="Room 12",
            )
            session.add(asset)
            session.commit()

            created = create_asset_relocation_request(
                {
                    "asset_id": asset.id,
                    "target_department": "Radiology",
                    "target_location": "Imaging Room 2",
                    "reason": "Required beside the new scanner.",
                },
                session,
                user,
            )
            self.assertTrue(created["success"])
            self.assertEqual(asset.department, "Nephrology")
            self.assertEqual(len(get_asset_relocation_requests("Pending", session, electrical)), 1)
            self.assertEqual(get_asset_relocation_requests("Pending", session, biomedical), [])

            request_id = created["request"]["id"]
            reviewed = review_asset_relocation_request(
                request_id,
                {"decision": "approve", "review_note": "Move cleared."},
                session,
                electrical,
            )
            self.assertEqual(reviewed["request"]["status"], "Approved")
            session.refresh(asset)
            self.assertEqual(asset.department, "Radiology")
            self.assertEqual(asset.location, "Imaging Room 2")
            self.assertEqual(get_my_asset_relocation_requests(session, user)[0]["status"], "Approved")
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
