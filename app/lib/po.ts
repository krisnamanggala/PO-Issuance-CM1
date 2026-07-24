export const purchasingGroups = ["ELE", "INS", "ROT", "PRO", "STA"] as const;
export const paymentTerms = ["T/T", "SKBDN"] as const;
export const currencyCodes = ["IDR", "USD", "AUD", "JPY", "CNY", "GBP", "EUR"] as const;
export const yesNoValues = ["Yes", "No"] as const;
export const serviceInclusionValues = ["Included", "Not included"] as const;
export const incotermLocations = ["Jakarta", "Overseas", "Site"] as const;
export const deliveryToSiteWeeks: Record<IncotermLocation, number> = {
  Jakarta: 2,
  Overseas: 3,
  Site: 0,
};
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
export type CurrencyCode = (typeof currencyCodes)[number];
export type Incoterm = (typeof incoterms)[number]["value"];
export type IncotermLocation = (typeof incotermLocations)[number];
export type ServiceInclusion = (typeof serviceInclusionValues)[number];

export type PORecord = {
  id: number;
  previousRevisionId: number | null;
  revisionReason: string;
  poNumber: string;
  revisionNumber: number;
  releasedDate: string;
  purchasingGroup: PurchasingGroup;
  projectId: number | null;
  projectCode: string | null;
  projectName: string | null;
  vendorId: number | null;
  location: string;
  equipmentName: string;
  vendorName: string;
  budget: string | null;
  contractValue: string;
  currencyCode: CurrencyCode;
  deliveryLeadTimeWeeks: number;
  incoterm: Incoterm;
  etaRosAtSite: string;
  termOfPayment: PaymentTerm;
  milestoneDetails: string;
  pb: boolean;
  pbValidity: string;
  wb: boolean;
  wbValidity: string;
  deliveryCompletedAt: string | null;
  cancelledAt: string | null;
  responsiblePerson: string;
  revisionReviewRequired: boolean;
  supervisionInstallationAssistIncluded: boolean;
  supervisionInstallationAssistMandays: string | null;
  supervisionInstallationAssistCost: string | null;
  precommCommissioningAssistIncluded: boolean;
  precommCommissioningAssistMandays: string | null;
  precommCommissioningAssistCost: string | null;
  trainingIncluded: boolean;
  trainingMandays: string | null;
  trainingCost: string | null;
  createdAt: string;
  updatedAt: string;
};

export type POInput = Omit<PORecord, "id" | "createdAt" | "updatedAt">;

export type ValidatedPOInput = POInput & {
  createdBy: string;
  updatedBy: string;
};

export type POInputFields = {
  previousRevisionId: string | number;
  revisionReason: string;
  poNumber: string;
  revisionNumber: string | number;
  releasedDate: string;
  purchasingGroup: string;
  projectId: string | number;
  vendorId: string | number;
  location: string;
  equipmentName: string;
  vendorName: string;
  budget: string | number;
  contractValue: string | number;
  currencyCode: string;
  deliveryLeadTimeWeeks: string | number;
  incoterm: string;
  etaRosAtSite: string;
  termOfPayment: string;
  milestoneDetails: string;
  pb: string | boolean;
  pbValidity: string;
  wb: string | boolean;
  wbValidity: string;
  deliveryCompletedAt: string;
  cancelledAt: string;
  responsiblePerson: string;
  revisionReviewRequired: string | boolean;
  supervisionInstallationAssistIncluded: string | boolean;
  supervisionInstallationAssistMandays: string | number;
  supervisionInstallationAssistCost: string | number;
  precommCommissioningAssistIncluded: string | boolean;
  precommCommissioningAssistMandays: string | number;
  precommCommissioningAssistCost: string | number;
  trainingIncluded: string | boolean;
  trainingMandays: string | number;
  trainingCost: string | number;
};

export const csvHeaders = [
  "po_number",
  "revision_number",
  "released_date",
  "purchasing_group",
  "project_code",
  "location",
  "equipment_name",
  "vendor_name",
  "budget_idr",
  "contract_value_idr",
  "currency_code",
  "delivery_lead_time_weeks",
  "incoterm",
  "term_of_payment",
  "milestone_details",
  "pb",
  "pb_validity",
  "wb",
  "wb_validity",
  "supervision_installation_assist_included",
  "supervision_installation_assist_mandays",
  "supervision_installation_assist_cost_idr",
  "precomm_commissioning_assist_included",
  "precomm_commissioning_assist_mandays",
  "precomm_commissioning_assist_cost_idr",
  "training_included",
  "training_mandays",
  "training_cost_idr",
] as const;

// Project code remains optional for legacy PO records. Operational-status fields
// are retained in the database for historical reporting but are no longer imported.
export const requiredCsvHeaders = csvHeaders.filter((header) => ![
  "project_code", "budget_idr",
].includes(header));

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

function canonicalIncotermLocation(value: string): IncotermLocation | null {
  const match = incotermLocations.find(
    (location) => location.toLowerCase() === value.toLowerCase(),
  );
  return match ?? null;
}

export function calculateEtaRosAtSite(
  releasedDate: string,
  deliveryLeadTimeWeeks: string | number,
  location: string,
) {
  const leadTimeWeeks = Number(deliveryLeadTimeWeeks);
  const incotermLocation = canonicalIncotermLocation(location);
  if (!isRealIsoDate(releasedDate) || !Number.isInteger(leadTimeWeeks) || leadTimeWeeks < 0 || !incotermLocation) return "";

  const eta = new Date(`${releasedDate}T00:00:00Z`);
  eta.setUTCDate(eta.getUTCDate() + ((leadTimeWeeks + deliveryToSiteWeeks[incotermLocation]) * 7));
  return eta.toISOString().slice(0, 10);
}

function optionalIsoDate(value: unknown, label: string, errors: string[]) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!isRealIsoDate(raw)) errors.push(`${label} must use YYYY-MM-DD.`);
  return raw || null;
}

function optionalId(value: unknown, label: string, errors: string[]) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!integerPattern.test(raw) || Number(raw) < 1) {
    errors.push(`${label} must be a valid record identifier.`);
    return null;
  }
  return Number(raw);
}

function requiredId(value: unknown, label: string, errors: string[]) {
  const id = optionalId(value, label, errors);
  if (id === null) errors.push(`${label} is required.`);
  return id;
}

function serviceIncluded(value: unknown, label: string, errors: string[]) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (value === true || normalized === "included") return true;
  if (value === false || normalized === "not included") return false;
  errors.push(`${label} must be Included or Not included.`);
  return false;
}

function isNotApplicable(value: string) {
  return !value || value.toUpperCase() === "N/A";
}

function validateService(
  source: Partial<POInputFields>,
  config: {
    label: string;
    included: keyof POInputFields;
    mandays: keyof POInputFields;
    cost: keyof POInputFields;
  },
  errors: string[],
) {
  const included = serviceIncluded(source[config.included], config.label, errors);
  const mandaysRaw = String(source[config.mandays] ?? "").trim();
  const costRaw = String(source[config.cost] ?? "").trim();

  if (!included) {
    if (!isNotApplicable(mandaysRaw)) {
      errors.push(`${config.label} man-days must be blank or N/A when the service is Not included.`);
    }
    if (!isNotApplicable(costRaw)) {
      errors.push(`${config.label} cost must be blank or N/A when the service is Not included.`);
    }
    return { included, mandays: null, cost: null };
  }

  if (!isNotApplicable(mandaysRaw) && !moneyPattern.test(mandaysRaw)) {
    errors.push(`${config.label} man-days must be a non-negative number with up to two decimals.`);
  }
  if (!isNotApplicable(costRaw) && !moneyPattern.test(costRaw)) {
    errors.push(`${config.label} cost must be a non-negative IDR amount with up to two decimals.`);
  }

  return {
    included,
    mandays: isNotApplicable(mandaysRaw) ? null : moneyPattern.test(mandaysRaw) ? canonicalMoney(mandaysRaw) : mandaysRaw,
    cost: isNotApplicable(costRaw) ? null : moneyPattern.test(costRaw) ? canonicalMoney(costRaw) : costRaw,
  };
}

export function validatePOInput(
  source: Partial<POInputFields>,
  actor: string,
): { value: ValidatedPOInput; errors: string[] } {
  const errors: string[] = [];
  const previousRevisionId = optionalId(source.previousRevisionId, "Previous revision", errors);
  const revisionReason = String(source.revisionReason ?? "").trim();
  const poNumber = requiredString(source.poNumber, "PO No.", errors);
  const revisionRaw = requiredString(source.revisionNumber, "Revision number", errors);
  const releasedDate = requiredString(source.releasedDate, "Released date", errors);
  const purchasingGroupRaw = requiredString(
    source.purchasingGroup,
    "Purchasing group",
    errors,
  );
  const projectId = optionalId(source.projectId, "Project", errors);
  const vendorId = requiredId(source.vendorId, "Vendor", errors);
  const locationRaw = requiredString(source.location, "Location as per Incoterm", errors);
  const equipmentName = requiredString(source.equipmentName, "Equipment name", errors);
  const vendorName = requiredString(source.vendorName, "Vendor name", errors);
  const budget = String(source.budget ?? "").trim();
  const contractValue = requiredString(source.contractValue, "Contract value", errors);
  const leadTimeRaw = requiredString(
    source.deliveryLeadTimeWeeks,
    "Delivery lead time",
    errors,
  );
  const incotermRaw = requiredString(source.incoterm, "Incoterm", errors);
  const paymentRaw = requiredString(source.termOfPayment, "Term of payment", errors);
  const milestoneDetails = String(source.milestoneDetails ?? "").trim();
  const currencyCode = String(source.currencyCode ?? "IDR").trim().toUpperCase() || "IDR";
  const deliveryCompletedAt = optionalIsoDate(source.deliveryCompletedAt, "Completed date", errors);
  const cancelledAt = optionalIsoDate(source.cancelledAt, "Cancelled date", errors);
  const responsiblePerson = String(source.responsiblePerson ?? "").trim();

  if (!integerPattern.test(revisionRaw)) {
    errors.push("Revision number must be a whole number of 0 or more.");
  }
  if (!integerPattern.test(leadTimeRaw)) {
    errors.push("Delivery lead time must be a whole number of weeks.");
  }
  if (!isRealIsoDate(releasedDate)) {
    errors.push("Released date must use YYYY-MM-DD.");
  }
  if (budget && !moneyPattern.test(budget)) {
    errors.push("Budget must be a non-negative IDR amount with up to two decimals.");
  }
  if (!moneyPattern.test(contractValue)) {
    errors.push("Contract value must be a non-negative IDR amount with up to two decimals.");
  }
  if (!(currencyCodes as readonly string[]).includes(currencyCode)) {
    errors.push("Currency must be IDR, USD, AUD, JPY, CNY, GBP, or EUR.");
  }
  if (milestoneDetails.length > 2000) {
    errors.push("Milestone details must be 2,000 characters or fewer.");
  }
  if (previousRevisionId && !revisionReason) {
    errors.push("Revision reason is required when creating a new revision.");
  }
  if (revisionReason.length > 1000) {
    errors.push("Revision reason must be 1,000 characters or fewer.");
  }

  const purchasingGroup = canonicalGroup(purchasingGroupRaw);
  if (!purchasingGroup) errors.push("Purchasing group must be ELE, INS, ROT, PRO, or STA.");
  const termOfPayment = canonicalPayment(paymentRaw);
  if (!termOfPayment) errors.push("Term of payment must be T/T or SKBDN.");
  const incoterm = canonicalIncoterm(incotermRaw);
  if (!incoterm) errors.push("Choose an Incoterm from the approved list.");
  const location = canonicalIncotermLocation(locationRaw);
  if (!location) errors.push("Location as per Incoterm must be Jakarta, Overseas, or Site.");
  const etaRosAtSite = calculateEtaRosAtSite(releasedDate, leadTimeRaw, locationRaw);

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
  const revisionReviewRequired = source.revisionReviewRequired === true
    || String(source.revisionReviewRequired ?? "No").trim().toLowerCase() === "yes";

  const supervisionInstallationAssist = validateService(source, {
    label: "Supervision & installation assist",
    included: "supervisionInstallationAssistIncluded",
    mandays: "supervisionInstallationAssistMandays",
    cost: "supervisionInstallationAssistCost",
  }, errors);
  const precommCommissioningAssist = validateService(source, {
    label: "Precomm/commissioning assist",
    included: "precommCommissioningAssistIncluded",
    mandays: "precommCommissioningAssistMandays",
    cost: "precommCommissioningAssistCost",
  }, errors);
  const training = validateService(source, {
    label: "Training",
    included: "trainingIncluded",
    mandays: "trainingMandays",
    cost: "trainingCost",
  }, errors);

  return {
    errors,
    value: {
      previousRevisionId,
      revisionReason,
      poNumber,
      revisionNumber: Number.parseInt(revisionRaw || "0", 10),
      releasedDate,
      purchasingGroup: purchasingGroup ?? "ELE",
      projectId,
      projectCode: null,
      projectName: null,
      vendorId,
      location: location ?? "Jakarta",
      equipmentName,
      vendorName,
      budget: budget ? canonicalMoney(budget) : null,
      contractValue: canonicalMoney(contractValue),
      currencyCode: (currencyCodes as readonly string[]).includes(currencyCode) ? currencyCode as CurrencyCode : "IDR",
      deliveryLeadTimeWeeks: Number.parseInt(leadTimeRaw || "0", 10),
      incoterm: incoterm ?? "EXW",
      etaRosAtSite,
      termOfPayment: termOfPayment ?? "T/T",
      milestoneDetails,
      pb,
      pbValidity,
      wb,
      wbValidity,
      deliveryCompletedAt,
      cancelledAt,
      responsiblePerson,
      revisionReviewRequired,
      supervisionInstallationAssistIncluded: supervisionInstallationAssist.included,
      supervisionInstallationAssistMandays: supervisionInstallationAssist.mandays,
      supervisionInstallationAssistCost: supervisionInstallationAssist.cost,
      precommCommissioningAssistIncluded: precommCommissioningAssist.included,
      precommCommissioningAssistMandays: precommCommissioningAssist.mandays,
      precommCommissioningAssistCost: precommCommissioningAssist.cost,
      trainingIncluded: training.included,
      trainingMandays: training.mandays,
      trainingCost: training.cost,
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
  const missing = requiredCsvHeaders.filter((header) => !headers.includes(header));
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
    previousRevisionId: "",
    revisionReason: "",
    poNumber: row.po_number,
    revisionNumber: row.revision_number,
    releasedDate: row.released_date,
    purchasingGroup: row.purchasing_group,
    projectId: "",
    vendorId: "",
    location: row.location,
    equipmentName: row.equipment_name,
    vendorName: row.vendor_name,
    budget: row.budget_idr,
    contractValue: row.contract_value_idr,
    currencyCode: row.currency_code || "IDR",
    deliveryLeadTimeWeeks: row.delivery_lead_time_weeks,
    incoterm: row.incoterm,
    etaRosAtSite: "",
    termOfPayment: row.term_of_payment,
    milestoneDetails: row.milestone_details,
    pb: row.pb,
    pbValidity: row.pb_validity,
    wb: row.wb,
    wbValidity: row.wb_validity,
    deliveryCompletedAt: "",
    cancelledAt: "",
    responsiblePerson: "",
    revisionReviewRequired: "No",
    supervisionInstallationAssistIncluded: row.supervision_installation_assist_included,
    supervisionInstallationAssistMandays: row.supervision_installation_assist_mandays,
    supervisionInstallationAssistCost: row.supervision_installation_assist_cost_idr,
    precommCommissioningAssistIncluded: row.precomm_commissioning_assist_included,
    precommCommissioningAssistMandays: row.precomm_commissioning_assist_mandays,
    precommCommissioningAssistCost: row.precomm_commissioning_assist_cost_idr,
    trainingIncluded: row.training_included,
    trainingMandays: row.training_mandays,
    trainingCost: row.training_cost_idr,
  };
}
