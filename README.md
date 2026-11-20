# BioTrack Web

FastAPI and SQLite application for managing biomedical assets, maintenance requests, preventive maintenance, and inventory.

## Run locally

1. Create and activate a Python virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env`, then replace the placeholder secret and bootstrap password. Do not commit `.env`.
4. For an existing database, run `python -m backend.migrations.add_electrical_engineer_support`, `python -m backend.migrations.separate_engineering_assets_inventory`, `python -m backend.migrations.scope_inventory_bpk_to_service_team`, `python -m backend.migrations.add_spare_parts_stock_consumption`, `python -m backend.migrations.add_service_operations_features`, and `python -m backend.migrations.add_central_store_workflow` once. Re-run the first migration after updating to add the IT role.
5. Run `npm run audit` for the full database, route, offline-cache, bundle, frontend, and backend readiness audit. GitHub Actions runs the same audit on every push and pull request, once daily, and on manual request.
5. Start the app from this directory: `uvicorn backend.main:app --reload`.
6. Open `http://127.0.0.1:8000`.

## Progressive Web App

BioTrack can be installed from Chrome, Edge, and supported mobile browsers. Open the HTTPS deployment, then use the browser's **Install BioTrack** option or the install button shown on the login screen when installation is available.

The service worker caches only the application shell and static assets. Authenticated `/api` responses are always network-only and are not stored for offline access. When the server cannot be reached, navigation falls back to the dedicated offline screen.

## Tests

Run the backend regression suite from the project directory with:

```powershell
python -m unittest discover -s tests -v
```

Run the frontend output-encoding test with:

```powershell
node --test tests/security.test.js
```

## Render hosting

Set `JWT_SECRET_KEY` in the Render service environment to a unique secret of at least 32 characters. Set `COOKIE_SECURE=true` for the public HTTPS service. Render can use `GET /api/health` as its health-check path.

All `/api` endpoints except login require the HttpOnly session cookie issued by `/api/auth/login`. API clients may instead send the cookie's JWT as an `Authorization: Bearer <token>` header. Manager-only and biomedical-engineer endpoints are checked by the server; browser `localStorage` only controls dashboard presentation.

## Database changes

The application creates missing tables but does not modify existing tables at startup. `database/schema.sql` describes a clean current installation; existing databases must use the reviewed migration scripts. Back up `database/biotrack.db` before applying migrations.

## Persistent data with free Render hosting

Render's free web-service filesystem is ephemeral, and its free PostgreSQL
database expires after 30 days. The recommended no-cost setup is therefore a
free Neon PostgreSQL database while the application itself remains on Render:

1. Create a free Neon project and copy its pooled PostgreSQL connection string.
2. In the Render web service's **Environment** page, add `DATABASE_URL` with that
   connection string as its value.
3. Redeploy the service. BioTrack creates its tables in PostgreSQL on startup.

Do not commit the connection string or paste it into source files. BioTrack
continues to use `database/biotrack.db` for local development whenever
`DATABASE_URL` is not set.

As a paid alternative, attach a Render persistent disk at `/var/data` and set
`BIOTRACK_DATA_DIR=/var/data` to keep SQLite and generated QR files there.
# Google Calendar links

The Preventive Maintenance schedule has an **Add to Google Calendar** link for each visit. It opens a prefilled all-day event in Google Calendar with the visit date, equipment, department, location, status, and remarks. The user reviews and saves the event in Google Calendar.

This link-based flow requires no Google Cloud project, OAuth client, API enablement, or additional Render environment variables. BioTrack continues to run on Render; Google Calendar handles the event after the user saves it. Changes made later in BioTrack do not automatically update an event already saved in Google Calendar, so use the link again or edit the event there.
