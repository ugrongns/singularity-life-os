'use client';

import React, { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseTurkishBankCsv, ParsedBankCsvRow } from '@/lib/bank-csv-parser';

interface BankCsvImportModalProps {
  isOpen: boolean;
  accounts: Array<{ id: string; name: string; type: string; currency: string }>;
  categories: Array<{ id: string; name: string; type?: string }>;
  existingTransactions: Array<{ transaction_date: string; amount: number; merchant?: string | null }>;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function BankCsvImportModal({
  isOpen,
  accounts,
  categories,
  existingTransactions,
  onClose,
  onSuccess
}: BankCsvImportModalProps) {
  const [rows, setRows] = useState<ParsedBankCsvRow[]>([]);
  const [walletId, setWalletId] = useState<string>(accounts[0]?.id || '');
  const [expenseCatId, setExpenseCatId] = useState<string>(
    categories.find(c => c.type !== 'income')?.id || categories[0]?.id || ''
  );
  const [incomeCatId, setIncomeCatId] = useState<string>(
    categories.find(c => c.type === 'income')?.id || categories[0]?.id || ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const activeWalletId = walletId || accounts[0]?.id || '';
  const activeExpenseCatId = expenseCatId || categories.find(c => c.type !== 'income')?.id || categories[0]?.id || '';
  const activeIncomeCatId = incomeCatId || categories.find(c => c.type === 'income')?.id || categories[0]?.id || '';
  const selectedRows = rows.filter(r => r.selected);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTurkishBankCsv(text, existingTransactions);
      if (parsed.length === 0) {
        setErrorMsg('CSV dosyası ayrıştırılamadı ("Tarih" ve "Tutar" sütunları bulunamadı).');
        return;
      }
      setRows(parsed);
    } catch {
      setErrorMsg('Dosya okunurken hata oluştu.');
    }
  };

  const handleConfirmImport = async () => {
    if (selectedRows.length === 0 || !activeWalletId || importing) return;
    setImporting(true);
    setErrorMsg(null);
    let savedCount = 0;
    let failedCount = 0;
    let lastError = '';

    try {
      for (const r of selectedRows) {
        const chosenCatId = r.txType === 'income' ? activeIncomeCatId : activeExpenseCatId;
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_id: activeWalletId,
            type: r.txType,
            category_id: chosenCatId || undefined,
            merchant: r.description,
            amount: r.amount,
            transaction_date: r.date,
            notes: 'TR Banka CSV İçe Aktarım'
          })
        });
        const j = await res.json();
        if (res.ok && j.success) {
          savedCount++;
        } else {
          failedCount++;
          lastError = j.error || `HTTP ${res.status}`;
        }
      }

      if (savedCount === 0 && failedCount > 0) {
        setErrorMsg(`İşlemler aktarılamadı (${failedCount} hata): ${lastError}`);
        return;
      }

      setRows([]);
      onSuccess(
        failedCount > 0
          ? `📥 ${savedCount} banka hareketi aktarıldı, ${failedCount} satır atlandı (${lastError}).`
          : `📥 ${savedCount} banka hareketi onaylanarak bütçeye aktarıldı!`
      );
      onClose();
    } catch {
      setErrorMsg('İşlemler kaydedilirken hata oluştu.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '720px',
          width: '100%',
          maxHeight: '88dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>📥 TR Banka Ekstresi CSV İçe Aktarma</h3>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Önizleme &amp; Onay Kalkanı: Mükerrer satırlar işaretlenir, onayınız olmadan kayıt yapılmaz
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Hedef Hesap / Cüzdan</label>
              <select value={activeWalletId} onChange={e => setWalletId(e.target.value)} className="input" style={{ width: '100%', fontSize: '12px', marginTop: '3px' }}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Varsayılan Gider Kategorisi</label>
              <select value={activeExpenseCatId} onChange={e => setExpenseCatId(e.target.value)} className="input" style={{ width: '100%', fontSize: '12px', marginTop: '3px' }}>
                {categories.filter(c => c.type !== 'income').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Varsayılan Gelir Kategorisi</label>
              <select value={activeIncomeCatId} onChange={e => setIncomeCatId(e.target.value)} className="input" style={{ width: '100%', fontSize: '12px', marginTop: '3px' }}>
                {categories.filter(c => c.type === 'income').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <label style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '14px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <Upload size={20} style={{ color: '#10B981' }} />
            <span style={{ fontSize: '12px', fontWeight: 800 }}>Banka Ekstresi CSV Dosyası Seçin</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Noktalı virgül (;) veya virgül (,) destekli Türkçe tarih &amp; tutar formatı</span>
            <input type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>

          {errorMsg && (
            <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {rows.length > 0 && (
            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Seç</th>
                    <th style={{ padding: '8px' }}>Tarih</th>
                    <th style={{ padding: '8px' }}>Açıklama</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Tutar</th>
                    <th style={{ padding: '8px' }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={`${r.date}-${idx}`} style={{ borderTop: '1px solid var(--border)', opacity: r.isDuplicate ? 0.6 : 1 }}>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() => setRows(prev => prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)))}
                        />
                      </td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{r.description}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: r.txType === 'income' ? '#10B981' : '#DC2626' }}>
                        {r.txType === 'income' ? '+' : '-'}{r.amount.toLocaleString('tr-TR')} ₺
                      </td>
                      <td style={{ padding: '8px', fontSize: '11px', fontWeight: 700 }}>
                        {r.isDuplicate ? (
                          <span style={{ color: '#F59E0B' }}>Mükerrer</span>
                        ) : (
                          <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={12} /> Yeni
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} className="btn-subtle" style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}>
            İptal
          </button>
          <button
            type="button"
            disabled={selectedRows.length === 0 || importing}
            onClick={handleConfirmImport}
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: '12px', fontWeight: 800 }}
          >
            {importing ? 'Aktarılıyor...' : `${selectedRows.length} İşlemi Onayla ve Aktar`}
          </button>
        </div>
      </div>
    </div>
  );
}
