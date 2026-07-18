import type { PORecord, ValidatedPOInput } from "./po";

type DatabasePORevision = {
  id: number;
  po_number: string;
  revision_number: number;
  released_date: string;
  purchasing_group: PORecord["purchasingGroup"];
  location: string;
  equipment_name: string;
  vendor_name: string;
  budget: string | number;
  contract_value: string | number;
  delivery_lead_time_weeks: number;
  incoterm: PORecord["incoterm"];
  eta_ros_at_site: string;
  term_of_payment: PORecord["termOfPayment"];
  milestone_details: string;
  pb: boolean;
  pb_validity: string | null;
  wb: boolean;
  wb_validity: string | null;
  created_at: string;
  updated_at: string;
};

function isoDate(value: string | null) {
  return value ? value.slice(0, 10) : "N/A";
}

export function fromDatabase(record: DatabasePORevision): PORecord {
  return {
    id: Number(record.id),
    poNumber: record.po_number,
    revisionNumber: Number(record.revision_number),
    releasedDate: record.released_date.slice(0, 10),
    purchasingGroup: record.purchasing_group,
    location: record.location,
    equipmentName: record.equipment_name,
    vendorName: record.vendor_name,
    budget: String(record.budget),
    contractValue: String(record.contract_value),
    deliveryLeadTimeWeeks: Number(record.delivery_lead_time_weeks),
    incoterm: record.incoterm,
    etaRosAtSite: record.eta_ros_at_site.slice(0, 10),
    termOfPayment: record.term_of_payment,
    milestoneDetails: record.milestone_details,
    pb: Boolean(record.pb),
    pbValidity: isoDate(record.pb_validity),
    wb: Boolean(record.wb),
    wbValidity: isoDate(record.wb_validity),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function toInsertRecord(value: ValidatedPOInput) {
  return {
    po_number: value.poNumber,
    revision_number: value.revisionNumber,
    released_date: value.releasedDate,
    purchasing_group: value.purchasingGroup,
    location: value.location,
    equipment_name: value.equipmentName,
    vendor_name: value.vendorName,
    budget: value.budget,
    contract_value: value.contractValue,
    delivery_lead_time_weeks: value.deliveryLeadTimeWeeks,
    incoterm: value.incoterm,
    eta_ros_at_site: value.etaRosAtSite,
    term_of_payment: value.termOfPayment,
    milestone_details: value.milestoneDetails,
    pb: value.pb,
    pb_validity: value.pb ? value.pbValidity : null,
    wb: value.wb,
    wb_validity: value.wb ? value.wbValidity : null,
    created_by: value.createdBy,
    updated_by: value.updatedBy,
  };
}

export function toUpdateRecord(value: ValidatedPOInput) {
  const record = toInsertRecord(value);
  return {
    po_number: record.po_number,
    revision_number: record.revision_number,
    released_date: record.released_date,
    purchasing_group: record.purchasing_group,
    location: record.location,
    equipment_name: record.equipment_name,
    vendor_name: record.vendor_name,
    budget: record.budget,
    contract_value: record.contract_value,
    delivery_lead_time_weeks: record.delivery_lead_time_weeks,
    incoterm: record.incoterm,
    eta_ros_at_site: record.eta_ros_at_site,
    term_of_payment: record.term_of_payment,
    milestone_details: record.milestone_details,
    pb: record.pb,
    pb_validity: record.pb_validity,
    wb: record.wb,
    wb_validity: record.wb_validity,
    updated_by: record.updated_by,
    updated_at: new Date().toISOString(),
  };
}
