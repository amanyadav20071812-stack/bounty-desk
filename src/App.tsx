import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ageDays, allowedNext, ApiError, duplicateFor, formatINR, PREVIEW_PAYOUTS, PREVIEW_REPORTS, PROGRAM, request, workingDaysSince, type Payout, type Report, type Role, type Severity } from "./domain";
const MiniChart = lazy(() => import("./Charts").then((module) => ({ default: module.MiniChart })));
const SeverityChart = lazy(() => import("./Charts").then((module) => ({ default: module.SeverityChart })));

type Page = "Overview" | "Reports" | "Submit report" | "Triage queue" | "Payout desk" | "Program scope";
const pages: Page[] = ["Overview", "Reports", "Submit report", "Triage queue", "Payout desk", "Program scope"];
const kinds = ["Broken access control (IDOR)", "Cross-Site Scripting (XSS)", "SQL Injection (SQLi)", "Authentication Bypass", "Server-Side Request Forgery (SSRF)", "Business Logic Flaw"];

function Icon({ children }: { children: string }) { return <span className="nav-icon" aria-hidden="true">{children}</span>; }
function Severity({ value }: { value: string }) { return <span className={`badge sev-${value.toLowerCase()}`}>{value}</span>; }
function Status({ value }: { value: string }) {
  const dot = value === "To approve" ? "new" : value === "Approved" ? "accepted" : value.toLowerCase().replaceAll(" ", "-");
  return <span className="status"><i className={`status-dot dot-${dot}`} />{value}</span>;
}
function Metric({ title, value, sub, color, chart }: { title: string; value: string; sub: string; color?: string; chart?: ReactNode }) {
  return <article className="metric"><div className="metric-label">{title}</div><div className={`metric-value ${color || ""}`}>{value}</div><div className="metric-sub">{sub}</div>{chart && <div className="trend">{chart}</div>}</article>;
}

export default function App() {
  const [role, setRole] = useState<Role>("researcher");
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [loginName, setLoginName] = useState<Role>("researcher");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [page, setPage] = useState<Page>("Overview");
  const [reports, setReports] = useState<Report[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All severities");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [assetFilter, setAssetFilter] = useState("All assets");
  const [payoutTab, setPayoutTab] = useState("All payouts");
  const [selected, setSelected] = useState<Report | null>(null);
  const [form, setForm] = useState({ title: "", asset: PROGRAM.assets[0], vulnType: kinds[0], severity: "High" as Severity, steps: "", impact: "", agreed: false });
  const [review, setReview] = useState({ comment: "", severity: "High" as Severity, duplicateOf: "" });
  const [payoutEdit, setPayoutEdit] = useState<{ payout: Payout; amount: number; reason: string; reference: string } | null>(null);

  useEffect(() => {
    request<{ role: Role }>("/auth/me").then((identity) => { setRole(identity.role); setAuthenticated(true); })
      .catch(() => {}).finally(() => setAuthReady(true));
  }, []);

  const reload = useCallback(async (activeRole: Role) => {
    setLoading(true); setError("");
    try {
      const [nextReports, nextPayouts] = await Promise.all([
        request<Report[]>("/reports"), request<Payout[]>("/payouts"),
      ]);
      setReports(nextReports); setPayouts(nextPayouts); setApiOffline(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setAuthenticated(false); setPage("Overview"); return; }
      setReports(activeRole === "researcher" ? PREVIEW_REPORTS.filter((r) => r.researcherId === "r_arjun") : PREVIEW_REPORTS);
      setPayouts(activeRole === "researcher" ? PREVIEW_PAYOUTS.filter((p) => p.researcherId === "r_arjun") : PREVIEW_PAYOUTS);
      setApiOffline(true); setError("");
    }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (authenticated) void reload(role);
    else if (previewMode) {
      setReports(role === "researcher" ? PREVIEW_REPORTS.filter((r) => r.researcherId === "r_arjun") : PREVIEW_REPORTS);
      setPayouts(role === "researcher" ? PREVIEW_PAYOUTS.filter((p) => p.researcherId === "r_arjun") : PREVIEW_PAYOUTS);
      setApiOffline(true); setLoading(false);
    }
  }, [role, authenticated, previewMode, reload]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const visibleReports = useMemo(() => reports.filter((r) => {
    const text = `${r.id} ${r.title} ${r.asset} ${r.vulnType}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (severityFilter === "All severities" || (r.finalSeverity || r.suggestedSeverity) === severityFilter)
      && (statusFilter === "All statuses" || r.status === statusFilter || (statusFilter === "Paid" && payouts.some((p) => p.reportId === r.id && p.status === "Paid")))
      && (assetFilter === "All assets" || r.asset === assetFilter);
  }), [reports, payouts, query, severityFilter, statusFilter, assetFilter]);
  const paid = payouts.filter((p) => p.status === "Paid").reduce((sum, p) => sum + p.amount, 0);
  const pending = payouts.filter((p) => p.status !== "Paid").reduce((sum, p) => sum + p.amount, 0);
  const active = reports.filter((r) => ["New", "Triaged", "Accepted"].includes(r.status)).length;
  const newCount = reports.filter((r) => r.status === "New").length;
  const overdue = reports.filter((r) => r.status === "New" && workingDaysSince(r.createdAt) >= 5).length;
  const duplicateCount = reports.filter((r) => duplicateFor(r, reports)).length;
  const severityData = (["Critical", "High", "Medium", "Low"] as Severity[]).map((severity) => ({
    severity, reports: reports.filter((r) => (r.finalSeverity || r.suggestedSeverity) === severity).length,
  }));

  const apiWrite = async <T,>(path: string, method: string, body: unknown) => request<T>(path, { method, body: JSON.stringify(body) });
  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setAuthError("");
    try {
      const identity = await request<{ role: Role }>("/auth/login", { method: "POST", body: JSON.stringify({ username: loginName, password }) });
      setRole(identity.role); setAuthenticated(true); setPreviewMode(false); setPassword("");
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Sign-in failed."); }
  };
  const signOut = async () => {
    try { await request("/auth/logout", { method: "POST" }); } catch { /* Clear local state even if the API is offline. */ }
    setAuthenticated(false); setPreviewMode(false); setPage("Overview"); setReports([]); setPayouts([]);
  };
  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.agreed) { setError("Confirm the program rules before submitting."); return; }
    try {
      const report = await apiWrite<Report>("/reports", "POST", {
        researcherId: "r_arjun", title: form.title, asset: form.asset, vulnType: form.vulnType,
        suggestedSeverity: form.severity, steps: form.steps, impact: form.impact,
      });
      setReports((current) => [report, ...current]); setForm({ ...form, title: "", steps: "", impact: "", agreed: false });
      setPage("Reports"); setToast(`${report.id} submitted. We aim to triage within 5 working days.`); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Report could not be submitted."); }
  };
  const changeStatus = async (to: string) => {
    if (!selected) return;
    try {
      const updated = await apiWrite<Report>(`/reports/${selected.id}/status`, "PATCH", {
        to, comment: review.comment, severity: review.severity, duplicateOf: review.duplicateOf || null,
      });
      setReports((current) => current.map((r) => r.id === updated.id ? updated : r)); setSelected(updated);
      const nextPayouts = await request<Payout[]>("/payouts"); setPayouts(nextPayouts);
      setReview({ ...review, comment: "" }); setToast(`${updated.id} marked ${to}.`); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Status change failed."); }
  };
  const updatePayout = async () => {
    if (!payoutEdit) return;
    try {
      const updated = await apiWrite<Payout>(`/payouts/${payoutEdit.payout.id}`, "PATCH", {
        toStatus: payoutEdit.payout.status === "To approve" ? "Approved" : "Paid",
        amount: Number(payoutEdit.amount), reason: payoutEdit.reason, reference: payoutEdit.reference || null,
      });
      setPayouts((current) => current.map((p) => p.id === updated.id ? updated : p));
      setToast(updated.status === "Paid" ? `Payout marked paid · ${updated.reference}` : "Payout approved."); setPayoutEdit(null); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Payout update failed."); }
  };

  const exportCsv = () => {
    const header = ["Payout", "Report", "Researcher", "Severity", "Amount INR", "Status", "Reference"];
    const rows = payouts.map((p) => [p.id, p.reportId, p.researcherId, p.severity, p.amount, p.status, p.reference || ""]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `shopnest-payouts-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const nav = (next: Page) => { setPage(next); setError(""); };
  const openReview = (report: Report) => { setSelected(report); setReview({ comment: "", severity: report.finalSeverity || report.suggestedSeverity, duplicateOf: report.duplicateOf || "" }); };
  const filteredPayouts = payouts.filter((p) => (payoutTab === "All payouts" || p.status === payoutTab)
    && (!query || `${p.id} ${p.reportId} ${p.status} ${p.reference || ""}`.toLowerCase().includes(query.toLowerCase())));

  if (!authReady) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#111115", color: "#f4f4f5" }}>Loading BountyDesk…</main>;
  if (!authenticated && !previewMode) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#111115", color: "#f4f4f5" }}><form onSubmit={signIn} className="section-card" style={{ width: "min(420px, 100%)" }}>
    <div className="brand" style={{ marginBottom: 22 }}>⌁ BountyDesk</div><h1 style={{ fontSize: 20 }}>Sign in</h1><p className="muted">Use your researcher or security lead credentials.</p>
    <div className="field"><label htmlFor="login-name">Account</label><select id="login-name" value={loginName} onChange={(e) => setLoginName(e.target.value as Role)}><option value="researcher">Researcher</option><option value="lead">Security lead</option></select></div>
    <div className="field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
    {authError && <div className="notice error" role="alert">{authError}</div>}
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
      <button className="button primary" type="submit">Sign in</button>
      <button className="button" type="button" onClick={() => { setPreviewMode(true); setAuthError(""); }}>Open sample preview</button>
    </div>
    <div style={{ paddingTop: 14, borderTop: "1px solid #2e2e38", fontSize: 11 }}>
      <div className="muted" style={{ marginBottom: 8 }}>Quick-fill demo accounts:</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="button" type="button" onClick={() => { setLoginName("researcher"); setPassword("researcher-demo-pass-1234"); }}>Researcher demo</button>
        <button className="button" type="button" onClick={() => { setLoginName("lead"); setPassword("lead-demo-pass-1234"); }}>Security lead demo</button>
      </div>
    </div>
  </form></main>;

  return <div className="shell min-h-screen bg-zinc-950 text-zinc-100">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">⌁</span> BountyDesk</div>
      <div><div className="side-label">Management</div><div className="nav">
        {pages.map((item, i) => <button key={item} className={page === item ? "active" : ""} onClick={() => nav(item)}><Icon>{["◫", "⚠", "+", "◎", "▤", "◇"][i]}</Icon>{item}</button>)}
      </div></div>
      <div className="side-bottom"><div className="side-label">Workspace</div><button className="button" onClick={() => nav("Program scope")}>⚙ &nbsp; Program settings</button></div>
    </aside>
    <main className="main min-w-0">
      <header className="topbar">
        <div className="org">Organization <select aria-label="Organization"><option>ShopNest Production</option></select></div>
        <div className="top-actions"><span className="desktop-action">◉ &nbsp; ? &nbsp; ☾</span>{previewMode ? <select className="role-select" aria-label="Sample preview role" value={role} onChange={(e) => { setRole(e.target.value as Role); setSelected(null); setPayoutEdit(null); }}><option value="researcher">Researcher sample</option><option value="lead">Security lead sample</option></select> : <span>{role === "lead" ? "Security Lead" : "Researcher"}</span>}<span className="avatar">{role === "lead" ? "NS" : "AR"}</span><button className="button" onClick={previewMode ? () => { setPreviewMode(false); setAuthReady(true); } : () => void signOut()}>{previewMode ? "Exit preview" : "Sign out"}</button></div>
      </header>
      <div className="content mx-auto max-w-screen-2xl">
        <div className="crumb"><b>Security</b> / {page}</div>
        <div className="page-title"><div><h1>{page === "Overview" ? "Security overview" : page}</h1><p>ShopNest vulnerability disclosure and bounty program</p></div>
          {page === "Reports" && role === "researcher" && <button className="button primary" onClick={() => nav("Submit report")}>＋ Submit report</button>}
          {page === "Payout desk" && role === "lead" && <button className="button" onClick={exportCsv}>↓ Export CSV</button>}
        </div>

        {error && <div className="notice error" role="alert">{error} <button className="button" onClick={() => setError("")}>Dismiss</button></div>}
        {apiOffline && !loading && <div className="notice" role="status">Preview mode: sample reports are shown. Start PostgreSQL and FastAPI to save report, review, and payout changes.</div>}
        {loading && <div className="notice">Connecting to the ShopNest API…</div>}

        {(page === "Overview" || page === "Reports" || page === "Triage queue") && <>
          <div className="metrics">
            <Metric title="Total vulnerabilities" value={String(reports.length)} sub={`${newCount} new · ${active} in progress`} chart={<Suspense fallback={null}><MiniChart data={severityData} /></Suspense>} />
            <Metric title="Open vulnerabilities" value={String(active)} sub={overdue ? `${overdue} beyond the 5 working day triage target` : "All within the triage target"} color="good" chart={<Suspense fallback={null}><MiniChart data={severityData} line /></Suspense>} />
            <Metric title="Paid bounties" value={formatINR(paid)} sub={`${payouts.filter((p) => p.status === "Paid").length} recorded payments`} />
            <Metric title="Pending rewards" value={formatINR(pending)} sub={`${payouts.filter((p) => p.status !== "Paid").length} awaiting approval or transfer`} color="warning" />
          </div>
          {page === "Overview" && <div className="chart-grid">
            <div className="chart-card"><div className="chart-title">Reports by severity</div><Suspense fallback={<div className="muted">Loading chart…</div>}><SeverityChart data={severityData} /></Suspense></div>
            <div className="chart-card"><div className="chart-title">Program health</div><div className="summary-stat"><span>Possible duplicate groups</span><b>{duplicateCount}</b></div><div className="summary-stat"><span>Reports beyond triage target</span><b className={overdue ? "warning" : "good"}>{overdue}</b></div><div className="summary-stat"><span>In-scope assets</span><b>{PROGRAM.assets.length}</b></div></div>
          </div>}
          <div className="tabs"><button className="active" onClick={() => nav("Reports")}>⚠ &nbsp; Vulnerabilities</button><button onClick={() => nav("Reports")}>▣ &nbsp; My reports</button><button onClick={() => nav("Program scope")}>◎ &nbsp; Scope</button></div>
          <div className="toolbar">
            <select className="filter" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}><option>All severities</option>{["Critical", "High", "Medium", "Low"].map((v) => <option key={v}>{v}</option>)}</select>
            <select className="filter" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}><option>All assets</option>{PROGRAM.assets.map((a) => <option key={a}>{a}</option>)}</select>
            <select className="filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option>{["New", "Triaged", "Accepted", "Fixed", "Paid", "Duplicate", "Out of scope"].map((v) => <option key={v}>{v}</option>)}</select>
            <input className="search" placeholder="⌕  Search reports…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <span className="muted" style={{ marginLeft: "auto", fontSize: 10 }}>{visibleReports.length} reports</span>
          </div>
          <ReportTable reports={visibleReports} payouts={payouts} lead={role === "lead"} onOpen={(r) => role === "lead" ? openReview(r) : setSelected(r)} />
        </>}

        {page === "Submit report" && <form onSubmit={submitReport} className="form-grid"><section className="section-card">
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Submit a vulnerability report</h2><p className="muted">Provide a clear, text-only description using an in-scope ShopNest asset.</p>
          <div className="field"><label htmlFor="asset">Select your scope (required)</label><select id="asset" value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })}>{PROGRAM.assets.map((a) => <option key={a}>{a}</option>)}</select></div>
          <div className="field"><label htmlFor="kind">Vulnerability type (required)</label><select id="kind" value={form.vulnType} onChange={(e) => setForm({ ...form, vulnType: e.target.value })}>{kinds.map((kind) => <option key={kind}>{kind}</option>)}</select></div>
          <div className="field"><label>Suggested severity</label><div className="severity-picks">{(["Low", "Medium", "High", "Critical"] as Severity[]).map((s) => <button type="button" key={s} onClick={() => setForm({ ...form, severity: s })} className={form.severity === s ? "active" : ""}>{s}</button>)}</div><small className="muted">Estimated reward range: {formatINR(PROGRAM.rewards[form.severity].min)} – {formatINR(PROGRAM.rewards[form.severity].max)}</small></div>
          <div className="field"><label htmlFor="title">Report title (required)</label><input id="title" required minLength={5} maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="A short, clear summary" /></div>
          <div className="field"><label htmlFor="steps">Steps to reproduce (30+ characters, required)</label><textarea id="steps" required minLength={30} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} placeholder="Describe the steps in plain text. Do not upload or execute proof-of-concept code." /></div>
          <div className="field"><label htmlFor="impact">Security impact (required)</label><textarea id="impact" required minLength={10} value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} placeholder="What could an attacker or user do?" /></div>
          {duplicateFor({ id: "draft", asset: form.asset, vulnType: form.vulnType } as Report, reports) && <div className="notice">Possible duplicate: same asset and vulnerability type as another open report. The lead will review this hint.</div>}
          <label className="field" style={{ display: "flex", gridTemplateColumns: "auto 1fr", alignItems: "center" }}><span><input type="checkbox" checked={form.agreed} onChange={(e) => setForm({ ...form, agreed: e.target.checked })} /> &nbsp; I followed the rules of engagement (required)</span></label>
          <button className="button primary" type="submit" disabled={apiOffline} title={apiOffline ? "Start FastAPI and PostgreSQL to submit reports." : undefined}>Submit report</button>
        </section><aside className="side-summary"><h3>ShopNest Security</h3><div className="summary-stat"><span>Assets in scope</span><b>3</b></div><div className="summary-stat"><span>Reward range</span><b>₹2,000 – ₹2,50,000</b></div><p className="footer-note">We aim to triage reports within five working days. Your report will be visible in My Reports after submission.</p></aside></form>}

        {page === "Payout desk" && <><div className="metrics"><Metric title="Paid" value={formatINR(paid)} sub="Payment references recorded" color="good" /><Metric title="Approved" value={formatINR(payouts.filter((p) => p.status === "Approved").reduce((sum, p) => sum + p.amount, 0))} sub="Awaiting transfer" /><Metric title="To approve" value={formatINR(payouts.filter((p) => p.status === "To approve").reduce((sum, p) => sum + p.amount, 0))} sub="Ready for review" /><Metric title="Recipients" value={String(new Set(payouts.map((p) => p.researcherId)).size)} sub="Unique researchers" /></div><div className="tabs">{["All payouts", "To approve", "Approved", "Paid"].map((tab) => <button key={tab} className={payoutTab === tab ? "active" : ""} onClick={() => setPayoutTab(tab)}>{tab}</button>)}</div><div className="toolbar"><input className="search" placeholder="Search payout or report…" value={query} onChange={(e) => setQuery(e.target.value)} /></div><PayoutTable payouts={filteredPayouts} disabled={apiOffline} onAction={(p) => setPayoutEdit({ payout: p, amount: p.amount, reason: "", reference: "" })} /></>}

        {page === "Program scope" && <><div className="section-card"><h2 style={{ fontSize: 15 }}>In-scope assets</h2><div className="scope-grid">{PROGRAM.assets.map((asset) => <article className="scope-item" key={asset}><h3>{asset}</h3><span className="badge sev-low">In scope</span><p className="muted">ShopNest fictional test environment. Test only with your own account.</p></article>)}</div></div><div className="section-card"><h2 style={{ fontSize: 15 }}>Out of scope</h2><div className="scope-grid">{PROGRAM.excluded.map((item) => <article className="scope-item" key={item}>{item}</article>)}</div></div><div className="section-card"><h2 style={{ fontSize: 15 }}>Reward guide</h2>{(Object.keys(PROGRAM.rewards) as Severity[]).map((s) => <div className="summary-stat" key={s}><Severity value={s} /><span>{formatINR(PROGRAM.rewards[s].min)} – {formatINR(PROGRAM.rewards[s].max)}</span><b>{formatINR(PROGRAM.rewards[s].default)} default</b></div>)}</div></>}

        {page === "Triage queue" && <div className="notice">Triage queue: {newCount} new reports · {overdue} beyond the five working day target. Choose a report in the table to review it.</div>}
        <p className="footer-note">Demo workspace · Fictional reports · No real payments are sent</p>
      </div>
    </main>

    {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="drawer" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-head"><div className="crumb">REPORT / {selected.id}</div><button className="button" onClick={() => setSelected(null)}>Close</button></div><h2>{selected.title}</h2><div style={{ display: "flex", gap: 8 }}><Severity value={selected.finalSeverity || selected.suggestedSeverity} /><Status value={selected.status} /></div>
      <div className="summary-stat"><span>Asset</span><b>{selected.asset}</b></div><div className="summary-stat"><span>Vulnerability</span><b>{selected.vulnType}</b></div><h3 style={{ fontSize: 12 }}>Reproduction steps</h3><div className="section-card">{selected.steps}</div><h3 style={{ fontSize: 12 }}>Impact</h3><div className="section-card">{selected.impact}</div>
      {role === "lead" && <><h3 style={{ fontSize: 12 }}>Review decision</h3><div className="field"><label>Final severity</label><select value={review.severity} onChange={(e) => setReview({ ...review, severity: e.target.value as Severity })}>{["Critical", "High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}</select></div>{allowedNext[selected.status].includes("Duplicate") && <div className="field"><label>Duplicate of</label><select value={review.duplicateOf} onChange={(e) => setReview({ ...review, duplicateOf: e.target.value })}><option value="">Choose report</option>{reports.filter((r) => r.id !== selected.id).map((r) => <option value={r.id} key={r.id}>{r.id} · {r.title}</option>)}</select></div>}<div className="field"><label>Audit comment (required)</label><textarea value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} /></div><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{allowedNext[selected.status].map((next) => <button className="button primary" key={next} disabled={apiOffline} onClick={() => void changeStatus(next)}>{next}</button>)}</div></>}
      <h3 style={{ fontSize: 12, marginTop: 20 }}>Status timeline</h3><ol className="timeline">{selected.timeline.map((event, i) => <li key={`${event.at}-${i}`}><b>{event.to}</b> · {new Date(event.at).toLocaleString()}<small>{event.comment || "Report submitted"}</small></li>)}</ol>
    </aside></div>}

    {payoutEdit && <div className="drawer-backdrop" onClick={() => setPayoutEdit(null)}><aside className="drawer" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><h2>{payoutEdit.payout.status === "To approve" ? "Approve payout" : "Record payment"}</h2><button className="button" onClick={() => setPayoutEdit(null)}>Close</button></div><p className="muted">{payoutEdit.payout.reportId} · {payoutEdit.payout.severity}</p>{payoutEdit.payout.status === "To approve" && <><div className="field"><label>Reward amount (INR)</label><input type="number" value={payoutEdit.amount} onChange={(e) => setPayoutEdit({ ...payoutEdit, amount: Number(e.target.value) })} /></div><div className="field"><label>Reason for changing the default amount</label><textarea value={payoutEdit.reason} onChange={(e) => setPayoutEdit({ ...payoutEdit, reason: e.target.value })} /></div></>}<div className="field"><label>Bank UTR / payment reference {payoutEdit.payout.status === "Approved" ? "(required)" : "(entered after transfer)"}</label><input value={payoutEdit.reference} onChange={(e) => setPayoutEdit({ ...payoutEdit, reference: e.target.value })} placeholder="e.g. UTR9842109283-HDFC" /></div><button className="button primary" onClick={() => void updatePayout()}>{payoutEdit.payout.status === "To approve" ? "Approve payout" : "Mark paid"}</button></aside></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function ReportTable({ reports, payouts, lead, onOpen }: { reports: Report[]; payouts: Payout[]; lead: boolean; onOpen: (r: Report) => void }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>Severity</th><th>Vulnerability name</th><th>Surface</th><th>Status</th><th>Age</th><th>SLA</th><th>Tags</th><th>Actions</th></tr></thead><tbody>{reports.map((r) => {
    const paid = payouts.find((p) => p.reportId === r.id && p.status === "Paid"); const duplicate = duplicateFor(r, reports);
    return <tr key={r.id} onClick={() => onOpen(r)} style={{ cursor: "pointer" }}><td><Severity value={r.finalSeverity || r.suggestedSeverity} /></td><td><div className="report-title">{r.title}</div><div className="report-sub">{r.id} · {r.researcherId}</div></td><td><a className="muted">{r.asset}</a></td><td><Status value={paid ? "Paid" : r.status} /></td><td>{ageDays(r.createdAt)} days</td><td>{r.status === "New" && workingDaysSince(r.createdAt) >= 5 ? <span className="warning">⚠ Overdue</span> : <span className="muted">—</span>}</td><td>{duplicate ? <span className="tag">Possible duplicate</span> : <span className="tag">Bug bounty</span>}</td><td><button className="button" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>{lead ? "Review" : "Details"}</button></td></tr>;
  })}{reports.length === 0 && <tr><td colSpan={8} className="empty">No reports found.</td></tr>}</tbody></table></div>;
}

function PayoutTable({ payouts, onAction, disabled = false }: { payouts: Payout[]; onAction: (p: Payout) => void; disabled?: boolean }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>Payout</th><th>Report</th><th>Researcher</th><th>Severity</th><th>Amount</th><th>Status</th><th>Reference</th><th>Action</th></tr></thead><tbody>{payouts.map((p) => <tr key={p.id}><td>{p.id}</td><td>{p.reportId}</td><td>{p.researcherId}</td><td><Severity value={p.severity} /></td><td>{formatINR(p.amount)}</td><td><Status value={p.status} /></td><td>{p.reference || "—"}</td><td>{p.status !== "Paid" && <button className="button primary" disabled={disabled} onClick={() => onAction(p)}>{p.status === "Approved" ? "Record payment" : "Approve"}</button>}</td></tr>)}{payouts.length === 0 && <tr><td colSpan={8} className="empty">No payout records yet. Fixed reports create a payout record.</td></tr>}</tbody></table></div>;
}
