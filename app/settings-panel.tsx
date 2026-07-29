"use client";

import { useCallback, useEffect, useState } from "react";

type SettingsData = {
  settings: { delivery_warning_days: number; bond_critical_days: number; bond_warning_days: number; updated_at: string } | null;
  permissions: { isAdmin: boolean };
  error?: string;
};
type WorkspaceMember = { user_id: string; email: string; role: "admin" | "editor" | "viewer"; created_at: string };
const roles = ["admin", "editor", "viewer"] as const;

export default function SettingsPanel() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [delivery, setDelivery] = useState("30");
  const [critical, setCritical] = useState("30");
  const [warning, setWarning] = useState("60");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersError, setMembersError] = useState("");
  const [savingRole, setSavingRole] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/master-data", { cache: "no-store" });
      const payload = await response.json() as SettingsData;
      if (!response.ok) throw new Error(payload.error ?? "Unable to load settings.");
      setData(payload);
      if (payload.settings) {
        setDelivery(String(payload.settings.delivery_warning_days));
        setCritical(String(payload.settings.bond_critical_days));
        setWarning(String(payload.settings.bond_warning_days));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load settings.");
    }
  }, []);
  const refreshMembers = useCallback(async () => {
    try {
      setMembersError("");
      const response = await fetch("/api/workspace-members", { cache: "no-store" });
      const payload = await response.json() as { members?: WorkspaceMember[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load workspace members.");
      setMembers(payload.members ?? []);
    } catch (reason) {
      setMembersError(reason instanceof Error ? reason.message : "Unable to load workspace members.");
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data?.permissions.isAdmin) void refreshMembers(); }, [data?.permissions.isAdmin, refreshMembers]);

  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/master-data", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "settings", deliveryWarningDays: Number(delivery), bondCriticalDays: Number(critical), bondWarningDays: Number(warning) }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save settings.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save settings.");
    } finally { setSaving(false); }
  }

  async function updateRole(member: WorkspaceMember, role: WorkspaceMember["role"]) {
    if (role === member.role) return;
    setSavingRole(member.user_id); setMembersError("");
    try {
      const response = await fetch("/api/workspace-members", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.user_id, role }),
      });
      const payload = await response.json() as { member?: WorkspaceMember; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to update workspace role.");
      if (payload.member) setMembers((current) => current.map((item) => item.user_id === member.user_id ? payload.member! : item));
    } catch (reason) {
      setMembersError(reason instanceof Error ? reason.message : "Unable to update workspace role.");
    } finally { setSavingRole(""); }
  }

  return <>
    <section className="page-header"><div><p className="eyebrow">Workspace configuration</p><h1>Settings</h1><p>Control delivery and bond thresholds, plus workspace access.</p></div></section>
    <section className="panel settings-panel"><div><h2>Risk thresholds</h2><p>All dates use calendar days. Changes apply across the workspace on the next data refresh.</p></div>{error && <p className="form-error">{error}</p>}{!data ? <div className="loading-table">Loading settings…</div> : <form className="settings-form" onSubmit={(event) => { event.preventDefault(); void save(); }}><label>Delivery warning days<input type="number" min="1" max="365" value={delivery} disabled={!data.permissions.isAdmin} onChange={(event) => setDelivery(event.target.value)} /></label><label>Bond critical days<input type="number" min="1" max="365" value={critical} disabled={!data.permissions.isAdmin} onChange={(event) => setCritical(event.target.value)} /></label><label>Bond warning days<input type="number" min="1" max="365" value={warning} disabled={!data.permissions.isAdmin} onChange={(event) => setWarning(event.target.value)} /></label>{data.permissions.isAdmin ? <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save thresholds"}</button> : <p className="read-only-note">Only workspace administrators can change settings.</p>}</form>}</section>
    {data?.permissions.isAdmin && <section className="panel settings-panel"><div><p className="eyebrow">Access control</p><h2>Workspace members</h2><p>New @tripatra.com registrations start as editors. Viewers can read the workspace but cannot change operational data.</p></div>{membersError && <p className="form-error">{membersError}</p>}{!members.length && !membersError ? <div className="loading-table">Loading workspace members…</div> : <div className="table-scroll"><table><thead><tr><th>Email</th><th>Joined</th><th>Role</th></tr></thead><tbody>{members.map((member) => <tr key={member.user_id}><td><strong>{member.email}</strong></td><td>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(member.created_at))}</td><td><select aria-label={`Role for ${member.email}`} value={member.role} disabled={savingRole === member.user_id} onChange={(event) => void updateRole(member, event.target.value as WorkspaceMember["role"])}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></td></tr>)}</tbody></table></div>}</section>}
  </>;
}
