import { lineTotal, type JobCostLine } from "@/components/portal/use-job-costing";

export const GENERAL_SECTION = "";

export type LineSectionGroup = {
  key: string;
  label: string;
  lines: JobCostLine[];
  total: number;
};

/** Preserve first-seen section order from the flat line array. */
export function groupLinesBySection(lines: JobCostLine[]): LineSectionGroup[] {
  const order: string[] = [];
  const map = new Map<string, JobCostLine[]>();
  for (const line of lines) {
    const key = String(line.section || "").trim();
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(line);
  }
  // Always show at least a General block so the default section is visible/editable.
  if (!order.length) {
    return [
      {
        key: GENERAL_SECTION,
        label: "General",
        lines: [],
        total: 0,
      },
    ];
  }
  return order.map((key) => {
    const sectionLines = map.get(key) || [];
    return {
      key,
      label: key || "General",
      lines: sectionLines,
      total: sectionLines.reduce((sum, line) => sum + lineTotal(line), 0),
    };
  });
}

export function setLineSection(
  lines: JobCostLine[],
  lineId: string,
  section: string,
): JobCostLine[] {
  const next = String(section || "").trim();
  return lines.map((line) =>
    line.id === lineId
      ? { ...line, ...(next ? { section: next } : { section: undefined }) }
      : line,
  );
}

export function renameSection(
  lines: JobCostLine[],
  fromKey: string,
  toLabel: string,
): JobCostLine[] {
  const raw = String(toLabel || "").trim();
  // "General" is the default unsectioned bucket — store as empty section.
  const next =
    !raw || raw.toLowerCase() === "general" ? "" : raw;
  const from = String(fromKey || "").trim();
  return lines.map((line) => {
    const key = String(line.section || "").trim();
    if (key !== from) return line;
    return next ? { ...line, section: next } : { ...line, section: undefined };
  });
}

/** Remove a named section — lines move to General (empty section). */
export function removeSection(lines: JobCostLine[], sectionKey: string): JobCostLine[] {
  const key = String(sectionKey || "").trim();
  if (!key) return lines;
  return lines.map((line) =>
    String(line.section || "").trim() === key
      ? { ...line, section: undefined }
      : line,
  );
}

export function addEmptySectionPlaceholder(
  lines: JobCostLine[],
  sectionName: string,
  createLine: () => JobCostLine,
): JobCostLine[] {
  const name = String(sectionName || "").trim();
  if (!name) return lines;
  const exists = lines.some((line) => String(line.section || "").trim() === name);
  if (exists) return lines;
  return [...lines, { ...createLine(), section: name }];
}
