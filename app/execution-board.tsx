"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  deliveryUpdateStatuses, latestDeliveryUpdates, milestoneStatuses,
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

  return <>
    <section className="page-header"><div><p className="eyebrow">Execution control</p><h1>Delivery & Cash</h1><p>Track delivery forecasts separately from contract dates and convert payment terms into reportable cash milestones.</p></div><div className="page-actions"><button className="button button-quiet" onClick={() => setForm("delivery-update")}>Add delivery update</button><button className="button button-primary" onClick={() => setForm("payment-milestone")}>+ Add milestone</button></div></section>
    {error && <div className="notice" role="alert">{error}<button className="text-button" onClick={() => void refresh()}>Retry</button></div>}
    <section className="dashboard-kpis execution-kpis" aria-label="Delivery and cash indicators">
      <article className="dashboard-kpi critical"><span>Past delivery forecast</span><strong>{deliveryRisks.length}</strong><small>Open POs past latest forecast or contract ETA</small></article>
      <article className="dashboard-kpi neutral"><span>Unpaid milestones</span><strong>{unpaid.length}</strong><small><CurrencyLines values={totalsByCurrency(unpaid)} /></small></article>
      <article className="dashboard-kpi neutral"><span>Recorded delivery updates</span><strong>{data.deliveryUpdates.length}</strong><small>Append-only execution snapshots</small></article>
      <article className="dashboard-kpi neutral"><span>Included service cost</span><strong>{money(serviceCost, "IDR")}</strong><small>Normalized service commitments</small></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Latest delivery position</h2><p>One latest execution update per current PO revision; the contractual ETA remains visible.</p></div></div>{loading ? <div className="loading-table">Loading delivery updates…</div> : latest.length ? <div className="table-scroll"><table className="action-table"><thead><tr><th>PO / vendor</th><th>Contract ETA</th><th>Forecast ETA</th><th>Status</th><th>Progress</th><th>Actual ROS</th><th>Last update</th></tr></thead><tbody>{latest.map(({ po, update }) => <tr key={po.id}><td><strong>{po.poNumber} · Rev. {po.revisionNumber}</strong><span>{po.vendorName}</span></td><td>{date(po.etaRosAtSite)}</td><td>{date(update?.forecastEta ?? null)}</td><td><span className={`status-badge status-${update?.deliveryStatus ?? "n/a"}`}>{update?.deliveryStatus?.replaceAll("-", " ") ?? "No update"}</span></td><td>{update ? `${update.progressPercent}%` : "—"}</td><td>{date(update?.actualRosDate ?? null)}</td><td>{date(update?.updateDate ?? null)}</td></tr>)}</tbody></table></div> : <Empty title="No PO execution records yet." copy="Create a PO first, then add delivery updates without changing its contractual schedule." />}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Payment milestones</h2><p>Planned invoice, payment, and actual payment dates support cash exposure reporting.</p></div></div>{loading ? <div className="loading-table">Loading payment milestones…</div> : data.milestones.length ? <div className="table-scroll"><table className="action-table"><thead><tr><th>PO / milestone</th><th>Share</th><th>Amount</th><th>Invoice plan</th><th>Payment plan</th><th>Actual paid</th><th>Status</th></tr></thead><tbody>{data.milestones.map((item) => <tr key={item.id}><td><strong>{item.poNumber} · {item.sequenceNo}. {item.milestoneName}</strong><span>{item.vendorName}</span></td><td>{item.percentage === null ? "—" : `${Number(item.percentage).toLocaleString("en-US")}%`}</td><td>{money(item.amount, item.currencyCode)}</td><td>{date(item.plannedInvoiceDate)}</td><td>{date(item.plannedPaymentDate)}</td><td>{date(item.actualPaymentDate)}</td><td><select aria-label={`Status for ${item.milestoneName}`} value={item.milestoneStatus} disabled={saving === item.id} onChange={(event) => void updateMilestoneStatus(item, event.target.value)}>{milestoneStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div> : <Empty title="No structured payment milestones yet." copy="Add the first milestone to turn payment terms into an actionable cash forecast." />}</section>
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
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const [status, setStatus] = useState("planned");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { const body = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch("/api/execution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "payment-milestone", ...body }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Unable to save payment milestone."); await onSaved(); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save payment milestone."); } finally { setSaving(false); } }
  return <div className="modal-backdrop"><section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="milestone-form-title"><div className="dialog-top"><div><p className="eyebrow">Cash commitment</p><h2 id="milestone-form-title">Add payment milestone</h2><p>Amounts remain in their contract currency; no FX conversion is assumed.</p></div><button className="icon-button" onClick={onClose}>×</button></div><form onSubmit={submit}><fieldset><legend>Milestone identity & value</legend><div className="form-grid"><POSelect pos={pos} /><Input label="Sequence" name="sequenceNo" type="number" min="1" step="1" required /><Input label="Milestone name" name="milestoneName" required /><Input label="Percentage (%)" name="percentage" type="number" min="0" max="100" step="0.0001" /><Input label="Amount" name="amount" type="number" min="0" step="0.01" required /><label className="form-field"><span>Currency</span><select name="currencyCode" defaultValue="IDR">{currencyCodes.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label></div></fieldset><fieldset><legend>Cash schedule</legend><div className="form-grid"><Input label="Planned invoice date" name="plannedInvoiceDate" type="date" /><Input label="Planned payment date" name="plannedPaymentDate" type="date" /><label className="form-field"><span>Status</span><select name="milestoneStatus" value={status} onChange={(event) => setStatus(event.target.value)}>{milestoneStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{status === "paid" && <Input label="Actual payment date" name="actualPaymentDate" type="date" required />}</div></fieldset><label className="textarea-field"><span>Remarks</span><textarea name="remarks" rows={3} /></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save milestone"}</button></div></form></section></div>;
}
