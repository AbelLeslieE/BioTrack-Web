# ==========================================
# IMPORTS
# ==========================================

from io import BytesIO
from urllib.parse import quote

import qrcode

# ==========================================
# GENERATE QR
# ==========================================

def qr_url_for_asset_code(asset_code: str) -> str:
    """Return the stable, database-backed QR image endpoint for an asset."""
    return f"/api/qr/image/{quote(asset_code, safe='')}"


def generate_qr_png(asset_code: str) -> bytes:
    """Render an asset QR code without depending on persistent file storage."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(asset_code)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def generate_qr(asset_code: str) -> str:
    """
    Return the dynamic QR image URL for an equipment asset.

    Returns:
        Relative URL of generated QR image.
    """

    # --------------------------------------
    # Future Production URL
    # --------------------------------------

    qr_data = asset_code

    # Example later:
    #
    # qr_data = f"https://biotrack.lfhospital.com/assets/{asset_code}"
    #

    return qr_url_for_asset_code(qr_data)
