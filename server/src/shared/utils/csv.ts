// Minimal RFC 4180 CSV writer.
//
// Spreadsheet formula injection: a cell that starts with = + - @ (or a tab / CR) is executed as a
// formula by Excel and Google Sheets. Names and emails are user-supplied, so such cells get a
// leading apostrophe, which makes the spreadsheet treat them as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}