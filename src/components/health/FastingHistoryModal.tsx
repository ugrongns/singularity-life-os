'use client';

import React, { useState, useEffect } from 'react';
import {
  FastingHistorySummary,
  DailyFastingMetric,
  FastingSessionStats
} from '@/lib/fasting-analytics';
import {
  X,
  Award,
  Sparkles,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Calendar
} from 'lucide-react';

interface FastingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId?: string | null;
}

export default function FastingHistoryModal({
  isOpen,
  onClose,
  memberId
}: FastingHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FastingHistorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'autophagy'>('all');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const query = memberId ? `?member_id=${encodeURIComponent(memberId)}` : '';
    fetch(`/api/health/fasting/history${query}`)
      .then(res => res.json())
      .then(json => {
        if (!isMounted) return;
        if (json.success && json.data) {
          setSummary(json.data);
        } else {
          setError(json.error ?? 'Geçmiş verileri alınamadı.');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message ?? 'Bağlantı hatası.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, memberId, onClose]);

  if (!isOpen) return null;

  const filteredSessions = (summary?.sessions ?? []).filter(s => {
    if (filter === 'autophagy') return s.reachedAutophagy;
    return true;
  });

  // Son 14 günün verisi mini SVG çubuk grafiği için
  const chartDays: DailyFastingMetric[] = (summary?.dailyFastingHours ?? []).slice(-14);
  const maxHoursInChart = Math.max(24, ...(chartDays.map(d => d.fastingHours) || [24])) + 2;

  // SVG Çubuk Grafik Boyutları
  const svgWidth = 560;
  const svgHeight = 160;
  const padLeft = 32;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 26;
  const chartPlotWidth = svgWidth - padLeft - padRight;
  const chartPlotHeight = svgHeight - padTop - padBottom;

  const getY = (hours: number) => {
    const clamped = Math.max(0, Math.min(maxHoursInChart, hours));
    return padTop + chartPlotHeight - (clamped / maxHoursInChart) * chartPlotHeight;
  };

  const line16Y = getY(16);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px'
        }}
      >
        <div className="sheet-handle" />

        {/* Modal Başlığı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#8B5CF6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Sparkles size={20} color="#8B5CF6" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                📜 Geçmiş & Ötofaji Analitiği
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Biyolojik Faz Geçmişi, 16s+ Hücre Yenilenmesi ve Başarı Eğrisi
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '30px', marginBottom: '8px' }}>⏳</div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Ötofaji Verileri Hesaplanıyor...</div>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#EF4444',
              fontSize: '13px'
            }}
          >
            ⚠️ {error}
          </div>
        ) : summary ? (
          <>
            {/* 1. Başarı Rozetleri (3'lü Bento KPI) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px'
              }}
            >
              {/* Bu Ay Otofaji */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(139, 92, 246, 0.04))',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8B5CF6', fontSize: '11px', fontWeight: 800 }}>
                  <Sparkles size={14} /> BU AY ÖTOFAJİ
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#8B5CF6', letterSpacing: '-0.02em' }}>
                  {summary.currentMonthAutophagyHours} <span style={{ fontSize: '13px', fontWeight: 700 }}>sa</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  16s üzeri hücresel temizlik
                </div>
              </div>

              {/* Başarı Oranı */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '11px', fontWeight: 800 }}>
                  <Award size={14} /> BAŞARI ORANI
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#10B981', letterSpacing: '-0.02em' }}>
                  %{summary.successRate}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Hedefini tamamlayan seanslar
                </div>
              </div>

              {/* En Uzun Oruç */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', fontSize: '11px', fontWeight: 800 }}>
                  <Flame size={14} /> EN UZUN ORUÇ
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#F59E0B', letterSpacing: '-0.02em' }}>
                  {summary.longestFastHours} <span style={{ fontSize: '13px', fontWeight: 700 }}>sa</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Kişisel rekor derinliği
                </div>
              </div>

              {/* Toplam Seans */}
              <div
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800 }}>
                  <Clock size={14} /> TAMAMLANAN SEANS
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  {summary.totalCompletedSessions} <span style={{ fontSize: '13px', fontWeight: 700 }}>seans</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Bu ay: {summary.currentMonthFastingHours} sa oruç
                </div>
              </div>
            </div>

            {/* 2. Mini SVG Çubuk Grafik: Son 14 Gün & 16s Ötofaji Eşiği */}
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
                  <Calendar size={14} color="#8B5CF6" />
                  <span>Son 14 Günün Oruç Dağılımı & Ötofaji Çizgisi</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10B981' }} /> 0-16s Oruç
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#8B5CF6' }} /> 16s+ Ötofaji
                  </span>
                </div>
              </div>

              {/* Native Responsive SVG Grafik */}
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  {/* Yatay Kılavuz Çizgileri (8s, 16s, 24s) */}
                  {[8, 16, 24].map(h => {
                    const y = getY(h);
                    const is16 = h === 16;
                    return (
                      <g key={h}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={svgWidth - padRight}
                          y2={y}
                          stroke={is16 ? '#8B5CF6' : 'var(--border)'}
                          strokeDasharray={is16 ? '4 3' : '2 2'}
                          strokeWidth={is16 ? 1.5 : 1}
                          opacity={is16 ? 0.9 : 0.5}
                        />
                        <text
                          x={padLeft - 6}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="9"
                          fill={is16 ? '#8B5CF6' : 'var(--text-muted)'}
                          fontWeight={is16 ? 'bold' : 'normal'}
                        >
                          {h}s
                        </text>
                      </g>
                    );
                  })}

                  {/* 16s Ötofaji Eşiği Rozet Etiketi */}
                  <text
                    x={svgWidth - padRight - 4}
                    y={line16Y - 4}
                    textAnchor="end"
                    fontSize="9"
                    fontWeight="800"
                    fill="#8B5CF6"
                  >
                    ✨ 16s Temel Ötofaji Eşiği
                  </text>

                  {/* Çubuklar (14 Gün) */}
                  {chartDays.map((d, i) => {
                    const colWidth = chartPlotWidth / chartDays.length;
                    const barWidth = Math.max(10, colWidth - 8);
                    const barX = padLeft + i * colWidth + (colWidth - barWidth) / 2;

                    const totalH = d.fastingHours;
                    if (totalH <= 0) {
                      return (
                        <g key={d.date}>
                          <rect
                            x={barX}
                            y={getY(0) - 2}
                            width={barWidth}
                            height={2}
                            rx={1}
                            fill="var(--border)"
                            opacity={0.4}
                          />
                          <text
                            x={barX + barWidth / 2}
                            y={svgHeight - 10}
                            textAnchor="middle"
                            fontSize="8"
                            fill="var(--text-muted)"
                          >
                            {d.dayLabel.split(' ')[0]}
                          </text>
                        </g>
                      );
                    }

                    const baseHours = Math.min(16, totalH);
                    const autoHours = Math.max(0, totalH - 16);

                    const baseY = getY(baseHours);
                    const baseHeight = getY(0) - baseY;

                    const autoY = getY(totalH);
                    const autoHeight = autoHours > 0 ? baseY - autoY : 0;

                    return (
                      <g key={d.date}>
                        <title>{`${d.dayLabel}: Toplam ${totalH}s (Ötofaji: ${d.autophagyHours}s)`}</title>
                        {/* Standart Oruç Kısmı (0 - 16s) */}
                        <rect
                          x={barX}
                          y={baseY}
                          width={barWidth}
                          height={baseHeight}
                          rx={autoHours > 0 ? 0 : 3}
                          fill="#10B981"
                          opacity={0.85}
                        />

                        {/* Ötofaji Kısmı (16s+) */}
                        {autoHours > 0 && (
                          <rect
                            x={barX}
                            y={autoY}
                            width={barWidth}
                            height={autoHeight}
                            rx={3}
                            fill="#8B5CF6"
                          />
                        )}

                        {/* Çubuk Üstü Süre */}
                        <text
                          x={barX + barWidth / 2}
                          y={autoY - 3}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="bold"
                          fill={autoHours > 0 ? '#8B5CF6' : 'var(--text-main)'}
                        >
                          {totalH}s
                        </text>

                        {/* X Ekseni Gün Etiketi */}
                        <text
                          x={barX + barWidth / 2}
                          y={svgHeight - 10}
                          textAnchor="middle"
                          fontSize="8"
                          fill="var(--text-muted)"
                        >
                          {d.dayLabel.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* 3. Son Seanslar Listesi & Filtre */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                  🗓️ Tamamlanan Seanslar ({filteredSessions.length})
                </div>

                {/* Filtre Butonları */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: filter === 'all' ? 'var(--text-main)' : 'var(--surface-subtle)',
                      color: filter === 'all' ? 'var(--bg-main)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Tümü
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('autophagy')}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${filter === 'autophagy' ? '#8B5CF6' : 'var(--border)'}`,
                      background: filter === 'autophagy' ? 'rgba(139, 92, 246, 0.2)' : 'var(--surface-subtle)',
                      color: filter === 'autophagy' ? '#8B5CF6' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    ✨ Sadece Ötofaji
                  </button>
                </div>
              </div>

              {filteredSessions.length === 0 ? (
                <div
                  style={{
                    padding: '30px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border)',
                    fontSize: '12px'
                  }}
                >
                  Bu filtrede tamamlanmış bir oruç seansı bulunmuyor. 🌱
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredSessions.map((s: FastingSessionStats) => {
                    const startStr = new Date(s.startTime).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const endStr = new Date(s.endTime).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={s.id}
                        style={{
                          background: 'var(--surface-subtle)',
                          border: `1px solid ${s.reachedAutophagy ? 'rgba(139, 92, 246, 0.3)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)'
                              }}
                            >
                              {s.protocol}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {startStr} → {endStr}
                            </span>
                          </div>

                          {/* Biyolojik Rozet */}
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: s.reachedAutophagy ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              color: s.phaseColor,
                              border: `1px solid ${s.phaseColor}44`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {s.badge}
                          </span>
                        </div>

                        {/* Süre & Başarı Dökümü */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '13px' }}>
                              ⏱️ {s.durationHours} sa
                            </span>
                            {s.autophagyHours > 0 && (
                              <span style={{ color: '#8B5CF6', fontWeight: 700 }}>
                                🧬 +{s.autophagyHours} sa ötofaji
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {s.isSuccessful ? (
                              <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                                <CheckCircle2 size={13} /> Hedefe Ulaşıldı
                              </span>
                            ) : (
                              <span style={{ color: '#F59E0B', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                                <AlertCircle size={13} /> Erken Bitirildi ({s.targetHours}s hedef)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
