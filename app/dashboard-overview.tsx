"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPOReference } from "./lib/po";
import type { CriticalAction, DashboardVisuals } from "./lib/status";

type DashboardPayload = {
  metrics: {
    activePos: number; activeValueByCurrency: Record<string, number>; baseScopeCommittedValueByCurrency: Record<string, number>; provisionalScopeCommittedValueByCurrency: Record<string, number>; delayedDeliveries: number; dueWithin30Days: number;
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

function valueText(values: Record<string, number>) {
  const entries = Object.entries(values).filter(([, value]) => Number.isFinite(value));
  return entries.length ? entries.map(([currency, value]) => formatCurrency(value, currency)).join(" · ") : "—";
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
  const topDelayedVendor = data.visuals.vendorDelays[0];
  const largestProjectRisk = projectOverview[0];
  const totalBondExposure = metrics.missingPerformanceBonds + metrics.performanceBondsExpiring + metrics.missingWarrantyBonds + metrics.warrantyBondsExpiring;
  const cards = [
    { title: "Total committed PO value", value: metrics.activePos, detail: <div className="currency-lines">{valueLines(metrics.activeValueByCurrency)}</div>, tone: "neutral", href: "/register?status=active", tip: "Total commitment is base plus provisional scope, kept separate by contract currency." },
    { title: "Base scope commitment", value: "By currency", detail: <div className="currency-lines">{valueLines(metrics.baseScopeCommittedValueByCurrency)}</div>, tone: "neutral", href: "/register", tip: "Committed PO value funded by the project base scope." },
    { title: "Provisional scope commitment", value: "Backcharge", detail: <div className="currency-lines">{valueLines(metrics.provisionalScopeCommittedValueByCurrency)}</div>, tone: "warning", href: "/register", tip: "Committed PO value for provisional scope expected to be backcharged to the client." },
    { title: "Budget headroom", value: metrics.budgetUnavailablePos === metrics.activePos ? "Budget not set" : "By currency", detail: metrics.budgetUnavailablePos === metrics.activePos ? "No budget is available for the selected active POs." : <div className="currency-lines">{valueLines(metrics.budgetVarianceByCurrency)}{metrics.budgetUnavailablePos > 0 && <span>{metrics.budgetUnavailablePos} PO without available budget excluded</span>}</div>, tone: "neutral", href: "/register", tip: "Budget minus base-scope committed value, kept separate by currency. Provisional value is excluded because it is backcharged to the client." },
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
    <section className="dashboard-kpis" aria-label="Procurement risk indicators">
      {cards.map((card) => <Link key={card.title} href={card.href} className={`dashboard-kpi ${card.tone}`} title={card.tip}><span>{card.title}</span><strong>{card.value}</strong><small>{card.detail}</small><i aria-hidden="true">→</i></Link>)}
    </section>
    <section className="management-cockpit panel" aria-labelledby="management-cockpit-title">
      <div className="panel-heading"><div><p className="eyebrow">Management cockpit</p><h2 id="management-cockpit-title">Portfolio risk at a glance</h2><p>Hover or focus a chart bar for the underlying exposure. Click a project bar to apply the project filter.</p></div><span className="management-live">Live portfolio view</span></div>
      <div className="management-insights">
        <InsightCard tone={metrics.delayedDeliveries ? "critical" : "positive"} label="Delivery attention" value={`${metrics.delayedDeliveries} delayed`} detail={metrics.dueWithin30Days ? `${metrics.dueWithin30Days} due within 30 days` : "No PO due within 30 days"} />
        <InsightCard tone={totalBondExposure ? "warning" : "positive"} label="Bond compliance" value={`${totalBondExposure} exception${totalBondExposure === 1 ? "" : "s"}`} detail={totalBondExposure ? "Missing or near-expiry PB/WB" : "No critical bond exception"} />
        <InsightCard tone={metrics.unpaidMilestones ? "warning" : "positive"} label="Cash exposure" value={`${metrics.unpaidMilestones} open milestone${metrics.unpaidMilestones === 1 ? "" : "s"}`} detail={valueText(metrics.unpaidValueByCurrency)} />
        <InsightCard tone={topDelayedVendor ? "critical" : "positive"} label="Supplier requiring review" value={topDelayedVendor?.vendor ?? "None"} detail={topDelayedVendor ? `${topDelayedVendor.count} delayed PO · up to ${topDelayedVendor.maxDays} days overdue` : "No delayed supplier delivery"} />
      </div>
      <div className="management-chart-grid">
        <DeliveryHealthChart data={metrics.deliveryBreakdown} />
        <ProjectRiskChart projects={projectOverview} selectedProject={data.selectedProject} onSelect={selectProject} />
        <VendorDelayChart vendors={data.visuals.vendorDelays} />
        <CategoryExposureChart categories={data.visuals.categoryExposure} />
      </div>
      {largestProjectRisk && <p className="management-callout"><strong>Focus first:</strong> {largestProjectRisk.code} has {largestProjectRisk.delayed} delayed PO{largestProjectRisk.delayed === 1 ? "" : "s"} and {largestProjectRisk.missingPB + largestProjectRisk.expiringPB + largestProjectRisk.missingWB + largestProjectRisk.expiringWB} bond exception{largestProjectRisk.missingPB + largestProjectRisk.expiringPB + largestProjectRisk.missingWB + largestProjectRisk.expiringWB === 1 ? "" : "s"}. <button type="button" className="text-button" onClick={() => selectProject(largestProjectRisk.code)}>Filter this project</button></p>}
    </section>
    <section className="panel critical-panel">
      <div className="panel-heading"><div><p className="eyebrow">Action queue</p><h2>Critical Actions</h2><p>Delivery, bond, and data-quality exceptions ranked by urgency.</p></div><Link href="/alerts" className="button button-quiet">Open Alerts</Link></div>
      <div className="action-filters"><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{priorityOrder.map((item) => <option key={item} value={item}>{item === "all" ? "All priorities" : item}</option>)}</select></label><label>Issue type<select value={issueType} onChange={(event) => setIssueType(event.target.value)}><option value="all">All issue types</option>{issueTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><span>{issues.length} action{issues.length === 1 ? "" : "s"}</span></div>
      {issues.length ? <div className="table-scroll"><table className="action-table"><thead><tr><th>Priority</th><th>Issue</th><th>PO / vendor</th><th>Project</th><th>Relevant date</th><th>Days</th><th>Value</th><th>Action</th></tr></thead><tbody>{issues.slice(0, 12).map((action) => <tr key={action.id}><td><StatusBadge status={action.priority} /></td><td><strong>{action.issueType}</strong><span>{action.equipmentName}</span></td><td><strong>{formatPOReference(action.poNumber, action.projectCode, action.purchasingGroup)}</strong><span>{action.vendorName || "Missing vendor"}</span></td><td>{action.projectCode || "—"}</td><td>{action.relevantDate ? new Intl.DateTimeFormat("en-GB").format(new Date(`${action.relevantDate}T00:00:00Z`)) : "—"}</td><td>{action.daysRemaining === null ? "—" : action.daysRemaining}</td><td>{formatCurrency(action.value, action.currencyCode)}</td><td><Link href={action.bondId ? `/bonds?bond=${action.bondId}` : `/register?po=${encodeURIComponent(action.poNumber)}`} className="row-action">View</Link></td></tr>)}</tbody></table></div> : <EmptyMessage title="No critical issues" copy="No PO delivery or contractual bond exceptions match the current filters." />}
    </section>
    <section className="visual-grid" aria-label="Supporting dashboard visualizations">
      <ChartCard title="Payment Milestone Status" subtitle="Cash milestone workflow for current active POs"><Breakdown data={metrics.paymentBreakdown} labels={{ planned: "Planned", invoiced: "Invoiced", paid: "Paid", "on-hold": "On hold" }} /></ChartCard>
      <ChartCard title="Supplier Concentration" subtitle="Current active PO count and value by currency"><div className="rank-list">{data.visuals.vendorConcentration.length ? data.visuals.vendorConcentration.map((vendor) => <div key={vendor.vendor}><strong>{vendor.vendor}</strong><span>{vendor.poCount} active PO{vendor.poCount === 1 ? "" : "s"}</span><small>{valueLines(vendor.values)}</small></div>) : <p>No active supplier exposure.</p>}</div></ChartCard>
    </section>
    {data.isEmpty && <section className="setup-checklist panel"><div><p className="eyebrow">New workspace</p><h2>Complete your CM1 setup</h2><p>Master data helps make the PO and bond registers consistent from the very first record.</p></div><ol><li><Link href="/master-data">Add project master data</Link></li><li><Link href="/master-data">Add vendor master data</Link></li><li><Link href="/register?new=1">Create the first PO</Link></li><li><Link href="/bonds?new=1">Add bond requirements</Link></li><li><Link href="/register?import=1">Import existing records</Link></li></ol></section>}
  </>;
}

function DashboardSkeleton() { return <section className="dashboard-skeleton" aria-live="polite"><div className="skeleton-title" /><div className="skeleton-grid">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton-card" />)}</div><div className="skeleton-table" /></section>; }
function StatusBadge({ status }: { status: string }) { return <span className={`status-badge status-${status.replaceAll(" ", "-")}`}>{status}</span>; }
function EmptyMessage({ title, copy }: { title: string; copy: string }) { return <div className="compact-empty"><strong>{title}</strong><p>{copy}</p></div>; }
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="panel chart-card"><div className="chart-heading"><h2>{title}</h2><p>{subtitle}</p></div>{children}</section>; }
function Breakdown({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) { const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1; return <div className="breakdown" role="list">{Object.entries(labels).map(([key, label]) => <div key={key} role="listitem"><div><span className={`dot dot-${key}`}/><strong>{label}</strong><b>{data[key] ?? 0}</b></div><span className="bar"><i className={`bar-${key}`} style={{ width: `${((data[key] ?? 0) / total) * 100}%` }} /></span></div>)}</div>; }

function InsightCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "critical" | "warning" | "positive" }) { return <div className={`management-insight ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }

function DeliveryHealthChart({ data }: { data: Record<string, number> }) {
  const [active, setActive] = useState("delayed");
  const segments = [
    { key: "delayed", label: "Delayed", description: "Past the latest forecast ETA or contract ETA", tone: "critical" },
    { key: "due-soon", label: "Due soon", description: "Due within the current warning window", tone: "warning" },
    { key: "on-track", label: "On track", description: "Forecast beyond the warning window", tone: "positive" },
    { key: "missing-eta", label: "Missing ETA", description: "Delivery cannot be monitored until ETA is recorded", tone: "neutral" },
  ];
  const total = segments.reduce((sum, segment) => sum + (data[segment.key] ?? 0), 0) || 1;
  const selected = segments.find((segment) => segment.key === active) ?? segments[0];
  const count = data[selected.key] ?? 0;
  return <ManagementChart title="Delivery health" subtitle="Active PO execution outlook" detail={<><strong>{selected.label}: {count} PO{count === 1 ? "" : "s"}</strong><span>{selected.description} · {Math.round((count / total) * 100)}% of monitored active POs</span></>}><div className="stacked-chart" role="list" aria-label="Delivery health breakdown">{segments.map((segment) => { const value = data[segment.key] ?? 0; return <button key={segment.key} type="button" role="listitem" className={`stacked-segment ${segment.tone}${active === segment.key ? " active" : ""}`} style={{ flexGrow: Math.max(value, 0.2) }} onMouseEnter={() => setActive(segment.key)} onFocus={() => setActive(segment.key)} onClick={() => setActive(segment.key)} aria-label={`${segment.label}: ${value} PO`}><span>{value || ""}</span></button>; })}</div><div className="chart-legend">{segments.map((segment) => <button key={segment.key} type="button" className={active === segment.key ? "active" : ""} onMouseEnter={() => setActive(segment.key)} onFocus={() => setActive(segment.key)} onClick={() => setActive(segment.key)}><i className={segment.tone} />{segment.label}<b>{data[segment.key] ?? 0}</b></button>)}</div></ManagementChart>;
}

function ProjectRiskChart({ projects, selectedProject, onSelect }: { projects: DashboardVisuals["projectOverview"]; selectedProject: string | null; onSelect: (project: string) => void }) {
  const [active, setActive] = useState(projects[0]?.code ?? "");
  const max = Math.max(...projects.map((project) => project.active), 1);
  const selected = projects.find((project) => project.code === active) ?? projects[0];
  if (!projects.length) return <ManagementChart title="Project Overview" subtitle="Active POs and management exceptions" detail="No active project exposure available."><p className="chart-empty">No project data yet.</p></ManagementChart>;
  const bondIssues = selected.missingPB + selected.expiringPB + selected.missingWB + selected.expiringWB;
  return <ManagementChart title="Project Overview" subtitle="Click a project to filter the dashboard" detail={<><strong>{selected.code}: {selected.active} active PO{selected.active === 1 ? "" : "s"}</strong><span>{selected.delayed} delayed · {selected.due} due soon · {bondIssues} bond exception{bondIssues === 1 ? "" : "s"} · {valueText(selected.values)}</span></>}><div className="hbar-chart">{projects.slice(0, 7).map((project) => { const risks = project.delayed + project.due + project.missingPB + project.expiringPB + project.missingWB + project.expiringWB; return <button key={project.code} type="button" className={`hbar-row${active === project.code ? " active" : ""}${selectedProject === project.code ? " selected" : ""}`} onMouseEnter={() => setActive(project.code)} onFocus={() => setActive(project.code)} onClick={() => { setActive(project.code); onSelect(project.code); }}><span>{project.code}</span><i><b style={{ width: `${(project.active / max) * 100}%` }} /><em style={{ width: `${(risks / max) * 100}%` }} /></i><strong>{project.active}</strong></button>; })}</div></ManagementChart>;
}

function VendorDelayChart({ vendors }: { vendors: DashboardVisuals["vendorDelays"] }) {
  const [active, setActive] = useState(vendors[0]?.vendor ?? "");
  const max = Math.max(...vendors.map((vendor) => vendor.count), 1);
  const selected = vendors.find((vendor) => vendor.vendor === active) ?? vendors[0];
  if (!vendors.length) return <ManagementChart title="Supplier delay exposure" subtitle="Suppliers with delayed active deliveries" detail="No supplier delay exposure."><p className="chart-empty">No delayed supplier delivery.</p></ManagementChart>;
  return <ManagementChart title="Supplier delay exposure" subtitle="Highest delayed PO count first" detail={<><strong>{selected.vendor}: {selected.count} delayed PO{selected.count === 1 ? "" : "s"}</strong><span>Maximum {selected.maxDays} days overdue · committed value {valueText(selected.values)}</span></>}><div className="hbar-chart vendor-chart">{vendors.map((vendor) => <button key={vendor.vendor} type="button" className={`hbar-row${active === vendor.vendor ? " active" : ""}`} onMouseEnter={() => setActive(vendor.vendor)} onFocus={() => setActive(vendor.vendor)} onClick={() => setActive(vendor.vendor)}><span>{vendor.vendor}</span><i><b style={{ width: `${(vendor.count / max) * 100}%` }} /></i><strong>{vendor.count}</strong></button>)}</div></ManagementChart>;
}

function CategoryExposureChart({ categories }: { categories: DashboardVisuals["categoryExposure"] }) {
  const [active, setActive] = useState(categories[0]?.group ?? "");
  const max = Math.max(...categories.map((category) => category.poCount), 1);
  const selected = categories.find((category) => category.group === active) ?? categories[0];
  if (!categories.length) return <ManagementChart title="Category exposure" subtitle="Active PO volume by purchasing group" detail="No purchasing-group exposure."><p className="chart-empty">No category data yet.</p></ManagementChart>;
  return <ManagementChart title="Category exposure" subtitle="Active PO volume by purchasing group" detail={<><strong>{selected.group}: {selected.poCount} active PO{selected.poCount === 1 ? "" : "s"}</strong><span>Committed value {valueText(selected.values)}</span></>}><div className="hbar-chart category-chart">{categories.map((category) => <button key={category.group} type="button" className={`hbar-row${active === category.group ? " active" : ""}`} onMouseEnter={() => setActive(category.group)} onFocus={() => setActive(category.group)} onClick={() => setActive(category.group)}><span>{category.group}</span><i><b style={{ width: `${(category.poCount / max) * 100}%` }} /></i><strong>{category.poCount}</strong></button>)}</div></ManagementChart>;
}

function ManagementChart({ title, subtitle, detail, children }: { title: string; subtitle: string; detail: React.ReactNode; children: React.ReactNode }) { return <section className="management-chart"><div className="management-chart-heading"><h3>{title}</h3><p>{subtitle}</p></div>{children}<div className="chart-detail" role="status">{detail}</div></section>; }
