'use client';

interface ForecastItem {
  monthStr: string;
  monthName: string;
  committedInstallments: number;
  committedAmount: number;
  totalExpense: number;
  totalIncome: number;
  totalBudgetLimit: number;
  freeBudget: number;
  commitmentPercentage: number;
}

interface Props {
  forecast: ForecastItem[];
  selectedMonth: string;
  onSelectMonth: (monthStr: string) => void;
}

export default function FutureForecastCard({ forecast, selectedMonth, onSelectMonth }: Props) {
  if (!forecast || forecast.length === 0) return null;

  // ✅ Timezone-safe gerçek ay tespiti
  const now = new Date();
  const realCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const formatTRY = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔮</span>
          <span style={{ fontSize: '16px', fontWeight: 800 }}>Gelecek 6 Ay Bütçe & Taksit Projeksiyonu</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
          Ay başlamadan taksit yükünüzü öngörün
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        {forecast.map((item) => {
          const isSelected = item.monthStr === selectedMonth;
          // ✅ "Bu Ay" rozeti: idx=0 değil, gerçek bugünün ayıyla kıyasla
          const isCurrentMonth = item.monthStr === realCurrentMonth;
          const isPast = item.monthStr < realCurrentMonth;
          const hasRealData = item.totalExpense > 0 || item.totalIncome > 0;

          return (
            <div
              key={item.monthStr}
              onClick={() => onSelectMonth(item.monthStr)}
              style={{
                background: isSelected ? '#EEF2FF' : 'var(--surface-subtle)',
                border: isSelected ? '2px solid #4F46E5' : '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                opacity: isPast && !isSelected ? 0.85 : 1
              }}
            >
              {/* Rozet */}
              {isCurrentMonth && (
                <span style={{
                  position: 'absolute', top: '8px', right: '8px',
                  background: '#10B981', color: 'white', fontSize: '9px', fontWeight: 800,
                  padding: '1px 6px', borderRadius: '4px'
                }}>
                  Bu Ay
                </span>
              )}
              {isPast && !isCurrentMonth && (
                <span style={{
                  position: 'absolute', top: '8px', right: '8px',
                  background: '#6B7280', color: 'white', fontSize: '9px', fontWeight: 700,
                  padding: '1px 6px', borderRadius: '4px'
                }}>
                  Geçmiş
                </span>
              )}

              {/* Ay Adı */}
              <div style={{ fontSize: '12px', fontWeight: 800, color: isSelected ? '#312E81' : 'var(--text-main)', marginBottom: '4px', paddingRight: isPast || isCurrentMonth ? '42px' : '0' }}>
                {item.monthName}
              </div>

              {/* Taksit Kalemi */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {item.committedInstallments > 0 ? `${item.committedInstallments} Taksit Kalemi` : 'Taksit Yok'}
              </div>

              {/* Gerçek harcama varsa göster, yoksa taksit göster */}
              {hasRealData ? (
                <div style={{ marginTop: '6px' }}>
                  <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 900, color: '#EF4444' }}>
                    {formatTRY(item.totalExpense)}
                  </div>
                  {item.totalIncome > 0 && (
                    <div className="tabular-nums" style={{ fontSize: '10px', fontWeight: 700, color: '#10B981' }}>
                      Gelir: {formatTRY(item.totalIncome)}
                    </div>
                  )}
                  {item.committedAmount > 0 && (
                    <div className="tabular-nums" style={{ fontSize: '10px', fontWeight: 600, color: '#6366F1' }}>
                      Taksit: {formatTRY(item.committedAmount)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 900, color: item.committedAmount > 0 ? '#4F46E5' : '#10B981', marginTop: '6px' }}>
                  {formatTRY(item.committedAmount)}
                </div>
              )}

              {/* Ön-Taahhüt Çubuğu */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '3px' }}>
                  <span>Taksit Yükü</span>
                  <span>%{item.commitmentPercentage}</span>
                </div>
                <div className="budget-bar-track" style={{ height: '5px' }}>
                  <div
                    className="budget-bar-fill"
                    style={{
                      width: `${item.commitmentPercentage}%`,
                      backgroundColor:
                        item.commitmentPercentage > 40 ? '#EF4444' :
                        item.commitmentPercentage > 20 ? '#F59E0B' : '#10B981'
                    }}
                  />
                </div>
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>
                Serbest: <strong>{formatTRY(item.freeBudget)}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
