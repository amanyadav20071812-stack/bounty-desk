# BountyDesk

A small ShopNest vulnerability disclosure and payout demo. The interface follows the dark security dashboard references, while report review and payout workflows stay aligned with the BountyDesk PRD.

## Stack

- React, TypeScript, Vite, Tailwind CSS, and Recharts
- Python, FastAPI, Pydantic, SQLAlchemy, and PostgreSQL
- Power BI can connect directly to PostgreSQL for reporting

The first working slice includes report submission, a triage queue, status history, reward approval, paid references, filters, and CSV export. It uses fictional reports and records simulated payments only.

## Quick Start (Zero Config)

Double-click `run.bat` or run:

```bat
.\run.bat
```

This automatically:
1. Sets up the Python virtual environment and installs dependencies.
2. Installs frontend packages if needed.
3. Launches the FastAPI backend (`http://127.0.0.1:8000`) with a local SQLite database (`bountydesk.db`).
4. Launches the Vite frontend (`http://127.0.0.1:5173`) and opens your browser.

### Demo Credentials

- **Researcher**: Account: `researcher` / Password: `researcher-demo-pass-1234`
- **Security Lead**: Account: `lead` / Password: `lead-demo-pass-1234`

(Quick-fill buttons are also available directly on the sign-in screen).

## Manual Setup

1. Install Node.js (v18+) and Python (3.11+).
2. Install frontend dependencies and start Vite:

   ```cmd
   npm install
   npm run dev
   ```

3. In a second terminal, set up and start the API:

   ```cmd
   py -m venv .venv
   .\.venv\Scripts\activate
   pip install -r backend\requirements.txt
   uvicorn backend.main:app --reload
   ```

4. Open `http://localhost:5173`. FastAPI interactive docs are at `http://localhost:8000/docs`.

### Using PostgreSQL (Optional)

SQLite is used by default for zero-friction setup. If you want to connect PostgreSQL (e.g. for Power BI reporting):
1. Create a local user and database:
   ```sql
   CREATE USER bountydesk WITH PASSWORD 'choose-a-local-password';
   CREATE DATABASE bountydesk OWNER bountydesk;
   ```
2. In `.env`, update `DATABASE_URL`:
   ```env
   DATABASE_URL=postgresql+psycopg://bountydesk:choose-a-local-password@localhost:5432/bountydesk
   ```

## Learn the project

There are seven main files to understand:

1. `src/App.tsx` — screens, forms, charts, and user actions.
2. `src/domain.ts` — shared data types, reward tiers, formatting, and workflow helpers.
3. `src/styles.css` — Tailwind import plus the small set of dashboard styles.
4. `src/main.tsx` — React entry point.
5. `src/Charts.tsx` — Recharts visuals, loaded as a separate bundle.
6. `backend/main.py` — API routes, validation, database models, seed data, and workflow.
7. `backend/requirements.txt` — Python packages.

`index.html`, `package.json`, `tsconfig.json`, and `vite.config.ts` are normal tool setup files.

## Sign-in and security boundary

The API checks separate researcher and lead passwords from `.env`, issues an expiring HttpOnly session cookie, rate-limits repeated failed sign-ins, and checks the signed-in role on each request. Write requests must come from an allowed frontend origin. The launcher and API bind to localhost by default. For an HTTPS deployment, set `APP_ENV=production`, `COOKIE_SECURE=true`, and `FRONTEND_ORIGINS` to the exact HTTPS site origin. Never expose this app over plain HTTP on Wi-Fi or the public internet.

There are no file uploads, exploit execution, or real transfers. Report text is rendered as React text. The API validates scope, report fields, state transitions, reward limits, custom amount reasons, duplicate targets, and payment references.

## Production work still needed

- Replace the demo's two environment-password accounts with managed users, password reset, and organization-level authorization.
- Add session revocation, HTTPS hosting, managed secrets, and production database/network restrictions.
- Add Alembic migrations before changing the PostgreSQL schema beyond the starter `create_all` setup.
- Add persistent rate limits, backups, logging, security review, and automated coverage before handling sensitive reports.
- Add Power BI measures using separate totals for approved and actually paid rewards.
- Add pytest, Vitest, and Playwright coverw.

No database password, token, or other secret belongs in source control.

To connect Power BI Desktop, choose **Get Data → PostgreSQL database**, enter `localhost:5432` and database `bountydesk`, then use the local database credentials. Build separate measures for approved and paid payouts so approved amounts are not counted as money already sent.
