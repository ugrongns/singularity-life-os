'use client';
import { useState, useEffect } from 'react';
import { CreditCard, X, Download, Calendar } from 'lucide-react';
import { generateCSVContent, downloadCSV, CSVColumn } from '@/lib/export-csv';

interface Props {
  isOpen: boolean;
  accountId: string | null;
  onClose: () => void;
}

export default function CreditCardStatementModal({ isOpen, accountId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'installments' | 'single'>('installments');

  useEffect(() => {
    if (isOpen && accountId) {
      setLoading(true);
      fetch(`/api/budget/card-statement?account_id=${accountId}`)
        .then(res => res.json())
        .then(json => {
          if (json.success) setData(json.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, accountId]);

  // ESC tuşuyla kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !accountId) return null;

  const handleExportStatementCSV = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];

    (data.activeInstallments || []).forEach((inst: any) => {
      rows.push([
        inst.first_date || '—',
        inst.merchant || 'Taksitli Harcama',
        'Taksitli',
        `${inst.current_installment_number || 1}/${inst.total_installments}`,
        inst.monthly_amount || 0,
        inst.total_amount || 0,
        inst.remaining_amount || 0
      ]);
    });

    (data.singleTransactions || []).forEach((tx: any) => {
      rows.push([
        tx.transaction_date || '—',
        tx.merchant || 'Tek Çekim',
        'Tek Çekim',
        '1/1',
        tx.amount || 0,
        tx.amount || 0,
        0
      ]);
    });

    const columns: CSVColumn<(string | number)[]>[] = [
      { header: 'Tarih', accessor: r => r[0] },
      { header: 'Harcama Noktası', accessor: r => r[1] },
      { header: 'İşlem Tipi', accessor: r => r[2] },
      { header: 'Taksit Durumu', accessor: r => r[3] },
      { header: 'Aylık Tutar (TL)', accessor: r => r[4] },
      { header: 'Toplam Tutar (TL)', accessor: r => r[5] },
      { header: 'Kalan Borç (TL)', accessor: r => r[6] },
    ];

    const csvStr = generateCSVContent(columns, rows);
    const filename = `kredi-karti-ekstre-${(data.card?.name || 'kart').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, csvStr);
  };

  const formatTRY = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
      const d = new Date(dateStr).getDate().toString().padStart(2, '0');
      const m = (new Date(dateStr).getMonth() + 1).toString().padStart(2, '0');
      const y = new Date(dateStr).getFullYear();
      return `${d}.${m}.${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="sheet-handle" />
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-indigo">
              <CreditCard size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {data?.card?.name || 'Kredi Kartı Ekstre Detayı'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                Anlık harcama geçmişi, taksitler ve hesap kesim özeti
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {data && (
              <button
                onClick={handleExportStatementCSV}
                title="Ekstre detayını CSV olarak indir"
                className="btn-subtle"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '6px 12px', borderRadius: 'var(--radius-full)',
                  fontSize: '11px', fontWeight: 700, minHeight: '34px'
                }}
              >
                <Download size={13} strokeWidth={1.75} />
                <span>Ekstre CSV</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Kapat"
              style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Kart ekstresi yükleniyor...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Kart Özet Kutuları */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--rose-bg)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', color: 'var(--rose)', fontWeight: 800 }}>📌 BU AY ÖDENECEK GÜNCEL EKSTRE</div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--rose)', marginTop: '2px' }}>
                  {formatTRY(data?.summary?.currentStatementDebt || 0)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Tek Çekim + Bu Ayki Taksit Dilimi
                </div>
              </div>

              <div style={{ background: 'var(--emerald-bg)', border: '1px solid rgba(16,185,129,0.3)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800 }}>KALAN KULLANILABİLİR LİMİT</div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--emerald)', marginTop: '2px' }}>
                  {formatTRY(data?.card?.available_limit || 0)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Toplam Limit: {formatTRY(data?.card?.credit_limit || 0)}
                </div>
              </div>
            </div>

            {/* Gelecek Aylara Sarkan Borç Bilgisi */}
            {(data?.summary?.futureInstallmentDebt || 0) > 0 && (
              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ⏳ Gelecek Aylara Sarkan Taksit Borcu:
                </div>
                <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatTRY(data?.summary?.futureInstallmentDebt || 0)}
                </div>
              </div>
            )}

            {/* Sekme Değiştirici */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('installments')}
                style={{
                  background: 'none', border: 'none', padding: '6px 12px', fontSize: '13px', fontWeight: 700,
                  color: activeTab === 'installments' ? 'var(--emerald)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'installments' ? '2px solid var(--emerald)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Aktif Taksitler ({data?.activeInstallments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                style={{
                  background: 'none', border: 'none', padding: '6px 12px', fontSize: '13px', fontWeight: 700,
                  color: activeTab === 'single' ? 'var(--emerald)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'single' ? '2px solid var(--emerald)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Bu Dönemki Tek Çekimler ({data?.singleTransactions?.length || 0})
              </button>
            </div>

            {/* Tab İçerikleri */}
            {activeTab === 'installments' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                {(!data?.activeInstallments || data.activeInstallments.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Bu kartta aktif taksitli harcama bulunmuyor.
                  </div>
                ) : (
                  data.activeInstallments.map((inst: any) => (
                    <div
                      key={inst.id}
                      style={{
                        padding: '12px', background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>{inst.merchant}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} strokeWidth={1.75} />
                          <span>İlk Taksit: {formatDate(inst.first_date)} • {inst.category_name}</span>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--indigo)', marginTop: '4px' }}>
                          Kalan Taksit: {inst.current_installment_number || 1} / {inst.total_installments}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--rose)' }}>
                          {formatTRY(inst.monthly_amount)} / ay
                        </div>
                        <div className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Kalan Toplam: {formatTRY(inst.remaining_amount)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                {(!data?.singleTransactions || data.singleTransactions.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Bu ekstre döneminde tek çekim harcama bulunmuyor.
                  </div>
                ) : (
                  data.singleTransactions.map((tx: any) => (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{tx.merchant}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} strokeWidth={1.75} />
                          <span>{formatDate(tx.transaction_date)} • {tx.category_name}</span>
                        </div>
                      </div>

                      <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                        -{formatTRY(tx.amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sabit Alt Kapat Butonu */}
            <div className="modal-sticky-footer" style={{ textAlign: 'right' }}>
              <button
                onClick={onClose}
                className="btn-primary"
                style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700, width: 'auto', minHeight: '44px' }}
              >
                Kapat
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
