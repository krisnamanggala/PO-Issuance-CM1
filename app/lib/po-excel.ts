import ExcelJS from "exceljs";
import {
  csvHeaders,
  currencyCodes,
  incotermLocations,
  incoterms,
  paymentTerms,
  purchasingGroups,
  serviceInclusionValues,
  yesNoValues,
  type POInputFields,
} from "./po";

type WorkbookRow = { values: Record<string, string>; rowNumber: number };

const maxTemplateRows = 500;
const headerRowNumber = 4;
const headerByColumn = new Map(csvHeaders.map((header, index) => [header, index + 1]));
const listValidation = (values: readonly string[]): ExcelJS.DataValidation => ({ type: "list", allowBlank: false, formulae: [`"${values.join(",")}"`] });

function isoDate(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())).toISOString().slice(0, 10);
}

function dmyDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
}

function cellText(value: ExcelJS.CellValue, dateFormat: "iso" | "dmy" | "text", fallback: string) {
  if (value instanceof Date) return dateFormat === "dmy" ? dmyDate(value) : isoDate(value);
  if (value && typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue, dateFormat, fallback);
  if (value && typeof value === "object" && "richText" in value) return value.richText.map((part) => part.text).join("").trim();
  if (value === null || value === undefined) return "";
  return String(value ?? fallback).trim();
}

export async function parsePOExcel(buffer: ArrayBuffer): Promise<{ rows: WorkbookRow[]; errors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("PO Register") ?? workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: ["Excel workbook has no worksheet."] };

  let foundHeaderRow = 0;
  let columnByHeader = new Map<string, number>();
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 10); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const candidate = new Map<string, number>();
    row.eachCell((cell, columnNumber) => {
      const header = cellText(cell.value, "text", cell.text);
      if (header) candidate.set(header, columnNumber);
    });
    if (csvHeaders.every((header) => candidate.has(header))) {
      foundHeaderRow = rowNumber;
      columnByHeader = candidate;
      break;
    }
  }
  if (!foundHeaderRow) return { rows: [], errors: [`Missing required columns: ${csvHeaders.join(", ")}.`] };

  const rows: WorkbookRow[] = [];
  for (let rowNumber = foundHeaderRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(csvHeaders.map((header) => {
      const cell = row.getCell(columnByHeader.get(header) ?? 0);
      const dateFormat = header === "released_date" ? "iso" : header === "pb_validity" || header === "wb_validity" ? "dmy" : "text";
      return [header, cellText(cell.value, dateFormat, cell.text)];
    }));
    if (Object.values(values).some((value) => value.trim())) rows.push({ values, rowNumber });
  }
  return { rows, errors: [] };
}

function addColumnValidation(
  sheet: ExcelJS.Worksheet,
  header: (typeof csvHeaders)[number],
  validation: ExcelJS.DataValidation,
) {
  const column = headerByColumn.get(header) ?? 1;
  for (let row = headerRowNumber + 1; row <= headerRowNumber + maxTemplateRows; row += 1) {
    sheet.getCell(row, column).dataValidation = validation;
  }
}

export async function buildPOExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TPEC CM1 PO Monitoring";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("PO Register", { views: [{ state: "frozen", ySplit: headerRowNumber }] });
  sheet.mergeCells("A1:AB1");
  sheet.getCell("A1").value = "TPEC CM1 PO Register Import Template";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF172467" } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 28;
  sheet.mergeCells("A2:AB2");
  sheet.getCell("A2").value = "Fill rows from row 5 onward. Use the dropdowns where available; do not rename or rearrange the column headers.";
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF5C647A" } };
  sheet.mergeCells("A3:AB3");
  sheet.getCell("A3").value = "Dates and numbers are typed cells. Project code and vendor name must already exist in Master Data before import.";
  sheet.getCell("A3").font = { italic: true, color: { argb: "FF5C647A" } };
  sheet.getRow(headerRowNumber).values = [...csvHeaders];
  const headerRange = sheet.getRow(headerRowNumber);
  headerRange.height = 32;
  headerRange.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172467" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FF8DC63F" } } };
  });
  sheet.autoFilter = `A${headerRowNumber}:AB${headerRowNumber}`;

  const widths = [24, 15, 15, 16, 16, 14, 34, 38, 18, 20, 14, 20, 14, 18, 38, 10, 15, 10, 15, 22, 18, 22, 22, 18, 22, 14, 18, 20];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.getColumn(headerByColumn.get("po_number") ?? 1).numFmt = "@";
  sheet.getColumn(headerByColumn.get("revision_number") ?? 2).numFmt = "0";
  sheet.getColumn(headerByColumn.get("released_date") ?? 3).numFmt = "yyyy-mm-dd";
  sheet.getColumn(headerByColumn.get("budget_idr") ?? 9).numFmt = "#,##0.00";
  sheet.getColumn(headerByColumn.get("contract_value_idr") ?? 10).numFmt = "#,##0.00";
  sheet.getColumn(headerByColumn.get("delivery_lead_time_weeks") ?? 12).numFmt = "0";
  sheet.getColumn(headerByColumn.get("pb_validity") ?? 17).numFmt = "dd/mm/yyyy";
  sheet.getColumn(headerByColumn.get("wb_validity") ?? 19).numFmt = "dd/mm/yyyy";
  ["supervision_installation_assist_mandays", "supervision_installation_assist_cost_idr", "precomm_commissioning_assist_mandays", "precomm_commissioning_assist_cost_idr", "training_mandays", "training_cost_idr"].forEach((header) => {
    sheet.getColumn(headerByColumn.get(header as (typeof csvHeaders)[number]) ?? 1).numFmt = "#,##0.00";
  });

  addColumnValidation(sheet, "purchasing_group", listValidation(purchasingGroups));
  addColumnValidation(sheet, "location", listValidation(incotermLocations));
  addColumnValidation(sheet, "currency_code", listValidation(currencyCodes));
  addColumnValidation(sheet, "incoterm", listValidation(incoterms.map((term) => term.value)));
  addColumnValidation(sheet, "term_of_payment", listValidation(paymentTerms));
  addColumnValidation(sheet, "pb", listValidation(yesNoValues));
  addColumnValidation(sheet, "wb", listValidation(yesNoValues));
  ["supervision_installation_assist_included", "precomm_commissioning_assist_included", "training_included"].forEach((header) => addColumnValidation(sheet, header as (typeof csvHeaders)[number], listValidation(serviceInclusionValues)));
  ["revision_number", "delivery_lead_time_weeks"].forEach((header) => addColumnValidation(sheet, header as (typeof csvHeaders)[number], { type: "whole", operator: "greaterThanOrEqual", allowBlank: false, formulae: [0] }));
  ["budget_idr", "contract_value_idr", "supervision_installation_assist_mandays", "supervision_installation_assist_cost_idr", "precomm_commissioning_assist_mandays", "precomm_commissioning_assist_cost_idr", "training_mandays", "training_cost_idr"].forEach((header) => addColumnValidation(sheet, header as (typeof csvHeaders)[number], { type: "decimal", operator: "greaterThanOrEqual", allowBlank: header !== "contract_value_idr", formulae: [0] }));

  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 34 }, { width: 22 }, { width: 70 }];
  instructions.getRow(1).values = ["Field", "Excel datatype", "Rule"];
  instructions.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172467" } }; });
  const rules: [string, string, string][] = [
    ["po_number", "Text", "Required; retain leading zeroes and PO prefixes."],
    ["revision_number", "Whole number", "Required; zero or greater."],
    ["released_date", "Date", "Required; displayed as YYYY-MM-DD."],
    ["project_code", "Text", "Optional; must exactly match active Project Master Data when entered."],
    ["vendor_name", "Text", "Required; must exactly match Vendor Master Data."],
    ["budget_idr", "Decimal", "Optional; zero or greater."],
    ["contract_value_idr", "Decimal", "Required; zero or greater."],
    ["pb_validity / wb_validity", "Date or text", "Use a date when PB/WB is Yes; enter N/A when No."],
    ["Service estimates", "Decimal or blank", "Optional when service is Included; if entered, zero or greater. Leave blank/N/A when Not included."],
    ["ETA to Site", "Calculated", "Do not add a column. The web calculates it from PO issued date, lead time, and location."],
  ];
  rules.forEach((row) => instructions.addRow(row));
  instructions.eachRow((row, rowNumber) => { if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true }; });
  return workbook.xlsx.writeBuffer();
}

export function rowToPOInput(row: Record<string, string>): POInputFields {
  return {
    previousRevisionId: "", revisionReason: "", poNumber: row.po_number, revisionNumber: row.revision_number,
    releasedDate: row.released_date, purchasingGroup: row.purchasing_group, projectId: "", vendorId: "", location: row.location,
    equipmentName: row.equipment_name, vendorName: row.vendor_name, budget: row.budget_idr, contractValue: row.contract_value_idr,
    currencyCode: row.currency_code || "IDR", deliveryLeadTimeWeeks: row.delivery_lead_time_weeks, incoterm: row.incoterm,
    etaRosAtSite: "", termOfPayment: row.term_of_payment, milestoneDetails: row.milestone_details, pb: row.pb,
    pbValidity: row.pb_validity, wb: row.wb, wbValidity: row.wb_validity, deliveryCompletedAt: "", cancelledAt: "",
    responsiblePerson: "", revisionReviewRequired: "No", supervisionInstallationAssistIncluded: row.supervision_installation_assist_included,
    supervisionInstallationAssistMandays: row.supervision_installation_assist_mandays, supervisionInstallationAssistCost: row.supervision_installation_assist_cost_idr,
    precommCommissioningAssistIncluded: row.precomm_commissioning_assist_included, precommCommissioningAssistMandays: row.precomm_commissioning_assist_mandays,
    precommCommissioningAssistCost: row.precomm_commissioning_assist_cost_idr, trainingIncluded: row.training_included,
    trainingMandays: row.training_mandays, trainingCost: row.training_cost_idr,
  };
}
