"use client";

import { useCallback, useEffect, useState } from "react";

type Data = { settings: { delivery_warning_days: number; bond_critical_days: number; bond_warning_days: number; updated_at: string } | null; permissions: { isAdmin: boolean }; error?: string };

export default function SettingsPanel() {
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => { try { const response = await fetch("/api/master-data", { cache: "no-store" }); const payload = await response.json() as Data; if (!response.ok) throw new Error(payload.error ?? "Unable to load settings."); setData(payload); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load settings."); } }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  const initial = data?.settings;
  const [delivery, setDelivery] = useState("30"); const [critical, setCritical] = useState("30"); const [warning, setWarning] = useState("60");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (initial) { setDelivery(String(initial.delivery_warning_days)); setCritical(String(initial.bond_critical_days)); setWarning(String(initial.bond_warning_days)); } }, [initial]);
  async function save() { setSaving(true); setError(""); try { const response = await fetch("/api/master-data", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "settings", deliveryWarningDays: Number(delivery), bondCriticalDays: Number(critical), bondWarningDays: Number(warning) }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Unable to save settings."); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save settings."); } finally { setSaving(false); } }
  return <><section className="page-header"><div><p className="eyebrow">Workspace configuration</p><h1>Settings</h1><p>Control the thresholds used by the PO delivery and bond-risk calculations.</p></div></section><section className="panel settings-panel"><div><h2>Risk thresholds</h2><p>All dates use calendar days. Changes apply across the workspace on the next data refresh.</p></div>{error && <p className="form-error">{error}</p>}{!data ? <div className="loading-table">Loading settings…</div> : <form className="settings-form" onSubmit={(event) => { event.preventDefault(); void save(); }}><label>Delivery warning days<input type="number" min="1" max="365" value={delivery} disabled={!data.permissions.isAdmin} onChange={(event) => setDelivery(event.target.value)} /></label><label>Bond critical days<input type="number" min="1" max="365" value={critical} disabled={!data.permissions.isAdmin} onChange={(event) => setCritical(event.target.value)} /></label><label>Bond warning days<input type="number" min="1" max="365" value={warning} disabled={!data.permissions.isAdmin} onChange={(event) => setWarning(event.target.value)} /></label>{data.permissions.isAdmin ? <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save thresholds"}</button> : <p className="read-only-note">Only workspace administrators can change settings.</p>}</form>}</section></>;
}
