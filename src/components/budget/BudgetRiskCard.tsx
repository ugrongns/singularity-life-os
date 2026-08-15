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
}

interface BudgetRiskCardProps {
  accounts: Account[];
  onUpdate?: () => void;
}

export const BudgetRiskCard: React.FC<BudgetRiskCardProps> = ({ accounts }) => {
  const today = new Date();
  const currentDay = today.getDate();

  // 1. Gecikmedeki Kredi Kartları
  const overdueCards = accounts.filter(acc => {
    if (acc.type !== 'credit_card' || acc.balance <= 0 || !acc.due_day) return false;
    // Eğer bugün son ödeme gününden sonraysa gecikmededir
    return currentDay > acc.due_day;
  }).map(acc => {
    const daysOverdue = currentDay - (acc.due_day || 1);
    const lateRatePercent = acc.interest_rate_late || 4.55;
    const dailyRate = (lateRatePercent / 100) / 30;
    const estimatedInterest = Math.round(acc.balance * dailyRate * daysOverdue);
    return {
      ...acc,
      daysOverdue,
      lateRatePercent,
      estimatedInterest
    };
  });

  // 2. Kullanılan KMH (Ek Hesaplar)
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

  const hasRisks = overdueCards.length > 0 || usedKmhAccounts.length > 0;

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-title-row">
        <div className="card-title">
          <span>🚨</span>
          <span>Faiz & Gecikme Risk Takip Motoru</span>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: 'var(--radius-full)',
          background: hasRisks ? '#FEF2F2' : 'var(--emerald-bg)',
          color: hasRisks ? '#991B1B' : 'var(--emerald)'
        }}>
          {hasRisks ? `● ${overdueCards.length + usedKmhAccounts.length} Riskli İşlem` : '● Tüm Ödemeler Düzenli'}
        </span>
      </div>

      {!hasRisks ? (
        <div style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)'
        }}>
          ✨ Gecikmede kredi kartı borcu veya faiz işleyen KMH hesabı bulunmuyor. Tüm finansal akışınız güvende!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Geciken Kartlar */}
          {overdueCards.map(card => (
            <div key={card.id} style={{
              background: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>💳</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#991B1B' }}>
                    {card.name} <span style={{ fontSize: '11px', background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px' }}>{card.daysOverdue} Gün Gecikmede!</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7F1D1D', marginTop: '2px' }}>
                    Son Ödeme Günü: Ayın {card.due_day}. Günü • Gecikme Faizi Oranı: %{card.lateRatePercent}/ay
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#7F1D1D', fontWeight: 700 }}>Güncel Ekstre Borcu</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#991B1B' }}>
                  ₺{card.balance.toLocaleString('tr-TR')}
                </div>
                <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 800, marginTop: '2px' }}>
                  ⚡ İşleyen Faiz: ~₺{card.estimatedInterest.toLocaleString('tr-TR')}
                </div>
              </div>
            </div>
          ))}

          {/* Kullanılan KMH Hesapları */}
          {usedKmhAccounts.map(kmh => (
            <div key={kmh.id} style={{
              background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>⚡</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#1E40AF' }}>
                    {kmh.name} <span style={{ fontSize: '11px', background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: '4px', marginLeft: '6px' }}>Hazır Kredi Kullanılıyor</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#1E3A8A', marginTop: '2px' }}>
                    KMH Limiti: ₺{(kmh.overdraft_limit || 0).toLocaleString('tr-TR')} • Aylık Faiz: %{kmh.monthlyRatePercent}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#1E3A8A', fontWeight: 700 }}>Kullanılan KMH Tutarı</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1E40AF' }}>
                  ₺{kmh.usedAmount.toLocaleString('tr-TR')}
                </div>
                <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: 800, marginTop: '2px' }}>
                  ⏳ Ay Sonu Tahmini Faiz: ~₺{kmh.estimatedMonthlyInterest.toLocaleString('tr-TR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
