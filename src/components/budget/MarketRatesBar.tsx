'use client';
import { MarketRates } from '@/lib/market-data';

interface MarketRatesBarProps {
  rates?: MarketRates | null;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function MarketRatesBar({ rates, onRefresh, loading = false }: MarketRatesBarProps) {
  if (!rates) return null;

  const formatPrice = (val?: number, isDecimals = true) => {
    if (val === undefined || val === null) return '—';
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
        fontWeight: 800,
        padding: '2px 6px',
        borderRadius: 'var(--radius-full)',
        background: bg,
        color: color,
        lineHeight: 1
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
    {
      label: 'Dolar',
      symbol: 'USD',
      icon: '🇺🇸',
      price: rates.USD_TRY,
      buy: rates.USD_BUY || (rates.USD_TRY ? Math.round(rates.USD_TRY * 0.997 * 100) / 100 : undefined),
      sell: rates.USD_SELL || rates.USD_TRY,
      change: rates.USD_CHANGE,
      unit: '₺'
    },
    {
      label: 'Euro',
      symbol: 'EUR',
      icon: '🇪🇺',
      price: rates.EUR_TRY,
      buy: rates.EUR_BUY || (rates.EUR_TRY ? Math.round(rates.EUR_TRY * 0.997 * 100) / 100 : undefined),
      sell: rates.EUR_SELL || rates.EUR_TRY,
      change: rates.EUR_CHANGE,
      unit: '₺'
    },
    {
      label: 'Sterlin',
      symbol: 'GBP',
      icon: '🇬🇧',
      price: rates.GBP_TRY,
      buy: rates.GBP_BUY || (rates.GBP_TRY ? Math.round(rates.GBP_TRY * 0.997 * 100) / 100 : undefined),
      sell: rates.GBP_SELL || rates.GBP_TRY,
      change: rates.GBP_CHANGE,
      unit: '₺'
    },
    {
      label: 'Gram Altın',
      symbol: 'GRA',
      icon: '🥇',
      price: rates.GOLD_GRAM_TRY,
      buy: rates.GOLD_GRAM_BUY || (rates.GOLD_GRAM_TRY ? Math.round(rates.GOLD_GRAM_TRY * 0.993 * 100) / 100 : undefined),
      sell: rates.GOLD_GRAM_SELL || rates.GOLD_GRAM_TRY,
      change: rates.GOLD_CHANGE,
      unit: '₺'
    },
    {
      label: 'Çeyrek Altın',
      symbol: 'CEY',
      icon: '🪙',
      price: rates.GOLD_CEYREK_TRY,
      buy: rates.GOLD_CEYREK_BUY || (rates.GOLD_CEYREK_TRY ? Math.round(rates.GOLD_CEYREK_TRY * 0.985) : undefined),
      sell: rates.GOLD_CEYREK_SELL || rates.GOLD_CEYREK_TRY,
      unit: '₺',
      isDec: false
    },
    {
      label: 'Bitcoin',
      symbol: 'BTC',
      icon: '₿',
      price: rates.BTC_TRY ? Math.round(rates.BTC_TRY / 1000) : 0,
      buy: rates.BTC_TRY ? Math.round((rates.BTC_TRY * 0.995) / 1000) : 0,
      sell: rates.BTC_TRY ? Math.round(rates.BTC_TRY / 1000) : 0,
      unit: 'K ₺',
      isDec: false
    }
  ];

  const sourceName = rates.source === 'truncgil'
    ? 'Kapalıçarşı & Serbest Piyasa'
    : rates.source === 'tcmb'
    ? 'TCMB Resmi Gösterge'
    : 'Global FX Data';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '14px 16px',
      marginBottom: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* Üst Başlık & Kaynak Şeridi */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--indigo-bg)',
            color: 'var(--indigo)',
            fontSize: '14px'
          }}>
            📈
          </div>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
            Canlı Finans & Piyasa Kurları
          </span>

          {/* Canlı Kaynak Rozeti */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#065F46',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10B981',
              display: 'inline-block',
              boxShadow: '0 0 6px #10B981'
            }} />
            <span>{sourceName}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: 'auto' }}>
          {updateTimeFormatted && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{
                display: 'inline-block',
                transform: loading ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.4s ease'
              }}>
                🔄
              </span>
              <span>{loading ? 'Güncelleniyor...' : 'Yenile'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Finansal Ticker Şeridi (Yatay Kaydırılabilir ve Kartlar) */}
      <div style={{
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch'
      }}>
        {rateItems.map(item => (
          <div
            key={item.symbol}
            style={{
              flex: '1 0 160px',
              minWidth: '150px',
              maxWidth: '220px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              position: 'relative'
            }}
          >
            {/* Kart Başlığı ve Değişim Rozeti */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ fontSize: '14px' }}>{item.icon}</span>
                <span>{item.label}</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>({item.symbol})</span>
              </span>
              {renderChangeBadge(item.change)}
            </div>

            {/* Büyük Gösterge Fiyat */}
            <div className="tabular-nums" style={{
              fontSize: '17px',
              fontWeight: 900,
              color: 'var(--text-main)',
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'baseline',
              gap: '3px'
            }}>
              <span>{formatPrice(item.price, item.isDec !== false)}</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{item.unit}</span>
            </div>

            {/* Wise/Revolut Tarzı Alış & Satış Rozetleri (Spread) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              paddingTop: '4px',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              fontSize: '10px'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                color: 'var(--text-muted)',
                fontWeight: 600
              }}>
                <span style={{ opacity: 0.8 }}>Alış:</span>
                <strong className="tabular-nums" style={{ color: 'var(--text-main)' }}>
                  {formatPrice(item.buy, item.isDec !== false)}
                </strong>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                color: 'var(--text-muted)',
                fontWeight: 600
              }}>
                <span style={{ opacity: 0.8 }}>Satış:</span>
                <strong className="tabular-nums" style={{ color: 'var(--text-main)' }}>
                  {formatPrice(item.sell, item.isDec !== false)}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
