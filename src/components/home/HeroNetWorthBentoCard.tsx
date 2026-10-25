'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Wallet, TrendingUp, TrendingDown, Scale, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';

interface HeroNetWorthBentoCardProps {
  netWorthData?: {
    TRY: number;
    USD: number;
    EUR: number;
    GBP: number;
    GOLD_GRAM: string | number;
    BTC: string | number;
    breakdown?: {
      cashAndBanks: number;
      investmentsAndBES: number;
      realEstate: number;
      debts: number;
    };
  } | null;
  monthlySummary?: {
    totalIncome: number;
    totalExpense: number;
    budgetScore?: number | { score: number; grade: string; breakdown?: any };
    maxAllowedCap?: number;
    totalBudgetLimit?: number;
  } | null;
  marketRates?: {
    USD_TRY: number;
    EUR_TRY: number;
    GOLD_GRAM_TRY: number;
    BTC_TRY?: number;
  } | null;
}

type CurrencyType = 'TRY' | 'USD' | 'EUR' | 'GOLD';

export default function HeroNetWorthBentoCard({
  netWorthData,
  monthlySummary,
  marketRates
}: HeroNetWorthBentoCardProps) {
  const [currency, setCurrency] = useState<CurrencyType>('TRY');

  const rawTRY = netWorthData?.TRY ?? 0;
  const cashAssetsTRY = netWorthData?.breakdown?.cashAndBanks ?? 0;
  const debtsTRY = netWorthData?.breakdown?.debts ?? 0;

  // Kur çevrimleri
  const usdRate = marketRates?.USD_TRY || 34.5;
  const eurRate = marketRates?.EUR_TRY || 37.8;
  const goldRate = marketRates?.GOLD_GRAM_TRY || 3100;

  let displayNetWorth = '';
  let currencySymbol = '₺';
  let currencyLabel = 'Türk Lirası';

  if (currency === 'TRY') {
    displayNetWorth = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rawTRY);
    currencySymbol = '₺';
    currencyLabel = 'Türk Lirası';
  } else if (currency === 'USD') {
    const val = usdRate > 0 ? Math.round(rawTRY / usdRate) : 0;
    displayNetWorth = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    currencySymbol = '$';
    currencyLabel = `USD (Kur: ${usdRate.toFixed(2)} ₺)`;
  } else if (currency === 'EUR') {
    const val = eurRate > 0 ? Math.round(rawTRY / eurRate) : 0;
    displayNetWorth = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    currencySymbol = '€';
    currencyLabel = `EUR (Kur: ${eurRate.toFixed(2)} ₺)`;
  } else if (currency === 'GOLD') {
    const val = goldRate > 0 ? (rawTRY / goldRate).toFixed(1) : '0';
    displayNetWorth = val;
    currencySymbol = 'Gr';
    currencyLabel = `Gram Altın (${goldRate.toLocaleString('tr-TR')} ₺/Gr)`;
  }

  // Varlık / Borç Oranı
  const totalVolume = Math.max(cashAssetsTRY + debtsTRY, 1);
  const assetRatio = Math.round((cashAssetsTRY / totalVolume) * 100);
  const debtRatio = 100 - assetRatio;

  // KPI Hesaplamaları
  const income = monthlySummary?.totalIncome ?? 0;
  const expense = monthlySummary?.totalExpense ?? 0;
  const netCashFlow = income - expense;
  const rawBudgetScore = monthlySummary?.budgetScore;
  const scoreValue = typeof rawBudgetScore === 'object' && rawBudgetScore !== null
    ? (rawBudgetScore.score ?? 85)
    : (typeof rawBudgetScore === 'number' ? rawBudgetScore : 85);

  // Günlük Harcama Limiti (Ayın kalan günlerine göre)
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate() + 1, 1);
  const remainingBudget = Math.max((monthlySummary?.totalBudgetLimit || income || 45000) - expense, 0);
  const dailyBudgetGuideline = Math.round(remainingBudget / daysRemaining);

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '20px',
        height: '100%',
        minHeight: '260px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Üst Bar: Başlık, Çoklu Döviz Toggle & Detay Butonu */}
      <div className="card-header-block" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="icon-badge icon-badge-emerald">
            <Wallet size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              Executive Finans Komuta
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Konsolide Net Servet
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Döviz Geçiş Hapları */}
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              background: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border)'
            }}
          >
            {(['TRY', 'USD', 'EUR', 'GOLD'] as CurrencyType[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: currency === c ? 'var(--blue)' : 'transparent',
                  color: currency === c ? '#FFFFFF' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {c === 'GOLD' ? 'ALTIN' : c}
              </button>
            ))}
          </div>

          <Link
            href="/budget"
            className="header-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              fontSize: '11px',
              fontWeight: 700,
              textDecoration: 'none'
            }}
            title="Bütçe & Varlık Detayları"
          >
            <span>Detay</span>
            <ArrowUpRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Net Worth Tutar & Kur Bilgisi */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span
            className="tabular-nums currency-nowrap"
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 900,
              letterSpacing: '-1px',
              color: rawTRY >= 0 ? 'var(--text-main)' : 'var(--rose)'
            }}
          >
            {currency === 'GOLD' ? `${displayNetWorth} ${currencySymbol}` : `${currencySymbol} ${displayNetWorth}`}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {currencyLabel}
          </span>
        </div>

        {/* Varlık & Borç Dağılım Çubuğu */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
            <span style={{ color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--emerald)', display: 'inline-block' }} />
              Varlık: {cashAssetsTRY.toLocaleString('tr-TR')} ₺ (%{assetRatio})
            </span>
            <span style={{ color: 'var(--rose)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose)', display: 'inline-block' }} />
              Borç: {debtsTRY.toLocaleString('tr-TR')} ₺ (%{debtRatio})
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(244, 63, 94, 0.25)',
              overflow: 'hidden',
              display: 'flex'
            }}
          >
            <div
              style={{
                width: `${assetRatio}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10B981, #059669)',
                transition: 'width 0.4s ease'
              }}
            />
            <div
              style={{
                width: `${debtRatio}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #F43F5E, #E11D48)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      </div>

      {/* Alt Bölüm: 3 Mini Hızlı FinTech KPI'ı */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border)'
        }}
      >
        {/* KPI 1: Aylık Net Nakit Akışı */}
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            minWidth: 0
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
            Aylık Nakit Akışı
          </div>
          <div
            className="tabular-nums currency-nowrap"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: netCashFlow >= 0 ? 'var(--emerald)' : 'var(--rose)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {netCashFlow >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{netCashFlow >= 0 ? '+' : ''}{netCashFlow.toLocaleString('tr-TR')} ₺</span>
          </div>
        </div>

        {/* KPI 2: Bütçe Skoru (50/30/20) */}
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            minWidth: 0
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
            50/30/20 Bütçe Skoru
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: scoreValue >= 75 ? 'var(--emerald)' : scoreValue >= 50 ? 'var(--amber)' : 'var(--rose)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ShieldCheck size={14} />
            <span>%{scoreValue} {scoreValue >= 75 ? 'Mükemmel' : scoreValue >= 50 ? 'Dengeli' : 'Geliştirilmeli'}</span>
          </div>
        </div>

        {/* KPI 3: Kalan Günlük Rehber Bütçe */}
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            minWidth: 0
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
            Günlük Harcama Limiti
          </div>
          <div
            className="tabular-nums currency-nowrap"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: 'var(--blue)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Sparkles size={14} />
            <span>{dailyBudgetGuideline.toLocaleString('tr-TR')} ₺ / gün</span>
          </div>
        </div>
      </div>
    </div>
  );
}
