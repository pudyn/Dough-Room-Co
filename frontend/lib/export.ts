import * as XLSX from "xlsx";

export function exportToExcel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[],
  columns: { key: string; label: string; format?: (val: unknown) => string }[],
  filename: string
) {
  if (data.length === 0) return;

  const rows = data.map((row: Record<string, unknown>) =>
    Object.fromEntries(
      columns.map(col => {
        const val = row[col.key];
        return [col.label, col.format ? col.format(val) : (val ?? "")];
      })
    )
  );

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = columns.map(col => {
    const maxLen = Math.max(
      col.label.length,
      ...data.map((row: Record<string, unknown>) => {
        const val = col.format ? col.format(row[col.key]) : String(row[col.key] ?? "");
        return val.length;
      })
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
