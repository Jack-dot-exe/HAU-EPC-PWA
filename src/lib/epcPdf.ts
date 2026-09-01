import { jsPDF } from "jspdf";
import "svg2pdf.js";
import epclogoSvg from "../assets/epclogo.svg?raw";
import haulogoSvg from "../assets/HAU-logo-schwarz.svg?raw";
import { CALC_VERSIONS } from "../calculations";
import type {
  AircraftProfile,
  CheckType,
  EngineDef,
  FieldDef,
  PowerCheckRecord,
  PowerCheckResult,
  PowerCheckValues,
  ProfileExecutionMode,
  Registration,
} from "../domain/models";
import { getDisplayMetrics } from "../domain/resultMetrics";
import { formatFieldValue, formatMetricValue, getFieldUnitId, getUnitLabel } from "../domain/units";
import { ENV_FIELD_KEYS, getExecutionMode, getProfileFields, isInputOnlyRecord } from "../domain/profileUtils";

type EpcPdfPayload = {
  registration: Registration;
  profile: AircraftProfile;
  executionMode: ProfileExecutionMode;
  checkType: CheckType;
  engines: EngineDef[];
  envFields: FieldDef[];
  engineFields: FieldDef[];
  envValues: PowerCheckValues;
  engineValues: PowerCheckValues[];
  computedResults?: PowerCheckResult[];
  exportedAt: Date;
  checkPerformedAt: Date;
  calculationVersion?: string;
};

const APP_VERSION_PLACEHOLDER = "App Version: TBD";

function parseSvg(svgSource: string): SVGElement {
  const document = new DOMParser().parseFromString(svgSource, "image/svg+xml");
  const parserError = document.querySelector("parsererror");

  if (parserError || document.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("Unable to parse SVG asset for PDF generation.");
  }

  return document.documentElement as unknown as SVGElement;
}

async function addSvgToPdf(
  doc: jsPDF,
  svgSource: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  await doc.svg(parseSvg(svgSource), { x, y, width, height });
}


function formatValue(field: FieldDef, value: PowerCheckValues[string] | undefined): string {
  return formatFieldValue(field, value);
}

function fieldLabel(field: FieldDef): string {
  const unit = getUnitLabel(getFieldUnitId(field));
  return unit ? `${field.label} (${unit})` : field.label;
}

function getEnginesFromRecord(
  record: PowerCheckRecord,
): Array<{
  engineId: string;
  engineLabel: string;
  values: PowerCheckValues;
  result?: PowerCheckResult;
}> {
  if (Array.isArray(record.engines) && record.engines.length > 0) {
    return record.engines.map((engine, index) => ({
      engineId: String(engine.engineId ?? index + 1),
      engineLabel: String(engine.engineLabel ?? `ENG ${index + 1}`),
      values: engine.values ?? {},
      result: engine.result,
    }));
  }

  return [
    {
      engineId: "1",
      engineLabel: "ENG 1",
      values: record.values ?? {},
      result: record.result,
    },
  ];
}

export function createEpcPdfPayloadFromRecord(
  record: PowerCheckRecord,
  registration: Registration,
  profile: AircraftProfile,
): EpcPdfPayload {
  const fields = getProfileFields(profile, record.checkType);
  const envFields = fields.filter((field) => ENV_FIELD_KEYS.has(String(field.key)));
  const engineFields = fields.filter((field) => !ENV_FIELD_KEYS.has(String(field.key)));
  const engineRows = getEnginesFromRecord(record);
  const executionMode = isInputOnlyRecord(record) ? "input_only" : getExecutionMode(profile);
  const computedResults = executionMode === "input_only"
    ? undefined
    : engineRows.map((engine) => engine.result).filter(Boolean) as PowerCheckResult[];

  return {
    registration,
    profile,
    executionMode,
    checkType: record.checkType,
    engines: engineRows.map((engine) => ({ id: engine.engineId, label: engine.engineLabel })),
    envFields,
    engineFields,
    envValues: (engineRows[0]?.values ?? {}) as PowerCheckValues,
    engineValues: engineRows.map((engine) => engine.values ?? {}),
    computedResults,
    exportedAt: new Date(),
    checkPerformedAt: new Date(record.createdAtIso),
    calculationVersion:
      record.calculationVersion ??
      (executionMode === "calculated" ? CALC_VERSIONS[profile.calculationId] : undefined),
  };
}
async function addFooter(
  doc: jsPDF,
  exportedAt: Date,
  calculationVersion: string | undefined,
  payload: EpcPdfPayload,
): Promise<void> {
  const pageCount = doc.getNumberOfPages();
  const footerDate = exportedAt.toLocaleString();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    doc.setDrawColor(220, 220, 220);
    doc.line(14, height - 22, width - 14, height - 22);

    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(`Print Date: ${footerDate}`, 14, height - 11);
    doc.text(APP_VERSION_PLACEHOLDER, width - 14, height - 16, { align: "right" });
    await addSvgToPdf(doc, haulogoSvg, width / 2 - 11.5, height - 18, 23, 11);
    doc.text(
      payload.executionMode === "input_only"
        ? "Based on: Input-only profile"
        : `Based on: ${payload.profile.calculationId} - ${calculationVersion ?? "Unknown"}`,
      width - 14,
      height - 11,
      { align: "right" },
    );
  }
}

function getEpcPdfFilename(payload: EpcPdfPayload): string {
  const datePart = payload.checkPerformedAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `EPC${datePart}${payload.registration.tailNumber}.pdf`;
}

export async function buildEpcPdfDocument(payload: EpcPdfPayload): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const bottomGuard = 24;
  let cursorY = 18;

  const ensureSpace = (needed = 10) => {
    if (cursorY + needed <= pageHeight - bottomGuard) return;
    doc.addPage();
    cursorY = 18;
  };

  const sectionTitle = (title: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(25, 25, 25);
    doc.text(title, marginX, cursorY);
    cursorY += 6;
  };

  const bodyLine = (label: string, value: string, indent = 0) => {
    ensureSpace(7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(35, 35, 35);
    doc.text(`${label}:`, marginX + indent, cursorY);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginX + indent + 45, cursorY);
    cursorY += 5.5;
  };

  const bodyParagraph = (text: string) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 5 + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(55, 55, 55);
    doc.text(lines, marginX, cursorY);
    cursorY += lines.length * 5;
  };

  await addSvgToPdf(doc, epclogoSvg, marginX, cursorY - 4, 33, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(25, 25, 25);
  doc.text("Engine Power Check Report", marginX + 40, cursorY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(
    payload.executionMode === "input_only" ? "Generated from saved input values" : "Generated from calculation results",
    marginX + 40,
    cursorY + 10,
  );

  cursorY += 22;
  sectionTitle("Check Details");
  bodyLine("Registration", payload.registration.tailNumber);
  bodyLine("Aircraft", `${payload.profile.modelName} (${payload.profile.engine})`);
  bodyLine("EPC Type", payload.checkType);
  bodyLine("EPC Perf.", payload.checkPerformedAt.toLocaleString());
  bodyLine("Profile Mode", payload.executionMode === "input_only" ? "Input Only" : "Calculated");
  cursorY += 3;

  sectionTitle("Input Values");
  if (payload.envFields.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("General", marginX, cursorY);
    cursorY += 5;

    for (const field of payload.envFields) {
      bodyLine(fieldLabel(field), formatValue(field, payload.envValues[String(field.key)]), 4);
    }
    cursorY += 2;
  }

  for (const [index, engine] of payload.engines.entries()) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 25);
    doc.text(engine.label, marginX, cursorY);
    cursorY += 5;

    if (payload.engineFields.length === 0) {
      bodyParagraph("This check type has no engine-specific input fields.");
      continue;
    }

    for (const field of payload.engineFields) {
      bodyLine(fieldLabel(field), formatValue(field, payload.engineValues[index]?.[String(field.key)]), 4);
    }
    cursorY += 8;
  }
  if (payload.executionMode === "calculated" && payload.computedResults && payload.computedResults.length > 0) {
    sectionTitle("Results");
    const overallPass = payload.computedResults.every((result) => result.pass);
    bodyLine("Overall Result", overallPass ? "PASS" : "FAIL");
    cursorY += 2;

    for (const [index, engine] of payload.engines.entries()) {
      const result = payload.computedResults[index];
      if (!result) continue;
      const metrics = getDisplayMetrics(result, payload.profile.calculationId);

      ensureSpace(Math.max(18, metrics.length * 18 + 10));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(25, 25, 25);
      doc.text(`${engine.label} - ${result.pass ? "PASS" : "FAIL"}`, marginX, cursorY);
      cursorY += 6;

      for (const metric of metrics) {
        ensureSpace(16);
        doc.setDrawColor(225, 225, 225);
        doc.roundedRect(marginX, cursorY - 3, contentWidth, 16, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(metric.title, marginX + 3, cursorY + 1);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`${metric.expectedLabel}: ${formatMetricValue(metric, metric.expected)}`, marginX + 3, cursorY + 6);
        doc.text(`${metric.actualLabel}: ${formatMetricValue(metric, metric.actual)}`, marginX + 3, cursorY + 10);
        doc.text(`${metric.deltaLabel}: ${formatMetricValue(metric, metric.delta)}`, marginX + 80, cursorY + 6);
        doc.text(`Status: ${metric.pass ? "PASS" : "FAIL"}`, marginX + 80, cursorY + 10);
        cursorY += 20;
      }
    }
  } else {
    sectionTitle("Result Mode");
    bodyParagraph("No calculation was performed for this profile. This PDF contains the saved check inputs only.");
  }

  await addFooter(doc, payload.exportedAt, payload.calculationVersion, payload);
  return doc;
}

export async function createEpcResultPdfBlob(payload: EpcPdfPayload): Promise<Blob> {
  const doc = await buildEpcPdfDocument(payload);
  return doc.output("blob");
}

export async function downloadEpcResultPdf(payload: EpcPdfPayload): Promise<void> {
  const doc = await buildEpcPdfDocument(payload);
  doc.save(getEpcPdfFilename(payload));
}

export async function downloadSavedCheckPdf(
  record: PowerCheckRecord,
  registration: Registration,
  profile: AircraftProfile,
): Promise<void> {
  await downloadEpcResultPdf(createEpcPdfPayloadFromRecord(record, registration, profile));
}

export async function createSavedCheckPdfBlob(
  record: PowerCheckRecord,
  registration: Registration,
  profile: AircraftProfile,
): Promise<Blob> {
  return createEpcResultPdfBlob(createEpcPdfPayloadFromRecord(record, registration, profile));
}
