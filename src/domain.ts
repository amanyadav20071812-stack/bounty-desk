/// <reference types="vite/client" />

export type Role = "researcher" | "lead";
export type Severity = "Critical" | "High" | "Medium" | "Low";
export type ReportStatus = "New" | "Triaged" | "Accepted" | "Fixed" | "Duplicate" | "Out of scope" | "Not applicable";
export type PayoutStatus = "To approve" | "Approved" | "Paid";

export type TimelineEvent = { at: string; by: string; from: string | null; to: string; comment: string };
export type Report = {
  id: string; researcherId: string; title: string; asset: string; vulnType: string;
  suggestedSeverity: Severity; finalSeverity: Severity | null; steps: string; impact: string;
  status: ReportStatus; duplicateOf: string | null; createdAt: string; timeline: TimelineEvent[];
};
export type Payout = {
  id: string; reportId: string; researcherId: string; severity: Severity; amount: number;
  status: PayoutStatus; reason: string; reference: string | null; createdAt: string;
};

export const API = import.meta.env.VITE_API_URL || "/api";
export const PROGRAM = {
  name: "ShopNest Security",
  assets: ["shop.shopnest.test", "api.shopnest.test", "mobile web"],
  excluded: ["Denial of service", "Social engineering", "Physical attacks", "Automated scans without validation"],
  rewards: {
    Critical: { min: 100000, default: 150000, max: 250000 },
    High: { min: 30000, default: 50000, max: 75000 },
    Medium: { min: 8000, default: 15000, max: 25000 },
    Low: { min: 2000, default: 5000, max: 8000 },
  } satisfies Record<Severity, { min: number; default: number; max: number }>,
};

const sampleDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const firstFinding = "Broken access control (IDOR)";
const xssFinding = "Cross-Site Scripting (XSS)";

// Read-only preview data lets the interface open before PostgreSQL is configured.
export const PREVIEW_REPORTS: Report[] = [
  { id: "BD-0031", researcherId: "r_arjun", title: "Order details exposed by changing order ID", asset: "api.shopnest.test", vulnType: firstFinding, suggestedSeverity: "High", finalSeverity: "High", steps: "Use the fictional ShopNest test account and change an order ID in the request path.", impact: "A customer could access order details belonging to another account.", status: "Fixed", duplicateOf: null, createdAt: sampleDate(32), timeline: [{ at: sampleDate(32), by: "researcher", from: null, to: "New", comment: "Report submitted." }, { at: sampleDate(30), by: "lead", from: "New", to: "Accepted", comment: "Confirmed, fix in progress." }, { at: sampleDate(21), by: "lead", from: "Accepted", to: "Fixed", comment: "Fix verified." }] },
  { id: "BD-0024", researcherId: "r_meera", title: "Reflected XSS in storefront search", asset: "shop.shopnest.test", vulnType: xssFinding, suggestedSeverity: "Medium", finalSeverity: "Medium", steps: "Submit harmless test text in the search field and observe how the page displays it.", impact: "Unescaped text could affect visitors to the results page.", status: "Accepted", duplicateOf: null, createdAt: sampleDate(6), timeline: [{ at: sampleDate(6), by: "researcher", from: null, to: "New", comment: "Report submitted." }, { at: sampleDate(3), by: "lead", from: "New", to: "Accepted", comment: "Reproduced safely in the demo." }] },
  { id: "BD-0025", researcherId: "r_kabir", title: "Search result reflects untrusted text", asset: "shop.shopnest.test", vulnType: xssFinding, suggestedSeverity: "High", finalSeverity: null, steps: "Enter harmless marker text in the search field and compare the displayed result.", impact: "Search results could render untrusted text in another visitor's page.", status: "New", duplicateOf: null, createdAt: sampleDate(2), timeline: [{ at: sampleDate(2), by: "researcher", from: null, to: "New", comment: "Report submitted." }] },
  { id: "BD-0026", researcherId: "r_zoya", title: "Checkout total can be changed", asset: "shop.shopnest.test", vulnType: "Business Logic Flaw", suggestedSeverity: "Critical", finalSeverity: null, steps: "Review a fictional checkout total and note whether client-side changes are accepted.", impact: "A checkout logic issue may permit an incorrect order total.", status: "New", duplicateOf: null, createdAt: sampleDate(1), timeline: [{ at: sampleDate(1), by: "researcher", from: null, to: "New", comment: "Report submitted." }] },
  { id: "BD-0027", researcherId: "r_arjun", title: "Private profile fields visible across accounts", asset: "api.shopnest.test", vulnType: firstFinding, suggestedSeverity: "High", finalSeverity: "High", steps: "Compare profile visibility using two fictional test accounts with separate sessions.", impact: "Private fields might be visible to another signed-in user.", status: "Triaged", duplicateOf: null, createdAt: sampleDate(4), timeline: [{ at: sampleDate(4), by: "researcher", from: null, to: "New", comment: "Report submitted." }, { at: sampleDate(2), by: "lead", from: "New", to: "Triaged", comment: "Initial review started." }] },
  { id: "BD-0028", researcherId: "r_meera", title: "Session remains active after sign out", asset: "mobile web", vulnType: "Authentication Bypass", suggestedSeverity: "Medium", finalSeverity: "Medium", steps: "Sign out of the fictional mobile storefront and confirm the old session is rejected.", impact: "A signed-out session should not retain account access.", status: "Accepted", duplicateOf: null, createdAt: sampleDate(8), timeline: [{ at: sampleDate(8), by: "researcher", from: null, to: "New", comment: "Report submitted." }, { at: sampleDate(5), by: "lead", from: "New", to: "Accepted", comment: "Confirmed on the test storefront." }] },
  { id: "BD-0029", researcherId: "r_kabir", title: "Response reveals extra server details", asset: "api.shopnest.test", vulnType: "Information Disclosure", suggestedSeverity: "Low", finalSeverity: "Low", steps: "Review the fictional API response for details the client does not need.", impact: "Extra implementation details could help plan further testing.", status: "Fixed", duplicateOf: null, createdAt: sampleDate(12), timeline: [{ at: sampleDate(12), by: "researcher", from: null, to: "New", comment: "Report submitted." }, { at: sampleDate(10), by: "lead", from: "New", to: "Accepted", comment: "Patch approved." }, { at: sampleDate(7), by: "lead", from: "Accepted", to: "Fixed", comment: "Fix verified." }] },
];

export const PREVIEW_PAYOUTS: Payout[] = [
  { id: "PAY-0031", reportId: "BD-0031", researcherId: "r_arjun", severity: "High", amount: 50000, status: "Approved", reason: "Default High reward", reference: null, createdAt: sampleDate(20) },
  { id: "PAY-0029", reportId: "BD-0029", researcherId: "r_kabir", severity: "Low", amount: 5000, status: "To approve", reason: "Default Low reward", reference: null, createdAt: sampleDate(7) },
];

export const formatINR = (amount: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(amount);

export const allowedNext: Record<ReportStatus, ReportStatus[]> = {
  New: ["Triaged", "Accepted", "Duplicate", "Not applicable", "Out of scope"],
  Triaged: ["Accepted", "Duplicate", "Not applicable"],
  Accepted: ["Fixed"], Fixed: [], Duplicate: [], "Out of scope": [], "Not applicable": [],
};

export function duplicateFor(candidate: Pick<Report, "id" | "asset" | "vulnType">, reports: Report[]) {
  return reports.find((report) => report.id !== candidate.id && report.asset === candidate.asset
    && report.vulnType === candidate.vulnType && !["Duplicate", "Not applicable", "Out of scope"].includes(report.status));
}

export function ageDays(date: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

export function workingDaysSince(date: string) {
  const cursor = new Date(date);
  const end = new Date();
  cursor.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  let days = 0;
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6 && cursor <= end) days++;
  }
  return days;
}

export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail || `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}
