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

const METRIC_OPTIONS = [
  { key: 'weight_kg', label: 'Ağırlık (Kg)', unit: 'Kg', color: '#10B981', status: '84.65 Kg' },
  { key: 'bmi', label: 'BMI (Vücut Kitle İndeksi)', unit: '', color: '#F59E0B', status: 'Yüksek' },
  { key: 'body_fat_percent', label: 'Vücut Yağ Oranı (%)', unit: '%', color: '#EF4444', status: 'Yüksek' },
  { key: 'body_fat_mass_kg', label: 'Vücut Yağ Ağırlığı (Kg)', unit: 'Kg', color: '#EF4444', status: 'Yüksek' },
  { key: 'skeletal_muscle_percent', label: 'İskelet Kası Yüzdesi (%)', unit: '%', color: '#3B82F6', status: 'Sağlıklı' },
  { key: 'skeletal_muscle_mass_kg', label: 'İskelet Kası Ağırlığı (Kg)', unit: 'Kg', color: '#3B82F6', status: 'Sağlıklı' },
  { key: 'muscle_percent', label: 'Kas Oranı (%)', unit: '%', color: '#8B5CF6', status: 'Mükemmel' },
  { key: 'muscle_mass_kg', label: 'Kas Ağırlığı (Kg)', unit: 'Kg', color: '#8B5CF6', status: 'Mükemmel' },
  { key: 'water_percent', label: 'Su Oranı (%)', unit: '%', color: '#06B6D4', status: 'Sağlıklı' },
  { key: 'water_mass_kg', label: 'Vücut Sıvı Ağırlığı (Kg)', unit: 'Kg', color: '#06B6D4', status: 'Sağlıklı' },
  { key: 'visceral_fat_rating', label: 'V-Yağ (İç Organ Yağı)', unit: '', color: '#DC2626', status: 'Obez ⚠️' },
  { key: 'bone_mass_kg', label: 'Kemik Kütlesi (Kg)', unit: 'Kg', color: '#6B7280', status: 'Sağlıklı' },
  { key: 'bmr_calories', label: 'Bazal Metabolizma (kcal)', unit: 'kcal', color: '#F59E0B', status: 'Yüksek' },
  { key: 'protein_percent', label: 'Protein Oranı (%)', unit: '%', color: '#10B981', status: 'Sağlıklı' },
  { key: 'metabolic_age', label: 'Metabolik Yaş', unit: 'Yaş', color: '#EC4899', status: 'Metabolik' }
];

export function SmartScaleTrendDashboard({ logs, onOpenScanModal }: SmartScaleTrendDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState('weight_kg');

  // Debug: console log to verify data flow
  React.useEffect(() => {
    console.log('[SmartScaleTrendDashboard] logs received:', logs?.length, logs);
  }, [logs]);


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

  // Grafik için Min/Max Hesaplama
  const rawNumbers = metricValues.map(m => m.value as number);
  const minVal = rawNumbers.length > 0 ? Math.min(...rawNumbers) : 0;
  const maxVal = rawNumbers.length > 0 ? Math.max(...rawNumbers) : 100;
  const range = maxVal - minVal || 1;

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              İzlenecek Metriği Seçin:
            </label>
            <select 
              value={selectedMetric} 
              onChange={e => setSelectedMetric(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 700, fontSize: '14px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
            >
              {METRIC_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Seçili Metrik Anlık Değer Kartı */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: currentOption.color }}>
              {latestValue !== null && latestValue !== undefined ? `${latestValue} ${currentOption.unit}` : 'Veri Yok'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: deltaColor }}>
              {deltaText || 'İlk Ölçüm'}
            </div>
          </div>
        </div>

        {/* Görsel Trend Grafiği */}
        {metricValues.length > 0 ? (
          <div style={{ marginTop: '10px' }}>
            <div style={{ height: '160px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              {metricValues.map((m, idx) => {
                const val = m.value as number;
                const heightPercent = Math.max(15, Math.min(100, Math.round(((val - minVal) / range) * 80 + 20)));

                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: currentOption.color }}>{val}</span>
                    <div 
                      style={{ 
                        width: '100%', 
                        maxWidth: '40px',
                        height: `${heightPercent}%`, 
                        background: currentOption.color, 
                        borderRadius: '6px 6px 0 0',
                        opacity: idx === metricValues.length - 1 ? 1 : 0.6,
                        transition: 'height 0.3s ease'
                      }} 
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {m.date.split('T')[0].split('-').slice(1).join('/')}
                    </span>
                  </div>
                );
              })}
            </div>
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
