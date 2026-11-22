# BioTrack Web

FastAPI and SQLAlchemy application for managing hospital assets, maintenance, preventive maintenance, inventory, Central Store, and institutional Business Office operations.

## Business Office boundary

The Business role manages hospital-level budgets, purchase requests, institutional payments, payer agreements, and aggregate insurance claim batches. It is deliberately not a patient billing or cashier system: patient names, patient identifiers, individual bills, and individual policy records do not belong in this module. Administrators can supervise purchase approvals and see a concise financial overview from their dashboard.

## Run locally

1. Create and activate a Python virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env`, then replace the placeholder secret and bootstrap password. Do not commit `.env`.
4. For an existing database, back it up and run `python -m backend.migrations.run_all`. The ordered runner applies every reviewed migration and safely skips changes that are already present. On an empty database it creates the complete current schema.
5. Run `npm run audit` for the full database, route, offline-cache, bundle, frontend, and backend readiness audit. GitHub Actions runs the same audit on every push and pull request, once daily, and on manual request.
6. Start the app from this directory: `uvicorn backend.main:app --reload`.
7. Open `http://127.0.0.1:8000`.

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

The repository-root `render.yaml` is the deployment definition. It installs the Python dependencies, runs the ordered database migration before every start, launches the web process on Render's assigned port, and uses `GET /api/health` as a database-aware health check.

When creating or syncing the Blueprint, provide these prompted values:

- `DATABASE_URL`: the pooled Neon PostgreSQL connection string used by the running app.
- `DATABASE_URL_UNPOOLED`: the direct Neon PostgreSQL connection string used only by schema migrations.
- `PUBLIC_ORIGIN`: the final HTTPS URL, such as `https://biotrack.example.org`.
- `ALLOWED_HOSTS`: the corresponding hostname without `https://`, such as `biotrack.example.org`.

Render generates `JWT_SECRET_KEY`; production HTTPS, secure cookies, proxy handling, health checks, and deploy-after-checks are already declared in the Blueprint. Keep all connection strings and generated secrets in the Render environment, never in the repository.

All `/api` endpoints except login require the HttpOnly session cookie issued by `/api/auth/login`. API clients may instead send the cookie's JWT as an `Authorization: Bearer <token>` header. Manager-only and biomedical-engineer endpoints are checked by the server; browser `localStorage` only controls dashboard presentation.

## Database changes and uploads

`database/schema.sql` describes a clean current installation. The deployment start command runs `python -m backend.migrations.run_all`, which initializes an empty database or upgrades an existing one. PostgreSQL upgrades are protected by an advisory lock, so overlapping Render starts cannot race each other. Every migration is repeatable and reports `already current` after it has been applied.

Equipment photos, asset manuals, and maintenance evidence are compressed and stored in PostgreSQL. This keeps them durable when the Render web service restarts or redeploys. Older disk-backed records remain readable through a compatibility fallback.

## Free Render hosting with Neon

Render's free web-service filesystem is ephemeral, and its free PostgreSQL
database expires after 30 days. The recommended no-cost setup is therefore a
free Neon PostgreSQL database while the application itself remains on Render:

1. Create a Neon project and copy both its pooled and direct PostgreSQL connection strings.
2. Supply them as `DATABASE_URL` and `DATABASE_URL_UNPOOLED` when Render prompts for the Blueprint environment values.
3. Deploy the service. BioTrack initializes or upgrades the schema before the web process starts.

Do not commit the connection string or paste it into source files. BioTrack
continues to use `database/biotrack.db` for local development whenever
`DATABASE_URL` is not set.

No Render disk is required for uploaded photos or documents. For a SQLite-only paid deployment, a Render persistent disk can still be mounted at `/var/data` with `BIOTRACK_DATA_DIR=/var/data`, but PostgreSQL is the supported production setup.
# Google Calendar links

The Preventive Maintenance schedule has an **Add to Google Calendar** link for each visit. It opens a prefilled all-day event in Google Calendar with the visit date, equipment, department, location, status, and remarks. The user reviews and saves the event in Google Calendar.

This link-based flow requires no Google Cloud project, OAuth client, API enablement, or additional Render environment variables. BioTrack continues to run on Render; Google Calendar handles the event after the user saves it. Changes made later in BioTrack do not automatically update an event already saved in Google Calendar, so use the link again or edit the event there.
