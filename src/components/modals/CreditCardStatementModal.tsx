'use client';
import { useState, useEffect, useMemo } from 'react';
import { CreditCard, X, Download, Calendar, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleExportStatementCSV = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];

    (data.activeInstallments || []).forEach((inst: any) => {
      rows.push([
        inst.first_date || '—',
        inst.merchant || 'Taksitli Harcama',
        inst.category_name || 'Genel',
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
        tx.category_name || 'Genel',
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
      { header: 'Kategori', accessor: r => r[2] },
      { header: 'İşlem Tipi', accessor: r => r[3] },
      { header: 'Taksit Durumu', accessor: r => r[4] },
      { header: 'Aylık Tutar (TL)', accessor: r => r[5] },
      { header: 'Toplam Tutar (TL)', accessor: r => r[6] },
      { header: 'Kalan Borç (TL)', accessor: r => r[6] },
    ];

    const csvStr = generateCSVContent(columns, rows);
    const filename = `kredi-karti-ekstre-${(data.card?.name || 'kart').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, csvStr);
  };

  const formatTRY = (val: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(val || 0);
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

  // Arama filtresi
  const filteredInstallments = useMemo(() => {
    const list = data?.activeInstallments || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((inst: any) =>
      (inst.merchant && inst.merchant.toLowerCase().includes(q)) ||
      (inst.category_name && inst.category_name.toLowerCase().includes(q))
    );
  }, [data?.activeInstallments, searchQuery]);

  const filteredSingle = useMemo(() => {
    const list = data?.singleTransactions || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((tx: any) =>
      (tx.merchant && tx.merchant.toLowerCase().includes(q)) ||
      (tx.category_name && tx.category_name.toLowerCase().includes(q))
    );
  }, [data?.singleTransactions, searchQuery]);

  if (!isOpen || !accountId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px' }}>
        <div className="sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-indigo" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
              <CreditCard size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
                {data?.card?.name || 'Kredi Kartı Ekstre Detayı'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                Anlık harcama geçmişi, taksitler ve hesap kesim özeti
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            {/* Arama Inputu */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '5px 10px 5px 26px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                  fontSize: '11px',
                  width: '120px',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }} />
            </div>

            {data && (
              <button
                onClick={handleExportStatementCSV}
                title="Ekstre detayını CSV olarak indir"
                className="btn-subtle"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '6px 12px', borderRadius: 'var(--radius-full)',
                  fontSize: '11px', fontWeight: 700, minHeight: '32px'
                }}
              >
                <Download size={13} strokeWidth={1.75} />
                <span>CSV İndir</span>
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
            {/* Kart Özet KPI Kutuları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div style={{ background: 'var(--rose-bg)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px 14px', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '11px', color: 'var(--rose)', fontWeight: 800 }}>📌 BU AY ÖDENECEK GÜNCEL EKSTRE</div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--rose)', marginTop: '2px' }}>
                  {formatTRY(data?.summary?.currentStatementDebt || 0)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Tek Çekim + Bu Ayki Taksit Dilimi
                </div>
              </div>

              <div style={{ background: 'var(--emerald-bg)', border: '1px solid rgba(16,185,129,0.3)', padding: '12px 14px', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800 }}>KALAN KULLANILABİLİR LİMİT</div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--emerald)', marginTop: '2px' }}>
                  {formatTRY(data?.card?.available_limit || 0)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Toplam Limit: {formatTRY(data?.card?.credit_limit || 0)}
                </div>
              </div>

              {(data?.summary?.futureInstallmentDebt || 0) > 0 && (
                <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '12px 14px', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>⏳ GELECEK AYLARA SARKAN BORÇ</div>
                  <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                    {formatTRY(data?.summary?.futureInstallmentDebt || 0)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Önümüzdeki ayların taksit taahhütleri
                  </div>
                </div>
              )}
            </div>

            {/* Sekme Değiştirici */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('installments')}
                style={{
                  background: 'none', border: 'none', padding: '6px 12px', fontSize: '13px', fontWeight: 800,
                  color: activeTab === 'installments' ? 'var(--indigo)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'installments' ? '2px solid var(--indigo)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Aktif Taksitler ({filteredInstallments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                style={{
                  background: 'none', border: 'none', padding: '6px 12px', fontSize: '13px', fontWeight: 800,
                  color: activeTab === 'single' ? 'var(--indigo)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'single' ? '2px solid var(--indigo)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Bu Dönemki Tek Çekimler ({filteredSingle.length})
              </button>
            </div>

            {/* Tab İçerikleri: Masaüstünde Geniş Veri Tablosu */}
            {activeTab === 'installments' ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredInstallments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {searchQuery ? 'Aramanıza uygun taksitli işlem bulunamadı.' : 'Bu kartta aktif taksitli harcama bulunmuyor.'}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>İlk Taksit</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Harcama Noktası</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Kategori</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Taksit Durumu</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Aylık Tutar</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Kalan Borç</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInstallments.map((inst: any) => (
                        <tr key={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="tabular-nums" style={{ padding: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(inst.first_date)}
                          </td>
                          <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {inst.merchant}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                            <span style={{ background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '11px' }}>
                              {inst.category_name || 'Genel'}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--indigo)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '11px' }}>
                              {inst.current_installment_number || 1} / {inst.total_installments}
                            </span>
                          </td>
                          <td className="tabular-nums" style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: 'var(--rose)' }}>
                            {formatTRY(inst.monthly_amount)}
                          </td>
                          <td className="tabular-nums" style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>
                            {formatTRY(inst.remaining_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredSingle.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {searchQuery ? 'Aramanıza uygun tek çekim işlem bulunamadı.' : 'Bu ekstre döneminde tek çekim harcama bulunmuyor.'}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Tarih</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Harcama Noktası</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Kategori</th>
                        <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSingle.map((tx: any) => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="tabular-nums" style={{ padding: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(tx.transaction_date)}
                          </td>
                          <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {tx.merchant}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                            <span style={{ background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '11px' }}>
                              {tx.category_name || 'Genel'}
                            </span>
                          </td>
                          <td className="tabular-nums" style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>
                            -{formatTRY(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Sabit Alt Kapat Butonu */}
            <div className="modal-sticky-footer" style={{ textAlign: 'right' }}>
              <button
                onClick={onClose}
                className="btn-primary"
                style={{ padding: '8px 24px', fontSize: '13px', fontWeight: 700, width: 'auto', minHeight: '40px' }}
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
