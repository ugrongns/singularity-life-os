'use client';

import React, { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';

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
  notes?: string | null;
}

interface SmartScaleTrendDashboardProps {
  logs: ScaleLog[];
  onOpenScanModal: () => void;
  onDeleteLog?: (id: string) => Promise<void> | void;
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

function parseScaleTimestamp(rawDate: string): number {
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(rawDate)
    ? rawDate.replace(' ', 'T')
    : rawDate;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? 0 : ms;
}

function getNumericMetric(log: ScaleLog | undefined, key: string): number | null {
  if (!log) return null;
  const raw = (log as unknown as Record<string, unknown>)[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) && !Number.isNaN(num) ? num : null;
}

export function SmartScaleTrendDashboard({ logs, onOpenScanModal, onDeleteLog }: SmartScaleTrendDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [selectedMetric, setSelectedMetric] = useState('weight_kg');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [hoveredPoint, setHoveredPoint] = useState<{ idx: number; val: number; date: string } | null>(null);
  const [hoveredMulti, setHoveredMulti] = useState<{ label: string; valueText: string; date: string; x: number; y: number; color: string } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [targetFatPct, setTargetFatPct] = useState<number>(15);

  // Çoklu metrik karşılaştırma state'i
  const [selectedMultiMetrics, setSelectedMultiMetrics] = useState<string[]>([
    'weight_kg', 'body_fat_percent', 'muscle_percent', 'water_percent'
  ]);

  const currentOption = METRIC_OPTIONS.find(m => m.key === selectedMetric) || METRIC_OPTIONS[0];

  // Tarihe göre deterministik sıralanmış loglar (Safari/Chrome uyumlu)
  const sortedLogs = [...logs].sort((a, b) => {
    const diff = parseScaleTimestamp(a.measurement_date) - parseScaleTimestamp(b.measurement_date);
    if (diff !== 0) return diff;
    return a.measurement_date.localeCompare(b.measurement_date);
  });

  const metricValues = sortedLogs
    .map(l => ({
      date: l.measurement_date,
      value: getNumericMetric(l, selectedMetric)
    }))
    .filter((item): item is { date: string; value: number } => item.value !== null);

  const latestLog = sortedLogs[sortedLogs.length - 1];
  const prevLog = sortedLogs[sortedLogs.length - 2];

  const latestValue = getNumericMetric(latestLog, selectedMetric);
  const prevValue = getNumericMetric(prevLog, selectedMetric);

  let deltaText = '';
  let deltaColor = 'var(--text-muted)';

  if (latestValue !== null && prevValue !== null) {
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
  const rawNumbers = metricValues.map(m => m.value);
  const minRaw = rawNumbers.length > 0 ? Math.min(...rawNumbers) : 0;
  const maxRaw = rawNumbers.length > 0 ? Math.max(...rawNumbers) : 100;

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
  const svgHeight = 232;
  const paddingLeft = 60;
  const paddingRight = 28;
  const paddingTop = 36;
  const paddingBottom = 44;
  const plotInsetX = 36;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const usableWidth = Math.max(40, chartWidth - plotInsetX * 2);
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const getPlotX = (idx: number, total: number) => {
    if (total <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + plotInsetX + (idx / (total - 1)) * usableWidth;
  };

  const points = metricValues.map((m, idx) => {
    const val = m.value;
    const x = getPlotX(idx, metricValues.length);
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

  const radarCenterX = 290;
  const radarCenterY = 170;
  const radarRadius = 92;
  const totalAxes = radarMetrics.length;

  const getRadarCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = radarRadius * Math.min(1, Math.max(0, valueRatio));
    return {
      x: radarCenterX + r * Math.cos(angle),
      y: radarCenterY + r * Math.sin(angle),
      angle
    };
  };

  const getRadarLabelCoordinates = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = radarRadius * ratio;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const textAnchor: 'start' | 'middle' | 'end' = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
    const dy = sin > 0.5 ? 8 : sin < -0.5 ? -8 : 0;
    return {
      x: radarCenterX + r * cos,
      y: radarCenterY + r * sin + dy,
      textAnchor
    };
  };

  const latestRadarPoints = radarMetrics.map((rm, idx) => {
    const rawVal = getNumericMetric(latestLog, rm.key);
    const val = rawVal ?? 0;
    const ratio = val / rm.max;
    return { ...getRadarCoordinates(idx, ratio), val, hasValue: rawVal !== null, rm };
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
          type="button"
          className="btn-primary"
          onClick={onOpenScanModal}
          style={{
            width: 'auto',
            marginTop: 0,
            padding: '10px 16px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
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

      {/* ------------------ 🧬 BIA LBM HEDEF KİLO & PROTEİN KOÇ BANDI ------------------ */}
      {latestLog && latestLog.weight_kg > 0 && (latestLog.fat_free_mass_kg || latestLog.body_fat_percent) && (() => {
        const lbmKg = latestLog.fat_free_mass_kg && latestLog.fat_free_mass_kg > 0
          ? latestLog.fat_free_mass_kg
          : latestLog.weight_kg * (1 - (latestLog.body_fat_percent || 20) / 100);
        const targetWeightKg = lbmKg / (1 - targetFatPct / 100);
        const fatToLoseKg = Math.max(0, latestLog.weight_kg - targetWeightKg);
        const dailyProteinG = Math.round(lbmKg * 1.8);
        return (
          <div
            className="glass-card"
            style={{
              padding: '14px 16px',
              marginBottom: '12px',
              borderLeft: '4px solid #10B981',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                  🧬 BIA Vücut Kompozisyonu &amp; LBM Hedef Koçu
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Sıfır AI kotalı deterministik analiz • Kas kütlesini (LBM) koruyarak yağ yakım hedefi
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', marginRight: '4px' }}>Hedef Yağ:</span>
                {[12, 15, 18, 20, 22].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setTargetFatPct(pct)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      border: `1px solid ${targetFatPct === pct ? '#10B981' : 'var(--border)'}`,
                      background: targetFatPct === pct ? 'rgba(16, 185, 129, 0.14)' : 'var(--surface-subtle)',
                      color: targetFatPct === pct ? '#10B981' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    %{pct}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Yağsız Kütle (LBM)</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#3B82F6' }}>{lbmKg.toFixed(1)} kg</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>%{targetFatPct} Yağda Hedef Kilo</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#10B981' }}>{targetWeightKg.toFixed(1)} kg</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Verilecek Net Yağ</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: fatToLoseKg > 0 ? '#F59E0B' : '#10B981' }}>
                  {fatToLoseKg > 0 ? `${fatToLoseKg.toFixed(1)} kg` : 'Hedefe Ulaşıldı 🎉'}
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Günlük Protein Koçu (1.8g/LBM)</div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#8B5CF6' }}>{dailyProteinG} g/gün</div>
              </div>
            </div>
          </div>
        );
      })()}

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
                  <option key={opt.key} value={opt.key}>{opt.icon} {opt.label} ({opt.unit || 'puan'})</option>
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
                {latestValue !== null ? `${latestValue} ${currentOption.unit}` : 'Veri Yok'}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: deltaColor }}>
                {deltaText || (latestValue !== null ? 'Ölçüm Kayıtlı' : 'Ölçüm Bekleniyor')}
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
                      <text x={paddingLeft - 10} y={yPos + 4} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--text-muted)">{tick}</text>
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
                  const barWidth = Math.min(32, (usableWidth / Math.max(1, points.length)) * 0.5);
                  const barHeight = paddingTop + chartHeight - p.y;
                  return (
                    <rect key={idx} x={p.x - barWidth / 2} y={p.y} width={barWidth} height={Math.max(4, barHeight)} rx="4" fill={currentOption.color} opacity={idx === points.length - 1 ? 1 : 0.7} />
                  );
                })}

                {points.map((p, idx) => {
                  const dateParts = p.date.split(' ');
                  const dateStr = dateParts[0].split('-').slice(1).join('/');
                  const timeStr = dateParts[1] ? dateParts[1].substring(0, 5) : '';
                  const showLabel = points.length <= 7 || idx === 0 || idx === points.length - 1 || hoveredPoint?.idx === idx || idx % Math.ceil(points.length / 6) === 0;

                  return (
                    <g key={idx} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint({ idx, val: p.val, date: p.date })} onMouseLeave={() => setHoveredPoint(null)}>
                      <circle cx={p.x} cy={p.y} r={hoveredPoint?.idx === idx ? '8' : '6'} fill={currentOption.color} stroke="#FFFFFF" strokeWidth="2" style={{ transition: 'all 0.2s ease' }} />
                      {showLabel && (
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill={currentOption.color}>
                          {p.val} {currentOption.unit}
                        </text>
                      )}
                      {showLabel && (
                        <>
                          <text x={p.x} y={paddingTop + chartHeight + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">{dateStr}</text>
                          {timeStr && <text x={p.x} y={paddingTop + chartHeight + 30} textAnchor="middle" fontSize="9" fontWeight="500" fill="var(--text-muted)">{timeStr}</text>}
                        </>
                      )}
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
          <div style={{ marginBottom: '12px' }}>
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

          {/* Seçili Metriklerin Güncel Değer Lejantı (Çakışmasız Okuma) */}
          {sortedLogs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              {selectedMultiMetrics.map(metricKey => {
                const opt = METRIC_OPTIONS.find(m => m.key === metricKey) || METRIC_OPTIONS[0];
                const lastVal = getNumericMetric(latestLog, metricKey);
                return (
                  <div key={metricKey} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-muted)' }}>{opt.label}:</span>
                    <span style={{ color: opt.color, fontWeight: 800 }}>
                      {lastVal !== null ? `${lastVal} ${opt.unit}`.trim() : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

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
                      <text x={paddingLeft - 10} y={yPos + 4} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--text-muted)">%{pct}</text>
                    </g>
                  );
                })}

                {/* Her Seçili Metrik İçin Çizgi Çiz (Yalnızca gerçek veri olan noktalar!) */}
                {selectedMultiMetrics.map(metricKey => {
                  const opt = METRIC_OPTIONS.find(m => m.key === metricKey) || METRIC_OPTIONS[0];
                  const validEntries = sortedLogs
                    .map((l, i) => ({ idx: i, val: getNumericMetric(l, metricKey), date: l.measurement_date }))
                    .filter((entry): entry is { idx: number; val: number; date: string } => entry.val !== null);

                  if (validEntries.length === 0) return null;

                  const vals = validEntries.map(e => e.val);
                  const minV = Math.min(...vals);
                  const maxV = Math.max(...vals);
                  const rangeV = maxV - minV;

                  const mPoints = validEntries.map(entry => {
                    const normRatio = rangeV === 0 ? 0.5 : (entry.val - minV) / rangeV;
                    const x = getPlotX(entry.idx, sortedLogs.length);
                    const y = paddingTop + chartHeight - (normRatio * 0.8 + 0.1) * chartHeight;
                    return { x, y, rawV: entry.val, date: entry.date };
                  });

                  const pathD = mPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

                  return (
                    <g key={metricKey}>
                      {mPoints.length > 1 && (
                        <path d={pathD} fill="none" stroke={opt.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
                      )}
                      {mPoints.map((p, pIdx) => (
                        <circle
                          key={pIdx}
                          cx={p.x}
                          cy={p.y}
                          r="4.5"
                          fill={opt.color}
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredMulti({
                            label: opt.label,
                            valueText: `${p.rawV} ${opt.unit}`.trim(),
                            date: p.date.split(' ')[0],
                            x: p.x,
                            y: p.y,
                            color: opt.color
                          })}
                          onMouseLeave={() => setHoveredMulti(null)}
                        />
                      ))}
                    </g>
                  );
                })}

                {/* X Eksen Tarihleri */}
                {sortedLogs.map((l, i) => {
                  const showDateTick = sortedLogs.length <= 7 || i === 0 || i === sortedLogs.length - 1 || i % Math.ceil(sortedLogs.length / 6) === 0;
                  if (!showDateTick) return null;
                  const x = getPlotX(i, sortedLogs.length);
                  const dateStr = l.measurement_date.split(' ')[0].split('-').slice(1).join('/');
                  return (
                    <text key={i} x={x} y={paddingTop + chartHeight + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">
                      {dateStr}
                    </text>
                  );
                })}

                {/* Hover Tooltip */}
                {hoveredMulti && (
                  <g pointerEvents="none">
                    <rect
                      x={Math.min(svgWidth - 155, Math.max(paddingLeft, hoveredMulti.x - 68))}
                      y={Math.max(4, hoveredMulti.y - 36)}
                      width="136"
                      height="26"
                      rx="6"
                      fill="#0F172A"
                      stroke={hoveredMulti.color}
                      strokeWidth="1.5"
                    />
                    <text
                      x={Math.min(svgWidth - 155, Math.max(paddingLeft, hoveredMulti.x - 68)) + 68}
                      y={Math.max(4, hoveredMulti.y - 36) + 17}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="800"
                      fill="#FFFFFF"
                    >
                      {hoveredMulti.label}: {hoveredMulti.valueText}
                    </text>
                  </g>
                )}
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
            Son biyo-impedans taramanızın 8 temel parametredeki bütünsel profili
          </p>

          {latestLog ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <svg viewBox="0 0 580 340" style={{ width: '100%', maxWidth: '580px', height: 'auto', overflow: 'visible' }}>
                {/* Radar Ağ Arka Plan Poligonları (%25, %50, %75, %100) */}
                {[0.25, 0.5, 0.75, 1.0].map((level, lIdx) => {
                  const polyPoints = radarMetrics.map((_, i) => getRadarCoordinates(i, level));
                  const pathD = polyPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '') + ' Z';
                  return (
                    <path key={lIdx} d={pathD} fill="none" stroke="var(--border)" strokeDasharray={level === 1.0 ? 'none' : '3 3'} strokeOpacity="0.7" />
                  );
                })}

                {/* Eksen Çizgileri & Değerli Dış Etiketler (Çakışmasız Yerleşim) */}
                {radarMetrics.map((rm, i) => {
                  const endPos = getRadarCoordinates(i, 1.0);
                  const labelPos = getRadarLabelCoordinates(i, 1.24);
                  const pt = latestRadarPoints[i];
                  const valLabel = pt.hasValue ? `${pt.val}${rm.unit ? ` ${rm.unit}` : ''}` : '—';
                  return (
                    <g key={i}>
                      <line x1={radarCenterX} y1={radarCenterY} x2={endPos.x} y2={endPos.y} stroke="var(--border)" strokeOpacity="0.6" />
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor={labelPos.textAnchor}
                        fontSize="11"
                        fontWeight="800"
                        fill="var(--text-main)"
                      >
                        <tspan x={labelPos.x} dy="0">{rm.label}</tspan>
                        <tspan x={labelPos.x} dy="13" fill="#10B981" fontSize="10" fontWeight="900">{valLabel}</tspan>
                      </text>
                    </g>
                  );
                })}

                {/* Son Ölçüm Veri Poligonu */}
                <path d={radarPolygonD} fill="rgba(16, 185, 129, 0.25)" stroke="#10B981" strokeWidth="3" strokeLinejoin="round" />

                {/* Veri Noktaları */}
                {latestRadarPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
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
              const currentVal = getNumericMetric(latestLog, opt.key);
              const previousVal = getNumericMetric(prevLog, opt.key);
              const allVals = sortedLogs
                .map(l => getNumericMetric(l, opt.key))
                .filter((v): v is number => v !== null);

              let diffText = '—';
              let diffColor = 'var(--text-muted)';
              if (currentVal !== null && previousVal !== null) {
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
                    {currentVal !== null ? `${currentVal} ${opt.unit}` : '—'}
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

      {/* ------------------ KAYITLI TARTI ÖLÇÜMLERİ GEÇMİŞİ & TEKİL SİLME ------------------ */}
      {sortedLogs.length > 0 && onDeleteLog && (
        <div className="glass-card" style={{ padding: '14px 18px' }}>
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              color: 'var(--text-main)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800 }}>
              <span>📋</span>
              <span>Kayıtlı Tartı Ölçümleri ({sortedLogs.length})</span>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
              <span>{isHistoryOpen ? 'Gizle' : 'Göster'}</span>
              {isHistoryOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>

          {isHistoryOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', maxHeight: '260px', overflowY: 'auto' }}>
              {[...sortedLogs].reverse().map(log => {
                const isDeleting = deletingId === log.id;
                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--surface-subtle)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 900, color: '#10B981' }}>
                          {log.weight_kg} Kg
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          📅 {log.measurement_date}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {log.bmi !== null && log.bmi !== undefined && (
                          <span>BMI: <strong style={{ color: 'var(--text-main)' }}>{log.bmi}</strong></span>
                        )}
                        {log.body_fat_percent !== null && log.body_fat_percent !== undefined && (
                          <span>Yağ: <strong style={{ color: '#EF4444' }}>%{log.body_fat_percent}</strong></span>
                        )}
                        {log.muscle_percent !== null && log.muscle_percent !== undefined && (
                          <span>Kas: <strong style={{ color: '#8B5CF6' }}>%{log.muscle_percent}</strong></span>
                        )}
                        {log.water_percent !== null && log.water_percent !== undefined && (
                          <span>Su: <strong style={{ color: '#06B6D4' }}>%{log.water_percent}</strong></span>
                        )}
                        {log.notes && (
                          <span style={{ fontStyle: 'italic' }}>• {log.notes}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={async () => {
                        setDeletingId(log.id);
                        try {
                          await onDeleteLog(log.id);
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      title="Ölçümü Sil"
                      aria-label={`${log.measurement_date} ölçümünü sil`}
                      style={{
                        minWidth: '34px',
                        minHeight: '34px',
                        padding: '6px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: '#EF4444',
                        cursor: isDeleting ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        opacity: isDeleting ? 0.5 : 1
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
