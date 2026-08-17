'use client';

import React, { useState, useEffect } from 'react';

interface ScaleLog {
  id: string;
  measurement_date: string;
  weight_kg: number;
  bmi?: number | null;
  body_fat_percent?: number | null;
  body_fat_mass_kg?: number | null;
  skeletal_muscle_percent?: number | null;
  skeletal_muscle_mass_kg?: number | null;
  muscle_percent?: number | null;
  muscle_mass_kg?: number | null;
  water_percent?: number | null;
  water_mass_kg?: number | null;
  visceral_fat_rating?: number | null;
  bone_mass_kg?: number | null;
  bmr_calories?: number | null;
  protein_percent?: number | null;
  obesity_degree_percent?: number | null;
  metabolic_age?: number | null;
  fat_free_mass_kg?: number | null;
}

interface SmartScaleTrendDashboardProps {
  logs: ScaleLog[];
  onOpenScanModal: () => void;
}

type ChartType = 'line' | 'area' | 'bar' | 'scatter';

const METRIC_OPTIONS = [
  { key: 'weight_kg', label: 'Ağırlık (Kg)', unit: 'Kg', color: '#10B981' },
  { key: 'bmi', label: 'BMI (Vücut Kitle İndeksi)', unit: '', color: '#F59E0B' },
  { key: 'body_fat_percent', label: 'Vücut Yağ Oranı (%)', unit: '%', color: '#EF4444' },
  { key: 'body_fat_mass_kg', label: 'Vücut Yağ Ağırlığı (Kg)', unit: 'Kg', color: '#EF4444' },
  { key: 'skeletal_muscle_percent', label: 'İskelet Kası Yüzdesi (%)', unit: '%', color: '#3B82F6' },
  { key: 'skeletal_muscle_mass_kg', label: 'İskelet Kası Ağırlığı (Kg)', unit: 'Kg', color: '#3B82F6' },
  { key: 'muscle_percent', label: 'Kas Oranı (%)', unit: '%', color: '#8B5CF6' },
  { key: 'muscle_mass_kg', label: 'Kas Ağırlığı (Kg)', unit: 'Kg', color: '#8B5CF6' },
  { key: 'water_percent', label: 'Su Oranı (%)', unit: '%', color: '#06B6D4' },
  { key: 'water_mass_kg', label: 'Vücut Sıvı Ağırlığı (Kg)', unit: 'Kg', color: '#06B6D4' },
  { key: 'visceral_fat_rating', label: 'V-Yağ (İç Organ Yağı)', unit: '', color: '#DC2626' },
  { key: 'bone_mass_kg', label: 'Kemik Kütlesi (Kg)', unit: 'Kg', color: '#6B7280' },
  { key: 'bmr_calories', label: 'Bazal Metabolizma (kcal)', unit: 'kcal', color: '#F59E0B' },
  { key: 'protein_percent', label: 'Protein Oranı (%)', unit: '%', color: '#10B981' },
  { key: 'metabolic_age', label: 'Metabolik Yaş', unit: 'Yaş', color: '#EC4899' }
];

export function SmartScaleTrendDashboard({ logs, onOpenScanModal }: SmartScaleTrendDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState('weight_kg');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [hoveredPoint, setHoveredPoint] = useState<{ idx: number; val: number; date: string } | null>(null);

  const currentOption = METRIC_OPTIONS.find(m => m.key === selectedMetric) || METRIC_OPTIONS[0];

  // Filtrelenmiş ve tarihe göre sıralanmış loglar
  const sortedLogs = [...logs].sort((a, b) => new Date(a.measurement_date).getTime() - new Date(b.measurement_date).getTime());

  const metricValues = sortedLogs
    .map(l => ({
      date: l.measurement_date,
      value: (l as any)[selectedMetric] as number | null
    }))
    .filter(item => item.value !== null && item.value !== undefined);

  const latestLog = sortedLogs[sortedLogs.length - 1];
  const prevLog = sortedLogs[sortedLogs.length - 2];

  const latestValue = latestLog ? (latestLog as any)[selectedMetric] : null;
  const prevValue = prevLog ? (prevLog as any)[selectedMetric] : null;

  let deltaText = '';
  let deltaColor = 'var(--text-muted)';

  if (latestValue !== null && prevValue !== null && latestValue !== undefined && prevValue !== undefined) {
    const diff = Math.round((latestValue - prevValue) * 100) / 100;
    if (diff > 0) {
      deltaText = `+${diff} ${currentOption.unit} (Son ölçüme göre)`;
      deltaColor = selectedMetric.includes('fat') ? '#EF4444' : '#10B981';
    } else if (diff < 0) {
      deltaText = `${diff} ${currentOption.unit} (Son ölçüme göre)`;
      deltaColor = selectedMetric.includes('fat') ? '#10B981' : '#EF4444';
    } else {
      deltaText = 'Değişim yok';
    }
  }

  // Y Eksen Skala Hesaplamaları (Dinamik Min/Max)
  const rawNumbers = metricValues.map(m => Number(m.value));
  let minRaw = rawNumbers.length > 0 ? Math.min(...rawNumbers) : 0;
  let maxRaw = rawNumbers.length > 0 ? Math.max(...rawNumbers) : 100;

  // Marjin ekleyelim ki noktalar grafik sınırlarına yapışmasın
  let deltaRaw = maxRaw - minRaw;
  if (deltaRaw === 0) {
    deltaRaw = minRaw === 0 ? 10 : Math.abs(minRaw * 0.1);
  }

  const yMin = Math.floor((minRaw - deltaRaw * 0.15) * 10) / 10;
  const yMax = Math.ceil((maxRaw + deltaRaw * 0.15) * 10) / 10;
  const yRange = yMax - yMin || 1;

  // Y-Ekseni kılavuz çizgileri (4 kademe)
  const ticksCount = 4;
  const yTicks = Array.from({ length: ticksCount }, (_, i) => {
    const val = yMin + (yRange / (ticksCount - 1)) * i;
    return Math.round(val * 10) / 10;
  });

  // SVG Görsel Çizim Koordinatları (ViewBox: 600 x 220)
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const points = metricValues.map((m, idx) => {
    const val = Number(m.value);
    const x = metricValues.length === 1 
      ? paddingLeft + chartWidth / 2 
      : paddingLeft + (idx / (metricValues.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((val - yMin) / yRange) * chartHeight;
    return { x, y, val, date: m.date };
  });

  // SVG Path (Polyline / Curve) Oluşturma
  const linePathD = points.length > 0 
    ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
    : '';

  const areaPathD = points.length > 0 
    ? `${linePathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Üst Kart: Akıllı Tartı Taraması Butonu & Özeti */}
      <div className="glass-card" style={{ padding: '18px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚖️</span> Akıllı Tartı & Biyo-İmpedans Analitiği
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Yapay zeka ekran görüntüsü tarayıcısı ile tartı uygulamanızdaki 16+ metriği anında grafiklere dökün.
          </p>
        </div>

        <button 
          className="btn-primary" 
          onClick={onOpenScanModal}
          style={{ padding: '10px 16px', fontWeight: 800, background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>📸</span>
          <span>TARTI EKRANI TARA (AI)</span>
        </button>
      </div>

      {/* İnteraktif Grafik Kontrol Paneli */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              İzlenecek Metriği Seçin:
            </label>
            <select 
              value={selectedMetric} 
              onChange={e => setSelectedMetric(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 700, fontSize: '14px', background: 'var(--surface-subtle)', color: 'var(--text-main)', cursor: 'pointer' }}
            >
              {METRIC_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Grafik Türü Seçici (Pills) */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Grafik Türü:
            </label>
            <div style={{ display: 'flex', background: 'var(--surface-subtle)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)', gap: '2px' }}>
              {[
                { type: 'line', label: '📈 Çizgi' },
                { type: 'area', label: '📉 Alan' },
                { type: 'bar', label: '📊 Sütun' },
                { type: 'scatter', label: '📍 Nokta' }
              ].map(item => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setChartType(item.type as ChartType)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: chartType === item.type ? currentOption.color : 'transparent',
                    color: chartType === item.type ? '#FFFFFF' : 'var(--text-muted)',
                    transition: 'all 0.2s ease',
                    boxShadow: chartType === item.type ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Seçili Metrik Anlık Değer Kartı */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: currentOption.color }}>
              {latestValue !== null && latestValue !== undefined ? `${latestValue} ${currentOption.unit}` : 'Veri Yok'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: deltaColor }}>
              {deltaText || 'Ölçüm Kayıtlı'}
            </div>
          </div>
        </div>

        {/* İnteraktif SVG Grafik Alanı */}
        {metricValues.length > 0 ? (
          <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
            <svg 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              style={{ width: '100%', height: 'auto', minHeight: '220px', overflow: 'visible' }}
            >
              <defs>
                {/* Alan Grafiği Gradyan Dolgusu */}
                <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentOption.color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={currentOption.color} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y Eksen Kılavuz Çizgileri ve Etiketleri */}
              {yTicks.map((tick, i) => {
                const yPos = paddingTop + chartHeight - ((tick - yMin) / yRange) * chartHeight;
                return (
                  <g key={i}>
                    <line 
                      x1={paddingLeft} 
                      y1={yPos} 
                      x2={svgWidth - paddingRight} 
                      y2={yPos} 
                      stroke="var(--border)" 
                      strokeDasharray="4 4" 
                      strokeOpacity="0.6"
                    />
                    <text 
                      x={paddingLeft - 8} 
                      y={yPos + 4} 
                      textAnchor="end" 
                      fontSize="10" 
                      fontWeight="600" 
                      fill="var(--text-muted)"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* ALAN GRAFİĞİ DOLGUSU (Area Chart Mode) */}
              {(chartType === 'area' || chartType === 'line') && points.length > 1 && (
                <path 
                  d={areaPathD} 
                  fill={chartType === 'area' ? `url(#grad-${selectedMetric})` : `url(#grad-${selectedMetric})`}
                  opacity={chartType === 'area' ? 1 : 0.4}
                />
              )}

              {/* ÇİZGİ GRAFİĞİ (Line / Area Mode) */}
              {(chartType === 'line' || chartType === 'area') && points.length > 1 && (
                <path 
                  d={linePathD} 
                  fill="none" 
                  stroke={currentOption.color} 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              )}

              {/* SÜTUN GRAFİĞİ (Bar Chart Mode) */}
              {chartType === 'bar' && points.map((p, idx) => {
                const barWidth = Math.min(32, (chartWidth / points.length) * 0.5);
                const barHeight = paddingTop + chartHeight - p.y;
                return (
                  <rect
                    key={idx}
                    x={p.x - barWidth / 2}
                    y={p.y}
                    width={barWidth}
                    height={Math.max(4, barHeight)}
                    rx="4"
                    fill={currentOption.color}
                    opacity={idx === points.length - 1 ? 1 : 0.7}
                  />
                );
              })}

              {/* VERİ NOKTALARI & ETİKETLERİ (Data Dots & Badges) */}
              {points.map((p, idx) => {
                const dateParts = p.date.split(' ');
                const dateStr = dateParts[0].split('-').slice(1).join('/');
                const timeStr = dateParts[1] ? dateParts[1].substring(0, 5) : '';

                return (
                  <g 
                    key={idx}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint({ idx, val: p.val, date: p.date })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Dış Halka / Parlama */}
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r={hoveredPoint?.idx === idx ? "8" : "6"} 
                      fill={currentOption.color} 
                      stroke="#FFFFFF" 
                      strokeWidth="2" 
                      style={{ transition: 'all 0.2s ease' }}
                    />

                    {/* Nokta Üstü Değer Etiketi */}
                    <text 
                      x={p.x} 
                      y={p.y - 12} 
                      textAnchor="middle" 
                      fontSize="11" 
                      fontWeight="800" 
                      fill={currentOption.color}
                    >
                      {p.val} {currentOption.unit}
                    </text>

                    {/* Nokta Altı Tarih ve Saat Etiketi */}
                    <text 
                      x={p.x} 
                      y={paddingTop + chartHeight + 18} 
                      textAnchor="middle" 
                      fontSize="10" 
                      fontWeight="700" 
                      fill="var(--text-main)"
                    >
                      {dateStr}
                    </text>
                    {timeStr && (
                      <text 
                        x={p.x} 
                        y={paddingTop + chartHeight + 30} 
                        textAnchor="middle" 
                        fontSize="9" 
                        fontWeight="500" 
                        fill="var(--text-muted)"
                      >
                        {timeStr}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Tek ölçüm bilgilendirmesi */}
            {points.length === 1 && (
              <div style={{ textAlign: 'center', marginTop: '12px', padding: '8px 12px', background: 'var(--surface-subtle)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                ℹ️ <strong>İlk ölçümünüz kaydedildi ({points[0].val} {currentOption.unit}).</strong> Zaman içindeki değişimi trend çizgisi üzerinde görmek için yeni tartı taraması ekleyin.
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Bu metrik için henüz ölçüm kaydı bulunmuyor. Tartı ekran görüntünüzü yükleyerek kaydetmeye başlayın!
          </div>
        )}
      </div>
    </div>
  );
}

