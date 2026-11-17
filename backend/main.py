"""BountyDesk demo API with server-verified role sessions; use HTTPS outside localhost."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
APP_SECRET = os.getenv("APP_SECRET", "").strip()
RESEARCHER_PASSWORD = os.getenv("RESEARCHER_PASSWORD", "").strip()
LEAD_PASSWORD = os.getenv("LEAD_PASSWORD", "").strip()

if len(APP_SECRET) < 32:
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise RuntimeError("Set APP_SECRET (32+ characters) in .env for production.")
    APP_SECRET = "bountydesk-dev-secret-key-shopnest-32chars-min"

if len(RESEARCHER_PASSWORD) < 16:
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise RuntimeError("Set RESEARCHER_PASSWORD (16+ characters) in .env for production.")
    RESEARCHER_PASSWORD = "researcher-demo-pass-1234"

if len(LEAD_PASSWORD) < 16:
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise RuntimeError("Set LEAD_PASSWORD (16+ characters) in .env for production.")
    LEAD_PASSWORD = "lead-demo-pass-1234"

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
if not COOKIE_SECURE and os.getenv("APP_ENV", "development").lower() == "production":
    raise RuntimeError("COOKIE_SECURE=true is required in production; serve BountyDesk over HTTPS.")
SESSION_COOKIE = "__Host-bounty_session" if COOKIE_SECURE else "bounty_session"
SESSION_SECONDS = 8 * 60 * 60
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
).split(",") if origin.strip()]
LOGIN_ATTEMPTS: dict[str, list[float]] = {}


def create_db_engine():
    db_url = DATABASE_URL or "sqlite:///./bountydesk.db"
    if db_url.startswith("sqlite"):
        return create_engine(db_url, pool_pre_ping=True, connect_args={"check_same_thread": False})
    try:
        eng = create_engine(db_url, pool_pre_ping=True)
        with eng.connect():
            pass
        return eng
    except Exception as exc:
        print(f"[BountyDesk] Could not connect to PostgreSQL at {db_url} ({exc}).")
        print("[BountyDesk] Falling back to local SQLite database: bountydesk.db")
        return create_engine("sqlite:///./bountydesk.db", pool_pre_ping=True, connect_args={"check_same_thread": False})


engine = create_db_engine()
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class ReportRow(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    researcher_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(160))
    asset: Mapped[str] = mapped_column(String(100), index=True)
    vuln_type: Mapped[str] = mapped_column(String(80))
    suggested_severity: Mapped[str] = mapped_column(String(12))
    final_severity: Mapped[str | None] = mapped_column(String(12), nullable=True)
    steps: Mapped[str] = mapped_column(String(6000))
    impact: Mapped[str] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(24), default="New", index=True)
    duplicate_of: Mapped[str | None] = mapped_column(ForeignKey("reports.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    timeline: Mapped[list] = mapped_column(JSON, default=list)


class PayoutRow(Base):
    __tablename__ = "payouts"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), unique=True, index=True)
    researcher_id: Mapped[str] = mapped_column(String(32), index=True)
    severity: Mapped[str] = mapped_column(String(12))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="To approve", index=True)
    reason: Mapped[str] = mapped_column(String(500), default="")
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ReportCreate(BaseModel):
    title: str = Field(min_length=5, max_length=160)
    asset: str = Field(min_length=1, max_length=100)
    vulnType: str = Field(min_length=2, max_length=80)
    suggestedSeverity: str = Field(pattern="^(Low|Medium|High|Critical)$")
    steps: str = Field(min_length=30, max_length=6000)
    impact: str = Field(min_length=10, max_length=2000)


class StatusChange(BaseModel):
    to: str = Field(pattern="^(Triaged|Accepted|Duplicate|Not applicable|Out of scope|Fixed)$")
    comment: str = Field(min_length=1, max_length=1000)
    severity: str | None = None
    duplicateOf: str | None = None


class PayoutChange(BaseModel):
    toStatus: str = Field(pattern="^(Approved|Paid)$")
    amount: int | None = Field(default=None, ge=1, le=250000)
    reason: str = Field(default="", max_length=500)
    reference: str | None = Field(default=None, max_length=100)


class LoginPayload(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=1, max_length=256)


def _sign_session(role: str) -> str:
    payload = json.dumps({"role": role, "exp": int(time.time()) + SESSION_SECONDS}, separators=(",", ":")).encode()
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=")
    signature = hmac.new(APP_SECRET.encode(), encoded, hashlib.sha256).digest()
    return encoded.decode() + "." + base64.urlsafe_b64encode(signature).rstrip(b"=").decode()


def _read_session(token: str | None) -> str | None:
    if not token or "." not in token:
        return None
    encoded, supplied = token.split(".", 1)
    expected = base64.urlsafe_b64encode(hmac.new(APP_SECRET.encode(), encoded.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    if not hmac.compare_digest(supplied, expected):
        return None
    try:
        padding = "=" * (-len(encoded) % 4)
        data = json.loads(base64.urlsafe_b64decode(encoded + padding))
        if data.get("exp", 0) < time.time() or data.get("role") not in {"researcher", "lead"}:
            return None
        return data["role"]
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def db_session():
    with SessionLocal() as session:
        yield session


def current_role(bounty_session: str | None = Cookie(default=None, alias=SESSION_COOKIE)):
    role = _read_session(bounty_session)
    if role is None:
        raise HTTPException(401, "Sign in to continue.")
    return role


def require_role(expected: str):
    def check(role: str = Depends(current_role)):
        if role != expected:
            raise HTTPException(403, "Your account does not have permission for this action.")
    return check


def require_same_origin(request: Request):
    origin = request.headers.get("origin")
    if not origin:
        referer = request.headers.get("referer")
        if referer:
            from urllib.parse import urlparse
            ref_origin = f"{urlparse(referer).scheme}://{urlparse(referer).netloc}"
            if ref_origin in ALLOWED_ORIGINS:
                return
        if os.getenv("APP_ENV", "development").lower() != "production":
            return
        raise HTTPException(403, "Request origin is not allowed.")
    if origin not in ALLOWED_ORIGINS:
        from urllib.parse import urlparse
        hostname = urlparse(origin).hostname
        if os.getenv("APP_ENV", "development").lower() != "production" and hostname in ("localhost", "127.0.0.1"):
            return
        raise HTTPException(403, "Request origin is not allowed.")


REWARDS = {"Low": (2000, 5000, 8000), "Medium": (8000, 15000, 25000), "High": (30000, 50000, 75000), "Critical": (100000, 150000, 250000)}
ASSETS = {"shop.shopnest.test", "api.shopnest.test", "mobile web"}
TRANSITIONS = {"New": {"Triaged", "Accepted", "Duplicate", "Not applicable", "Out of scope"}, "Triaged": {"Accepted", "Duplicate", "Not applicable"}, "Accepted": {"Fixed"}, "Fixed": set(), "Duplicate": set(), "Not applicable": set(), "Out of scope": set()}


def report_dict(row: ReportRow):
    created_at = row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at)
    return {"id": row.id, "researcherId": row.researcher_id, "title": row.title, "asset": row.asset,
            "vulnType": row.vuln_type, "suggestedSeverity": row.suggested_severity, "finalSeverity": row.final_severity,
            "steps": row.steps, "impact": row.impact, "status": row.status, "duplicateOf": row.duplicate_of,
            "createdAt": created_at, "timeline": row.timeline or []}


def payout_dict(row: PayoutRow):
    created_at = row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at)
    return {"id": row.id, "reportId": row.report_id, "researcherId": row.researcher_id, "severity": row.severity,
            "amount": row.amount, "status": row.status, "reason": row.reason, "reference": row.reference,
            "createdAt": created_at}


def seed_demo(session: Session):
    if session.scalar(select(ReportRow.id).limit(1)):
        return
    now = datetime.now(timezone.utc)
    examples = [
        ("BD-0031", "r_arjun", "Order details exposed by changing order ID", "api.shopnest.test", "Broken access control (IDOR)", "High", "Fixed", "Confirmed, fix in progress", "Fix deployed"),
        ("BD-0024", "r_meera", "Reflected XSS in the storefront search", "shop.shopnest.test", "Cross-Site Scripting (XSS)", "Medium", "Accepted", "Reproduced safely in the demo", ""),
        ("BD-0025", "r_kabir", "Search result reflects untrusted text", "shop.shopnest.test", "Cross-Site Scripting (XSS)", "High", "New", "", ""),
        ("BD-0026", "r_zoya", "Checkout total can be changed", "shop.shopnest.test", "Business Logic Flaw", "Critical", "New", "", ""),
        ("BD-0027", "r_arjun", "Private profile fields visible across accounts", "api.shopnest.test", "Broken access control (IDOR)", "High", "Triaged", "Initial review started", ""),
        ("BD-0028", "r_meera", "Session token remains valid after logout", "mobile web", "Authentication Bypass", "Medium", "Accepted", "Confirmed on the test storefront", ""),
        ("BD-0029", "r_kabir", "Outdated response reveals server details", "api.shopnest.test", "Information Disclosure", "Low", "Fixed", "Patch approved", "Fix verified"),
    ]
    for rid, researcher, title, asset, kind, sev, status, accepted, fixed in examples:
        severity = sev if status in {"Accepted", "Fixed"} else None
        timeline = [{"at": now.isoformat(), "by": "researcher", "from": None, "to": "New", "comment": "Report submitted."}]
        if status in {"Triaged", "Accepted", "Fixed"}:
            timeline.append({"at": now.isoformat(), "by": "lead", "from": "New", "to": "Triaged" if status == "Triaged" else "Accepted", "comment": accepted or "Reviewed."})
        if status == "Fixed":
            timeline.append({"at": now.isoformat(), "by": "lead", "from": "Accepted", "to": "Fixed", "comment": fixed})
        session.add(ReportRow(id=rid, researcher_id=researcher, title=title, asset=asset, vuln_type=kind,
            suggested_severity=sev, final_severity=severity, steps="Reproduce using the fictional ShopNest test account and document the affected screen and response.",
            impact="A user could access or change information outside their own account.", status=status, created_at=now, timeline=timeline))
    session.flush()
    session.add_all([
        PayoutRow(id="PAY-0031", report_id="BD-0031", researcher_id="r_arjun", severity="High", amount=50000, status="Approved", reason="Default High reward", created_at=now),
        PayoutRow(id="PAY-0029", report_id="BD-0029", researcher_id="r_kabir", severity="Low", amount=5000, status="To approve", reason="Default Low reward", created_at=now),
    ])
    session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_demo(session)
    yield


app = FastAPI(title="BountyDesk API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.post("/api/auth/login", dependencies=[Depends(require_same_origin)])
def login(payload: LoginPayload, request: Request, response: Response):
    address = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = [stamp for stamp in LOGIN_ATTEMPTS.get(address, []) if now - stamp < 300]
    if len(attempts) >= 5:
        raise HTTPException(429, "Too many sign-in attempts. Wait five minutes and try again.")
    expected = {"researcher": RESEARCHER_PASSWORD, "lead": LEAD_PASSWORD}.get(payload.username)
    if expected is None or not hmac.compare_digest(payload.password, expected):
        LOGIN_ATTEMPTS[address] = [*attempts, now]
        raise HTTPException(401, "Username or password is incorrect.")
    LOGIN_ATTEMPTS.pop(address, None)
    response.set_cookie(SESSION_COOKIE, _sign_session(payload.username), max_age=SESSION_SECONDS,
        httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/")
    return {"role": payload.username}


@app.get("/api/auth/me")
def who_am_i(role: str = Depends(current_role)):
    return {"role": role}


@app.post("/api/auth/logout", dependencies=[Depends(require_same_origin)])
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=COOKIE_SECURE, samesite="lax")
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"status": "ok", "database": "connected"}


@app.get("/api/reports")
def list_reports(role: str = Depends(current_role), session: Session = Depends(db_session)):
    query = select(ReportRow).order_by(ReportRow.created_at.desc())
    if role == "researcher":
        query = query.where(ReportRow.researcher_id == "r_arjun")
    elif role != "lead":
        raise HTTPException(403, "Unknown demo role.")
    return [report_dict(row) for row in session.scalars(query).all()]


@app.post("/api/reports", status_code=201, dependencies=[Depends(require_role("researcher")), Depends(require_same_origin)])
def create_report(payload: ReportCreate, session: Session = Depends(db_session)):
    if payload.asset not in ASSETS:
        raise HTTPException(422, "Choose an in-scope ShopNest asset.")
    if payload.suggestedSeverity not in REWARDS:
        raise HTTPException(422, "Choose a valid severity.")
    last = session.scalar(select(ReportRow.id).order_by(ReportRow.id.desc()).limit(1)) or "BD-0030"
    number = int(last.split("-")[1]) + 1
    rid, now = f"BD-{number:04d}", datetime.now(timezone.utc)
    row = ReportRow(id=rid, researcher_id="r_arjun", title=payload.title.strip(), asset=payload.asset,
        vuln_type=payload.vulnType, suggested_severity=payload.suggestedSeverity, steps=payload.steps.strip(),
        impact=payload.impact.strip(), status="New", created_at=now,
        timeline=[{"at": now.isoformat(), "by": "researcher", "from": None, "to": "New", "comment": "Report submitted."}])
    session.add(row); session.commit(); session.refresh(row)
    return report_dict(row)


@app.patch("/api/reports/{report_id}/status", dependencies=[Depends(require_role("lead")), Depends(require_same_origin)])
def change_status(report_id: str, payload: StatusChange, session: Session = Depends(db_session)):
    row = session.get(ReportRow, report_id)
    if not row:
        raise HTTPException(404, "Report not found.")
    if payload.to not in TRANSITIONS.get(row.status, set()):
        raise HTTPException(422, f"Cannot move a report from {row.status} to {payload.to}.")
    if not payload.comment.strip():
        raise HTTPException(422, "Add a review comment to the audit timeline.")
    if payload.to in {"Accepted", "Fixed"}:
        severity = payload.severity or row.final_severity or row.suggested_severity
        if severity not in REWARDS:
            raise HTTPException(422, "Choose a final severity.")
        row.final_severity = severity
    if payload.to == "Duplicate":
        target = session.get(ReportRow, payload.duplicateOf or "")
        if not target or target.id == row.id:
            raise HTTPException(422, "Choose an existing report to link as the duplicate.")
        row.duplicate_of = target.id
    before, now = row.status, datetime.now(timezone.utc)
    row.status = payload.to
    row.timeline = [*(row.timeline or []), {"at": now.isoformat(), "by": "lead", "from": before, "to": payload.to, "comment": payload.comment.strip()}]
    if payload.to == "Fixed" and not session.scalar(select(PayoutRow).where(PayoutRow.report_id == row.id)):
        sev = row.final_severity or row.suggested_severity
        session.add(PayoutRow(id=f"PAY-{row.id.removeprefix('BD-')}", report_id=row.id, researcher_id=row.researcher_id,
            severity=sev, amount=REWARDS[sev][1], status="To approve", reason=f"Default {sev} reward", created_at=now))
    session.commit(); session.refresh(row)
    return report_dict(row)


@app.get("/api/payouts")
def list_payouts(role: str = Depends(current_role), session: Session = Depends(db_session)):
    query = select(PayoutRow).order_by(PayoutRow.created_at.desc())
    if role == "researcher":
        query = query.where(PayoutRow.researcher_id == "r_arjun")
    elif role != "lead":
        raise HTTPException(403, "Unknown demo role.")
    return [payout_dict(row) for row in session.scalars(query).all()]


@app.patch("/api/payouts/{payout_id}", dependencies=[Depends(require_role("lead")), Depends(require_same_origin)])
def update_payout(payout_id: str, payload: PayoutChange, session: Session = Depends(db_session)):
    payout = session.get(PayoutRow, payout_id)
    if not payout:
        raise HTTPException(404, "Payout not found.")
    transitions = {"To approve": "Approved", "Approved": "Paid"}
    if transitions.get(payout.status) != payload.toStatus:
        raise HTTPException(422, f"Cannot move payout from {payout.status} to {payload.toStatus}.")
    low, default, high = REWARDS[payout.severity]
    amount = payout.amount if payload.amount is None else payload.amount
    if amount < low or amount > high:
        raise HTTPException(422, f"{payout.severity} pays {low:,}–{high:,}. Enter an amount in this range.")
    if amount != default and len(payload.reason.strip()) < 8:
        raise HTTPException(422, "A custom reward needs a written reason of at least 8 characters.")
    if payload.toStatus == "Paid" and not (payload.reference or "").strip():
        raise HTTPException(422, "Enter the bank UTR or payment reference before marking paid.")
    payout.amount, payout.reason = amount, payload.reason.strip() or payout.reason
    payout.status = payload.toStatus
    if payload.toStatus == "Paid":
        payout.reference = payload.reference.strip()
        report = session.get(ReportRow, payout.report_id)
        if report:
            now = datetime.now(timezone.utc)
            report.timeline = [*(report.timeline or []), {"at": now.isoformat(), "by": "finance", "from": "Fixed", "to": "Paid", "comment": f"Payment reference recorded: {payout.reference}"}]
    session.commit(); session.refresh(payout)
    return payout_dict(payout)
