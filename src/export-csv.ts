export function exportCsv(name: string, rows: (number | string)[][]) {
  const escape = (cell: number | string) => {
    const text = String(cell);
    const safe =
      typeof cell === "string" && /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const csv =
    "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
