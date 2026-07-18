export const purchasingGroups = ["ELE", "INS", "ROT"] as const;
export const paymentTerms = ["T/T", "SKBDN"] as const;
export const yesNoValues = ["Yes", "No"] as const;
export const incoterms = [
  { value: "EXW", label: "EXW – Ex Works" },
  { value: "FCA", label: "FCA – Free Carrier" },
  { value: "CPT", label: "CPT – Carriage Paid To" },
  { value: "CIP", label: "CIP – Carriage and Insurance Paid To" },
  { value: "DAP", label: "DAP – Delivered at Place" },
  { value: "DPU", label: "DPU – Delivered at Place Unloaded" },
  { value: "DDP", label: "DDP – Delivered Duty Paid" },
  { value: "FAS", label: "FAS – Free Alongside Ship" },
  { value: "FOB", label: "FOB – Free on Board" },
  { value: "CFR", label: "CFR – Cost and Freight" },
  { value: "CIF", label: "CIF – Cost, Insurance and Freight" },
] as const;

export type PurchasingGroup = (typeof purchasingGroups)[number];
export type PaymentTerm = (typeof paymentTerms)[number];
export type Incoterm = (typeof incoterms)[number]["value"];

export type PORecord = {
  id: number;
  poNumber: string;
  revisionNumber: number;
  releasedDate: string;
  purchasingGroup: PurchasingGroup;
  location: string;
  equipmentName: string;
  vendorName: string;
  budget: string;
  contractValue: string;
  deliveryLeadTimeWeeks: number;
  incoterm: Incoterm;
  etaRosAtSite: string;
  termOfPayment: PaymentTerm;
  milestoneDetails: string;
  pb: boolean;
  pbValidity: string;
  wb: boolean;
  wbValidity: string;
  createdAt: string;
  updatedAt: string;
};

export type POInput = Omit<PORecord, "id" | "createdAt" | "updatedAt">;

export type ValidatedPOInput = POInput & {
  createdBy: string;
  updatedBy: string;
};

export type POInputFields = {
  poNumber: string;
  revisionNumber: string | number;
  releasedDate: string;
  purchasingGroup: string;
  location: string;
  equipmentName: string;
  vendorName: string;
  budget: string | number;
  contractValue: string | number;
  deliveryLeadTimeWeeks: string | number;
  incoterm: string;
  etaRosAtSite: string;
  termOfPayment: string;
  milestoneDetails: string;
  pb: string | boolean;
  pbValidity: string;
  wb: string | boolean;
  wbValidity: string;
};

export const csvHeaders = [
  "po_number",
  "revision_number",
  "released_date",
  "purchasing_group",
  "location",
  "equipment_name",
  "vendor_name",
  "budget_idr",
  "contract_value_idr",
  "delivery_lead_time_weeks",
  "incoterm",
  "eta_ros_at_site",
  "term_of_payment",
  "milestone_details",
  "pb",
  "pb_validity",
  "wb",
  "wb_validity",
] as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dmyDatePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const moneyPattern = /^\d+(?:\.\d{1,2})?$/;
const integerPattern = /^\d+$/;

function requiredString(value: unknown, label: string, errors: string[]) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) errors.push(`${label} is required.`);
  return trimmed;
}

function isRealIsoDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function dmyDateToIso(value: string) {
  const match = dmyDatePattern.exec(value);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isRealIsoDate(iso) ? iso : null;
}

function canonicalBondValidity(value: unknown, label: string, errors: string[]) {
  const raw = String(value ?? "").trim();
  const iso = isRealIsoDate(raw) ? raw : dmyDateToIso(raw);
  if (!iso) errors.push(`${label} validity must use DD/MM/YYYY.`);
  return iso ?? raw;
}

function stringBoolean(value: unknown, label: string, errors: string[]) {
  if (value === true || String(value).trim().toLowerCase() === "yes") return true;
  if (value === false || String(value).trim().toLowerCase() === "no") return false;
  errors.push(`${label} must be Yes or No.`);
  return false;
}

function canonicalGroup(value: string): PurchasingGroup | null {
  const match = purchasingGroups.find(
    (group) => group.toLowerCase() === value.toLowerCase(),
  );
  return match ?? null;
}

function canonicalPayment(value: string): PaymentTerm | null {
  const match = paymentTerms.find(
    (term) => term.toLowerCase() === value.toLowerCase(),
  );
  return match ?? null;
}

function canonicalIncoterm(value: string): Incoterm | null {
  const normalized = value.toUpperCase();
  const match = incoterms.find((term) => term.value === normalized);
  return match?.value ?? null;
}

export function validatePOInput(
  source: Partial<POInputFields>,
  actor: string,
): { value: ValidatedPOInput; errors: string[] } {
  const errors: string[] = [];
  const poNumber = requiredString(source.poNumber, "PO No.", errors);
  const revisionRaw = requiredString(source.revisionNumber, "Revision number", errors);
  const releasedDate = requiredString(source.releasedDate, "Released date", errors);
  const purchasingGroupRaw = requiredString(
    source.purchasingGroup,
    "Purchasing group",
    errors,
  );
  const location = requiredString(source.location, "Incoterm location", errors);
  const equipmentName = requiredString(source.equipmentName, "Equipment name", errors);
  const vendorName = requiredString(source.vendorName, "Vendor name", errors);
  const budget = requiredString(source.budget, "Budget", errors);
  const contractValue = requiredString(source.contractValue, "Contract value", errors);
  const leadTimeRaw = requiredString(
    source.deliveryLeadTimeWeeks,
    "Delivery lead time",
    errors,
  );
  const incotermRaw = requiredString(source.incoterm, "Incoterm", errors);
  const etaRosAtSite = requiredString(source.etaRosAtSite, "ETA ROS at site", errors);
  const paymentRaw = requiredString(source.termOfPayment, "Term of payment", errors);
  const milestoneDetails = String(source.milestoneDetails ?? "").trim();

  if (!integerPattern.test(revisionRaw)) {
    errors.push("Revision number must be a whole number of 0 or more.");
  }
  if (!integerPattern.test(leadTimeRaw)) {
    errors.push("Delivery lead time must be a whole number of weeks.");
  }
  if (!isRealIsoDate(releasedDate)) {
    errors.push("Released date must use YYYY-MM-DD.");
  }
  if (!isRealIsoDate(etaRosAtSite)) {
    errors.push("ETA ROS at site must use YYYY-MM-DD.");
  }
  if (!moneyPattern.test(budget)) {
    errors.push("Budget must be a non-negative IDR amount with up to two decimals.");
  }
  if (!moneyPattern.test(contractValue)) {
    errors.push("Contract value must be a non-negative IDR amount with up to two decimals.");
  }
  if (milestoneDetails.length > 2000) {
    errors.push("Milestone details must be 2,000 characters or fewer.");
  }
  if (location.length > 250) {
    errors.push("Incoterm location must be 250 characters or fewer.");
  }

  const purchasingGroup = canonicalGroup(purchasingGroupRaw);
  if (!purchasingGroup) errors.push("Purchasing group must be ELE, INS, or ROT.");
  const termOfPayment = canonicalPayment(paymentRaw);
  if (!termOfPayment) errors.push("Term of payment must be T/T or SKBDN.");
  const incoterm = canonicalIncoterm(incotermRaw);
  if (!incoterm) errors.push("Choose an Incoterm from the approved list.");

  const pb = stringBoolean(source.pb, "PB", errors);
  const pbValidityRaw = String(source.pbValidity ?? "").trim();
  const pbValidity = pb ? canonicalBondValidity(pbValidityRaw, "Performance Bond", errors) : "N/A";
  if (pb && (!pbValidityRaw || pbValidityRaw.toUpperCase() === "N/A")) {
    errors.push("Performance Bond validity is required when PB is Yes.");
  }
  const wb = stringBoolean(source.wb, "WB", errors);
  const wbValidityRaw = String(source.wbValidity ?? "").trim();
  const wbValidity = wb ? canonicalBondValidity(wbValidityRaw, "Warranty Bond", errors) : "N/A";
  if (wb && (!wbValidityRaw || wbValidityRaw.toUpperCase() === "N/A")) {
    errors.push("Warranty Bond validity is required when WB is Yes.");
  }

  return {
    errors,
    value: {
      poNumber,
      revisionNumber: Number.parseInt(revisionRaw || "0", 10),
      releasedDate,
      purchasingGroup: purchasingGroup ?? "ELE",
      location,
      equipmentName,
      vendorName,
      budget: canonicalMoney(budget),
      contractValue: canonicalMoney(contractValue),
      deliveryLeadTimeWeeks: Number.parseInt(leadTimeRaw || "0", 10),
      incoterm: incoterm ?? "EXW",
      etaRosAtSite,
      termOfPayment: termOfPayment ?? "T/T",
      milestoneDetails,
      pb,
      pbValidity,
      wb,
      wbValidity,
      createdBy: actor,
      updatedBy: actor,
    },
  };
}

function canonicalMoney(value: string) {
  if (!moneyPattern.test(value)) return value;
  const [whole, fraction] = value.split(".");
  return fraction ? `${Number(whole)}.${fraction}` : String(Number(whole));
}

export type CsvParseResult =
  | { headers: string[]; rows: Record<string, string>[]; errors: [] }
  | { headers: string[]; rows: []; errors: string[] };

export function parseCsv(text: string): CsvParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) return { headers: [], rows: [], errors: ["CSV has an unclosed quoted value."] };
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const [headerRow, ...dataRows] = rows.filter((item) => item.some((cellValue) => cellValue.trim()));
  if (!headerRow) return { headers: [], rows: [], errors: ["CSV is empty."] };

  const headers = headerRow.map((header) => header.trim().replace(/^\uFEFF/, ""));
  const missing = csvHeaders.filter((header) => !headers.includes(header));
  if (missing.length) {
    return { headers, rows: [], errors: [`Missing required columns: ${missing.join(", ")}.`] };
  }
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    return { headers, rows: [], errors: [`CSV repeats column: ${duplicateHeaders[0]}.`] };
  }

  const mappedRows = dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])),
  );
  return { headers, rows: mappedRows, errors: [] };
}

export function csvRowToInput(row: Record<string, string>): POInputFields {
  return {
    poNumber: row.po_number,
    revisionNumber: row.revision_number,
    releasedDate: row.released_date,
    purchasingGroup: row.purchasing_group,
    location: row.location,
    equipmentName: row.equipment_name,
    vendorName: row.vendor_name,
    budget: row.budget_idr,
    contractValue: row.contract_value_idr,
    deliveryLeadTimeWeeks: row.delivery_lead_time_weeks,
    incoterm: row.incoterm,
    etaRosAtSite: row.eta_ros_at_site,
    termOfPayment: row.term_of_payment,
    milestoneDetails: row.milestone_details,
    pb: row.pb,
    pbValidity: row.pb_validity,
    wb: row.wb,
    wbValidity: row.wb_validity,
  };
}
