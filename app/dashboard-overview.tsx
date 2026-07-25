"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CriticalAction, DashboardVisuals } from "./lib/status";

type DashboardPayload = {
  metrics: {
    activePos: number; activeValueByCurrency: Record<string, number>; delayedDeliveries: number; dueWithin30Days: number;
    averageLeadTimeWeeks: number; missingPerformanceBonds: number; performanceBondsExpiring: number;
    missingWarrantyBonds: number; warrantyBondsExpiring: number; deliveryBreakdown: Record<string, number>; bondBreakdown: Record<string, number>;
    delayedValueByCurrency: Record<string, number>; budgetVarianceByCurrency: Record<string, number>; budgetUnavailablePos: number;
    unpaidMilestones: number; unpaidValueByCurrency: Record<string, number>; serviceCostIdr: number;
    revisionDeltaByCurrency: Record<string, number>; paymentBreakdown: Record<string, number>;
  };
  actions: CriticalAction[];
  visuals: DashboardVisuals;
  projects: string[];
  selectedProject: string | null;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedProject = searchParams.get("project") ?? "all";
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [priority, setPriority] = useState<(typeof priorityOrder)[number]>("all");
  const [issueType, setIssueType] = useState("all");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = selectedProject === "all" ? "" : `?project=${encodeURIComponent(selectedProject)}`;
      const response = await fetch(`/api/dashboard${query}`, { cache: "no-store" });
      const payload = await response.json() as DashboardPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load dashboard.");
      setData(payload);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load dashboard."); }
    finally { setLoading(false); }
  }, [selectedProject]);

  // Initial remote data load; subsequent refreshes are explicit user actions.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  const issues = useMemo(() => data?.actions.filter((action) => (priority === "all" || action.priority === priority) && (issueType === "all" || action.issueType === issueType)) ?? [], [data, issueType, priority]);
  const issueTypes = useMemo(() => [...new Set(data?.actions.map((action) => action.issueType) ?? [])], [data]);

  function selectProject(project: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (project === "all") next.delete("project");
    else next.set("project", project);
    router.replace(next.size ? `/?${next.toString()}` : "/", { scroll: false });
  }

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) return <section className="page-error"><h1>Overview unavailable</h1><p>{error}</p><button className="button button-primary" onClick={() => void refresh()}>Retry</button></section>;
  if (!data) return null;
  const { metrics } = data;
  const projectOverview = data.visuals.projectOverview.filter((project) => project.code !== "Unassigned");
  const cards = [
    { title: "Committed PO value", value: metrics.activePos, detail: <div className="currency-lines">{valueLines(metrics.activeValueByCurrency)}</div>, tone: "neutral", href: "/register?status=active", tip: "Current committed value by contract currency; currencies are never combined without an approved FX source." },
    { title: "Budget headroom", value: metrics.budgetUnavailablePos === metrics.activePos ? "Budget not set" : "By currency", detail: metrics.budgetUnavailablePos === metrics.activePos ? "No budget is available for the selected active POs." : <div className="currency-lines">{valueLines(metrics.budgetVarianceByCurrency)}{metrics.budgetUnavailablePos > 0 && <span>{metrics.budgetUnavailablePos} PO without available budget excluded</span>}</div>, tone: "neutral", href: "/register", tip: "Budget minus current contract value, kept separate by currency. POs without a budget are excluded from this calculation." },
    { title: "Past delivery forecast", value: metrics.delayedDeliveries, detail: <div className="currency-lines">{valueLines(metrics.delayedValueByCurrency)}</div>, tone: "critical", href: "/execution", tip: "Exposure on active POs past the latest forecast ETA or, when absent, the contract ETA." },
    { title: "Unpaid cash milestones", value: metrics.unpaidMilestones, detail: <div className="currency-lines">{valueLines(metrics.unpaidValueByCurrency)}</div>, tone: "warning", href: "/execution", tip: "Planned, invoiced, and on-hold milestones for current active PO revisions." },
    { title: "Current revision delta", value: "Net change", detail: <div className="currency-lines">{valueLines(metrics.revisionDeltaByCurrency)}</div>, tone: "neutral", href: "/register?view=all", tip: "Current contract value less the linked prior revision, by currency." },
    { title: "Bond exposure", value: metrics.missingPerformanceBonds + metrics.performanceBondsExpiring + metrics.missingWarrantyBonds + metrics.warrantyBondsExpiring, detail: "Missing or critical PB/WB records", tone: "critical", href: "/bonds", tip: "Active PO bonds that are missing or within the critical expiry window." },
    { title: "Included services", value: formatCurrency(metrics.serviceCostIdr, "IDR"), detail: "Normalized supervision, commissioning, and training cost", tone: "neutral", href: "/execution", tip: "IDR service commitments for current active PO revisions." },
    { title: "Management actions", value: data.actions.length, detail: "Open derived exceptions requiring review", tone: data.actions.some((action) => action.priority === "critical") ? "critical" : "warning", href: "/alerts", tip: "System-derived delivery, bond, and data-quality exceptions." },
  ];

  return <>
    <section className="page-header dashboard-header">
      <div><p className="eyebrow">SCM Category Management 1</p><h1>TPEC CM1 PO Monitoring</h1><p>Executive view of commitments, budget variance, delivery exposure, cash milestones, contractual bonds, and supplier concentration.</p><small>Last refreshed {formatDateTime(data.refreshedAt)}</small></div>
      <div className="page-actions"><Link className="button button-quiet" href="/execution">Delivery & Cash</Link><Link className="button button-quiet" href="/bonds?new=1">Add Bond</Link><Link className="button button-primary" href="/register?new=1">+ New PO</Link></div>
    </section>
    {error && <div className="notice" role="status">{error}<button onClick={() => void refresh()} className="text-button">Retry</button></div>}
    <section className="dashboard-slicer panel" aria-label="Dashboard filters"><label>Project<select value={selectedProject} onChange={(event) => selectProject(event.target.value)}><option value="all">All projects</option>{data.projects.map((project) => <option key={project} value={project}>{project}</option>)}</select></label><span>{data.selectedProject ? `Showing Project ${data.selectedProject}` : "Showing all projects"}</span></section>
    <section className="project-overview" aria-labelledby="project-overview-title"><div className="project-overview-heading"><div><p className="eyebrow">Portfolio snapshot</p><h2 id="project-overview-title">Project Overview</h2><p>Click a card to filter the dashboard for that project.</p></div><span>{projectOverview.length} project{projectOverview.length === 1 ? "" : "s"}</span></div><div className="project-card-list">{projectOverview.length ? projectOverview.map((project) => <button key={project.code} type="button" className={`project-overview-card${data.selectedProject === project.code ? " selected" : ""}`} onClick={() => selectProject(project.code)}><span className="project-card-code">{project.code}</span><strong>{project.active} Active PO{project.active === 1 ? "" : "s"}</strong><small className="currency-lines">{valueLines(project.values)}</small><span className="project-card-risks"><b>{project.delayed} delayed</b><b>{project.missingPB + project.expiringPB + project.missingWB + project.expiringWB} bond issue{project.missingPB + project.expiringPB + project.missingWB + project.expiringWB === 1 ? "" : "s"}</b></span></button>) : <p className="project-overview-empty">No active POs assigned to a project.</p>}</div></section>
    <section className="dashboard-kpis" aria-label="Procurement risk indicators">
      {cards.map((card) => <Link key={card.title} href={card.href} className={`dashboard-kpi ${card.tone}`} title={card.tip}><span>{card.title}</span><strong>{card.value}</strong><small>{card.detail}</small><i aria-hidden="true">→</i></Link>)}
    </section>
    <section className="panel critical-panel">
      <div className="panel-heading"><div><p className="eyebrow">Action queue</p><h2>Critical Actions</h2><p>Delivery, bond, and data-quality exceptions ranked by urgency.</p></div><Link href="/alerts" className="button button-quiet">Open Alerts</Link></div>
      <div className="action-filters"><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{priorityOrder.map((item) => <option key={item} value={item}>{item === "all" ? "All priorities" : item}</option>)}</select></label><label>Issue type<select value={issueType} onChange={(event) => setIssueType(event.target.value)}><option value="all">All issue types</option>{issueTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><span>{issues.length} action{issues.length === 1 ? "" : "s"}</span></div>
      {issues.length ? <div className="table-scroll"><table className="action-table"><thead><tr><th>Priority</th><th>Issue</th><th>PO / vendor</th><th>Project</th><th>Relevant date</th><th>Days</th><th>Value</th><th>Action</th></tr></thead><tbody>{issues.slice(0, 12).map((action) => <tr key={action.id}><td><StatusBadge status={action.priority} /></td><td><strong>{action.issueType}</strong><span>{action.equipmentName}</span></td><td><strong>{action.poNumber}</strong><span>{action.vendorName || "Missing vendor"}</span></td><td>{action.projectCode || "—"}</td><td>{action.relevantDate ? new Intl.DateTimeFormat("en-GB").format(new Date(`${action.relevantDate}T00:00:00Z`)) : "—"}</td><td>{action.daysRemaining === null ? "—" : action.daysRemaining}</td><td>{formatCurrency(action.value, action.currencyCode)}</td><td><Link href={action.bondId ? `/bonds?bond=${action.bondId}` : `/register?po=${encodeURIComponent(action.poNumber)}`} className="row-action">View</Link></td></tr>)}</tbody></table></div> : <EmptyMessage title="No critical issues" copy="No PO delivery or contractual bond exceptions match the current filters." />}
    </section>
    <section className="visual-grid" aria-label="Dashboard visualizations">
      <ChartCard title="PO Delivery Status" subtitle="Latest execution forecast, falling back to contract ETA"><Breakdown data={metrics.deliveryBreakdown} labels={{ "on-track": "On track", "due-soon": "Due soon", delayed: "Delayed", completed: "Completed", cancelled: "Cancelled", "missing-eta": "Missing ETA" }} /></ChartCard>
      <ChartCard title="Payment Milestone Status" subtitle="Cash milestone workflow for current active POs"><Breakdown data={metrics.paymentBreakdown} labels={{ planned: "Planned", invoiced: "Invoiced", paid: "Paid", "on-hold": "On hold" }} /></ChartCard>
      <ChartCard title="Supplier Concentration" subtitle="Current active PO count and value by currency"><div className="rank-list">{data.visuals.vendorConcentration.length ? data.visuals.vendorConcentration.map((vendor) => <div key={vendor.vendor}><strong>{vendor.vendor}</strong><span>{vendor.poCount} active PO{vendor.poCount === 1 ? "" : "s"}</span><small>{valueLines(vendor.values)}</small></div>) : <p>No active supplier exposure.</p>}</div></ChartCard>
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
