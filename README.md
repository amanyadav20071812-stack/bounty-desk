# 🛡️ BountyDesk
### Vulnerability Disclosure & Reward Management Platform

**BountyDesk** is a vulnerability disclosure and bounty management platform designed to streamline the process of receiving, reviewing, validating, and rewarding security vulnerability reports.

Built around a modern security dashboard, BountyDesk provides a centralized workspace for security researchers and security teams to collaborate, manage vulnerability reports, track their progress, and oversee reward approvals.

The project currently implements a functional demonstration using fictional vulnerability reports and simulated payments.

---

## 🚀 Key Features

### 1. Vulnerability Report Submission
- Submit vulnerability reports through a structured interface.
- Provide report details, affected targets, severity, and supporting information.
- Validate report information before submission.

### 2. Security Triage Dashboard
- Centralized vulnerability report management.
- Review and classify incoming submissions.
- Filter reports based on status and other available attributes.
- Track report progress throughout the review lifecycle.

### 3. Report Lifecycle Management
- Manage vulnerability report statuses.
- Maintain status history for transparency.
- Track report progression from submission to resolution.

### 4. Reward & Payout Management
- Approve rewards for validated vulnerabilities.
- Support predefined reward tiers and justified custom amounts.
- Maintain payment references.
- Distinguish between approved rewards and simulated completed payments.

### 5. Analytics & Reporting
- Dashboard charts powered by Recharts.
- Report filtering and CSV export.
- PostgreSQL compatibility for external analytics.
- Power BI integration for additional reporting and visualization.

---

## 👥 User Roles

BountyDesk provides two distinct user experiences:

| Role | Responsibilities |
|---|---|
| **Security Researcher** | Submit vulnerability reports and track their progress. |
| **Security Lead** | Review submissions, manage triage, approve rewards, and track payouts. |

---

## 🧰 Technology Stack

### Frontend
- **React** – Component-based user interface.
- **TypeScript** – Type safety and maintainable code.
- **Vite** – Frontend development and build tooling.
- **Tailwind CSS** – Responsive dashboard styling.
- **Recharts** – Data visualization and analytics.

### Backend
- **Python** – Backend application logic.
- **FastAPI** – REST API development.
- **Pydantic** – Request validation and data schemas.
- **SQLAlchemy** – Database operations and ORM.

### Database & Analytics
- **SQLite** – Default local development database.
- **PostgreSQL** – Optional database configuration.
- **Power BI** – External business intelligence and reporting.

---

## 🏗️ Project Structure

```text
BountyDesk/
│
├── backend/
│   ├── main.py
│   └── requirements.txt
│
├── src/
│   ├── App.tsx
│   ├── domain.ts
│   ├── styles.css
│   ├── main.tsx
│   └── Charts.tsx
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── run.bat
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites

Install the following before running the application:

- Node.js (v18 or later)
- Python (3.11 or later)
- Git

### Option 1: Quick Start (Windows)

The project includes an automated launcher.

Simply double-click `run.bat` or execute:

```bash
.\run.bat
```

The launcher automatically:

1. Creates and configures the Python virtual environment.
2. Installs the required backend dependencies.
3. Installs frontend dependencies when necessary.
4. Starts the FastAPI backend.
5. Starts the Vite frontend.
6. Opens the application in your browser.

### Option 2: Manual Setup (macOS / Linux)

**Step 1: Clone the repository**

```bash
git clone https://github.com/amanyadav20071812-stack/bounty-desk.git

cd bounty-desk
```

**Step 2: Install frontend dependencies**

```bash
npm install
```

**Step 3: Start the frontend**

```bash
npm run dev
```

**Step 4: Configure the backend**

Open a second terminal inside the project directory.

Create a Python virtual environment:

```bash
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

**Step 5: Start the backend**

```bash
uvicorn backend.main:app --reload
```

---

## 🌐 Application Access

Once both services are running, access the application using the following URLs:

| Service | URL |
|---|---|
| BountyDesk Frontend | http://localhost:5173 |
| FastAPI Backend | http://127.0.0.1:8000 |
| API Documentation | http://127.0.0.1:8000/docs |

---

## 🔐 Demo Credentials

Use the following credentials to explore the application's two user roles.

| Role | Username | Password |
|---|---|---|
| Researcher | `researcher` | `researcher-demo-pass-1234` |
| Security Lead | `lead` | `lead-demo-pass-1234` |

Quick-fill options are also available on the sign-in screen.

*These are demonstration credentials, not production accounts.*

---

## 🔒 Security Architecture

Security is an important consideration in BountyDesk.

The current implementation includes:

- Role-based authorization for researchers and security leads.
- Environment-based account credentials.
- Expiring HttpOnly session cookies.
- Rate limiting for repeated failed sign-in attempts.
- Frontend-origin validation for write requests.
- Server-side validation of report submissions and workflow transitions.
- Reward limits and custom reward justification.
- Duplicate target validation.

The application binds to localhost by default.

**Security limitations:** This is a demonstration application, not a production-ready vulnerability disclosure service. It does not execute exploits, accept file uploads, or perform real financial transactions.

Never expose the development application over plain HTTP on a public network.

---

## 📊 Database & Power BI Integration

BountyDesk uses SQLite by default, allowing developers to run the application without configuring an external database.

PostgreSQL can optionally be configured for more advanced reporting and database integration.

### PostgreSQL Configuration

Create a local database and user:

```sql
CREATE USER bountydesk WITH PASSWORD 'your-local-password';

CREATE DATABASE bountydesk OWNER bountydesk;
```

Configure the database connection in `.env`:

```env
DATABASE_URL=postgresql+psycopg://bountydesk:your-local-password@localhost:5432/bountydesk
```

### Power BI Integration

Power BI Desktop can connect to the PostgreSQL database through:

**Get Data → PostgreSQL Database**

Connection details:

- Server: `localhost:5432`
- Database: `bountydesk`

Separate reporting measures should be maintained for approved rewards and actually paid rewards to avoid treating approvals as completed payments.

---

## 📁 Important Files to Understand

| File | Purpose |
|---|---|
| `src/App.tsx` | Main dashboard, screens, forms, and user interactions. |
| `src/domain.ts` | Shared types, reward tiers, and workflow helpers. |
| `src/styles.css` | Global styling and Tailwind integration. |
| `src/main.tsx` | React application entry point. |
| `src/Charts.tsx` | Dashboard charts and visualizations. |
| `backend/main.py` | API endpoints, validation, database models, and workflow logic. |
| `backend/requirements.txt` | Python backend dependencies. |

---

## 🛠️ Future Improvements

Potential improvements for future development include:

- Managed user accounts and password recovery.
- Organization-level authorization and permissions.
- Advanced vulnerability classification and severity scoring.
- Session revocation and persistent rate limiting.
- Production-grade database migrations using Alembic.
- Automated testing using Pytest, Vitest, and Playwright.
- Improved analytics and Power BI dashboards.
- Production deployment with HTTPS, managed secrets, backups, and monitoring.
- Comprehensive security audits and logging.

---

## ⚠️ Project Limitations

BountyDesk is currently a functional prototype intended for demonstration and development purposes.

- Uses fictional vulnerability reports and sample records.
- Payments are simulated; no real money is transferred.
- SQLite is the default database.
- Production-grade identity management and deployment infrastructure are not yet implemented.

Do not use the current version to process real vulnerability disclosures or sensitive security reports.

---

## 🎯 Project Objective

The objective of BountyDesk is to demonstrate how modern web technologies can be combined to build a centralized vulnerability disclosure and reward management workflow.

By connecting researchers, security teams, reporting tools, and reward management in one interface, the project explores a more organized and transparent approach to vulnerability management.

---

**Built with React, TypeScript, Python, FastAPI, and SQLAlchemy.**

*BountyDesk — Discover. Report. Secure. Reward.*