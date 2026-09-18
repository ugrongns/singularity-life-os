'use client';
import { MarketRates } from '@/lib/market-data';

interface MarketRatesBarProps {
  rates?: MarketRates | null;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function MarketRatesBar({ rates, onRefresh, loading = false }: MarketRatesBarProps) {
  if (!rates) return null;

  const formatPrice = (val: number, isDecimals = true) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: isDecimals ? 2 : 0,
      maximumFractionDigits: isDecimals ? 2 : 0
    }).format(val);
  };

  const renderChangeBadge = (changeStr?: string) => {
    if (!changeStr) return null;
    const isNegative = changeStr.includes('-');
    const isZero = changeStr.includes('0,00') || changeStr.includes('0.00');
    const bg = isZero ? 'var(--surface-subtle)' : isNegative ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
    const color = isZero ? 'var(--text-muted)' : isNegative ? '#DC2626' : '#059669';
    const icon = isZero ? '•' : isNegative ? '▼' : '▲';

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        fontSize: '10px',
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: '4px',
        background: bg,
        color: color
      }}>
        <span>{icon}</span>
        <span>{changeStr.replace('%', '')}%</span>
      </span>
    );
  };

  const updateTimeFormatted = rates.lastUpdated
    ? new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(rates.lastUpdated))
    : '';

  const rateItems = [
    { label: 'Dolar', symbol: 'USD', icon: '🇺🇸', price: rates.USD_TRY, change: rates.USD_CHANGE, unit: '₺' },
    { label: 'Euro', symbol: 'EUR', icon: '🇪🇺', price: rates.EUR_TRY, change: rates.EUR_CHANGE, unit: '₺' },
    { label: 'Sterlin', symbol: 'GBP', icon: '🇬🇧', price: rates.GBP_TRY, change: rates.GBP_CHANGE, unit: '₺' },
    { label: 'Gram Altın', symbol: 'GRA', icon: '🥇', price: rates.GOLD_GRAM_TRY, change: rates.GOLD_CHANGE, unit: '₺' },
    { label: 'Çeyrek Altın', symbol: 'CEY', icon: '🪙', price: rates.GOLD_CEYREK_TRY, unit: '₺', isDec: false },
    { label: 'Bitcoin', symbol: 'BTC', icon: '₿', price: rates.BTC_TRY ? Math.round(rates.BTC_TRY / 1000) : 0, unit: 'K ₺', isDec: false }
  ];

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '12px 16px',
      marginBottom: '16px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📊</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.2px' }}>
            Canlı Finans & Piyasa Kurları
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'var(--indigo-bg)',
            color: 'var(--indigo)'
          }}>
            {rates.source === 'truncgil' ? 'Kapalıçarşı & Serbest Piyasa' : rates.source === 'tcmb' ? 'TCMB Gösterge' : 'Global API'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {updateTimeFormatted && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Son Güncelleme: <strong>{updateTimeFormatted}</strong>
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Kurları Yenile"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span style={{ display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>🔄</span>
              <span>{loading ? 'Güncelleniyor...' : 'Yenile'}</span>
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {rateItems.map(item => (
          <div
            key={item.symbol}
            style={{
              flex: '1 1 130px',
              minWidth: '120px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {renderChangeBadge(item.change)}
            </div>

            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
              {formatPrice(item.price, item.isDec !== false)} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
