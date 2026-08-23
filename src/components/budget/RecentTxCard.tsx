'use client';
import { useState } from 'react';

interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  transaction_date: string;
  is_installment: number;
  installment_number?: number;
  total_installments?: number;
  notes?: string;
  member_avatar?: string;
  member_name?: string;
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

  const formatTRY = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}.${m}.${y}`;
    } catch {
      return dateStr;
    }
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
      <div className="card-title-row">
        <div className="card-title">
          <span>💳</span>
          <span>Harcama & Ödeme Takvimi</span>
        </div>
      </div>

      {/* Sekme Seçici */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
        <button 
          className={`choice-pill ${activeTab === 'recent' ? 'selected' : ''}`}
          onClick={() => setActiveTab('recent')}
          style={{ flex: 1, padding: '6px', fontSize: '12px' }}
        >
          ⏱️ Son Harcamalar ({transactions.length})
        </button>
        <button 
          className={`choice-pill ${activeTab === 'upcoming' ? 'selected' : ''}`}
          onClick={() => setActiveTab('upcoming')}
          style={{ flex: 1, padding: '6px', fontSize: '12px' }}
        >
          📅 Yaklaşan Ödemeler ({upcomingPayments.length})
        </button>
      </div>

      {/* 1. Son Harcama Listesi (Gelirler Harcamalar Listesinden Çıkarılmıştır) */}
      {activeTab === 'recent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Henüz harcama kaydı bulunmuyor.
            </div>
          ) : (
            transactions.slice(0, 8).map(tx => {
              const isInstallment = tx.is_installment === 1;
              const totalInst = tx.total_installments || 1;
              const totalAmount = isInstallment ? tx.amount * totalInst : tx.amount;

              return (
                <div 
                  key={tx.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '10px 12px', 
                    background: 'var(--surface-subtle)', 
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{ fontSize: '18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}
                      title={tx.member_name ? `İşlemi yapan: ${tx.member_name}` : 'İşlemi yapan aile üyesi'}
                    >
                      {tx.member_avatar || '👤'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{tx.merchant}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span>{formatDate(tx.transaction_date)}</span>
                        {isInstallment && (
                          <span style={{ background: 'var(--amber-bg)', color: '#D97706', padding: '1px 5px', borderRadius: '3px', fontWeight: 600, fontSize: '10px' }}>
                            💳 {totalInst} taksit • {formatTRY(tx.amount)}/ay
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                        -{formatTRY(totalAmount)}
                      </div>
                      {isInstallment && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Toplam Taksit Borcu</div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteTx(tx.id, tx.merchant)}
                      title="Harcamayı Sil"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. Yaklaşan Ödemeler Listesi (Kart Borcu Kutusuna Tıklayınca Ekstre Pop-Up Açılır) */}
      {activeTab === 'upcoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '6px 10px', borderRadius: '4px', lineHeight: '1.5' }}>
            ℹ️ Kart ekstre borcunun üzerine tıklayarak <strong>tüm taksitleri ve anlık harcamaları pop-up ekranında</strong> görüntüleyebilirsiniz.
          </div>

          {upcomingPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Yakın tarihte bekleyen ödeme bulunmuyor.
            </div>
          ) : (
            upcomingPayments.slice(0, 5).map(pay => {
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
                    transition: 'all 0.2s ease',
                    boxShadow: isCardDue ? '0 2px 8px rgba(0,0,0,0.03)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>{pay.title}</span>
                      <span style={{ fontSize: '10px', background: isUrgent ? '#FEE2E2' : 'white', color: isUrgent ? '#DC2626' : 'var(--text-muted)', padding: '1px 6px', borderRadius: '3px', fontWeight: 700, border: '1px solid var(--border)' }}>
                        {pay.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: isUrgent ? '#991B1B' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span>📅 {formatDate(pay.due_date)}</span>
                      <span style={{ fontWeight: 700, color: isUrgent ? '#DC2626' : '#2563EB' }}>
                        • {pay.days_left === 0 ? 'Bugün Son Gün!' : pay.days_left < 0 ? `${Math.abs(pay.days_left)} gün gecikti` : `${pay.days_left} gün kaldı`}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '14px', color: isUrgent ? '#DC2626' : 'var(--text-main)' }}>
                      {formatTRY(pay.amount)}
                    </div>
                    {isCardDue && (
                      <span style={{ fontSize: '10px', color: '#4F46E5', fontWeight: 700, background: '#EEF2FF', padding: '1px 6px', borderRadius: '4px' }}>
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
