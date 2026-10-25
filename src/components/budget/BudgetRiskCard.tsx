'use client';

import React from 'react';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  credit_limit?: number;
  due_day?: number;
  cutoff_day?: number;
  interest_rate_contractual?: number;
  interest_rate_late?: number;
  overdraft_limit?: number;
  currency: string;
  is_overdue?: boolean;
  overdue_amount?: number;
  days_overdue?: number;
  estimated_late_interest?: number;
  next_due_date?: string;
  days_until_due?: number;
  current_cycle_spending?: number;
}

interface BudgetRiskCardProps {
  accounts: Account[];
  onUpdate?: () => void;
  onOpenCardStatement?: (accId: string) => void;
  onOpenTransfer?: () => void;
}

export const BudgetRiskCard: React.FC<BudgetRiskCardProps> = ({
  accounts,
  onOpenCardStatement,
  onOpenTransfer
}) => {
  const today = new Date();
  const currentDay = today.getDate();

  // 1. Gecikmedeki Kredi Kartları
  const overdueCards = accounts.filter(acc => {
    if (acc.type !== 'credit_card' || acc.balance <= 0) return false;
    if (typeof acc.is_overdue === 'boolean') {
      return acc.is_overdue && (acc.overdue_amount || 0) > 0;
    }
    return false;
  }).map(acc => {
    const overdueAmount = acc.overdue_amount ?? acc.balance;
    const daysOverdue = acc.days_overdue ?? Math.max(1, currentDay - (acc.due_day || 1));
    const lateRatePercent = acc.interest_rate_late || 4.55;
    const dailyRate = (lateRatePercent / 100) / 30;
    const estimatedInterest = acc.estimated_late_interest ?? Math.round(overdueAmount * dailyRate * daysOverdue);
    return {
      ...acc,
      overdueAmount,
      daysOverdue,
      lateRatePercent,
      estimatedInterest
    };
  });

  // 2. Yaklaşan Son Ödemesi Olan Kartlar (Gecikmede olmayan, önümüzdeki 15 gün içinde vadesi gelen borçlu kartlar)
  const upcomingCards = accounts.filter(acc => {
    if (acc.type !== 'credit_card' || acc.balance <= 0) return false;
    // Gecikmede olanları tekrar sayma
    if (acc.is_overdue) return false;
    if (!acc.due_day) return false;
    
    // Son ödeme gününe kaç gün var hesabı
    let daysDiff = acc.due_day - currentDay;
    if (daysDiff < 0) {
      // Gelecek ayın son ödeme günü
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysDiff = (daysInMonth - currentDay) + acc.due_day;
    }
    return daysDiff >= 0 && daysDiff <= 15;
  }).map(acc => {
    let daysDiff = (acc.due_day || currentDay) - currentDay;
    if (daysDiff < 0) {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysDiff = (daysInMonth - currentDay) + (acc.due_day || 0);
    }
    return {
      ...acc,
      daysUntilDue: daysDiff
    };
  }).sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  // 3. Kullanılan KMH (Ek Hesaplar)
  const usedKmhAccounts = accounts.filter(acc => {
    return acc.type === 'kmh' && acc.balance < 0;
  }).map(acc => {
    const usedAmount = Math.abs(acc.balance);
    const monthlyRatePercent = acc.interest_rate_contractual || 5.0;
    const estimatedMonthlyInterest = Math.round(usedAmount * (monthlyRatePercent / 100));
    return {
      ...acc,
      usedAmount,
      monthlyRatePercent,
      estimatedMonthlyInterest
    };
  });

  const totalRisks = overdueCards.length + usedKmhAccounts.length;
  const hasActionableItems = totalRisks > 0 || upcomingCards.length > 0;

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title">
          <span>🚨</span>
          <span>Kredi Kartı Risk & Faiz Takip Motoru</span>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 800,
          padding: '3px 10px',
          borderRadius: 'var(--radius-full)',
          background: totalRisks > 0 ? '#FEF2F2' : (upcomingCards.length > 0 ? '#FFFBEB' : 'var(--emerald-bg)'),
          color: totalRisks > 0 ? '#991B1B' : (upcomingCards.length > 0 ? '#92400E' : 'var(--emerald)'),
          border: `1px solid ${totalRisks > 0 ? 'rgba(239, 68, 68, 0.25)' : (upcomingCards.length > 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)')}`
        }}>
          {totalRisks > 0
            ? `● ${totalRisks} Riskli İşlem`
            : upcomingCards.length > 0
            ? `⏳ ${upcomingCards.length} Yaklaşan Ödeme`
            : '● Tüm Ödemeler Düzenli'}
        </span>
      </div>

      {!hasActionableItems ? (
        <div style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-muted)'
        }}>
          ✨ Gecikmede kart borcu veya faiz işleyen KMH hesabı bulunmuyor. Tüm finansal akışınız güvende!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 1. Geciken Kartlar (Timeline Önceliği 1: Kritik Kırmızı) */}
          {overdueCards.map(card => (
            <div
              key={card.id}
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECDD3',
                borderLeft: '4px solid #EF4444',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', flexShrink: 0
                }}>
                  💳
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{card.name}</span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      background: '#DC2626',
                      color: '#FFFFFF',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)'
                    }}>
                      🔴 {card.daysOverdue} Gün Gecikmede!
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7F1D1D', marginTop: '2px' }}>
                    Son Ödeme: Ayın {card.due_day}. Günü • Gecikme Faizi: %{card.lateRatePercent}/ay
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#7F1D1D', fontWeight: 700 }}>Geciken Borç</div>
                  <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: '#991B1B' }}>
                    ₺{card.overdueAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '10px', color: '#DC2626', fontWeight: 800 }}>
                    ⚡ +₺{card.estimatedInterest.toLocaleString('tr-TR')} faiz
                  </div>
                </div>

                {onOpenTransfer && (
                  <button
                    onClick={onOpenTransfer}
                    title="Borcu Hemen Öde"
                    style={{
                      background: '#DC2626',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>⚡</span>
                    <span>Hemen Öde</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* 2. Yaklaşan Son Ödemeli Kartlar (Timeline Önceliği 2: Amber / Countdown) */}
          {upcomingCards.map(card => {
            const isUrgent = card.daysUntilDue <= 3;
            const badgeBg = card.daysUntilDue === 0 ? '#DC2626' : isUrgent ? '#F59E0B' : 'rgba(59, 130, 246, 0.12)';
            const badgeColor = card.daysUntilDue === 0 || isUrgent ? '#FFFFFF' : '#2563EB';

            return (
              <div
                key={card.id}
                style={{
                  background: isUrgent ? '#FFFBEB' : 'var(--surface-subtle)',
                  border: `1px solid ${isUrgent ? '#FCD34D' : 'var(--border)'}`,
                  borderLeft: `4px solid ${isUrgent ? '#F59E0B' : '#3B82F6'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: isUrgent ? '#FEF3C7' : 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>
                    💳
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>{card.name}</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        background: badgeBg,
                        color: badgeColor,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)'
                      }}>
                        {card.daysUntilDue === 0 ? '🚨 Bugün Son Gün!' : `⏳ ${card.daysUntilDue} Gün Kaldı`}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Son Ödeme Tarihi: Ayın {card.due_day}. Günü
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Güncel Borç</div>
                    <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)' }}>
                      ₺{card.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {onOpenCardStatement && (
                      <button
                        onClick={() => onOpenCardStatement(card.id)}
                        title="Ekstre Detayını İncele"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-main)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        📄 Ekstre
                      </button>
                    )}

                    {onOpenTransfer && (
                      <button
                        onClick={onOpenTransfer}
                        title="Kart Borcunu Öde"
                        style={{
                          background: isUrgent ? '#D97706' : 'var(--blue)',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>Öde</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 3. Kullanılan KMH Hesapları */}
          {usedKmhAccounts.map(kmh => (
            <div
              key={kmh.id}
              style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderLeft: '4px solid #3B82F6',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', flexShrink: 0
                }}>
                  ⚡
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{kmh.name}</span>
                    <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                      KMH Kullanılıyor
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#1E3A8A', marginTop: '2px' }}>
                    KMH Limiti: ₺{(kmh.overdraft_limit || 0).toLocaleString('tr-TR')} • Aylık Faiz: %{kmh.monthlyRatePercent}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#1E3A8A', fontWeight: 700 }}>Kullanılan Bakiye</div>
                  <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: '#1E40AF' }}>
                    ₺{kmh.usedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '10px', color: '#2563EB', fontWeight: 800 }}>
                    ⏳ Ay Sonu Faiz: ~₺{kmh.estimatedMonthlyInterest.toLocaleString('tr-TR')}
                  </div>
                </div>

                {onOpenTransfer && (
                  <button
                    onClick={onOpenTransfer}
                    title="KMH Hesabına Para Aktar"
                    style={{
                      background: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>Kapat</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
