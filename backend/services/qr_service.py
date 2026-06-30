# ==========================================
# IMPORTS
# ==========================================

import os
import qrcode

# ==========================================
# QR STORAGE LOCATION
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

QR_FOLDER = os.path.join(
    BASE_DIR,
    "frontend",
    "qr"
)

os.makedirs(QR_FOLDER, exist_ok=True)

os.makedirs(QR_FOLDER, exist_ok=True)

# ==========================================
# GENERATE QR
# ==========================================

def generate_qr(asset_code: str) -> str:
    """
    Generate a QR image for an equipment asset.

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

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )

    qr.add_data(qr_data)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")

    filename = f"{asset_code}.png"

    filepath = os.path.join(QR_FOLDER, filename)

    image.save(filepath)

    return f"/static/qr/{filename}"