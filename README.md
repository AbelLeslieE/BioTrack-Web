# BioTrack Web

FastAPI and SQLite application for managing biomedical assets, maintenance requests, preventive maintenance, and inventory.

## Run locally

1. Create and activate a Python virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env`, then replace the placeholder secret and bootstrap password. Do not commit `.env`.
4. For an existing database, run `python -m backend.migrations.add_electrical_engineer_support`, `python -m backend.migrations.separate_engineering_assets_inventory`, and `python -m backend.migrations.add_spare_parts_stock_consumption` once. Re-run the first migration after updating to add the IT role.
5. Start the app from this directory: `uvicorn backend.main:app --reload`.
6. Open `http://127.0.0.1:8000`.

## Render hosting

Set `JWT_SECRET_KEY` in the Render service environment to a unique secret of at least 32 characters. Set `COOKIE_SECURE=true` for the public HTTPS service. Render can use `GET /api/health` as its health-check path.

All `/api` endpoints except login require the HttpOnly session cookie issued by `/api/auth/login`. API clients may instead send the cookie's JWT as an `Authorization: Bearer <token>` header. Manager-only and biomedical-engineer endpoints are checked by the server; browser `localStorage` only controls dashboard presentation.

## Database changes

The application creates missing tables but does not modify existing tables at startup. Back up `database/biotrack.db` and apply reviewed migration scripts for schema changes.
