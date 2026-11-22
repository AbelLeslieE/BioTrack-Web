import asyncio
import unittest
from io import BytesIO
from types import SimpleNamespace

from fastapi import UploadFile
from fastapi.requests import Request as WebRequest
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from backend.models.request import Request
from backend.models.request_attachment import RequestAttachment
from backend.models.security_audit import SecurityAudit
from backend.routes.attachment_routes import (
    delete_ticket_attachment,
    download_ticket_attachment,
    upload_ticket_attachment,
)


class AttachmentStorageTests(unittest.TestCase):
    def test_maintenance_attachment_round_trip_uses_database_content(self):
        engine = create_engine("sqlite:///:memory:")
        for table in (Request.__table__, RequestAttachment.__table__, SecurityAudit.__table__):
            table.create(engine)
        session = sessionmaker(bind=engine)()
        try:
            ticket = Request(ticket_number="REQ-DB-1", service_team="Biomedical")
            session.add(ticket)
            session.commit()
            user = SimpleNamespace(id=1, role="Manager", username="admin", name="Admin")
            buffer = BytesIO()
            Image.new("RGB", (80, 60), "blue").save(buffer, format="PNG")
            buffer.seek(0)
            upload = UploadFile(
                filename="evidence.png",
                file=buffer,
                headers=Headers({"content-type": "image/png"}),
            )
            request = WebRequest({"type": "http", "method": "POST", "path": "/", "headers": []})

            result = asyncio.run(
                upload_ticket_attachment(ticket.id, request, "Photo", upload, session, user)
            )
            stored = session.get(RequestAttachment, result["attachment"]["id"])
            self.assertIsNotNone(stored.file_data)
            self.assertEqual(len(stored.file_data), stored.stored_size_bytes)

            response = download_ticket_attachment(stored.id, request, session, user)
            self.assertEqual(response.body, stored.file_data)
            self.assertEqual(response.media_type, "image/jpeg")

            delete_ticket_attachment(stored.id, request, session, user)
            self.assertIsNone(session.get(RequestAttachment, stored.id))
        finally:
            session.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
