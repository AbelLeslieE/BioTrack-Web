# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter
import sqlite3


# ==========================================
# ROUTER
# ==========================================

router = APIRouter()


# ==========================================
# GET ALL LOGS
# ==========================================

@router.get("/api/logs")
def get_logs():

    connection = sqlite3.connect(
        "database/biotrack.db"
    )

    connection.row_factory = sqlite3.Row

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM logs
        ORDER BY id DESC
        """
    )

    rows = cursor.fetchall()

    connection.close()

    return [
        dict(row)
        for row in rows
    ]