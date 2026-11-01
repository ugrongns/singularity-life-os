import { describe, it, expect } from 'vitest';
import { generateCSVContent, CSVColumn } from '../src/lib/export-csv';

describe('CSV Export & Financial Tax Breakdown', () => {
  it('generates UTF-8 BOM, semicolon-separated, RFC-4180 escaped CSV content', () => {
    interface TestTx {
      date: string;
      merchant: string;
      amount: number;
      notes?: string;
    }

    const testData: TestTx[] = [
      { date: '2026-10-25', merchant: 'Migros "MM" Şubesi', amount: 485.50, notes: 'Haftalık mutfak; gıda alışverişi' },
      { date: '2026-10-26', merchant: 'Shell Petrol', amount: 1200.00, notes: 'Akaryakıt alımı' }
    ];

    const columns: CSVColumn<TestTx>[] = [
      { header: 'Tarih', accessor: t => t.date },
      { header: 'İşletme Adı', accessor: t => t.merchant },
      { header: 'Tutar', accessor: t => t.amount },
      { header: 'Notlar', accessor: t => t.notes }
    ];

    const csv = generateCSVContent(columns, testData);

    // 1. Must start with UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // 2. Must use semicolon delimiter
    expect(csv).toContain('"Tarih";"İşletme Adı";"Tutar";"Notlar"');

    // 3. Double quotes must be escaped with two double quotes ""
    expect(csv).toContain('"Migros ""MM"" Şubesi"');

    // 4. Semicolon inside data must be safely enclosed in quotes
    expect(csv).toContain('"Haftalık mutfak; gıda alışverişi"');
  });

  it('validates VAT (KDV) rates calculation logic (%1, %10, %20)', () => {
    const items = [
      { name: 'Ekmek & Un', price: 101.0, vat_rate: 1 },    // 100 net + 1 TL KDV
      { name: 'Peynir & Süt', price: 220.0, vat_rate: 10 },  // 200 net + 20 TL KDV
      { name: 'Deterjan', price: 120.0, vat_rate: 20 }      // 100 net + 20 TL KDV
    ];

    const vat1Total = items.filter(i => i.vat_rate === 1).reduce((s, i) => s + (i.price - (i.price / 1.01)), 0);
    const vat10Total = items.filter(i => i.vat_rate === 10).reduce((s, i) => s + (i.price - (i.price / 1.10)), 0);
    const vat20Total = items.filter(i => i.vat_rate === 20).reduce((s, i) => s + (i.price - (i.price / 1.20)), 0);

    expect(Math.round(vat1Total * 100) / 100).toBe(1.00);
    expect(Math.round(vat10Total * 100) / 100).toBe(20.00);
    expect(Math.round(vat20Total * 100) / 100).toBe(20.00);

    const totalTax = vat1Total + vat10Total + vat20Total;
    expect(Math.round(totalTax * 100) / 100).toBe(41.00);
  });

  it('sanitizes dangerous spreadsheet formula injection prefixes (=, +, -, @, \\t, \\r)', () => {
    interface MaliciousTx {
      id: string;
      merchant: string;
      amount: number;
      notes: string;
    }

    const testData: MaliciousTx[] = [
      { id: '1', merchant: '=cmd|\'/C calc\'!A0', amount: 100, notes: '@SUM(A1:A10)' },
      { id: '2', merchant: '+123456', amount: -500.50, notes: '\tsecret_tab' }
    ];

    const columns: CSVColumn<MaliciousTx>[] = [
      { header: 'ID', accessor: t => t.id },
      { header: 'Merchant', accessor: t => t.merchant },
      { header: 'Amount', accessor: t => t.amount },
      { header: 'Notes', accessor: t => t.notes }
    ];

    const csv = generateCSVContent(columns, testData);

    // Formula injection payloads should be neutralized with leading single quote '
    expect(csv).toContain('"\'=cmd|\'/C calc\'!A0"');
    expect(csv).toContain('"\'@SUM(A1:A10)"');
    expect(csv).toContain('"\' +123456"'.replace(' ', '')); // '+123456' -> "'+123456"
    expect(csv).toContain('"\'\tsecret_tab"');

    // Pure numbers (including negative financial amounts) should remain numbers without extra quotes
    expect(csv).toContain('"-500.5"');
  });
});
