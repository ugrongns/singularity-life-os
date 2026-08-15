'use client';
import { useState, useEffect } from 'react';

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

  if (!isOpen || !accountId) return null;

  const formatTRY = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}.${m}.${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '560px', width: '100%',
        boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>💳</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {data?.card?.name || 'Kredi Kartı Ekstre Detayı'}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Anlık harcama geçmişi, taksitler ve hesap kesim özeti
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Kart ekstresi yükleniyor...
          </div>
        ) : (
          <div>
            {/* Kart Özet Kutuları */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.3)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', color: '#991B1B', fontWeight: 800 }}>📌 BU AY ÖDENECEK GÜNCEL EKSTRE</div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: '#DC2626', marginTop: '2px' }}>
                  {formatTRY(data?.summary?.currentStatementDebt || 0)}
                </div>
                <div style={{ fontSize: '10px', color: '#991B1B', marginTop: '3px' }}>
                  Tek Çekim + Bu Ayki Taksit Dilimi
                </div>
              </div>

              <div style={{ background: 'var(--emerald-bg)', border: '1px solid rgba(16,185,129,0.3)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800 }}>KALAN KULLANILABİLİR LİMİT</div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--emerald)', marginTop: '2px' }}>
                  {formatTRY(data?.card?.available_limit || 0)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Toplam Kart Limiti: {formatTRY(data?.card?.credit_limit || 0)}
                </div>
              </div>
            </div>

            {/* Gelecek Dönem & Toplam Borç Detayı */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px',
              background: 'var(--surface-subtle)', border: '1px solid var(--border)',
              padding: '10px 12px', borderRadius: 'var(--radius-md)', marginBottom: '12px', textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Bu Ayki Tek Çekim</div>
                <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  {formatTRY(data?.summary?.singleTotal || 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Bu Ayki Taksit</div>
                <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  {formatTRY(data?.summary?.monthlyInstallmentTotal || 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Gelecek Taksitler</div>
                <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 700, color: '#D97706', marginTop: '2px' }}>
                  {formatTRY(data?.summary?.futureInstallmentsDebt || 0)}
                </div>
              </div>
            </div>

            {/* Tarih Bilgisi (Hesap Kesim & Son Ödeme) */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', background: 'var(--surface-subtle)',
              border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 'var(--radius-md)',
              fontSize: '12px', fontWeight: 600, marginBottom: '16px'
            }}>
              <div>
                <span>✂️ Hesap Kesim Günü: </span>
                <span style={{ color: 'var(--emerald)', fontWeight: 800 }}>
                  {data?.card?.cutoff_day ? `Her Ayın ${data.card.cutoff_day}. Günü` : 'Belirtilmedi'}
                </span>
              </div>
              <div>
                <span>📅 Son Ödeme Günü: </span>
                <span style={{ color: '#DC2626', fontWeight: 800 }}>
                  {data?.card?.due_day ? `Her Ayın ${data.card.due_day}. Günü` : 'Belirtilmedi'}
                </span>
              </div>
            </div>

            {/* Sekmeler */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <button
                className={`choice-pill ${activeTab === 'installments' ? 'selected' : ''}`}
                onClick={() => setActiveTab('installments')}
                style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 700 }}
              >
                💳 Aktif Taksitler ({data?.activeInstallments?.length || 0})
              </button>
              <button
                className={`choice-pill ${activeTab === 'single' ? 'selected' : ''}`}
                onClick={() => setActiveTab('single')}
                style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 700 }}
              >
                🛒 Tek Çekim Harcamalar ({data?.singleTransactions?.length || 0})
              </button>
            </div>

            {/* SEKME 1: TAKSİTLER */}
            {activeTab === 'installments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(!data?.activeInstallments || data.activeInstallments.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Bu kartta aktif taksitli harcama bulunmuyor.
                  </div>
                ) : (
                  data.activeInstallments.map((inst: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 14px', background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{inst.merchant}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                            {inst.completed_installments}/{inst.total_installments} Taksit
                          </span>
                          <span>• Toplam: {formatTRY(inst.total_amount)}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)' }}>
                          {formatTRY(inst.monthly_amount)}<span style={{ fontSize: '11px', fontWeight: 500 }}>/ay</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SEKME 2: TEK ÇEKİM HARCAMALAR */}
            {activeTab === 'single' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          📅 {formatDate(tx.transaction_date)} • {tx.category_name}
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

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={onClose}
                className="btn-primary"
                style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700 }}
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
