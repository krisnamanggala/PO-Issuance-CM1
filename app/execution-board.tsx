"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  deliveryUpdateStatuses, latestDeliveryUpdates, milestoneDueDays, milestoneNames, milestoneStatuses, paymentFacilities,
  type DeliveryUpdateRecord, type PaymentMilestoneRecord, type POServiceRecord,
} from "./lib/execution";
import { currencyCodes, type PORecord } from "./lib/po";
import { latestRevisions } from "./lib/status";

type Payload = { deliveryUpdates: DeliveryUpdateRecord[]; milestones: PaymentMilestoneRecord[]; services: POServiceRecord[] };
type FormKind = "delivery-update" | "payment-milestone" | null;

function money(value: string | number, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-US")}`; }
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function totalsByCurrency(items: PaymentMilestoneRecord[]) {
  return items.reduce<Record<string, number>>((totals, item) => {
    totals[item.currencyCode] = (totals[item.currencyCode] ?? 0) + Number(item.amount || 0);
    return totals;
  }, {});
}

function CurrencyLines({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values);
  return <div className="currency-lines">{entries.length ? entries.map(([currency, value]) => <span key={currency}>{money(value, currency)}</span>) : <span>—</span>}</div>;
}

export default function ExecutionBoard() {
  const [data, setData] = useState<Payload>({ deliveryUpdates: [], milestones: [], services: [] });
  const [pos, setPos] = useState<PORecord[]>([]);
  const [form, setForm] = useState<FormKind>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [executionResponse, poResponse] = await Promise.all([fetch("/api/execution", { cache: "no-store" }), fetch("/api/pos", { cache: "no-store" })]);
      const execution = await executionResponse.json() as Payload & { error?: string };
      const po = await poResponse.json() as { records?: PORecord[]; error?: string };
      if (!executionResponse.ok) throw new Error(execution.error ?? "Unable to load delivery and cash data.");
      if (!poResponse.ok) throw new Error(po.error ?? "Unable to load PO records.");
      setData(execution); setPos(po.records ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load delivery and cash data."); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const currentPos = useMemo(() => latestRevisions(pos), [pos]);
  const latestMap = useMemo(() => latestDeliveryUpdates(data.deliveryUpdates), [data.deliveryUpdates]);
  const latest = useMemo(() => currentPos.map((po) => ({ po, update: latestMap.get(po.id) ?? null })), [currentPos, latestMap]);
  const unpaid = useMemo(() => data.milestones.filter((item) => item.milestoneStatus !== "paid"), [data.milestones]);
  const deliveryRisks = latest.filter(({ po, update }) => {
    const forecast = update?.forecastEta ?? po.etaRosAtSite;
    return !["completed", "cancelled"].includes(update?.deliveryStatus ?? "") && forecast < new Date().toISOString().slice(0, 10);
  });
  const serviceCost = data.services.filter((item) => item.included).reduce((sum, item) => sum + Number(item.costIdr ?? 0), 0);

  async function updateMilestoneStatus(item: PaymentMilestoneRecord, milestoneStatus: string) {
    let actualPaymentDate = item.actualPaymentDate;
    if (milestoneStatus === "paid" && !actualPaymentDate) {
      actualPaymentDate = window.prompt("Actual payment date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
      if (!actualPaymentDate) return;
    }
    setSaving(item.id); setError("");
    try {
      const response = await fetch("/api/execution", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, milestoneStatus, actualPaymentDate }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to update the milestone.");
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update the milestone."); }
    finally { setSaving(null); }
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll(ids: number[], checked: boolean) {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }

  async function markSelectedPaid(paid: boolean) {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkSaving(true); setError("");
    const today = new Date().toISOString().slice(0, 10);
    try {
      for (const id of ids) {
        const body = paid
          ? { id, milestoneStatus: "paid", actualPaymentDate: today }
          : { id, milestoneStatus: "planned", actualPaymentDate: "" };
        const response = await fetch("/api/execution", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok) { const payload = await response.json() as { error?: string }; throw new Error(payload.error ?? "Unable to update the milestone."); }
      }
      setSelectedIds(new Set());
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update the milestones."); }
    finally { setBulkSaving(false); }
  }

  return <>
    <section className="page-header"><div><p className="eyebrow">Execution control</p><h1>Delivery & Cash</h1><p>Track delivery forecasts separately from contract dates and convert payment terms into reportable cash milestones.</p></div><div className="page-actions"><button className="button button-quiet" onClick={() => setForm("delivery-update")}>Add delivery update</button><button className="button button-primary" onClick={() => setForm("payment-milestone")}>+ Add milestone</button></div></section>
    {error && <div className="notice" role="alert">{error}<button className="text-button" onClick={() => void refresh()}>Retry</button></div>}
    <section className="dashboard-kpis execution-kpis" aria-label="Delivery and cash indicators">
      <article className="dashboard-kpi critical"><span>Past delivery forecast</span><strong>{deliveryRisks.length}</strong><small>Open POs past latest forecast or contract ETA</small></article>
      <article className="dashboard-kpi neutral"><span>Unpaid milestones</span><strong>{unpaid.length}</strong><small><CurrencyLines values={totalsByCurrency(unpaid)} /></small></article>
      <article className="dashboard-kpi neutral"><span>Recorded delivery updates</span><strong>{data.deliveryUpdates.length}</strong><small>Append-only execution snapshots</small></article>
      <article className="dashboard-kpi neutral"><span>Included service cost</span><strong>{money(serviceCost, "IDR")}</strong><small>Normalized service commitments</small></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Latest delivery position</h2><p>One latest execution update per current PO revision; the contractual ETA remains visible.</p></div></div>{loading ? <div className="loading-table">Loading delivery updates…</div> : latest.length ? <div className="table-scroll"><table className="action-table"><thead><tr><th>PO / vendor</th><th>Contract ETA</th><th>Forecast ETA</th><th>Status</th><th>Progress</th><th>Actual ROS</th><th>Last update</th></tr></thead><tbody>{latest.map(({ po, update }) => <tr key={po.id}><td><strong>{po.projectCode ? `${po.projectCode}-` : ""}{po.purchasingGroup}-{po.poNumber} Rev.{po.revisionNumber}</strong><span>{po.vendorName}</span></td><td>{date(po.etaRosAtSite)}</td><td>{date(update?.forecastEta ?? null)}</td><td><span className={`status-badge status-${update?.deliveryStatus ?? "n/a"}`}>{update?.deliveryStatus?.replaceAll("-", " ") ?? "No update"}</span></td><td>{update ? `${update.progressPercent}%` : "—"}</td><td>{date(update?.actualRosDate ?? null)}</td><td>{date(update?.updateDate ?? null)}</td></tr>)}</tbody></table></div> : <Empty title="No PO execution records yet." copy="Create a PO first, then add delivery updates without changing its contractual schedule." />}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Payment milestones</h2><p>Amounts derive from PO value × percentage. Select milestones to mark paid or unpaid per PO sequence.</p></div><div className="page-actions"><button className="button button-quiet" type="button" disabled={!selectedIds.size || bulkSaving} onClick={() => void markSelectedPaid(true)}>{bulkSaving ? "Saving…" : `Mark paid${selectedIds.size ? ` (${selectedIds.size})` : ""}`}</button><button className="button button-quiet" type="button" disabled={!selectedIds.size || bulkSaving} onClick={() => void markSelectedPaid(false)}>Mark unpaid</button></div></div>{loading ? <div className="loading-table">Loading payment milestones…</div> : data.milestones.length ? (() => { const milestoneIds = data.milestones.map((item) => item.id); const allSelected = milestoneIds.length > 0 && milestoneIds.every((id) => selectedIds.has(id)); return <div className="table-scroll"><table className="action-table"><thead><tr><th><input type="checkbox" aria-label="Select all milestones" checked={allSelected} onChange={(event) => toggleSelectAll(milestoneIds, event.target.checked)} /></th><th>PO / milestone</th><th>Facility</th><th>Share</th><th>Amount</th><th>Due date</th><th>Actual paid</th><th>Paid?</th><th>Status</th></tr></thead><tbody>{data.milestones.map((item) => <tr key={item.id} className={item.milestoneStatus === "paid" ? "is-paid" : ""}><td><input type="checkbox" aria-label={`Select milestone ${item.sequenceNo} for ${item.poNumber}`} checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} /></td><td><strong>{item.poNumber} · {item.sequenceNo}. {item.milestoneName}</strong><span>{item.vendorName}</span></td><td>{item.paymentFacility ?? "—"}</td><td>{item.percentage === null ? "—" : `${Number(item.percentage).toLocaleString("en-US")}%`}</td><td>{money(item.amount, item.currencyCode)}</td><td>{item.dueDateDays ? `${item.dueDateDays} days` : "—"}</td><td>{date(item.actualPaymentDate)}</td><td><span className={`status-badge status-${item.milestoneStatus === "paid" ? "paid" : "unpaid"}`}>{item.milestoneStatus === "paid" ? "Paid" : "Unpaid"}</span></td><td><select aria-label={`Status for ${item.milestoneName}`} value={item.milestoneStatus} disabled={saving === item.id || bulkSaving} onChange={(event) => void updateMilestoneStatus(item, event.target.value)}>{milestoneStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>; })() : <Empty title="No structured payment milestones yet." copy="Add the first milestone to turn payment terms into an actionable cash forecast." />}</section>
    {form === "delivery-update" && <DeliveryForm pos={currentPos} onClose={() => setForm(null)} onSaved={refresh} />}
    {form === "payment-milestone" && <MilestoneForm pos={currentPos} onClose={() => setForm(null)} onSaved={refresh} />}
  </>;
}

function Empty({ title, copy }: { title: string; copy: string }) { return <div className="empty-state"><h3>{title}</h3><p>{copy}</p></div>; }
function Input({ label, name, type = "text", required = false, min, max, step }: { label: string; name: string; type?: string; required?: boolean; min?: string; max?: string; step?: string }) { return <label className="form-field"><span>{label}</span><input name={name} type={type} required={required} min={min} max={max} step={step} /></label>; }
function POSelect({ pos }: { pos: PORecord[] }) { return <label className="form-field"><span>PO No.</span><select name="poRevisionId" required><option value="">Choose current PO revision</option>{pos.map((po) => <option key={po.id} value={po.id}>{po.poNumber} · Rev. {po.revisionNumber} · {po.vendorName}</option>)}</select></label>; }

function DeliveryForm({ pos, onClose, onSaved }: { pos: PORecord[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { const body = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch("/api/execution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "delivery-update", ...body }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Unable to save delivery update."); await onSaved(); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save delivery update."); } finally { setSaving(false); } }
  return <div className="modal-backdrop"><section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-form-title"><div className="dialog-top"><div><p className="eyebrow">Execution snapshot</p><h2 id="delivery-form-title">Add delivery update</h2><p>The contractual ETA is not changed by this update.</p></div><button className="icon-button" onClick={onClose}>×</button></div><form onSubmit={submit}><fieldset><legend>Delivery position</legend><div className="form-grid"><POSelect pos={pos} /><Input label="Update date" name="updateDate" type="date" required /><label className="form-field"><span>Status</span><select name="deliveryStatus" defaultValue="not-started">{deliveryUpdateStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("-", " ")}</option>)}</select></label><Input label="Progress (%)" name="progressPercent" type="number" min="0" max="100" step="0.01" required /><Input label="Forecast ETA" name="forecastEta" type="date" /><Input label="Actual ROS date" name="actualRosDate" type="date" /><Input label="Delay reason" name="delayReason" /></div></fieldset><label className="textarea-field"><span>Remarks</span><textarea name="remarks" rows={3} /></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save update"}</button></div></form></section></div>;
}

function MilestoneForm({ pos, onClose, onSaved }: { pos: PORecord[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({ poRevisionId: "", sequenceNo: "1", milestoneName: "", paymentFacility: "", dueDateDays: "", percentage: "", currencyCode: "IDR", remarks: "" });
  function set<K extends keyof typeof values>(key: K, value: string) { setValues((current) => ({ ...current, [key]: value })); }
  function choosePo(id: string) { const po = pos.find((item) => String(item.id) === id); setValues((current) => ({ ...current, poRevisionId: id, currencyCode: po?.currencyCode ?? current.currencyCode })); }

  const selectedPo = pos.find((item) => String(item.id) === values.poRevisionId) ?? null;
  const currency = selectedPo?.currencyCode ?? values.currencyCode;
  const poValue = selectedPo ? Number(selectedPo.contractValue) : null;
  const pct = values.percentage === "" ? null : Number(values.percentage);
  const amount = poValue !== null && pct !== null && Number.isFinite(poValue) && Number.isFinite(pct) ? Number((poValue * pct / 100).toFixed(2)) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const body = { kind: "payment-milestone", poRevisionId: values.poRevisionId, sequenceNo: values.sequenceNo, milestoneName: values.milestoneName, paymentFacility: values.paymentFacility, dueDateDays: values.dueDateDays, percentage: values.percentage, amount: amount === null ? "" : String(amount), currencyCode: currency, remarks: values.remarks };
      const response = await fetch("/api/execution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save payment milestone.");
      await onSaved(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save payment milestone."); } finally { setSaving(false); }
  }

  return <div className="modal-backdrop"><section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="milestone-form-title"><div className="dialog-top"><div><p className="eyebrow">Cash commitment</p><h2 id="milestone-form-title">Add payment milestone</h2><p>The amount is calculated from the PO value and the percentage; no FX conversion is assumed.</p></div><button className="icon-button" onClick={onClose}>×</button></div><form onSubmit={submit}><fieldset><legend>Milestone identity & value</legend><div className="form-grid"><label className="form-field"><span>PO No.</span><select value={values.poRevisionId} onChange={(event) => choosePo(event.target.value)} required><option value="">Choose current PO revision</option>{pos.map((po) => <option key={po.id} value={po.id}>{po.poNumber} · Rev. {po.revisionNumber} · {po.vendorName}</option>)}</select></label><label className="form-field"><span>Sequence</span><input type="number" min="1" step="1" value={values.sequenceNo} onChange={(event) => set("sequenceNo", event.target.value)} required /></label><label className="form-field"><span>Milestone name</span><select value={values.milestoneName} onChange={(event) => set("milestoneName", event.target.value)} required><option value="" disabled>Select milestone name</option>{milestoneNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label className="form-field"><span>Payment facility</span><select value={values.paymentFacility} onChange={(event) => set("paymentFacility", event.target.value)} required><option value="" disabled>Select facility</option>{paymentFacilities.map((facility) => <option key={facility} value={facility}>{facility}</option>)}</select></label><label className="form-field"><span>Due date</span><select value={values.dueDateDays} onChange={(event) => set("dueDateDays", event.target.value)}><option value="">Select due date</option>{milestoneDueDays.map((days) => <option key={days} value={days}>{days} days</option>)}</select></label><label className="form-field"><span>Percentage (%)</span><input type="number" min="0" max="100" step="0.0001" value={values.percentage} onChange={(event) => set("percentage", event.target.value)} required /></label><label className="form-field"><span>Currency</span><select value={currency} onChange={(event) => set("currencyCode", event.target.value)} disabled={Boolean(selectedPo)}>{currencyCodes.map((code) => <option key={code} value={code}>{code}</option>)}</select></label><label className="form-field"><span>Amount (calculated)</span><input type="text" readOnly value={amount === null ? "" : money(amount, currency)} placeholder="PO value × percentage" /></label></div><p className="milestone-copy" style={{ marginTop: 10, fontSize: 11 }}>{selectedPo ? `PO value ${money(selectedPo.contractValue, currency)} × ${values.percentage || 0}% = ${amount === null ? "—" : money(amount, currency)}` : "Select a PO to calculate the amount from its contract value."}</p></fieldset><label className="textarea-field"><span>Remarks</span><textarea value={values.remarks} onChange={(event) => set("remarks", event.target.value)} rows={3} /></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save milestone"}</button></div></form></section></div>;
}
