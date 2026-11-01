/**
 * Singularity Life OS - Finansal Veri CSV Dışa Aktarma Motoru
 * RFC 4180 Uyumlu, Türkçe Excel İçin UTF-8 BOM (\uFEFF) ve Noktalı Virgül (;) Ayracı
 */

export interface CSVColumn<T> {
  header: string;
  accessor: (item: T) => string | number | undefined | null;
}

export function generateCSVContent<T>(columns: CSVColumn<T>[], items: T[]): string {
  const sanitizeCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return String(val);

    const str = String(val);
    // OWASP Formula Injection (CSV Injection) Koruması:
    // Hücre '=', '+', '-', '@', '\t', '\r' ile başlıyorsa Excel/Calc formülü gibi çalıştırılmaması için tek tırnak eklenir.
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    if (dangerousPrefixes.some(prefix => str.startsWith(prefix))) {
      return `'${str}`;
    }
    return str;
  };

  const escapeCell = (cell: any) => {
    const sanitized = sanitizeCell(cell);
    const str = sanitized.replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = columns.map(c => escapeCell(c.header)).join(';');
  const dataRows = items.map(item =>
    columns.map(c => escapeCell(c.accessor(item))).join(';')
  );

  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}

export function downloadCSV(filename: string, csvContent: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
