"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CriticalAction, DashboardVisuals } from "./lib/status";

type DashboardPayload = {
  metrics: {
    activePos: number; activeValueByCurrency: Record<string, number>; delayedDeliveries: number; dueWithin30Days: number;
    averageLeadTimeWeeks: number; missingPerformanceBonds: number; performanceBondsExpiring: number;
    missingWarrantyBonds: number; warrantyBondsExpiring: number; deliveryBreakdown: Record<string, number>; bondBreakdown: Record<string, number>;
  };
  actions: CriticalAction[];
  visuals: DashboardVisuals;
  isEmpty: boolean;
  refreshedAt: string;
};

const priorityOrder = ["all", "critical", "high", "medium"] as const;

function formatCurrency(value: number | string, currency = "IDR") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-US")}`; }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function valueLines(values: Record<string, number>) {
  const entries = Object.entries(values).filter(([, value]) => Number.isFinite(value));
  return entries.length ? entries.map(([currency, value]) => <span key={currency}>{formatCurrency(value, currency)}</span>) : <span>—</span>;
}

export default function DashboardOverview() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState<(typeof priorityOrder)[number]>("all");
  const [issueType, setIssueType] = useState("all");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = await response.json() as DashboardPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load dashboard.");
      setData(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load dashboard."); }
    finally { setLoading(false); }
  }, []);

  // Initial remote data load; subsequent refreshes are explicit user actions.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  const issues = useMemo(() => data?.actions.filter((action) => (priority === "all" || action.priority === priority) && (issueType === "all" || action.issueType === issueType)) ?? [], [data, issueType, priority]);
  const issueTypes = useMemo(() => [...new Set(data?.actions.map((action) => action.issueType) ?? [])], [data]);

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) return <section className="page-error"><h1>Overview unavailable</h1><p>{error}</p><button className="button button-primary" onClick={() => void refresh()}>Retry</button></section>;
  if (!data) return null;
  const { metrics } = data;
  const cards = [
    { title: "Active POs", value: metrics.activePos, detail: <div className="currency-lines">{valueLines(metrics.activeValueByCurrency)}</div>, tone: "neutral", href: "/register?status=active", tip: "Latest PO revisions that have not been completed or cancelled." },
    { title: "Delayed deliveries", value: metrics.delayedDeliveries, detail: "Active POs with an ETA before today", tone: "critical", href: "/register?delivery=delayed", tip: "Completed and cancelled POs are excluded." },
    { title: "Due within 30 days", value: metrics.dueWithin30Days, detail: "Configured delivery warning window", tone: "warning", href: "/register?delivery=due-soon", tip: "Active POs with ETA from today through 30 days." },
    { title: "Average lead time", value: `${metrics.averageLeadTimeWeeks.toFixed(1)} wk`, detail: "Release date to ETA, valid dates only", tone: "neutral", href: "/register?sort=eta", tip: "Average calendar weeks between release and ETA." },
    { title: "Missing Performance Bonds", value: metrics.missingPerformanceBonds, detail: "Required PB with no usable bond record", tone: "critical", href: "/bonds?type=PB&status=missing", tip: "PB required on active POs but no valid PB exists." },
    { title: "PB expiring within 30 days", value: metrics.performanceBondsExpiring, detail: "Critical PB expiry window", tone: "warning", href: "/bonds?type=PB&status=critical", tip: "PB expiry dates from today through 30 days." },
    { title: "Missing Warranty Bonds", value: metrics.missingWarrantyBonds, detail: "Required WB with no usable bond record", tone: "critical", href: "/bonds?type=WB&status=missing", tip: "WB required on active POs but no valid WB exists." },
    { title: "WB expiring within 30 days", value: metrics.warrantyBondsExpiring, detail: "Critical WB expiry window", tone: "warning", href: "/bonds?type=WB&status=critical", tip: "WB expiry dates from today through 30 days." },
  ];

  return <>
    <section className="page-header dashboard-header">
      <div><p className="eyebrow">SCM Category Management 1</p><h1>TPEC CM1 PO Monitoring</h1><p>Monitor purchase order delivery, performance bonds, warranty bonds, and procurement risks.</p><small>Last refreshed {formatDateTime(data.refreshedAt)}</small></div>
      <div className="page-actions"><Link className="button button-quiet" href="/register?import=1">Import / Export</Link><Link className="button button-quiet" href="/bonds?new=1">Add Bond</Link><Link className="button button-primary" href="/register?new=1">+ New PO</Link></div>
    </section>
    {error && <div className="notice" role="status">{error}<button onClick={() => void refresh()} className="text-button">Retry</button></div>}
    <section className="dashboard-kpis" aria-label="Procurement risk indicators">
      {cards.map((card) => <Link key={card.title} href={card.href} className={`dashboard-kpi ${card.tone}`} title={card.tip}><span>{card.title}</span><strong>{card.value}</strong><small>{card.detail}</small><i aria-hidden="true">→</i></Link>)}
    </section>
    <section className="panel critical-panel">
      <div className="panel-heading"><div><p className="eyebrow">Action queue</p><h2>Critical Actions</h2><p>Delivery, bond, and data-quality exceptions ranked by urgency.</p></div><Link href="/alerts" className="button button-quiet">Open Alerts</Link></div>
      <div className="action-filters"><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{priorityOrder.map((item) => <option key={item} value={item}>{item === "all" ? "All priorities" : item}</option>)}</select></label><label>Issue type<select value={issueType} onChange={(event) => setIssueType(event.target.value)}><option value="all">All issue types</option>{issueTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><span>{issues.length} action{issues.length === 1 ? "" : "s"}</span></div>
      {issues.length ? <div className="table-scroll"><table className="action-table"><thead><tr><th>Priority</th><th>Issue</th><th>PO / vendor</th><th>Project</th><th>Relevant date</th><th>Days</th><th>Value</th><th>Action</th></tr></thead><tbody>{issues.slice(0, 12).map((action) => <tr key={action.id}><td><StatusBadge status={action.priority} /></td><td><strong>{action.issueType}</strong><span>{action.equipmentName}</span></td><td><strong>{action.poNumber}</strong><span>{action.vendorName || "Missing vendor"}</span></td><td>{action.projectCode || "—"}</td><td>{action.relevantDate ? new Intl.DateTimeFormat("en-GB").format(new Date(`${action.relevantDate}T00:00:00Z`)) : "—"}</td><td>{action.daysRemaining === null ? "—" : action.daysRemaining}</td><td>{formatCurrency(action.value, action.currencyCode)}</td><td><Link href={action.bondId ? `/bonds?bond=${action.bondId}` : `/register?po=${encodeURIComponent(action.poNumber)}`} className="row-action">View</Link></td></tr>)}</tbody></table></div> : <EmptyMessage title="No critical issues" copy="No PO delivery or contractual bond exceptions match the current filters." />}
    </section>
    <section className="visual-grid" aria-label="Dashboard visualizations">
      <ChartCard title="PO Delivery Status" subtitle="Current-revision delivery status"><Breakdown data={metrics.deliveryBreakdown} labels={{ "on-track": "On track", "due-soon": "Due soon", delayed: "Delayed", completed: "Completed", "missing-eta": "Missing ETA" }} /></ChartCard>
      <ChartCard title="Bond Status Distribution" subtitle="PB and WB requirement status"><Breakdown data={metrics.bondBreakdown} labels={{ valid: "Valid", expiring: "Expiring soon", critical: "Critical", expired: "Expired", missing: "Missing", "n/a": "N/A", released: "Released" }} /></ChartCard>
      <ChartCard title="Top Vendors with Delayed Deliveries" subtitle="Latest active PO revisions"><div className="rank-list">{data.visuals.vendorDelays.length ? data.visuals.vendorDelays.map((vendor) => <div key={vendor.vendor}><strong>{vendor.vendor}</strong><span>{vendor.count} delayed · max {vendor.maxDays} days overdue</span><small>{valueLines(vendor.values)}</small></div>) : <p>No delayed deliveries.</p>}</div></ChartCard>
      <ChartCard title="Project Risk Summary" subtitle="Active PO and bond exceptions"><div className="project-risk">{data.visuals.projectRisk.length ? <table><thead><tr><th>Project</th><th>Active</th><th>Delayed</th><th>Due</th><th>PB</th><th>WB</th></tr></thead><tbody>{data.visuals.projectRisk.map((project) => <tr key={project.code}><td><strong>{project.code}</strong></td><td>{project.active}</td><td>{project.delayed}</td><td>{project.due}</td><td>{project.missingPB + project.expiringPB}</td><td>{project.missingWB + project.expiringWB}</td></tr>)}</tbody></table> : <p>No active POs to summarise yet.</p>}</div></ChartCard>
    </section>
    {data.isEmpty && <section className="setup-checklist panel"><div><p className="eyebrow">New workspace</p><h2>Complete your CM1 setup</h2><p>Master data helps make the PO and bond registers consistent from the very first record.</p></div><ol><li><Link href="/master-data">Add project master data</Link></li><li><Link href="/master-data">Add vendor master data</Link></li><li><Link href="/register?new=1">Create the first PO</Link></li><li><Link href="/bonds?new=1">Add bond requirements</Link></li><li><Link href="/register?import=1">Import existing records</Link></li></ol></section>}
  </>;
}

function DashboardSkeleton() { return <section className="dashboard-skeleton" aria-live="polite"><div className="skeleton-title" /><div className="skeleton-grid">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton-card" />)}</div><div className="skeleton-table" /></section>; }
function StatusBadge({ status }: { status: string }) { return <span className={`status-badge status-${status.replaceAll(" ", "-")}`}>{status}</span>; }
function EmptyMessage({ title, copy }: { title: string; copy: string }) { return <div className="compact-empty"><strong>{title}</strong><p>{copy}</p></div>; }
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="panel chart-card"><div className="chart-heading"><h2>{title}</h2><p>{subtitle}</p></div>{children}</section>; }
function Breakdown({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) { const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1; return <div className="breakdown" role="list">{Object.entries(labels).map(([key, label]) => <div key={key} role="listitem"><div><span className={`dot dot-${key}`}/><strong>{label}</strong><b>{data[key] ?? 0}</b></div><span className="bar"><i className={`bar-${key}`} style={{ width: `${((data[key] ?? 0) / total) * 100}%` }} /></span></div>)}</div>; }
