import type { BondRecord, BondType } from "./status";

export const bondTypes = ["PB", "WB"] as const;

export type BondInput = {
  poRevisionId: string | number;
  bondType: string;
  bondNumber: string;
  issuingBank: string;
  currencyCode: string;
  bondValue: string | number;
  expectedValue: string | number;
  receivedDate: string;
  issueDate: string;
  effectiveDate: string;
  expiryDate: string;
  releasedDate: string;
  remarks: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const decimalPattern = /^\d+(?:\.\d{1,2})?$/;

function optionalDate(value: unknown, label: string, errors: string[]) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (!datePattern.test(raw) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== raw) {
    errors.push(`${label} must use YYYY-MM-DD.`);
  }
  return raw;
}

function optionalAmount(value: unknown, label: string, errors: string[]) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!decimalPattern.test(raw)) errors.push(`${label} must be a non-negative amount with up to two decimals.`);
  return raw || null;
}

export function validateBondInput(input: Partial<BondInput>, actor: string) {
  const errors: string[] = [];
  const revision = Number(input.poRevisionId);
  if (!Number.isInteger(revision) || revision < 1) errors.push("Choose the PO revision for this bond.");
  const bondType = String(input.bondType ?? "").trim().toUpperCase();
  if (!(bondTypes as readonly string[]).includes(bondType)) errors.push("Bond type must be PB or WB.");
  const currencyCode = String(input.currencyCode ?? "IDR").trim().toUpperCase() || "IDR";
  if (!/^[A-Z]{3}$/.test(currencyCode)) errors.push("Currency must use a three-letter ISO code.");
  const expiryDate = optionalDate(input.expiryDate, "Expiry date", errors);
  const releasedDate = optionalDate(input.releasedDate, "Released date", errors);
  const receivedDate = optionalDate(input.receivedDate, "Received date", errors);
  const issueDate = optionalDate(input.issueDate, "Issue date", errors);
  const effectiveDate = optionalDate(input.effectiveDate, "Effective date", errors);
  const bondValue = optionalAmount(input.bondValue, "Bond value", errors);
  const expectedValue = optionalAmount(input.expectedValue, "Expected bond value", errors);
  const remarks = String(input.remarks ?? "").trim();
  if (remarks.length > 2000) errors.push("Remarks must be 2,000 characters or fewer.");

  return {
    errors,
    value: {
      po_revision_id: Number.isInteger(revision) ? revision : 0,
      bond_type: bondType as BondType,
      bond_number: String(input.bondNumber ?? "").trim() || null,
      issuing_bank: String(input.issuingBank ?? "").trim() || null,
      currency_code: currencyCode,
      bond_value: bondValue,
      expected_value: expectedValue,
      received_date: receivedDate,
      issue_date: issueDate,
      effective_date: effectiveDate,
      expiry_date: expiryDate,
      released_date: releasedDate,
      remarks,
      created_by: actor,
      updated_by: actor,
    },
  };
}

type DatabaseBond = {
  id: number;
  po_revision_id: number;
  bond_type: BondType;
  bond_number: string | null;
  issuing_bank: string | null;
  currency_code: string;
  bond_value: string | number | null;
  expected_value: string | number | null;
  received_date: string | null;
  issue_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  released_date: string | null;
  replaced_at: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
  po_revisions?: { po_number?: string; revision_number?: number; vendor_name?: string; projects?: { project_code?: string | null } | null } | null;
};

function date(value: string | null) { return value ? value.slice(0, 10) : null; }

export function fromDatabaseBond(record: DatabaseBond): BondRecord {
  return {
    id: Number(record.id),
    poRevisionId: Number(record.po_revision_id),
    poNumber: record.po_revisions?.po_number ?? "—",
    revisionNumber: Number(record.po_revisions?.revision_number ?? 0),
    vendorName: record.po_revisions?.vendor_name ?? "—",
    projectCode: record.po_revisions?.projects?.project_code ?? null,
    bondType: record.bond_type,
    bondNumber: record.bond_number,
    issuingBank: record.issuing_bank,
    currencyCode: record.currency_code,
    bondValue: record.bond_value === null ? null : String(record.bond_value),
    expectedValue: record.expected_value === null ? null : String(record.expected_value),
    receivedDate: date(record.received_date),
    issueDate: date(record.issue_date),
    effectiveDate: date(record.effective_date),
    expiryDate: date(record.expiry_date),
    releasedDate: date(record.released_date),
    replacedAt: record.replaced_at,
    remarks: record.remarks,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
