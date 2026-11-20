"""Validate and compress maintenance evidence before persistent storage."""

from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
import socket
import struct

from fastapi import HTTPException
from PIL import Image, ImageOps

from backend.storage import DATA_DIRECTORY


ATTACHMENT_DIRECTORY = DATA_DIRECTORY / "attachments"
ATTACHMENT_DIRECTORY.mkdir(parents=True, exist_ok=True)
ASSET_DOCUMENT_DIRECTORY = ATTACHMENT_DIRECTORY / "assets"
ASSET_DOCUMENT_DIRECTORY.mkdir(parents=True, exist_ok=True)

TARGET_ATTACHMENT_BYTES = 900 * 1024
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".jpg",
}


def _scan_for_malware(data: bytes) -> None:
    """Stream an upload to ClamAV when available, failing closed when required."""
    host = os.getenv("CLAMAV_HOST", "127.0.0.1")
    port = int(os.getenv("CLAMAV_PORT", "3310"))
    required = os.getenv("CLAMAV_SCAN_REQUIRED", "false").casefold() == "true"
    try:
        with socket.create_connection((host, port), timeout=3) as connection:
            connection.sendall(b"zINSTREAM\0")
            for offset in range(0, len(data), 64 * 1024):
                chunk = data[offset:offset + 64 * 1024]
                connection.sendall(struct.pack(">I", len(chunk)))
                connection.sendall(chunk)
            connection.sendall(struct.pack(">I", 0))
            result = connection.recv(4096).decode("utf-8", "replace")
    except OSError as exc:
        if required:
            raise HTTPException(status_code=503, detail="Attachment malware scanning is temporarily unavailable.") from exc
        return
    if "FOUND" in result:
        raise HTTPException(status_code=422, detail="The attachment was rejected by malware scanning.")
    if "OK" not in result and required:
        raise HTTPException(status_code=503, detail="Attachment malware scanning did not complete successfully.")


def _compress_image(data: bytes, target_bytes: int) -> bytes:
    try:
        image = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The selected image could not be read.") from exc

    image.thumbnail((2200, 2200), Image.Resampling.LANCZOS)
    best = b""
    for _ in range(5):
        for quality in (84, 74, 64, 54, 44, 34):
            output = BytesIO()
            image.save(output, format="JPEG", quality=quality, optimize=True, progressive=True)
            candidate = output.getvalue()
            best = candidate
            if len(candidate) <= target_bytes:
                return candidate
        image = image.resize(
            (max(1, int(image.width * .82)), max(1, int(image.height * .82))),
            Image.Resampling.LANCZOS,
        )
    if len(best) > target_bytes:
        raise HTTPException(status_code=422, detail="The image could not be compressed below 900 KB.")
    return best


def _compress_pdf(data: bytes, target_bytes: int) -> bytes:
    try:
        import fitz
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="PDF compression support is not installed.") from exc

    try:
        source = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The selected PDF could not be read.") from exc
    if source.page_count > 100:
        source.close()
        raise HTTPException(status_code=422, detail="PDF attachments are limited to 100 pages.")

    best = b""
    # Rebuild every PDF from page images. This content-disarm step strips
    # scripts, embedded files, forms, launch actions, and other active content.
    for scale, quality in ((1.35, 72), (1.15, 62), (.95, 52), (.8, 42)):
        output = fitz.open()
        matrix = fitz.Matrix(scale, scale)
        for page in source:
            pixmap = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB, alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            buffer = BytesIO()
            image.save(buffer, "JPEG", quality=quality, optimize=True, progressive=True)
            target_page = output.new_page(width=page.rect.width, height=page.rect.height)
            target_page.insert_image(target_page.rect, stream=buffer.getvalue())
        candidate = output.tobytes(garbage=4, deflate=True, clean=True)
        output.close()
        best = candidate
        if len(candidate) <= target_bytes:
            source.close()
            return candidate
    source.close()
    if len(best) > target_bytes:
        raise HTTPException(status_code=422, detail="The PDF could not be compressed below 900 KB.")
    return best


def optimize_attachment(filename: str, content_type: str, data: bytes) -> tuple[bytes, str, str]:
    if not data:
        raise HTTPException(status_code=422, detail="The selected attachment is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Attachments must be 20 MB or smaller before compression.")

    _scan_for_malware(data)

    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    extension = ALLOWED_CONTENT_TYPES.get(normalized_type)
    if not extension:
        suffix = Path(filename or "").suffix.lower()
        normalized_type = "application/pdf" if suffix == ".pdf" else "image/jpeg" if suffix in {".jpg", ".jpeg", ".png"} else ""
        extension = ALLOWED_CONTENT_TYPES.get(normalized_type)
    if not extension:
        raise HTTPException(status_code=422, detail="Only PDF, JPG, JPEG, and PNG attachments are supported.")

    if normalized_type == "application/pdf":
        return _compress_pdf(data, TARGET_ATTACHMENT_BYTES), "application/pdf", ".pdf"
    return _compress_image(data, TARGET_ATTACHMENT_BYTES), "image/jpeg", ".jpg"
