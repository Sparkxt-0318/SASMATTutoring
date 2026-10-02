/**
 * One CSV cell. Quotes values that need it, and defuses spreadsheet formulas:
 * a student could type "=HYPERLINK(...)" as their name, and Excel or Sheets
 * would run it when an officer opens the export.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

export function csvResponse(lines: string[], filename: string): Response {
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
