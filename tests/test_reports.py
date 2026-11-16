import asyncio
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.models.report_schedule import ReportSchedule
from backend.models.request import Request
from backend.routes.report_routes import (
    complete_report_schedule,
    create_report_schedule,
    export_report,
    list_report_schedules,
)


async def response_bytes(response):
    chunks = []
    async for chunk in response.body_iterator:
        chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
    return b"".join(chunks)


class ReportActionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        for table in (Asset.__table__, Request.__table__, ReportSchedule.__table__):
            table.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.user = SimpleNamespace(username="admin", role="Manager")
        self.session.add(Request(ticket_number="REPORT-1", equipment_name="Ventilator", department="ICU", status="Completed", final_downtime_hours=2.5))
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_csv_excel_and_pdf_exports_contain_downloadable_content(self):
        for report_format, signature in (("csv", b"Ticket"), ("xlsx", b"PK"), ("pdf", b"%PDF")):
            response = export_report(report_format, None, None, None, None, None, self.session)
            content = asyncio.run(response_bytes(response))
            self.assertTrue(content.startswith(signature) or signature in content[:100])
            self.assertIn("attachment", response.headers["content-disposition"])

    def test_schedule_is_saved_and_advanced_after_export(self):
        first_run = datetime.now() + timedelta(hours=2)
        created = create_report_schedule(
            {
                "report_format": "xlsx",
                "frequency": "weekly",
                "next_run_at": first_run.isoformat(timespec="minutes"),
                "filters": {"department": "ICU"},
            },
            self.session,
            self.user,
        )
        schedules = list_report_schedules(self.session, self.user)
        self.assertEqual(len(schedules), 1)
        self.assertEqual(schedules[0]["filters"]["department"], "ICU")

        completed = complete_report_schedule(created["schedule_id"], self.session, self.user)
        self.assertTrue(completed["success"])
        self.assertTrue(completed["active"])
        self.assertGreater(datetime.fromisoformat(completed["next_run_at"]), first_run)


if __name__ == "__main__":
    unittest.main()
