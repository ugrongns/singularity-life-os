'use client';
import { useState } from 'react';

interface NetWorthProps {
  netWorth: {
    TRY: number;
    USD: number;
    EUR: number;
    GOLD_GRAM: string;
    BTC: string;
  };
}

export default function NetWorthHero({ netWorth }: NetWorthProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<'TRY' | 'USD' | 'EUR' | 'GOLD' | 'BTC'>('TRY');

  const formatTRY = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);
  const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatEUR = (val: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  const getDisplayValue = () => {
    switch (selectedCurrency) {
      case 'USD': return formatUSD(netWorth.USD || 0);
      case 'EUR': return formatEUR(netWorth.EUR || 0);
      case 'GOLD': return `${netWorth.GOLD_GRAM || '0'} gr Altın`;
      case 'BTC': return `${netWorth.BTC || '0'} ₿ Bitcoin`;
      default: return formatTRY(netWorth.TRY || 0);
    }
  };

  return (
    <section className="networth-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="networth-label">Toplam Net Değer (Net Worth)</div>
          <div className="networth-amount tabular-nums">{getDisplayValue()}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <a href="/budget" style={{
            background: 'var(--blue-bg)', color: 'var(--blue)',
            padding: '5px 12px', borderRadius: 'var(--radius-full)',
            fontSize: '12px', fontWeight: 600, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '4px'
          }}>
            📊 Finans & Bütçe
          </a>
        </div>
      </div>

      <div className="currency-row">
        <button 
          className={`currency-btn ${selectedCurrency === 'TRY' ? 'active' : ''}`}
          onClick={() => setSelectedCurrency('TRY')}
        >
          ₺ Türk Lirası
        </button>
        <button 
          className={`currency-btn ${selectedCurrency === 'USD' ? 'active' : ''}`}
          onClick={() => setSelectedCurrency('USD')}
        >
          $ USD Dolar
        </button>
        <button 
          className={`currency-btn ${selectedCurrency === 'EUR' ? 'active' : ''}`}
          onClick={() => setSelectedCurrency('EUR')}
        >
          € Euro
        </button>
        <button 
          className={`currency-btn ${selectedCurrency === 'GOLD' ? 'active' : ''}`}
          onClick={() => setSelectedCurrency('GOLD')}
        >
          🥇 Gram Altın
        </button>
        <button 
          className={`currency-btn ${selectedCurrency === 'BTC' ? 'active' : ''}`}
          onClick={() => setSelectedCurrency('BTC')}
        >
          ₿ Bitcoin
        </button>
      </div>
    </section>
  );
}
