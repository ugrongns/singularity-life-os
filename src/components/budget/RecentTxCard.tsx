'use client';
import { useState, useMemo } from 'react';
import { generateCSVContent, downloadCSV, CSVColumn } from '@/lib/export-csv';

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  transaction_date: string;
  is_installment: number;
  installment_number?: number;
  total_installments?: number;
  category_name?: string;
  category_icon?: string;
  wallet_name?: string;
  vat_rate?: number;
  vat_amount?: number;
  notes?: string;
  member_avatar?: string;
  member_name?: string;
  is_mine?: boolean;
  can_delete?: boolean;
}

interface UpcomingPayment {
  id: string;
  title: string;
  category: string;
  amount: number;
  due_date: string;
  days_left: number;
  badge: string;
  type?: string;
}

interface RecentTxProps {
  transactions: Transaction[];
  upcomingPayments?: UpcomingPayment[];
  onUpdate?: (msg?: string) => void;
  onOpenCardStatement?: (accId: string) => void;
}

export default function RecentTxCard({ transactions, upcomingPayments = [], onUpdate, onOpenCardStatement }: RecentTxProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'upcoming'>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const formatTRY = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}.${m}.${y}`;
    } catch {
      return dateStr;
    }
  };

  // Canlı Arama Filtrelemesi
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter(t =>
      (t.merchant && t.merchant.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      (t.category_name && t.category_name.toLowerCase().includes(q)) ||
      (t.wallet_name && t.wallet_name.toLowerCase().includes(q)) ||
      (t.member_name && t.member_name.toLowerCase().includes(q))
    );
  }, [transactions, searchQuery]);

  const handleExportCSV = () => {
    if (!filteredTransactions.length) return;
    const columns: CSVColumn<Transaction>[] = [
      { header: 'Tarih', accessor: t => t.transaction_date },
      { header: 'İşletme / Açıklama', accessor: t => t.merchant },
      { header: 'Kategori', accessor: t => t.category_name || 'Genel' },
      { header: 'Hesap / Cüzdan', accessor: t => t.wallet_name || 'Banka' },
      { header: 'Harcayan', accessor: t => t.member_name || (t.is_mine ? 'Ben' : 'Ortak') },
      { header: 'Taksit', accessor: t => t.is_installment ? `${t.installment_number || 1}/${t.total_installments || 1}` : 'Tek Çekim' },
      { header: 'KDV Oranı (%)', accessor: t => t.vat_rate ? `%${t.vat_rate}` : '—' },
      { header: 'Tutar (TL)', accessor: t => t.amount },
      { header: 'Para Birimi', accessor: t => t.currency || 'TRY' },
      { header: 'Notlar', accessor: t => t.notes || '' }
    ];
    const csv = generateCSVContent(columns, filteredTransactions);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`harcamalar_${dateStr}.csv`, csv);
  };

  const handleDeleteTx = async (txId: string, merchant: string) => {
    if (!confirm(`"${merchant}" harcama kaydını silmek istediğinize emin misiniz? Bakiye hesabınıza iade edilecektir.`)) return;

    try {
      const res = await fetch(`/api/transactions?id=${txId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success && onUpdate) {
        onUpdate(json.message);
      }
    } catch (err) {
      alert('Silme işlemi başarısız.');
    }
  };

  return (
    <div className="card">
      {/* Kart Başlık ve Arama / CSV Toolbar */}
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">
          <span>💳</span>
          <span>Harcama & Ödeme Takvimi</span>
        </div>

        {activeTab === 'recent' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Arama Çubuğu */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Harcama veya kişi ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '5px 10px 5px 26px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                  fontSize: '11px',
                  width: '160px',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', opacity: 0.5, pointerEvents: 'none' }}>
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>

            {filteredTransactions.length > 0 && (
              <button
                onClick={handleExportCSV}
                title="Harcamaları Excel / CSV formatında indir"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  height: '28px'
                }}
              >
                <span>📥</span>
                <span>CSV İndir</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sekme Seçici */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
        <button
          className={`choice-pill ${activeTab === 'recent' ? 'selected' : ''}`}
          onClick={() => setActiveTab('recent')}
          style={{ flex: 1, padding: '7px', fontSize: '12px', fontWeight: activeTab === 'recent' ? 800 : 600 }}
        >
          ⏱️ Son Harcamalar ({filteredTransactions.length})
        </button>
        <button
          className={`choice-pill ${activeTab === 'upcoming' ? 'selected' : ''}`}
          onClick={() => setActiveTab('upcoming')}
          style={{ flex: 1, padding: '7px', fontSize: '12px', fontWeight: activeTab === 'upcoming' ? 800 : 600 }}
        >
          📅 Yaklaşan Ödemeler ({upcomingPayments.length})
        </button>
      </div>

      {/* 1. SEKME: SON HARCAMALAR */}
      {activeTab === 'recent' && (
        <div>
          {filteredTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              {searchQuery ? 'Aramanıza uygun harcama kaydı bulunamadı.' : 'Henüz harcama kaydı bulunmuyor.'}
            </div>
          ) : (
            <>
              {/* 📱 A) MOBİL GÖRÜNÜM (Sadece 768px altında görünür) */}
              <div className="mobile-only-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredTransactions.slice(0, 15).map(tx => {
                  const isInstallment = tx.is_installment === 1;
                  const totalInst = tx.total_installments || 1;
                  const totalAmount = isInstallment ? tx.amount * totalInst : tx.amount;

                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '10px 12px',
                        background: 'var(--surface-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {/* Satır 1: İkon + İşletme & Kişi (Sol) | Net Tutar (Sağ) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px', flexShrink: 0
                          }}>
                            {tx.category_icon || tx.member_avatar || '💳'}
                          </div>
                          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.merchant}
                            </span>
                            {tx.member_name && (
                              <span style={{
                                fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                                background: tx.is_mine ? 'rgba(59, 130, 246, 0.12)' : 'rgba(236, 72, 153, 0.12)',
                                color: tx.is_mine ? '#2563EB' : '#DB2777'
                              }}>
                                {tx.member_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="tabular-nums" style={{
                          fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', whiteSpace: 'nowrap', flexShrink: 0
                        }}>
                          -{formatTRY(tx.amount)}
                        </div>
                      </div>

                      {/* Satır 2: Tarih & Taksit/KDV (Sol) | Hesap Adı & Sil (Sağ) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{formatDate(tx.transaction_date)}</span>
                          {isInstallment && (
                            <span style={{
                              background: 'rgba(245, 158, 11, 0.15)', color: '#D97706',
                              padding: '1px 5px', borderRadius: '4px', fontWeight: 700, fontSize: '10px'
                            }}>
                              💳 {tx.installment_number || 1}/{totalInst} Taksit
                            </span>
                          )}
                          {tx.vat_rate && (
                            <span style={{ fontSize: '10px', opacity: 0.8 }}>
                              %{tx.vat_rate} KDV
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.wallet_name || 'Cüzdan'}
                          </span>
                          {tx.can_delete !== false && (
                            <button
                              onClick={() => handleDeleteTx(tx.id, tx.merchant)}
                              title="Harcamayı Sil"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.6, padding: '2px 4px' }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 🖥️ B) MASAÜSTÜ GÖRÜNÜM: GENİŞLETİLMİŞ ÇOK SÜTUNLU VERİ TABLOSU (768px üzeri) */}
              <div className="desktop-only-table" style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Tarih</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Açıklama / İşletme</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Kategori</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Harcayan</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Hesap / Kart</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>Taksit</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700 }}>KDV</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Net Tutar</th>
                      <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(0, 15).map(tx => {
                      const isInstallment = tx.is_installment === 1;
                      const totalInst = tx.total_installments || 1;

                      return (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}>
                          <td className="tabular-nums" style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                            {formatDate(tx.transaction_date)}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{tx.merchant}</span>
                              {tx.notes && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>({tx.notes})</span>}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '11px' }}>
                              <span>{tx.category_icon || '🏷️'}</span>
                              <span>{tx.category_name || 'Genel'}</span>
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {tx.member_name ? (
                              <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                background: tx.is_mine ? 'rgba(59, 130, 246, 0.12)' : 'rgba(236, 72, 153, 0.12)',
                                color: tx.is_mine ? '#2563EB' : '#DB2777',
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}>
                                <span>{tx.member_avatar || '👤'}</span>
                                <span>{tx.member_name}</span>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {tx.wallet_name || 'Banka'}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            {isInstallment ? (
                              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '10px' }}>
                                💳 {tx.installment_number || 1}/{totalInst}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Tek Çekim</span>
                            )}
                          </td>
                          <td className="tabular-nums" style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {tx.vat_rate ? `%${tx.vat_rate}` : '—'}
                          </td>
                          <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                            -{formatTRY(tx.amount)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {tx.can_delete !== false && (
                              <button
                                onClick={() => handleDeleteTx(tx.id, tx.merchant)}
                                title="Harcamayı Sil"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. SEKME: YAKLAŞAN ÖDEMELER */}
      {activeTab === 'upcoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', lineHeight: '1.5' }}>
            ℹ️ Kart ekstre borcunun üzerine tıklayarak <strong>tüm taksitleri ve anlık harcamaları pop-up ekranında</strong> görüntüleyebilirsiniz.
          </div>

          {upcomingPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Yakın tarihte bekleyen ödeme bulunmuyor.
            </div>
          ) : (
            upcomingPayments.slice(0, 10).map(pay => {
              const isUrgent = pay.days_left <= 3;
              const isCardDue = pay.type === 'card_due';
              const cardAccId = pay.id.replace('cc-', '');

              return (
                <div
                  key={pay.id}
                  onClick={() => {
                    if (isCardDue && onOpenCardStatement) {
                      onOpenCardStatement(cardAccId);
                    }
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    background: isUrgent ? '#FEF2F2' : 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: isUrgent ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
                    cursor: isCardDue ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>{pay.title}</span>
                      <span style={{ fontSize: '10px', background: isUrgent ? '#FEE2E2' : 'var(--surface)', color: isUrgent ? '#DC2626' : 'var(--text-muted)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, border: '1px solid var(--border)' }}>
                        {pay.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: isUrgent ? '#991B1B' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span>📅 {formatDate(pay.due_date)}</span>
                      <span style={{ fontWeight: 800, color: isUrgent ? '#DC2626' : '#2563EB' }}>
                        • {pay.days_left === 0 ? 'Bugün Son Gün!' : pay.days_left < 0 ? `${Math.abs(pay.days_left)} gün gecikti` : `${pay.days_left} gün kaldı`}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <div className="tabular-nums" style={{ fontWeight: 900, fontSize: '15px', color: isUrgent ? '#DC2626' : 'var(--text-main)' }}>
                      {formatTRY(pay.amount)}
                    </div>
                    {isCardDue && (
                      <span style={{ fontSize: '10px', color: '#4F46E5', fontWeight: 800, background: '#EEF2FF', padding: '1px 6px', borderRadius: '4px' }}>
                        📄 Ekstre Gör ➔
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
