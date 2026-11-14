# BioTrack Web

FastAPI and SQLite application for managing biomedical assets, maintenance requests, preventive maintenance, and inventory.

## Run locally

1. Create and activate a Python virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env`, then replace the placeholder secret and bootstrap password. Do not commit `.env`.
4. For an existing database, run `python -m backend.migrations.add_electrical_engineer_support`, `python -m backend.migrations.separate_engineering_assets_inventory`, and `python -m backend.migrations.add_spare_parts_stock_consumption` once. Re-run the first migration after updating to add the IT role.
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
# Google Calendar integration

The Preventive Maintenance page can connect a user's Google account and add or update BioTrack PM schedules in that account's **primary calendar**. The connection is per BioTrack user; calendar events are not automatically deleted when the account is disconnected. Use **Sync schedules** to add newly scheduled visits and update existing linked events.

To enable it in production:

1. In Google Cloud Console, enable the Google Calendar API and create an OAuth client for a web application. Register `https://YOUR-RENDER-SERVICE.onrender.com/api/google-calendar/callback` as an authorized redirect URI (and use the same exact value below). Configure the OAuth consent screen and add the intended users if the app is in Testing mode.
2. In the Render service environment, set `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, and `GOOGLE_CALENDAR_REDIRECT_URI`.
3. Generate a Fernet key with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and set it as `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`. Keep this key stable and private: the app uses it to encrypt stored Google refresh tokens.
4. Deploy and open Preventive Maintenance, then choose **Connect Google Calendar** and approve access. Use **Sync schedules** to publish the current schedule.

The integration uses the signed-in user's Google OAuth consent and requests only email identity and event access. No Google client secrets or encryption keys belong in source control.
