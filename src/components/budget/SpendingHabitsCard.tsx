'use client';

import React, { useState, useEffect } from 'react';
import {
  SpendingHabitsSummary,
  DayOfWeekSpending,
  MonthlySavingsRate
} from '@/lib/financial-habits';
import {
  ShieldCheck,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Wallet,
  PiggyBank,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function SpendingHabitsCard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SpendingHabitsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHabits = () => {
    setLoading(true);
    fetch('/api/budget/habits')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setSummary(json.data);
        } else {
          setError(json.error ?? 'Harcama alışkanlıkları alınamadı.');
        }
      })
      .catch(err => setError(err.message ?? 'Bağlantı hatası.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHabits();

    const handleRefresh = () => fetchHabits();
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🧠</div>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>Harcama Alışkanlıkları & No-Spend Analizi Yükleniyor...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="card" style={{ padding: '16px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
          🧠 Finansal Harcama Davranışları
        </div>
        <div style={{ fontSize: '12px' }}>{error ? `⚠️ ${error}` : 'Veri bulunamadı.'}</div>
      </div>
    );
  }

  // Histogram Boyutları
  const maxDayAmt = Math.max(1, ...summary.dayOfWeekDistribution.map(d => d.amount));
  const svgWidth = 500;
  const svgHeight = 140;
  const padLeft = 24;
  const padRight = 16;
  const padTop = 22;
  const padBottom = 24;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const colWidth = plotWidth / 7;
  const barWidth = Math.max(16, colWidth - 14);

  // Tasarruf Oranı Renk Kuralı
  const sRate = summary.currentSavingsRate;
  const sColor = sRate >= 30 ? '#10B981' : sRate >= 15 ? '#3B82F6' : sRate >= 0 ? '#F59E0B' : '#EF4444';
  const sStatusText = sRate >= 30 ? '🚀 Yüksek Birikim' : sRate >= 15 ? '✓ Sağlıklı Tasarruf' : sRate >= 0 ? '⚠️ Kritik Denge' : '🚨 Net Borçlanma';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Başlık Çubuğu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={18} color="#10B981" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Harcama Davranışları & No-Spend Analitiği
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Davranışsal Finans, Sıfır Harcamalı Günler ve Dürtüsellik Takibi
            </div>
          </div>
        </div>

        {/* No-Spend Rozeti (Hap Şeklinde) */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '999px',
            backgroundColor: summary.targetAchieved ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-subtle)',
            color: summary.targetAchieved ? '#10B981' : 'var(--text-main)',
            border: `1px solid ${summary.targetAchieved ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <span>🛡️</span>
          <span>{summary.noSpendDaysThisMonth} No-Spend Günü</span>
        </span>
      </div>

      {/* 2. 3'lü Bento KPI Rozetleri */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px'
        }}
      >
        {/* No-Spend Takvim Rozeti */}
        <div
          style={{
            background: summary.targetAchieved
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.04))',
            border: `1px solid ${summary.targetAchieved ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: summary.targetAchieved ? '#10B981' : '#3B82F6', fontSize: '11px', fontWeight: 800 }}>
            <ShieldCheck size={14} /> NO-SPEND GÜNLERİ
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: summary.targetAchieved ? '#10B981' : 'var(--text-main)' }}>
            {summary.noSpendDaysThisMonth} <span style={{ fontSize: '12px', fontWeight: 700 }}>/ {summary.daysPassedInMonth} gün</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {summary.targetAchieved
              ? '🏆 Aylık 8 gün hedefi aşıldı!'
              : `Aylık hedefe ${Math.max(0, summary.noSpendTarget - summary.noSpendDaysThisMonth)} gün kaldı`}
          </div>
        </div>

        {/* Tasarruf Oranı İbresi */}
        <div
          style={{
            background: `linear-gradient(135deg, ${sColor}18, ${sColor}05)`,
            border: `1px solid ${sColor}44`,
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: sColor, fontSize: '11px', fontWeight: 800 }}>
            <PiggyBank size={14} /> TASARRUF ORANI
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: sColor }}>
            %{sRate}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {sStatusText}
          </div>
        </div>

        {/* Hafta İçi vs Hafta Sonu Dağılımı */}
        <div
          style={{
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
            <span style={{ color: '#3B82F6' }}>Hafta İçi: %{summary.weekdayPercent}</span>
            <span style={{ color: '#8B5CF6' }}>Hafta Sonu: %{summary.weekendPercent}</span>
          </div>

          {/* İki Kademeli Oran Çubuğu */}
          <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'var(--border)' }}>
            <div style={{ width: `${summary.weekdayPercent}%`, background: '#3B82F6' }} title={`Hafta İçi: %${summary.weekdayPercent}`} />
            <div style={{ width: `${summary.weekendPercent}%`, background: '#8B5CF6' }} title={`Hafta Sonu: %${summary.weekendPercent}`} />
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>₺{Math.round(summary.weekdayExpense).toLocaleString('tr-TR')}</span>
            <span>₺{Math.round(summary.weekendExpense).toLocaleString('tr-TR')}</span>
          </div>
        </div>
      </div>

      {/* 3. Haftanın Günleri Harcama Histogramı (Saf SVG Bar Chart) */}
      <div
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#10B981" />
            <span>Haftanın Günlerine Göre Harcama Yoğunluğu (Son 90 Gün)</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3B82F6' }} /> Hafta İçi
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#8B5CF6' }} /> Hafta Sonu
            </span>
          </div>
        </div>

        {/* SVG Histogram */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          >
            {summary.dayOfWeekDistribution.map((d: DayOfWeekSpending, i: number) => {
              const isWeekend = d.dayIndex === 0 || d.dayIndex === 6;
              const barHeight = maxDayAmt > 0 ? (d.amount / maxDayAmt) * plotHeight : 0;
              const x = padLeft + i * colWidth + (colWidth - barWidth) / 2;
              const y = padTop + plotHeight - barHeight;

              return (
                <g key={d.name}>
                  <title>{`${d.name}: ₺${d.amount.toLocaleString('tr-TR')} (%${d.percent})`}</title>

                  {/* Arka Plan Kılavuz Çubuğu */}
                  <rect
                    x={x}
                    y={padTop}
                    width={barWidth}
                    height={plotHeight}
                    rx={3}
                    fill="var(--border)"
                    opacity={0.2}
                  />

                  {/* Harcama Çubuğu */}
                  {barHeight > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={3}
                      fill={isWeekend ? '#8B5CF6' : '#3B82F6'}
                    />
                  )}

                  {/* Tutar Etiketi */}
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="var(--text-main)"
                  >
                    {d.amount > 0 ? `₺${Math.round(d.amount)}` : '₺0'}
                  </text>

                  {/* Gün İsmi */}
                  <text
                    x={x + barWidth / 2}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill={isWeekend ? '#8B5CF6' : 'var(--text-muted)'}
                  >
                    {d.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 4. En Yüksek Harcama Dilimi & Maaş Dürtüsellik Analizi */}
      <div
        style={{
          background: summary.peakPeriods.isImpulsiveSalarySpike
            ? 'rgba(239, 68, 68, 0.08)'
            : 'var(--surface-subtle)',
          border: `1px solid ${summary.peakPeriods.isImpulsiveSalarySpike ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: summary.peakPeriods.isImpulsiveSalarySpike ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: summary.peakPeriods.isImpulsiveSalarySpike ? '#EF4444' : '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {summary.peakPeriods.isImpulsiveSalarySpike ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
              {summary.peakPeriods.isImpulsiveSalarySpike
                ? '⚠️ Maaş Sonrası Dürtüsel Harcama Eğilimi'
                : '🎯 Dengeli Harcama Dağılımı'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Aylık harcamanın %{summary.peakPeriods.percent}&apos;si <strong>{summary.peakPeriods.periodName}</strong> diliminde yapıldı.
              Pik gün: <strong>Ayın {summary.peakPeriods.peakDay}. günü (₺{summary.peakPeriods.peakDayAmount.toLocaleString('tr-TR')})</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* 5. Son 3 Ayın Tasarruf Oranı Eğrisi */}
      {summary.savingsRateTrend.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} color="#3B82F6" />
            <span>Son 3 Ayın Tasarruf & Nakit Akışı Seyri</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {summary.savingsRateTrend.map((m: MonthlySavingsRate) => {
              const isPositive = m.savingsRate >= 0;
              return (
                <div
                  key={m.month}
                  style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>
                    {m.monthLabel.split(' ')[0]}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: isPositive ? '#10B981' : '#EF4444' }}>
                    %{m.savingsRate}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    +₺{m.income.toLocaleString('tr-TR')} / -₺{m.expense.toLocaleString('tr-TR')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
