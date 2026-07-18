"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  csvHeaders,
  incoterms,
  paymentTerms,
  POInputFields,
  PORecord,
  purchasingGroups,
  yesNoValues,
} from "./lib/po";

type MonitorProps = { user: { displayName: string; email: string } };
type EditorState = { mode: "create" | "edit" | "revision"; record?: PORecord } | null;
type BondFilter = "all" | "required" | "notApplicable";
type EtaFilter = "all" | "past" | "next30" | "later";
type SortOrder = "released" | "eta" | "po";

const blankForm: POInputFields = {
  poNumber: "", revisionNumber: "0", releasedDate: "", purchasingGroup: "ELE",
  location: "", equipmentName: "", vendorName: "", budget: "", contractValue: "",
  deliveryLeadTimeWeeks: "", incoterm: "", etaRosAtSite: "", termOfPayment: "T/T",
  milestoneDetails: "", pb: "No", pbValidity: "N/A", wb: "No", wbValidity: "N/A",
};

function toForm(record: PORecord): POInputFields {
  return {
    poNumber: record.poNumber, revisionNumber: String(record.revisionNumber), releasedDate: record.releasedDate,
    purchasingGroup: record.purchasingGroup, location: record.location, equipmentName: record.equipmentName, vendorName: record.vendorName,
    budget: record.budget, contractValue: record.contractValue, deliveryLeadTimeWeeks: String(record.deliveryLeadTimeWeeks),
    incoterm: record.incoterm, etaRosAtSite: record.etaRosAtSite, termOfPayment: record.termOfPayment,
    milestoneDetails: record.milestoneDetails, pb: record.pb ? "Yes" : "No", pbValidity: record.pbValidity,
    wb: record.wb ? "Yes" : "No", wbValidity: record.wbValidity,
  };
}

function asRevision(record: PORecord): POInputFields {
  return { ...toForm(record), revisionNumber: String(record.revisionNumber + 1) };
}

function formatMoney(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatBondDate(value: string) {
  if (!value || value === "N/A") return "N/A";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function isoToday() { return new Date().toISOString().slice(0, 10); }
function daysUntil(value: string) { return Math.round((new Date(`${value}T00:00:00Z`).valueOf() - new Date(`${isoToday()}T00:00:00Z`).valueOf()) / 86_400_000); }
function etaKind(record: PORecord): "past" | "next30" | "later" { const days = daysUntil(record.etaRosAtSite); return days < 0 ? "past" : days <= 30 ? "next30" : "later"; }
function etaLabel(record: PORecord) { const kind = etaKind(record); return kind === "past" ? "Past ETA" : kind === "next30" ? "Next 30 days" : "Scheduled"; }

function latestOnly(records: PORecord[]) {
  const byPo = new Map<string, PORecord>();
  records.forEach((record) => {
    const known = byPo.get(record.poNumber);
    if (!known || record.revisionNumber > known.revisionNumber || (record.revisionNumber === known.revisionNumber && record.id > known.id)) byPo.set(record.poNumber, record);
  });
  return [...byPo.values()];
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([`${csvHeaders.join(",")}\n`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "po-issuance-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function POMonitor({ user }: MonitorProps) {
  const [records, setRecords] = useState<PORecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [payment, setPayment] = useState("all");
  const [bondFilter, setBondFilter] = useState<BondFilter>("all");
  const [eta, setEta] = useState<EtaFilter>("all");
  const [sort, setSort] = useState<SortOrder>("released");
  const [view, setView] = useState<"current" | "history">("current");
  const [selected, setSelected] = useState<PORecord | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/pos", { cache: "no-store" });
      const payload = (await response.json()) as { records?: PORecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load the PO register.");
      setRecords(payload.records ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load the PO register.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/pos", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { records?: PORecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load the PO register.");
        if (active) setRecords(payload.records ?? []);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load the PO register.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const currentRecords = useMemo(() => latestOnly(records), [records]);
  const displayedRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const source = view === "current" ? currentRecords : records;
    return source.filter((record) => {
      const matchesSearch = !normalizedQuery || [record.poNumber, record.location, record.equipmentName, record.vendorName, record.incoterm].join(" ").toLowerCase().includes(normalizedQuery);
      const matchesGroup = group === "all" || record.purchasingGroup === group;
      const matchesPayment = payment === "all" || record.termOfPayment === payment;
      const matchesBonds = bondFilter === "all" || (bondFilter === "required" ? record.pb || record.wb : !record.pb && !record.wb);
      const matchesEta = eta === "all" || etaKind(record) === eta;
      return matchesSearch && matchesGroup && matchesPayment && matchesBonds && matchesEta;
    }).sort((a, b) => {
      if (sort === "po") return a.poNumber.localeCompare(b.poNumber) || b.revisionNumber - a.revisionNumber;
      if (sort === "eta") return a.etaRosAtSite.localeCompare(b.etaRosAtSite);
      return b.releasedDate.localeCompare(a.releasedDate) || b.revisionNumber - a.revisionNumber;
    });
  }, [bondFilter, currentRecords, eta, group, payment, query, records, sort, view]);

  const metrics = useMemo(() => ({
    total: currentRecords.length,
    past: currentRecords.filter((record) => etaKind(record) === "past").length,
    next30: currentRecords.filter((record) => etaKind(record) === "next30").length,
    averageLeadTime: currentRecords.length
      ? Math.round(currentRecords.reduce((sum, record) => sum + record.deliveryLeadTimeWeeks, 0) / currentRecords.length)
      : 0,
  }), [currentRecords]);

  const selectedHistory = useMemo(() => selected ? records.filter((record) => record.poNumber === selected.poNumber).sort((a, b) => b.revisionNumber - a.revisionNumber) : [], [records, selected]);

  async function saveRecord(values: POInputFields, mode: "create" | "edit" | "revision", id?: number) {
    const response = await fetch(mode === "edit" && id ? `/api/pos/${id}` : "/api/pos", {
      method: mode === "edit" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { record?: PORecord; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Unable to save the PO record.");
    await refresh();
    if (payload.record) setSelected(payload.record);
    setNotice(mode === "revision" ? "New revision saved. Earlier issuance records remain preserved." : "PO record saved.");
  }

  return <main className="monitor-shell">
    <header className="topbar">
      <a className="brand" href="#dashboard" aria-label="TPEC CM1 PO Monitoring dashboard"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span><b>TPEC CM1</b><em>PO MONITORING</em></span></a>
      <div className="topbar-meta"><span className="workspace-status"><i /> Workspace register</span><span className="user-chip" title={user.email}>{user.displayName}</span><form action="/sign-out" method="post"><button className="sign-out" type="submit">Sign out</button></form></div>
    </header>
    <section id="dashboard" className="dashboard">
      <div className="heading-row"><div><p className="eyebrow">SCM Category Management 1</p><h1>TPEC CM1 PO Monitoring</h1><p className="heading-copy">One trusted view of each purchase order release, revision, delivery schedule, payment-term milestone, and contractual bond.</p></div><div className="header-actions"><button className="button button-quiet" type="button" onClick={downloadTemplate}>Download CSV template</button><button className="button button-quiet" type="button" onClick={() => setShowImport(true)}>Import CSV</button><button className="button button-primary" type="button" onClick={() => setEditor({ mode: "create" })}><span aria-hidden="true">+</span> New PO</button></div></div>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
      <section className="metric-grid" aria-label="PO schedule overview"><Metric title="Active POs" value={metrics.total} detail="Latest revision per PO" accent="blue" /><Metric title="Past ETA ROS" value={metrics.past} detail="Date is already past" accent="orange" /><Metric title="ETA within 30 days" value={metrics.next30} detail="Next delivery window" accent="yellow" /><Metric title="Average lead time" value={`${metrics.averageLeadTime} wk`} detail="Across current revisions" accent="red" /></section>
      <section className="register-card" aria-label="PO register">
        <div className="register-heading"><div><p className="eyebrow">Register</p><h2>Issuance monitoring</h2></div><div className="view-switch" role="group" aria-label="Revision view"><button className={view === "current" ? "selected" : ""} onClick={() => setView("current")}>Current revisions</button><button className={view === "history" ? "selected" : ""} onClick={() => setView("history")}>All revisions</button></div></div>
        <div className="filters"><label className="search-field"><span className="sr-only">Search POs</span><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PO, equipment, vendor…" /></label><FilterSelect label="Purchasing group" value={group} onChange={setGroup} options={["all", ...purchasingGroups]} /><FilterSelect label="Payment term" value={payment} onChange={setPayment} options={["all", ...paymentTerms]} /><FilterSelect label="Bond requirement" value={bondFilter} onChange={(value) => setBondFilter(value as BondFilter)} options={["all", "required", "notApplicable"]} /><FilterSelect label="ETA timing" value={eta} onChange={(value) => setEta(value as EtaFilter)} options={["all", "past", "next30", "later"]} /><FilterSelect label="Sort records" value={sort} onChange={(value) => setSort(value as SortOrder)} options={["released", "eta", "po"]} /></div>
        {loadError ? <div className="error-state" role="alert"><strong>Register unavailable.</strong><p>{loadError}</p><button className="button button-quiet" onClick={() => void refresh()}>Try again</button></div> : loading ? <div className="loading-table" aria-live="polite">Loading the shared register…</div> : displayedRecords.length ? <div className="table-wrap"><table><thead><tr><th>PO / rev.</th><th>Equipment & vendor</th><th>Group</th><th>Released</th><th>Contract value</th><th>ETA ROS at site</th><th>Bonds</th><th><span className="sr-only">Open details</span></th></tr></thead><tbody>{displayedRecords.map((record) => <tr key={record.id} className={selected?.id === record.id ? "active-row" : ""}><td><strong className="po-number">{record.poNumber}</strong><span className="subline">Revision {record.revisionNumber}</span></td><td><strong>{record.equipmentName}</strong><span className="subline">{record.vendorName}</span></td><td><span className={`group-pill group-${record.purchasingGroup.toLowerCase()}`}>{record.purchasingGroup}</span></td><td>{formatDate(record.releasedDate)}</td><td className="money">{formatMoney(record.contractValue)}</td><td><span className={`eta-chip eta-${etaKind(record)}`}>{etaLabel(record)}</span><span className="subline">{formatDate(record.etaRosAtSite)}</span></td><td><BondStatus record={record} /></td><td><button type="button" className="row-action" onClick={() => setSelected(record)} aria-label={`Open ${record.poNumber} revision ${record.revisionNumber}`}>Open <span aria-hidden="true">→</span></button></td></tr>)}</tbody></table></div> : <EmptyState hasFilters={Boolean(query || group !== "all" || payment !== "all" || bondFilter !== "all" || eta !== "all")} onNew={() => setEditor({ mode: "create" })} onImport={() => setShowImport(true)} />}
        <footer className="table-footer"><span>{displayedRecords.length} {view === "current" ? "current PO record" : "revision record"}{displayedRecords.length === 1 ? "" : "s"}</span><span>Amounts shown in IDR</span></footer>
      </section>
    </section>
    {selected && <DetailDrawer record={selected} history={selectedHistory} onClose={() => setSelected(null)} onEdit={() => setEditor({ mode: "edit", record: selected })} onRevision={() => setEditor({ mode: "revision", record: selected })} onSelectRevision={setSelected} />}
    {editor && <EditorDialog key={`${editor.mode}-${editor.record?.id ?? "new"}`} state={editor} onClose={() => setEditor(null)} onSave={saveRecord} />}
    {showImport && <ImportDialog onClose={() => setShowImport(false)} onImported={async (count) => { await refresh(); setShowImport(false); setNotice(`${count} PO ${count === 1 ? "record" : "records"} imported into the shared register.`); }} />}
  </main>;
}

function Metric({ title, value, detail, accent }: { title: string; value: string | number; detail: string; accent: string }) { return <article className={`metric-card metric-${accent}`}><div><p>{title}</p><strong>{value}</strong><span>{detail}</span></div><span className="metric-mark" aria-hidden="true" /></article>; }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) { const optionLabel: Record<string, string> = { all: label, required: "Any bond required", notApplicable: "No bond required", past: "Past ETA", next30: "Next 30 days", later: "Beyond 30 days", released: "Latest release", eta: "ETA ROS", po: "PO number" }; return <label className="select-field"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{optionLabel[option] ?? option}</option>)}</select></label>; }
function BondStatus({ record }: { record: PORecord }) { return <div className="bond-status"><span className={record.pb ? "yes" : "na"} title={record.pb ? `Performance Bond validity: ${record.pbValidity}` : "Performance Bond validity: N/A"}>PB {record.pb ? "Yes" : "No"}</span><span className={record.wb ? "yes" : "na"} title={record.wb ? `Warranty Bond validity: ${record.wbValidity}` : "Warranty Bond validity: N/A"}>WB {record.wb ? "Yes" : "No"}</span></div>; }
function EmptyState({ hasFilters, onNew, onImport }: { hasFilters: boolean; onNew: () => void; onImport: () => void }) { if (hasFilters) return <div className="empty-state"><h3>No matching PO records</h3><p>Adjust the filters or search terms to see other releases.</p></div>; return <div className="empty-state empty-onboarding"><span className="empty-icon" aria-hidden="true">+</span><p className="eyebrow">Shared register ready</p><h3>Start with the first PO release</h3><p>Use a single-record form or import your approved CSV register. Every revision will remain traceable here.</p><div><button className="button button-primary" onClick={onNew}>Add first PO</button><button className="button button-quiet" onClick={onImport}>Import CSV</button></div></div>; }

function DetailDrawer({ record, history, onClose, onEdit, onRevision, onSelectRevision }: { record: PORecord; history: PORecord[]; onClose: () => void; onEdit: () => void; onRevision: () => void; onSelectRevision: (record: PORecord) => void }) { return <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`PO ${record.poNumber} details`}><div className="drawer-top"><div><p className="eyebrow">PO record</p><h2>{record.poNumber}<span>Revision {record.revisionNumber}</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close PO details">×</button></div><div className="drawer-actions"><button className="button button-quiet" onClick={onEdit}>Edit revision</button><button className="button button-primary" onClick={onRevision}>New revision</button></div><section className="drawer-section"><div className="drawer-label"><span>Delivery schedule</span><b className={`eta-chip eta-${etaKind(record)}`}>{etaLabel(record)}</b></div><dl className="detail-grid"><Detail label="Incoterm" value={record.incoterm} /><Detail label="Incoterm location" value={record.location} /><Detail label="ETA ROS at site" value={formatDate(record.etaRosAtSite)} /><Detail label="Lead time" value={`${record.deliveryLeadTimeWeeks} weeks`} /></dl></section><section className="drawer-section"><p className="section-title">Contractual bonds</p><dl className="detail-grid"><Detail label="Performance Bond (PB)" value={record.pb ? "Yes" : "No"} /><Detail label="PB validity" value={record.pb ? formatBondDate(record.pbValidity) : "N/A"} /><Detail label="Warranty Bond (WB)" value={record.wb ? "Yes" : "No"} /><Detail label="WB validity" value={record.wb ? formatBondDate(record.wbValidity) : "N/A"} /></dl></section><section className="drawer-section"><p className="section-title">Release & commercial</p><dl className="detail-grid"><Detail label="Released date" value={formatDate(record.releasedDate)} /><Detail label="Purchasing group" value={<span className={`group-pill group-${record.purchasingGroup.toLowerCase()}`}>{record.purchasingGroup}</span>} /><Detail label="Budget" value={formatMoney(record.budget)} /><Detail label="Contract value" value={formatMoney(record.contractValue)} /><Detail label="Term of payment" value={record.termOfPayment} /></dl></section><section className="drawer-section"><p className="section-title">Scope & payment-term milestones</p><dl className="detail-grid"><Detail label="Equipment" value={record.equipmentName} /><Detail label="Vendor" value={record.vendorName} /></dl><p className="milestone-copy">{record.milestoneDetails || "No payment-term milestones added."}</p></section><section className="drawer-section history-section"><div className="history-heading"><p className="section-title">Revision history</p><span>{history.length} retained</span></div>{history.map((item) => <button className={item.id === record.id ? "history-row current" : "history-row"} key={item.id} onClick={() => onSelectRevision(item)}><span><b>Revision {item.revisionNumber}</b><small>Released {formatDate(item.releasedDate)}</small></span><span>{item.id === record.id ? "Viewing" : "Open →"}</span></button>)}</section></aside>; }
function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function EditorDialog({ state, onClose, onSave }: { state: NonNullable<EditorState>; onClose: () => void; onSave: (values: POInputFields, mode: "create" | "edit" | "revision", id?: number) => Promise<void> }) {
  const initial = state.mode === "revision" && state.record ? asRevision(state.record) : state.record ? toForm(state.record) : blankForm;
  const [values, setValues] = useState<POInputFields>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = state.mode === "edit";
  const title = state.mode === "create" ? "Add PO issuance" : state.mode === "revision" ? "Create new PO revision" : "Edit PO revision";
  function update<K extends keyof POInputFields>(key: K, value: POInputFields[K]) { setValues((current) => ({ ...current, [key]: value })); }
  function updateBond(kind: "pb" | "wb", value: string) { setValues((current) => ({ ...current, [kind]: value, [kind === "pb" ? "pbValidity" : "wbValidity"]: value === "Yes" ? "" : "N/A" })); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { await onSave(values, state.mode, state.record?.id); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save the PO record."); } finally { setSaving(false); } }
  return <div className="modal-backdrop" role="presentation"><section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="dialog-top"><div><p className="eyebrow">Shared issuance register</p><h2 id="editor-title">{title}</h2>{state.mode === "revision" && <p>Revision {values.revisionNumber} is copied from the selected PO; the earlier issuance will remain intact.</p>}</div><button className="icon-button" type="button" onClick={onClose} aria-label="Close form">×</button></div><form onSubmit={submit}><fieldset><legend>Identity & release</legend><div className="form-grid"><Field label="PO No." value={values.poNumber} onChange={(value) => update("poNumber", value)} disabled={isEdit} required /><Field label="Revision number" type="number" min="0" value={values.revisionNumber} onChange={(value) => update("revisionNumber", value)} disabled={isEdit} required /><Field label="Released date" type="date" value={values.releasedDate} onChange={(value) => update("releasedDate", value)} required /><SelectField label="Purchasing group" value={values.purchasingGroup} onChange={(value) => update("purchasingGroup", value)} options={purchasingGroups} /><Field label="Equipment name" value={values.equipmentName} onChange={(value) => update("equipmentName", value)} required /><Field label="Vendor name" value={values.vendorName} onChange={(value) => update("vendorName", value)} required /></div></fieldset><fieldset><legend>Commercial terms</legend><div className="form-grid"><Field label="Budget (IDR)" type="number" min="0" step="0.01" value={values.budget} onChange={(value) => update("budget", value)} required /><Field label="Contract value (IDR)" type="number" min="0" step="0.01" value={values.contractValue} onChange={(value) => update("contractValue", value)} required /><SelectField label="Term of payment" value={values.termOfPayment} onChange={(value) => update("termOfPayment", value)} options={paymentTerms} /></div></fieldset><fieldset><legend>Delivery schedule</legend><div className="form-grid"><IncotermSelect value={values.incoterm} onChange={(value) => update("incoterm", value)} /><Field label="Incoterm location" value={values.location} onChange={(value) => update("location", value)} placeholder="e.g. Jakarta" required /><Field label="Delivery lead time (weeks)" type="number" min="0" step="1" value={values.deliveryLeadTimeWeeks} onChange={(value) => update("deliveryLeadTimeWeeks", value)} required /><Field label="ETA ROS at site" type="date" value={values.etaRosAtSite} onChange={(value) => update("etaRosAtSite", value)} required /></div></fieldset><fieldset><legend>Payment-term milestones</legend><label className="textarea-field"><span>Milestone details</span><textarea value={values.milestoneDetails} onChange={(event) => update("milestoneDetails", event.target.value)} rows={4} placeholder="e.g. 30% advance payment on PO release; 70% after acceptance" /></label></fieldset><fieldset><legend>Contractual bonds</legend><div className="form-grid"><SelectField label="Performance Bond (PB)" value={String(values.pb)} onChange={(value) => updateBond("pb", value)} options={yesNoValues} /><ValidityField label="PB validity" value={values.pbValidity} onChange={(value) => update("pbValidity", value)} applicable={values.pb === "Yes"} /><SelectField label="Warranty Bond (WB)" value={String(values.wb)} onChange={(value) => updateBond("wb", value)} options={yesNoValues} /><ValidityField label="WB validity" value={values.wbValidity} onChange={(value) => update("wbValidity", value)} applicable={values.wb === "Yes"} /></div></fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button disabled={saving} className="button button-primary" type="submit">{saving ? "Saving…" : state.mode === "revision" ? "Save new revision" : "Save PO record"}</button></div></form></section></div>;
}
function Field({ label, value, onChange, type = "text", disabled = false, required = false, min, step, placeholder }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; disabled?: boolean; required?: boolean; min?: string; step?: string; placeholder?: string }) { return <label className="form-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} min={min} step={step} placeholder={placeholder} /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) { return <label className="form-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function IncotermSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label className="form-field"><span>Incoterm</span><select value={value} onChange={(event) => onChange(event.target.value)} required><option value="" disabled>Select Incoterm</option>{incoterms.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}</select></label>; }
function ValidityField({ label, value, onChange, applicable }: { label: string; value: string; onChange: (value: string) => void; applicable: boolean }) { const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; return <label className="form-field"><span>{label} (DD/MM/YYYY)</span><input type={applicable ? "date" : "text"} value={applicable ? dateValue : "N/A"} onChange={(event) => onChange(event.target.value)} disabled={!applicable} required={applicable} /></label>; }

function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!file) { setError("Choose a CSV file to import."); return; } setImporting(true); setError(""); setRowErrors([]); try { const formData = new FormData(); formData.append("file", file); const response = await fetch("/api/pos/import", { method: "POST", body: formData }); const payload = (await response.json()) as { imported?: number; error?: string; errors?: string[] }; if (!response.ok) { setError(payload.error ?? "Unable to import the CSV."); setRowErrors(payload.errors ?? []); return; } await onImported(payload.imported ?? 0); } catch { setError("Unable to import the CSV. Please try again."); } finally { setImporting(false); } }
  return <div className="modal-backdrop" role="presentation"><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="dialog-top"><div><p className="eyebrow">Bulk intake</p><h2 id="import-title">Import PO register</h2><p>Each row becomes a retained PO revision. Files are checked completely before anything is added.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close import">×</button></div><ol className="import-rules"><li>Use the exact template headers, including <b>location</b>, and whole weeks for delivery lead time.</li><li>Use <b>YYYY-MM-DD</b> for released and ETA dates, plain IDR amounts, and an approved Incoterm code.</li><li>Payment-term milestones belong in milestone details. For PB/WB set to Yes, use <b>DD/MM/YYYY</b> validity dates; use N/A when No.</li></ol><button type="button" className="template-link" onClick={downloadTemplate}>↓ Download empty CSV template</button><form onSubmit={submit}><input ref={fileRef} className="file-input" type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); setRowErrors([]); }} /><div className="file-choice"><span>{file ? file.name : "No CSV selected"}</span><button type="button" className="button button-quiet" onClick={() => fileRef.current?.click()}>Choose file</button></div>{error && <p className="form-error" role="alert">{error}</p>}{rowErrors.length > 0 && <ul className="import-errors">{rowErrors.slice(0, 8).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}{rowErrors.length > 8 && <li>…and {rowErrors.length - 8} more rows to fix.</li>}</ul>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={importing}>{importing ? "Checking & importing…" : "Import register"}</button></div></form></section></div>;
}
