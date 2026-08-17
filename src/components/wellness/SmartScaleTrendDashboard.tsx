'use client';

import React, { useState } from 'react';

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

type ViewMode = 'single' | 'multi' | 'radar' | 'matrix';
type ChartType = 'line' | 'area' | 'bar' | 'scatter';

const METRIC_OPTIONS = [
  { key: 'weight_kg', label: 'Ağırlık', unit: 'Kg', color: '#10B981', icon: '⚖️' },
  { key: 'bmi', label: 'BMI', unit: '', color: '#F59E0B', icon: '📐' },
  { key: 'body_fat_percent', label: 'Vücut Yağ Oranı', unit: '%', color: '#EF4444', icon: '💧' },
  { key: 'body_fat_mass_kg', label: 'Vücut Yağ Ağırlığı', unit: 'Kg', color: '#EF4444', icon: '⚖️' },
  { key: 'skeletal_muscle_percent', label: 'İskelet Kası %', unit: '%', color: '#3B82F6', icon: '🦴' },
  { key: 'skeletal_muscle_mass_kg', label: 'İskelet Kası Ağırlığı', unit: 'Kg', color: '#3B82F6', icon: '🏋️' },
  { key: 'muscle_percent', label: 'Kas Oranı', unit: '%', color: '#8B5CF6', icon: '💪' },
  { key: 'muscle_mass_kg', label: 'Kas Ağırlığı', unit: 'Kg', color: '#8B5CF6', icon: '🏋️‍♂️' },
  { key: 'water_percent', label: 'Su Oranı', unit: '%', color: '#06B6D4', icon: '🌊' },
  { key: 'water_mass_kg', label: 'Vücut Sıvı Ağırlığı', unit: 'Kg', color: '#06B6D4', icon: '💧' },
  { key: 'visceral_fat_rating', label: 'İç Organ Yağı (V-Yağ)', unit: '', color: '#DC2626', icon: '⚠️' },
  { key: 'bone_mass_kg', label: 'Kemik Kütlesi', unit: 'Kg', color: '#6B7280', icon: '🦴' },
  { key: 'bmr_calories', label: 'Bazal Metabolizma', unit: 'kcal', color: '#F59E0B', icon: '🔥' },
  { key: 'protein_percent', label: 'Protein Oranı', unit: '%', color: '#10B981', icon: '🥩' },
  { key: 'obesity_degree_percent', label: 'Obezite Derecesi', unit: '%', color: '#EF4444', icon: '📈' },
  { key: 'metabolic_age', label: 'Metabolik Yaş', unit: 'Yaş', color: '#EC4899', icon: '🎂' }
];

export function SmartScaleTrendDashboard({ logs, onOpenScanModal }: SmartScaleTrendDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [selectedMetric, setSelectedMetric] = useState('weight_kg');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [hoveredPoint, setHoveredPoint] = useState<{ idx: number; val: number; date: string } | null>(null);

  // Çoklu metrik karşılaştırma state'i
  const [selectedMultiMetrics, setSelectedMultiMetrics] = useState<string[]>([
    'weight_kg', 'body_fat_percent', 'muscle_percent', 'water_percent'
  ]);

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

  // Y Eksen Skala Hesaplamaları (Tekli Grafik İçin)
  const rawNumbers = metricValues.map(m => Number(m.value));
  let minRaw = rawNumbers.length > 0 ? Math.min(...rawNumbers) : 0;
  let maxRaw = rawNumbers.length > 0 ? Math.max(...rawNumbers) : 100;

  let deltaRaw = maxRaw - minRaw;
  if (deltaRaw === 0) {
    deltaRaw = minRaw === 0 ? 10 : Math.abs(minRaw * 0.1);
  }

  const yMin = Math.floor((minRaw - deltaRaw * 0.15) * 10) / 10;
  const yMax = Math.ceil((maxRaw + deltaRaw * 0.15) * 10) / 10;
  const yRange = yMax - yMin || 1;

  const ticksCount = 4;
  const yTicks = Array.from({ length: ticksCount }, (_, i) => {
    const val = yMin + (yRange / (ticksCount - 1)) * i;
    return Math.round(val * 10) / 10;
  });

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

  const linePathD = points.length > 0 
    ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
    : '';

  const areaPathD = points.length > 0 
    ? `${linePathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  const toggleMultiMetric = (key: string) => {
    if (selectedMultiMetrics.includes(key)) {
      if (selectedMultiMetrics.length > 1) {
        setSelectedMultiMetrics(selectedMultiMetrics.filter(k => k !== key));
      }
    } else {
      setSelectedMultiMetrics([...selectedMultiMetrics, key]);
    }
  };

  // RADAR GRAFİK HESAPLAMALARI (Radar Chart Geometry)
  const radarMetrics = [
    { key: 'weight_kg', label: 'Ağırlık', max: 120, unit: 'kg' },
    { key: 'bmi', label: 'BMI', max: 40, unit: '' },
    { key: 'body_fat_percent', label: 'Yağ %', max: 40, unit: '%' },
    { key: 'muscle_percent', label: 'Kas %', max: 80, unit: '%' },
    { key: 'water_percent', label: 'Su %', max: 70, unit: '%' },
    { key: 'protein_percent', label: 'Protein %', max: 30, unit: '%' },
    { key: 'visceral_fat_rating', label: 'V-Yağ', max: 20, unit: '' },
    { key: 'metabolic_age', label: 'Met. Yaş', max: 60, unit: 'yaş' }
  ];

  const radarCenterX = 250;
  const radarCenterY = 150;
  const radarRadius = 100;
  const totalAxes = radarMetrics.length;

  const getRadarCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = radarRadius * Math.min(1, Math.max(0, valueRatio));
    return {
      x: radarCenterX + r * Math.cos(angle),
      y: radarCenterY + r * Math.sin(angle)
    };
  };

  const latestRadarPoints = radarMetrics.map((rm, idx) => {
    const val = latestLog ? Number((latestLog as any)[rm.key] || 0) : 0;
    const ratio = val / rm.max;
    return { ...getRadarCoordinates(idx, ratio), val, rm };
  });

  const radarPolygonD = latestRadarPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '') + ' Z';

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

      {/* Görünüm Modu Sekme Barı (View Mode Tabs) */}
      <div className="glass-card" style={{ padding: '10px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>Analiz Görünümü:</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'single', label: '📈 Tekli Metrik Trendi' },
            { id: 'multi', label: '🔀 Çoklu Çizgi Karşılaştırma' },
            { id: 'radar', label: '🕸️ Vücut Kompozisyonu Radarı' },
            { id: 'matrix', label: '📊 Biyo-İmpedans Matrisi' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id as ViewMode)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === tab.id ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' : 'var(--surface-subtle)',
                color: viewMode === tab.id ? '#FFFFFF' : 'var(--text-main)',
                boxShadow: viewMode === tab.id ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------ GÖRÜNÜM 1: TEKLİ METRİK TRENDİ ------------------ */}
      {viewMode === 'single' && (
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
                  <option key={opt.key} value={opt.key}>{opt.icon} {opt.label} ({opt.unit})</option>
                ))}
              </select>
            </div>

            {/* Grafik Türü Seçici */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Grafik Stili:
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
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Anlık Değer Kartı */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: currentOption.color }}>
                {latestValue !== null && latestValue !== undefined ? `${latestValue} ${currentOption.unit}` : 'Veri Yok'}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: deltaColor }}>
                {deltaText || 'Ölçüm Kayıtlı'}
              </div>
            </div>
          </div>

          {/* SVG Grafik */}
          {metricValues.length > 0 ? (
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', minHeight: '220px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={currentOption.color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={currentOption.color} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {yTicks.map((tick, i) => {
                  const yPos = paddingTop + chartHeight - ((tick - yMin) / yRange) * chartHeight;
                  return (
                    <g key={i}>
                      <line x1={paddingLeft} y1={yPos} x2={svgWidth - paddingRight} y2={yPos} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity="0.6" />
                      <text x={paddingLeft - 8} y={yPos + 4} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--text-muted)">{tick}</text>
                    </g>
                  );
                })}

                {(chartType === 'area' || chartType === 'line') && points.length > 1 && (
                  <path d={areaPathD} fill={`url(#grad-${selectedMetric})`} opacity={chartType === 'area' ? 1 : 0.4} />
                )}

                {(chartType === 'line' || chartType === 'area') && points.length > 1 && (
                  <path d={linePathD} fill="none" stroke={currentOption.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {chartType === 'bar' && points.map((p, idx) => {
                  const barWidth = Math.min(32, (chartWidth / points.length) * 0.5);
                  const barHeight = paddingTop + chartHeight - p.y;
                  return (
                    <rect key={idx} x={p.x - barWidth / 2} y={p.y} width={barWidth} height={Math.max(4, barHeight)} rx="4" fill={currentOption.color} opacity={idx === points.length - 1 ? 1 : 0.7} />
                  );
                })}

                {points.map((p, idx) => {
                  const dateParts = p.date.split(' ');
                  const dateStr = dateParts[0].split('-').slice(1).join('/');
                  const timeStr = dateParts[1] ? dateParts[1].substring(0, 5) : '';

                  return (
                    <g key={idx} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint({ idx, val: p.val, date: p.date })} onMouseLeave={() => setHoveredPoint(null)}>
                      <circle cx={p.x} cy={p.y} r={hoveredPoint?.idx === idx ? "8" : "6"} fill={currentOption.color} stroke="#FFFFFF" strokeWidth="2" style={{ transition: 'all 0.2s ease' }} />
                      <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill={currentOption.color}>{p.val} {currentOption.unit}</text>
                      <text x={p.x} y={paddingTop + chartHeight + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">{dateStr}</text>
                      {timeStr && <text x={p.x} y={paddingTop + chartHeight + 30} textAnchor="middle" fontSize="9" fontWeight="500" fill="var(--text-muted)">{timeStr}</text>}
                    </g>
                  );
                })}
              </svg>

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
      )}

      {/* ------------------ GÖRÜNÜM 2: ÇOKLU ÇİZGİ KARŞILAŞTIRMA ------------------ */}
      {viewMode === 'multi' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
              Grafikte Karşılaştırılacak Metrikleri Seçin:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {METRIC_OPTIONS.map(opt => {
                const isSelected = selectedMultiMetrics.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleMultiMetric(opt.key)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: `1px solid ${opt.color}`,
                      cursor: 'pointer',
                      background: isSelected ? opt.color : 'transparent',
                      color: isSelected ? '#FFFFFF' : opt.color,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{opt.icon} {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Çoklu Normalize Çizgi Grafiği */}
          {sortedLogs.length > 0 ? (
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', minHeight: '240px', overflow: 'visible' }}>
                {/* % Kılavuz Çizgileri */}
                {[0, 25, 50, 75, 100].map((pct, idx) => {
                  const yPos = paddingTop + chartHeight - (pct / 100) * chartHeight;
                  return (
                    <g key={idx}>
                      <line x1={paddingLeft} y1={yPos} x2={svgWidth - paddingRight} y2={yPos} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity="0.5" />
                      <text x={paddingLeft - 8} y={yPos + 4} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--text-muted)">%{pct}</text>
                    </g>
                  );
                })}

                {/* Her Seçili Metrik İçin Çizgi Çiz */}
                {selectedMultiMetrics.map(metricKey => {
                  const opt = METRIC_OPTIONS.find(m => m.key === metricKey) || METRIC_OPTIONS[0];
                  const vals = sortedLogs.map(l => Number((l as any)[metricKey])).filter(v => !isNaN(v) && v !== 0);

                  if (vals.length === 0) return null;

                  const minV = Math.min(...vals);
                  const maxV = Math.max(...vals);
                  const rangeV = maxV - minV || 1;

                  const mPoints = sortedLogs.map((l, i) => {
                    const rawV = Number((l as any)[metricKey] || minV);
                    const normRatio = (rawV - minV) / rangeV;
                    const x = sortedLogs.length === 1 ? paddingLeft + chartWidth / 2 : paddingLeft + (i / (sortedLogs.length - 1)) * chartWidth;
                    const y = paddingTop + chartHeight - (normRatio * 0.8 + 0.1) * chartHeight;
                    return { x, y, rawV, date: l.measurement_date };
                  });

                  const pathD = mPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

                  return (
                    <g key={metricKey}>
                      <path d={pathD} fill="none" stroke={opt.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
                      {mPoints.map((p, pIdx) => (
                        <g key={pIdx}>
                          <circle cx={p.x} cy={p.y} r="4" fill={opt.color} stroke="#FFFFFF" strokeWidth="1.5" />
                          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fontWeight="800" fill={opt.color}>
                            {p.rawV} {opt.unit}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })}

                {/* X Eksen Tarihleri */}
                {sortedLogs.map((l, i) => {
                  const x = sortedLogs.length === 1 ? paddingLeft + chartWidth / 2 : paddingLeft + (i / (sortedLogs.length - 1)) * chartWidth;
                  const dateStr = l.measurement_date.split(' ')[0].split('-').slice(1).join('/');
                  return (
                    <text key={i} x={x} y={paddingTop + chartHeight + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">
                      {dateStr}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>Henüz tartı verisi bulunmuyor.</div>
          )}
        </div>
      )}

      {/* ------------------ GÖRÜNÜM 3: VÜCUT KOMPOZİSYONU RADARI (360° Radar Chart) ------------------ */}
      {viewMode === 'radar' && (
        <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-main)' }}>
            🕸️ 360° Vücut Kompozisyonu Radarı
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Son biyo-İmpedans taramanızın 8 temel parametredeki bütünsel profili
          </p>

          {latestLog ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <svg viewBox="0 0 500 300" style={{ width: '100%', maxWidth: '500px', height: 'auto' }}>
                {/* Radar Ağ Arka Plan Poligonları (%25, %50, %75, %100) */}
                {[0.25, 0.5, 0.75, 1.0].map((level, lIdx) => {
                  const polyPoints = radarMetrics.map((_, i) => getRadarCoordinates(i, level));
                  const pathD = polyPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '') + ' Z';
                  return (
                    <path key={lIdx} d={pathD} fill="none" stroke="var(--border)" strokeDasharray={level === 1.0 ? 'none' : '3 3'} strokeOpacity="0.7" />
                  );
                })}

                {/* Eksen Çizgileri & Etiketleri */}
                {radarMetrics.map((rm, i) => {
                  const endPos = getRadarCoordinates(i, 1.0);
                  const labelPos = getRadarCoordinates(i, 1.2);
                  return (
                    <g key={i}>
                      <line x1={radarCenterX} y1={radarCenterY} x2={endPos.x} y2={endPos.y} stroke="var(--border)" strokeOpacity="0.6" />
                      <text x={labelPos.x} y={labelPos.y} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-main)">
                        {rm.label}
                      </text>
                    </g>
                  );
                })}

                {/* Son Ölçüm Veri Poligonu */}
                <path d={radarPolygonD} fill="rgba(16, 185, 129, 0.25)" stroke="#10B981" strokeWidth="3" strokeLinejoin="round" />

                {/* Veri Noktaları ve Rozetleri */}
                {latestRadarPoints.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                    <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="900" fill="#10B981">
                      {p.val} {p.rm.unit}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Radar grafiği oluşturmak için henüz ölçüm kaydı yok.</div>
          )}
        </div>
      )}

      {/* ------------------ GÖRÜNÜM 4: BİYO-İMPEDANS MATRİSİ (All Metrics Cards + Sparklines) ------------------ */}
      {viewMode === 'matrix' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-main)' }}>
            📊 Tüm Biyo-İmpedans Metrik Matrisi
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Son ölçümünüzün 16 metriği, değişim farkları ve mini trend çizgileri (Sparklines)
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {METRIC_OPTIONS.map(opt => {
              const currentVal = latestLog ? (latestLog as any)[opt.key] : null;
              const previousVal = prevLog ? (prevLog as any)[opt.key] : null;
              const allVals = sortedLogs.map(l => Number((l as any)[opt.key])).filter(v => !isNaN(v));

              let diffText = '—';
              let diffColor = 'var(--text-muted)';
              if (currentVal !== null && previousVal !== null && currentVal !== undefined && previousVal !== undefined) {
                const diff = Math.round((currentVal - previousVal) * 100) / 100;
                if (diff > 0) {
                  diffText = `▲ +${diff} ${opt.unit}`;
                  diffColor = opt.key.includes('fat') ? '#EF4444' : '#10B981';
                } else if (diff < 0) {
                  diffText = `▼ ${diff} ${opt.unit}`;
                  diffColor = opt.key.includes('fat') ? '#10B981' : '#EF4444';
                } else {
                  diffText = '= Değişim yok';
                }
              }

              // Mini Sparkline SVG Path
              let sparklineD = '';
              if (allVals.length > 1) {
                const sMin = Math.min(...allVals);
                const sMax = Math.max(...allVals);
                const sRange = sMax - sMin || 1;
                const sW = 60;
                const sH = 20;
                sparklineD = allVals.reduce((acc, v, i) => {
                  const sx = (i / (allVals.length - 1)) * sW;
                  const sy = sH - ((v - sMin) / sRange) * (sH - 4) - 2;
                  return `${acc} ${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
                }, '');
              }

              return (
                <div 
                  key={opt.key}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>
                      {opt.icon} {opt.label}
                    </span>
                    {sparklineD && (
                      <svg width="60" height="20" style={{ overflow: 'visible' }}>
                        <path d={sparklineD} fill="none" stroke={opt.color} strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>

                  <div style={{ fontSize: '20px', fontWeight: 900, color: opt.color }}>
                    {currentVal !== null && currentVal !== undefined ? `${currentVal} ${opt.unit}` : '—'}
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: 700, color: diffColor }}>
                    {diffText}
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


