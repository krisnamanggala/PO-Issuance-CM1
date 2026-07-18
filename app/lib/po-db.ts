import { currencyCodes, type PORecord, type ValidatedPOInput } from "./po";

type DatabasePORevision = {
  id: number;
  previous_revision_id: number | null;
  revision_reason: string;
  po_number: string;
  revision_number: number;
  released_date: string;
  purchasing_group: PORecord["purchasingGroup"];
  project_id: number | null;
  vendor_id: number | null;
  location: string;
  equipment_name: string;
  vendor_name: string;
  budget: string | number;
  contract_value: string | number;
  currency_code: string;
  delivery_lead_time_weeks: number;
  incoterm: PORecord["incoterm"];
  eta_ros_at_site: string;
  term_of_payment: PORecord["termOfPayment"];
  milestone_details: string;
  pb: boolean;
  pb_validity: string | null;
  wb: boolean;
  wb_validity: string | null;
  delivery_completed_at: string | null;
  cancelled_at: string | null;
  responsible_person: string | null;
  revision_review_required: boolean;
  projects?: { project_code?: string | null; project_name?: string | null } | null;
  supervision_installation_assist_included: boolean;
  supervision_installation_assist_mandays: string | number | null;
  supervision_installation_assist_cost: string | number | null;
  precomm_commissioning_assist_included: boolean;
  precomm_commissioning_assist_mandays: string | number | null;
  precomm_commissioning_assist_cost: string | number | null;
  training_included: boolean;
  training_mandays: string | number | null;
  training_cost: string | number | null;
  created_at: string;
  updated_at: string;
};

function isoDate(value: string | null) {
  return value ? value.slice(0, 10) : "N/A";
}

function decimal(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value);
}

export function fromDatabase(record: DatabasePORevision): PORecord {
  return {
    id: Number(record.id),
    previousRevisionId: record.previous_revision_id === null || record.previous_revision_id === undefined ? null : Number(record.previous_revision_id),
    revisionReason: record.revision_reason ?? "",
    poNumber: record.po_number,
    revisionNumber: Number(record.revision_number),
    releasedDate: record.released_date.slice(0, 10),
    purchasingGroup: record.purchasing_group,
    projectId: record.project_id === null || record.project_id === undefined ? null : Number(record.project_id),
    projectCode: record.projects?.project_code ?? null,
    projectName: record.projects?.project_name ?? null,
    vendorId: record.vendor_id === null || record.vendor_id === undefined ? null : Number(record.vendor_id),
    location: record.location,
    equipmentName: record.equipment_name,
    vendorName: record.vendor_name,
    budget: String(record.budget),
    contractValue: String(record.contract_value),
    currencyCode: (currencyCodes as readonly string[]).includes(record.currency_code) ? record.currency_code as PORecord["currencyCode"] : "IDR",
    deliveryLeadTimeWeeks: Number(record.delivery_lead_time_weeks),
    incoterm: record.incoterm,
    etaRosAtSite: record.eta_ros_at_site.slice(0, 10),
    termOfPayment: record.term_of_payment,
    milestoneDetails: record.milestone_details,
    pb: Boolean(record.pb),
    pbValidity: isoDate(record.pb_validity),
    wb: Boolean(record.wb),
    wbValidity: isoDate(record.wb_validity),
    deliveryCompletedAt: record.delivery_completed_at ? record.delivery_completed_at.slice(0, 10) : null,
    cancelledAt: record.cancelled_at ? record.cancelled_at.slice(0, 10) : null,
    responsiblePerson: record.responsible_person ?? "",
    revisionReviewRequired: Boolean(record.revision_review_required),
    supervisionInstallationAssistIncluded: Boolean(record.supervision_installation_assist_included),
    supervisionInstallationAssistMandays: decimal(record.supervision_installation_assist_mandays),
    supervisionInstallationAssistCost: decimal(record.supervision_installation_assist_cost),
    precommCommissioningAssistIncluded: Boolean(record.precomm_commissioning_assist_included),
    precommCommissioningAssistMandays: decimal(record.precomm_commissioning_assist_mandays),
    precommCommissioningAssistCost: decimal(record.precomm_commissioning_assist_cost),
    trainingIncluded: Boolean(record.training_included),
    trainingMandays: decimal(record.training_mandays),
    trainingCost: decimal(record.training_cost),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function toInsertRecord(value: ValidatedPOInput) {
  return {
    previous_revision_id: value.previousRevisionId,
    revision_reason: value.revisionReason,
    po_number: value.poNumber,
    revision_number: value.revisionNumber,
    released_date: value.releasedDate,
    purchasing_group: value.purchasingGroup,
    project_id: value.projectId,
    vendor_id: value.vendorId,
    location: value.location,
    equipment_name: value.equipmentName,
    vendor_name: value.vendorName,
    budget: value.budget,
    contract_value: value.contractValue,
    currency_code: value.currencyCode,
    delivery_lead_time_weeks: value.deliveryLeadTimeWeeks,
    incoterm: value.incoterm,
    eta_ros_at_site: value.etaRosAtSite,
    term_of_payment: value.termOfPayment,
    milestone_details: value.milestoneDetails,
    pb: value.pb,
    pb_validity: value.pb ? value.pbValidity : null,
    wb: value.wb,
    wb_validity: value.wb ? value.wbValidity : null,
    delivery_completed_at: value.deliveryCompletedAt,
    cancelled_at: value.cancelledAt,
    responsible_person: value.responsiblePerson || null,
    revision_review_required: value.revisionReviewRequired,
    supervision_installation_assist_included: value.supervisionInstallationAssistIncluded,
    supervision_installation_assist_mandays: value.supervisionInstallationAssistIncluded
      ? value.supervisionInstallationAssistMandays
      : null,
    supervision_installation_assist_cost: value.supervisionInstallationAssistIncluded
      ? value.supervisionInstallationAssistCost
      : null,
    precomm_commissioning_assist_included: value.precommCommissioningAssistIncluded,
    precomm_commissioning_assist_mandays: value.precommCommissioningAssistIncluded
      ? value.precommCommissioningAssistMandays
      : null,
    precomm_commissioning_assist_cost: value.precommCommissioningAssistIncluded
      ? value.precommCommissioningAssistCost
      : null,
    training_included: value.trainingIncluded,
    training_mandays: value.trainingIncluded ? value.trainingMandays : null,
    training_cost: value.trainingIncluded ? value.trainingCost : null,
    created_by: value.createdBy,
    updated_by: value.updatedBy,
  };
}

export function toUpdateRecord(value: ValidatedPOInput) {
  const record = toInsertRecord(value);
  return {
    previous_revision_id: record.previous_revision_id,
    revision_reason: record.revision_reason,
    po_number: record.po_number,
    revision_number: record.revision_number,
    released_date: record.released_date,
    purchasing_group: record.purchasing_group,
    project_id: record.project_id,
    vendor_id: record.vendor_id,
    location: record.location,
    equipment_name: record.equipment_name,
    vendor_name: record.vendor_name,
    budget: record.budget,
    contract_value: record.contract_value,
    currency_code: record.currency_code,
    delivery_lead_time_weeks: record.delivery_lead_time_weeks,
    incoterm: record.incoterm,
    eta_ros_at_site: record.eta_ros_at_site,
    term_of_payment: record.term_of_payment,
    milestone_details: record.milestone_details,
    pb: record.pb,
    pb_validity: record.pb_validity,
    wb: record.wb,
    wb_validity: record.wb_validity,
    delivery_completed_at: record.delivery_completed_at,
    cancelled_at: record.cancelled_at,
    responsible_person: record.responsible_person,
    revision_review_required: record.revision_review_required,
    supervision_installation_assist_included: record.supervision_installation_assist_included,
    supervision_installation_assist_mandays: record.supervision_installation_assist_mandays,
    supervision_installation_assist_cost: record.supervision_installation_assist_cost,
    precomm_commissioning_assist_included: record.precomm_commissioning_assist_included,
    precomm_commissioning_assist_mandays: record.precomm_commissioning_assist_mandays,
    precomm_commissioning_assist_cost: record.precomm_commissioning_assist_cost,
    training_included: record.training_included,
    training_mandays: record.training_mandays,
    training_cost: record.training_cost,
    updated_by: record.updated_by,
    updated_at: new Date().toISOString(),
  };
}
