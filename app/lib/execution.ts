import { currencyCodes, type CurrencyCode } from "./po";

export const deliveryUpdateStatuses = [
  "not-started", "manufacturing", "ready-to-ship", "in-transit",
  "arrived-at-site", "completed", "cancelled",
] as const;
export const milestoneStatuses = ["planned", "invoiced", "paid", "on-hold"] as const;
export const serviceTypes = ["supervision-installation", "precomm-commissioning", "training"] as const;

export const milestoneNames = [
  "APPROVAL (MIN CODE-2) OF KEY DOCS",
  "ORDERING OF IDENTIFIED MAJOR MATERIALS",
  "SUCESSFUL FAT (WITH MINOR PUNCH POINT)",
  "EXWORKS READINESS WITH ISSUANCE OF INSPECTION RELEASE NOTE",
  "AFTER DELIVERY AS PER STATED INCOTERM",
  "APPROVAL (MIN CODE-1) OF MANUFACTURING DATA RECORD",
] as const;

export const milestoneDueDays = [14, 30, 45, 60, 90] as const;

export const paymentFacilities = ["T/T", "SKBDN", "LC", "Swift"] as const;

export type DeliveryUpdateStatus = (typeof deliveryUpdateStatuses)[number];
export type MilestoneStatus = (typeof milestoneStatuses)[number];
export type ServiceType = (typeof serviceTypes)[number];

type POContext = {
  po_number?: string;
  revision_number?: number;
  vendor_name?: string;
  equipment_name?: string;
  contract_value?: string | number;
  currency_code?: string;
  projects?: { project_code?: string | null } | null;
};

export type DeliveryUpdateRecord = {
  id: number;
  poRevisionId: number;
  poNumber: string;
  revisionNumber: number;
  vendorName: string;
  equipmentName: string;
  projectCode: string | null;
  contractValue: string;
  currencyCode: CurrencyCode;
  updateDate: string;
  forecastEtaSite: string | null;
  actualRosDate: string | null;
  deliveryStatus: DeliveryUpdateStatus;
  delayReason: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
};

export type PaymentMilestoneRecord = {
  id: number;
  poRevisionId: number;
  poNumber: string;
  revisionNumber: number;
  vendorName: string;
  projectCode: string | null;
  sequenceNo: number;
  milestoneName: string;
  percentage: string | null;
  amount: string;
  currencyCode: CurrencyCode;
  dueDateDays: number | null;
  paymentFacility: string | null;
  plannedInvoiceDate: string | null;
  plannedPaymentDate: string | null;
  actualPaymentDate: string | null;
  milestoneStatus: MilestoneStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
};

export type POServiceRecord = {
  id: number;
  poRevisionId: number;
  serviceType: ServiceType;
  included: boolean;
  mandays: string | null;
  costIdr: string | null;
};

function context(record: { po_revisions?: POContext | null }) {
  return record.po_revisions ?? {};
}

function date(value: unknown) {
  return value ? String(value).slice(0, 10) : null;
}

function currency(value: unknown): CurrencyCode {
  const normalized = String(value ?? "IDR").toUpperCase();
  return (currencyCodes as readonly string[]).includes(normalized) ? normalized as CurrencyCode : "IDR";
}

export function fromDatabaseDelivery(record: Record<string, unknown>): DeliveryUpdateRecord {
  const po = context(record as { po_revisions?: POContext | null });
  return {
    id: Number(record.id), poRevisionId: Number(record.po_revision_id), poNumber: po.po_number ?? "—",
    revisionNumber: Number(po.revision_number ?? 0), vendorName: po.vendor_name ?? "",
    equipmentName: po.equipment_name ?? "", projectCode: po.projects?.project_code ?? null,
    contractValue: String(po.contract_value ?? "0"), currencyCode: currency(po.currency_code),
    updateDate: date(record.update_date) ?? "", forecastEtaSite: date(record.forecast_eta), actualRosDate: date(record.actual_ros_date),
    deliveryStatus: record.delivery_status as DeliveryUpdateStatus,
    delayReason: String(record.delay_reason ?? ""), remarks: String(record.remarks ?? ""),
    createdBy: String(record.created_by ?? ""), createdAt: String(record.created_at ?? ""),
  };
}

export function fromDatabaseMilestone(record: Record<string, unknown>): PaymentMilestoneRecord {
  const po = context(record as { po_revisions?: POContext | null });
  return {
    id: Number(record.id), poRevisionId: Number(record.po_revision_id), poNumber: po.po_number ?? "—",
    revisionNumber: Number(po.revision_number ?? 0), vendorName: po.vendor_name ?? "", projectCode: po.projects?.project_code ?? null,
    sequenceNo: Number(record.sequence_no), milestoneName: String(record.milestone_name ?? ""),
    percentage: record.percentage === null || record.percentage === undefined ? null : String(record.percentage),
    amount: String(record.amount ?? "0"), currencyCode: currency(record.currency_code),
    dueDateDays: record.due_date_days === null || record.due_date_days === undefined ? null : Number(record.due_date_days),
    paymentFacility: record.payment_facility ? String(record.payment_facility) : null,
    plannedInvoiceDate: date(record.planned_invoice_date), plannedPaymentDate: date(record.planned_payment_date),
    actualPaymentDate: date(record.actual_payment_date), milestoneStatus: record.milestone_status as MilestoneStatus,
    remarks: String(record.remarks ?? ""), createdAt: String(record.created_at ?? ""), updatedAt: String(record.updated_at ?? ""),
  };
}

export function fromDatabaseService(record: Record<string, unknown>): POServiceRecord {
  return {
    id: Number(record.id), poRevisionId: Number(record.po_revision_id), serviceType: record.service_type as ServiceType,
    included: Boolean(record.included), mandays: record.mandays === null ? null : String(record.mandays),
    costIdr: record.cost_idr === null ? null : String(record.cost_idr),
  };
}

function realDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function optionalDate(value: unknown, label: string, errors: string[]) {
  const result = String(value ?? "").trim();
  if (result && !realDate(result)) errors.push(`${label} must use YYYY-MM-DD.`);
  return result || null;
}

function validPORevisionId(value: unknown, errors: string[]) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) errors.push("Choose a PO revision.");
  return id;
}

export function validateDeliveryUpdate(source: Record<string, unknown>, actor: string) {
  const errors: string[] = [];
  const poRevisionId = validPORevisionId(source.poRevisionId, errors);
  const updateDate = optionalDate(source.updateDate, "Update date", errors);
  const forecastEtaSite = optionalDate(source.forecastEtaSite, "Forecast ETA Site", errors);
  const actualRosDate = optionalDate(source.actualRosDate, "Actual ROS date", errors);
  const deliveryStatus = String(source.deliveryStatus ?? "");
  if (!updateDate) errors.push("Update date is required.");
  if (!(deliveryUpdateStatuses as readonly string[]).includes(deliveryStatus)) errors.push("Choose a valid delivery status.");
  if (deliveryStatus === "completed" && !actualRosDate) errors.push("Actual ROS date is required when delivery is completed.");
  return { errors, value: {
    po_revision_id: poRevisionId, update_date: updateDate, forecast_eta: forecastEtaSite, actual_ros_date: actualRosDate,
    delivery_status: deliveryStatus,
    delay_reason: String(source.delayReason ?? "").trim().slice(0, 1000), remarks: String(source.remarks ?? "").trim().slice(0, 2000),
    created_by: actor,
  } };
}

export function validatePaymentMilestone(source: Record<string, unknown>, actor: string) {
  const errors: string[] = [];
  const poRevisionId = validPORevisionId(source.poRevisionId, errors);
  const sequenceNo = Number(source.sequenceNo);
  const milestoneName = String(source.milestoneName ?? "").trim();
  const percentageRaw = String(source.percentage ?? "").trim();
  const amountRaw = String(source.amount ?? "").trim();
  const selectedCurrency = String(source.currencyCode ?? "").toUpperCase();
  const status = String(source.milestoneStatus ?? "planned");
  const dueDateDaysRaw = String(source.dueDateDays ?? "").trim();
  let dueDateDays: number | null = null;
  if (dueDateDaysRaw) {
    const parsed = Number(dueDateDaysRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) errors.push("Due date must be a positive number of days.");
    else dueDateDays = parsed;
  }
  const paymentFacility = String(source.paymentFacility ?? "").trim();
  if (paymentFacility && !(paymentFacilities as readonly string[]).includes(paymentFacility)) errors.push("Choose a valid payment facility.");
  const plannedInvoiceDate = optionalDate(source.plannedInvoiceDate, "Planned invoice date", errors);
  const plannedPaymentDate = optionalDate(source.plannedPaymentDate, "Planned payment date", errors);
  const actualPaymentDate = optionalDate(source.actualPaymentDate, "Actual payment date", errors);
  if (!Number.isInteger(sequenceNo) || sequenceNo < 1) errors.push("Sequence must be a whole number above zero.");
  if (!milestoneName) errors.push("Milestone name is required.");
  if (milestoneName.length > 250) errors.push("Milestone name must be 250 characters or fewer.");
  const percentage = percentageRaw ? Number(percentageRaw) : null;
  if (percentage !== null && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) errors.push("Percentage must be from 0 to 100.");
  const amount = Number(amountRaw);
  if (!amountRaw || !Number.isFinite(amount) || amount < 0) errors.push("A non-negative milestone amount is required.");
  if (!(currencyCodes as readonly string[]).includes(selectedCurrency)) errors.push("Choose a valid currency.");
  if (!(milestoneStatuses as readonly string[]).includes(status)) errors.push("Choose a valid milestone status.");
  if (status === "paid" && !actualPaymentDate) errors.push("Actual payment date is required for a paid milestone.");
  return { errors, value: {
    po_revision_id: poRevisionId, sequence_no: sequenceNo, milestone_name: milestoneName, percentage,
    amount: amountRaw, currency_code: selectedCurrency, due_date_days: dueDateDays, payment_facility: paymentFacility || null, planned_invoice_date: plannedInvoiceDate,
    planned_payment_date: plannedPaymentDate, actual_payment_date: actualPaymentDate, milestone_status: status,
    remarks: String(source.remarks ?? "").trim().slice(0, 2000), created_by: actor, updated_by: actor,
  } };
}

export function latestDeliveryUpdates(updates: DeliveryUpdateRecord[]) {
  const latest = new Map<number, DeliveryUpdateRecord>();
  for (const update of updates) {
    const known = latest.get(update.poRevisionId);
    if (!known || update.updateDate > known.updateDate || (update.updateDate === known.updateDate && update.createdAt > known.createdAt)) {
      latest.set(update.poRevisionId, update);
    }
  }
  return latest;
}
