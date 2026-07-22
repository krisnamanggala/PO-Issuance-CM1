import type { PORecord } from "./po";
import { latestDeliveryUpdates, type DeliveryUpdateRecord, type PaymentMilestoneRecord, type POServiceRecord } from "./execution";

export type BondType = "PB" | "WB";
export type BondStatus = "n/a" | "missing" | "valid" | "expiring" | "critical" | "expired" | "released" | "replaced";
export type DeliveryStatus = "on-track" | "due-soon" | "delayed" | "completed" | "cancelled" | "missing-eta";
export type Priority = "critical" | "high" | "medium";

export type BondRecord = {
  id: number;
  poRevisionId: number;
  poNumber: string;
  revisionNumber: number;
  vendorName: string;
  projectCode: string | null;
  bondType: BondType;
  bondNumber: string | null;
  issuingBank: string | null;
  currencyCode: string;
  bondValue: string | null;
  expectedValue: string | null;
  receivedDate: string | null;
  issueDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  releasedDate: string | null;
  replacedAt: string | null;
  remarks: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardSettings = {
  deliveryWarningDays: number;
  bondCriticalDays: number;
  bondWarningDays: number;
};

export const defaultDashboardSettings: DashboardSettings = {
  deliveryWarningDays: 30,
  bondCriticalDays: 30,
  bondWarningDays: 60,
};

export type CriticalAction = {
  id: string;
  priority: Priority;
  issueType: string;
  poNumber: string;
  poRevisionId: number;
  vendorName: string;
  projectCode: string | null;
  equipmentName: string;
  relevantDate: string | null;
  daysRemaining: number | null;
  currencyCode: string;
  value: string;
  responsiblePerson: string;
  bondId: number | null;
  assignedTo?: string;
  dueDate?: string | null;
  financialExposure?: string;
};

export type DashboardVisuals = {
  projectRisk: { code: string; active: number; delayed: number; due: number; missingPB: number; expiringPB: number; missingWB: number; expiringWB: number }[];
  vendorDelays: { vendor: string; count: number; maxDays: number; values: Record<string, number> }[];
  vendorConcentration: { vendor: string; poCount: number; values: Record<string, number> }[];
  categoryExposure: { group: string; poCount: number; values: Record<string, number> }[];
};

function utcToday(today = new Date()) {
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

function dateUtc(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}

export function daysUntil(value: string | null | undefined, today = new Date()) {
  const target = dateUtc(value);
  return target === null ? null : Math.round((target - utcToday(today)) / 86_400_000);
}

export function deliveryStatus(record: PORecord, settings = defaultDashboardSettings, today = new Date(), update?: DeliveryUpdateRecord | null): DeliveryStatus {
  if (update?.deliveryStatus === "cancelled" || record.cancelledAt) return "cancelled";
  if (update?.deliveryStatus === "completed" || record.deliveryCompletedAt) return "completed";
  const days = daysUntil(update?.forecastEtaSite ?? record.etaRosAtSite, today);
  if (days === null) return "missing-eta";
  if (days < 0) return "delayed";
  if (days <= settings.deliveryWarningDays) return "due-soon";
  return "on-track";
}

export function isActivePO(record: PORecord, update?: DeliveryUpdateRecord | null) {
  return update?.deliveryStatus !== "completed" && update?.deliveryStatus !== "cancelled" && !record.deliveryCompletedAt && !record.cancelledAt;
}

export function bondStatus(required: boolean, bond: BondRecord | null | undefined, settings = defaultDashboardSettings, today = new Date()): BondStatus {
  if (!required) return "n/a";
  if (!bond) return "missing";
  if (bond.releasedDate) return "released";
  if (bond.replacedAt) return "replaced";
  const days = daysUntil(bond.expiryDate, today);
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= settings.bondCriticalDays) return "critical";
  if (days <= settings.bondWarningDays) return "expiring";
  return "valid";
}

export function latestRevisions(records: PORecord[]) {
  const latest = new Map<string, PORecord>();
  for (const record of records) {
    const previous = latest.get(record.poNumber);
    if (!previous || record.revisionNumber > previous.revisionNumber || (record.revisionNumber === previous.revisionNumber && record.id > previous.id)) {
      latest.set(record.poNumber, record);
    }
  }
  return [...latest.values()];
}

export function currencyTotals(records: PORecord[]) {
  return records.reduce<Record<string, number>>((totals, record) => {
    const value = Number(record.contractValue);
    if (Number.isFinite(value)) totals[record.currencyCode] = (totals[record.currencyCode] ?? 0) + value;
    return totals;
  }, {});
}

function actionPriority(days: number | null, kind: "delivery" | "bond" | "data"): Priority {
  if (kind === "data") return "medium";
  if (days === null) return "critical";
  if (days < 0 || (kind === "bond" && days <= 14)) return "critical";
  if (days <= 30) return "high";
  return "medium";
}

function mostRecentBond(bonds: BondRecord[], poRevisionId: number, type: BondType) {
  return bonds
    .filter((bond) => bond.poRevisionId === poRevisionId && bond.bondType === type)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export function criticalActions(records: PORecord[], bonds: BondRecord[], settings = defaultDashboardSettings, today = new Date(), deliveryUpdates: DeliveryUpdateRecord[] = []) {
  const actions: CriticalAction[] = [];
  const latestDelivery = latestDeliveryUpdates(deliveryUpdates);
  for (const record of latestRevisions(records)) {
    const update = latestDelivery.get(record.id);
    if (!isActivePO(record, update)) continue;
    const delivery = deliveryStatus(record, settings, today, update);
    const effectiveEta = update?.forecastEtaSite ?? record.etaRosAtSite;
    const etaDays = daysUntil(effectiveEta, today);
    const common = {
      poNumber: record.poNumber,
      poRevisionId: record.id,
      vendorName: record.vendorName,
      projectCode: record.projectCode,
      equipmentName: record.equipmentName,
      currencyCode: record.currencyCode,
      value: record.contractValue,
      responsiblePerson: record.responsiblePerson,
      financialExposure: record.contractValue,
    };
    if (delivery === "delayed" || delivery === "due-soon" || delivery === "missing-eta") {
      actions.push({
        id: `delivery-${record.id}`,
        priority: actionPriority(etaDays, delivery === "missing-eta" ? "data" : "delivery"),
        issueType: delivery === "delayed" ? "Past PO delivery forecast" : delivery === "due-soon" ? "PO ETA within 30 days" : "PO missing ETA",
        relevantDate: delivery === "missing-eta" ? null : effectiveEta,
        daysRemaining: etaDays,
        bondId: null,
        ...common,
      });
    }
    if (!record.vendorName.trim()) {
      actions.push({ id: `vendor-${record.id}`, priority: "medium", issueType: "PO missing vendor", relevantDate: null, daysRemaining: null, bondId: null, ...common });
    }
    if (record.revisionReviewRequired) {
      actions.push({ id: `review-${record.id}`, priority: "medium", issueType: "PO revision requires review", relevantDate: record.updatedAt.slice(0, 10), daysRemaining: null, bondId: null, ...common });
    }
    for (const [type, required] of [["PB", record.pb], ["WB", record.wb]] as const) {
      const bond = mostRecentBond(bonds, record.id, type);
      const status = bondStatus(required, bond, settings, today);
      const days = daysUntil(bond?.expiryDate, today);
      if (["missing", "expired", "critical", "expiring"].includes(status)) {
        const label = type === "PB" ? "Performance Bond" : "Warranty Bond";
        const issueType = status === "missing" ? `${label} missing` : status === "expired" ? `${label} expired` : `${label} expiring within ${status === "critical" ? 30 : 60} days`;
        actions.push({
          id: `${type}-${record.id}-${bond?.id ?? "missing"}`,
          priority: actionPriority(days, "bond"),
          issueType,
          relevantDate: bond?.expiryDate ?? null,
          daysRemaining: days,
          bondId: bond?.id ?? null,
          ...common,
        });
      }
    }
  }
  const rank: Record<Priority, number> = { critical: 0, high: 1, medium: 2 };
  return actions.sort((left, right) => rank[left.priority] - rank[right.priority] || (left.daysRemaining ?? Number.MAX_SAFE_INTEGER) - (right.daysRemaining ?? Number.MAX_SAFE_INTEGER) || (left.relevantDate ?? "9999-12-31").localeCompare(right.relevantDate ?? "9999-12-31"));
}

export function dashboardMetrics(records: PORecord[], bonds: BondRecord[], settings = defaultDashboardSettings, today = new Date(), deliveryUpdates: DeliveryUpdateRecord[] = [], milestones: PaymentMilestoneRecord[] = [], services: POServiceRecord[] = []) {
  const current = latestRevisions(records);
  const latestDelivery = latestDeliveryUpdates(deliveryUpdates);
  const active = current.filter((record) => isActivePO(record, latestDelivery.get(record.id)));
  const activeIds = new Set(active.map((record) => record.id));
  const delivery = active.map((record) => deliveryStatus(record, settings, today, latestDelivery.get(record.id)));
  const pb = active.map((record) => bondStatus(record.pb, mostRecentBond(bonds, record.id, "PB"), settings, today));
  const wb = active.map((record) => bondStatus(record.wb, mostRecentBond(bonds, record.id, "WB"), settings, today));
  const leadTimes = active
    .map((record) => daysUntil(record.etaRosAtSite, new Date(`${record.releasedDate}T00:00:00Z`)))
    .filter((days): days is number => days !== null && days >= 0)
    .map((days) => days / 7);
  const budgetVarianceByCurrency = active.reduce<Record<string, number>>((totals, record) => {
    totals[record.currencyCode] = (totals[record.currencyCode] ?? 0) + (Number(record.budget) || 0) - (Number(record.contractValue) || 0);
    return totals;
  }, {});
  const unpaid = milestones.filter((item) => activeIds.has(item.poRevisionId) && item.milestoneStatus !== "paid");
  const unpaidValueByCurrency = unpaid.reduce<Record<string, number>>((totals, item) => {
    totals[item.currencyCode] = (totals[item.currencyCode] ?? 0) + (Number(item.amount) || 0);
    return totals;
  }, {});
  const revisionDeltaByCurrency = current.reduce<Record<string, number>>((totals, record) => {
    const previous = record.previousRevisionId
      ? records.find((candidate) => candidate.id === record.previousRevisionId)
      : records.filter((candidate) => candidate.poNumber === record.poNumber && candidate.revisionNumber < record.revisionNumber).sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
    if (previous && previous.currencyCode === record.currencyCode) totals[record.currencyCode] = (totals[record.currencyCode] ?? 0) + (Number(record.contractValue) || 0) - (Number(previous.contractValue) || 0);
    return totals;
  }, {});
  const delayedValueByCurrency = active.filter((record) => deliveryStatus(record, settings, today, latestDelivery.get(record.id)) === "delayed").reduce<Record<string, number>>((totals, record) => {
    totals[record.currencyCode] = (totals[record.currencyCode] ?? 0) + (Number(record.contractValue) || 0);
    return totals;
  }, {});
  return {
    activePos: active.length,
    activeValueByCurrency: currencyTotals(active),
    delayedDeliveries: delivery.filter((status) => status === "delayed").length,
    dueWithin30Days: delivery.filter((status) => status === "due-soon").length,
    delayedValueByCurrency,
    averageLeadTimeWeeks: leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : 0,
    missingPerformanceBonds: pb.filter((status) => status === "missing").length,
    performanceBondsExpiring: pb.filter((status) => status === "critical").length,
    missingWarrantyBonds: wb.filter((status) => status === "missing").length,
    warrantyBondsExpiring: wb.filter((status) => status === "critical").length,
    budgetVarianceByCurrency,
    unpaidMilestones: unpaid.length,
    unpaidValueByCurrency,
    serviceCostIdr: services.filter((item) => activeIds.has(item.poRevisionId) && item.included).reduce((sum, item) => sum + (Number(item.costIdr) || 0), 0),
    revisionDeltaByCurrency,
    deliveryBreakdown: Object.fromEntries(["on-track", "due-soon", "delayed", "completed", "cancelled", "missing-eta"].map((status) => [status, current.filter((record) => deliveryStatus(record, settings, today, latestDelivery.get(record.id)) === status).length])),
    bondBreakdown: Object.fromEntries(["valid", "expiring", "critical", "expired", "missing", "n/a", "released"].map((status) => [status, [...pb, ...wb].filter((item) => item === status).length])),
    paymentBreakdown: Object.fromEntries(["planned", "invoiced", "paid", "on-hold"].map((status) => [status, milestones.filter((item) => activeIds.has(item.poRevisionId) && item.milestoneStatus === status).length])),
  };
}

export function dashboardVisuals(records: PORecord[], bonds: BondRecord[], settings = defaultDashboardSettings, today = new Date(), deliveryUpdates: DeliveryUpdateRecord[] = []): DashboardVisuals {
  const projects = new Map<string, DashboardVisuals["projectRisk"][number]>();
  const vendors = new Map<string, DashboardVisuals["vendorDelays"][number]>();
  const concentration = new Map<string, DashboardVisuals["vendorConcentration"][number]>();
  const categories = new Map<string, DashboardVisuals["categoryExposure"][number]>();
  const latestDelivery = latestDeliveryUpdates(deliveryUpdates);
  for (const record of latestRevisions(records)) {
    const update = latestDelivery.get(record.id);
    if (!isActivePO(record, update)) continue;
    const projectCode = record.projectCode || "Unassigned";
    const project = projects.get(projectCode) ?? { code: projectCode, active: 0, delayed: 0, due: 0, missingPB: 0, expiringPB: 0, missingWB: 0, expiringWB: 0 };
    project.active += 1;
    const delivery = deliveryStatus(record, settings, today, update);
    if (delivery === "delayed") project.delayed += 1;
    if (delivery === "due-soon") project.due += 1;
    const pb = bondStatus(record.pb, mostRecentBond(bonds, record.id, "PB"), settings, today);
    const wb = bondStatus(record.wb, mostRecentBond(bonds, record.id, "WB"), settings, today);
    if (pb === "missing") project.missingPB += 1;
    if (pb === "critical" || pb === "expiring") project.expiringPB += 1;
    if (wb === "missing") project.missingWB += 1;
    if (wb === "critical" || wb === "expiring") project.expiringWB += 1;
    projects.set(projectCode, project);
    const vendorKey = record.vendorName || "Unassigned vendor";
    const vendorExposure = concentration.get(vendorKey) ?? { vendor: vendorKey, poCount: 0, values: {} };
    vendorExposure.poCount += 1;
    vendorExposure.values[record.currencyCode] = (vendorExposure.values[record.currencyCode] ?? 0) + (Number(record.contractValue) || 0);
    concentration.set(vendorKey, vendorExposure);
    const category = categories.get(record.purchasingGroup) ?? { group: record.purchasingGroup, poCount: 0, values: {} };
    category.poCount += 1;
    category.values[record.currencyCode] = (category.values[record.currencyCode] ?? 0) + (Number(record.contractValue) || 0);
    categories.set(record.purchasingGroup, category);
    if (delivery === "delayed") {
      const vendorName = record.vendorName || "Unassigned vendor";
      const vendor = vendors.get(vendorName) ?? { vendor: vendorName, count: 0, maxDays: 0, values: {} };
      const overdueDays = Math.abs(daysUntil(update?.forecastEtaSite ?? record.etaRosAtSite, today) ?? 0);
      vendor.count += 1;
      vendor.maxDays = Math.max(vendor.maxDays, overdueDays);
      vendor.values[record.currencyCode] = (vendor.values[record.currencyCode] ?? 0) + (Number(record.contractValue) || 0);
      vendors.set(vendorName, vendor);
    }
  }
  return {
    projectRisk: [...projects.values()].sort((left, right) => (right.delayed + right.missingPB + right.missingWB) - (left.delayed + left.missingPB + left.missingWB)).slice(0, 8),
    vendorDelays: [...vendors.values()].sort((left, right) => right.count - left.count || right.maxDays - left.maxDays).slice(0, 6),
    vendorConcentration: [...concentration.values()].sort((left, right) => right.poCount - left.poCount).slice(0, 8),
    categoryExposure: [...categories.values()].sort((left, right) => right.poCount - left.poCount),
  };
}
