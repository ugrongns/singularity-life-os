'use client';

import React, { useState, useEffect } from 'react';
import {
  ReadingAnalyticsSummary,
  EnrichedReadingSession,
  CategoryWpmMetric
} from '@/lib/reading-analytics';
import {
  TrendingUp,
  Zap,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock
} from 'lucide-react';

interface ReadingProgressTrendCardProps {
  bookId?: string;
  onOpenSession?: () => void;
}

export default function ReadingProgressTrendCard({
  bookId,
  onOpenSession
}: ReadingProgressTrendCardProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReadingAnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchAnalytics = () => {
    setLoading(true);
    const query = bookId ? `?book_id=${encodeURIComponent(bookId)}` : '';
    fetch(`/api/library/analytics${query}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setSummary(json.data);
        } else {
          setError(json.error ?? 'Okuma analitiği alınamadı.');
        }
      })
      .catch(err => setError(err.message ?? 'Bağlantı hatası.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();

    const handleRefresh = () => fetchAnalytics();
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, [bookId]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📖</div>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>Okuma Hızı & Seans Analitiği Yükleniyor...</div>
      </div>
    );
  }

  if (error || !summary || summary.totalSessions === 0) {
    return (
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} color="#3B82F6" />
          <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Kitap Okuma Hızı (WPM) & Seans Zaman Serisi
          </h2>
        </div>
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
            fontSize: '12px'
          }}
        >
          {error ? `⚠️ ${error}` : 'Henüz kayıtlı okuma seansı bulunmuyor. Yeni bir seans tamamladığınızda WPM gelişim grafiğiniz burada oluşacaktır. 📚'}
        </div>
      </div>
    );
  }

  // Seanslar: Filtreye göre süzülmüş
  const displayedSessions = selectedCategory
    ? summary.sessions.filter(s => s.category === selectedCategory)
    : summary.sessions;

  // Çizgi Grafiği Noktaları (Kronolojik: Eskiden yeniye son 15 seans)
  const chartSessions = [...summary.sessions]
    .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
    .slice(-15);

  const wpmValues = chartSessions.map(s => s.wpm);
  const minWpm = Math.max(60, Math.min(...wpmValues, 180) - 20);
  const maxWpm = Math.max(...wpmValues, 300) + 20;

  // SVG Boyutları
  const svgWidth = 540;
  const svgHeight = 150;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 26;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const getY = (wpm: number) => {
    const clamped = Math.max(minWpm, Math.min(maxWpm, wpm));
    return padTop + plotHeight - ((clamped - minWpm) / (maxWpm - minWpm)) * plotHeight;
  };

  const getX = (index: number, total: number) => {
    if (total <= 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (total - 1)) * plotWidth;
  };

  // Çizgi ve Alan Path Koordinatları
  const points = chartSessions.map((s, i) => ({
    x: getX(i, chartSessions.length),
    y: getY(s.wpm),
    session: s
  }));

  const linePathD = points.length > 0
    ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')
    : '';

  const areaPathD = points.length > 0
    ? `${linePathD} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`
    : '';

  const isAccelerating = summary.accelerationPercent >= 0;

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
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <TrendingUp size={18} color="#3B82F6" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Okuma Hızı (WPM) & Seans Zaman Serisi
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Seans Seans Hızlanma Eğrisi ve Kategori Bazında Okuma Temposu
            </div>
          </div>
        </div>

        {onOpenSession && (
          <button
            type="button"
            onClick={onOpenSession}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '5px 10px',
              borderRadius: '999px',
              backgroundColor: 'var(--surface-subtle)',
              color: 'var(--text-main)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>➕</span>
            <span>Seans Ekle</span>
          </button>
        )}
      </div>

      {/* 2. 3'lü Bento KPI Rozetleri */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px'
        }}
      >
        {/* Gelişim Oranı */}
        <div
          style={{
            background: isAccelerating
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
            border: `1px solid ${isAccelerating ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: isAccelerating ? '#10B981' : '#F59E0B', fontSize: '11px', fontWeight: 800 }}>
            {isAccelerating ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
            <span>GELİŞİM ORANI</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: isAccelerating ? '#10B981' : '#F59E0B' }}>
            {isAccelerating ? `+${summary.accelerationPercent}%` : `${summary.accelerationPercent}%`}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {isAccelerating ? '🚀 Okuma hızınız arttı' : 'Okuma temposu stabil'}
          </div>
        </div>

        {/* Güncel WPM (Son 7 Seans) */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.04))',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#3B82F6', fontSize: '11px', fontWeight: 800 }}>
            <Zap size={14} /> GÜNCEL TEMPO (SON 7)
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#3B82F6' }}>
            {summary.recentWpm} <span style={{ fontSize: '12px', fontWeight: 700 }}>WPM</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Tüm zamanlar: {summary.allTimeWpm} WPM
          </div>
        </div>

        {/* Toplam Hacim */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#8B5CF6', fontSize: '11px', fontWeight: 800 }}>
            <BookOpen size={14} /> TOPLAM HACİM
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#8B5CF6' }}>
            {summary.totalPagesRead} <span style={{ fontSize: '12px', fontWeight: 700 }}>Sayfa</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {summary.totalMinutesRead} dk • {summary.totalSessions} Seans
          </div>
        </div>
      </div>

      {/* 3. Native Saf SVG Çizgi Grafiği */}
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
            <TrendingUp size={14} color="#3B82F6" />
            <span>Seans Bazında WPM Eğrisi</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Son {chartSessions.length} Seansın Hız Seyri
          </div>
        </div>

        {/* SVG Grafiği */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          >
            <defs>
              <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Yatay Kılavuz Çizgileri */}
            {[minWpm, Math.round((minWpm + maxWpm) / 2), maxWpm].map((val, idx) => {
              const y = getY(val);
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                    opacity={0.5}
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="var(--text-muted)"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Alan Dolgusu */}
            {areaPathD && (
              <path d={areaPathD} fill="url(#wpmGradient)" />
            )}

            {/* Çizgi Eğrisi */}
            {linePathD && (
              <path
                d={linePathD}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Veri Noktaları (Nokta + Tooltip) */}
            {points.map((p, idx) => (
              <g key={p.session.sessionId}>
                <title>{`${p.session.bookTitle}\n${p.session.sessionDate}\n${p.session.wpm} WPM (${p.session.pagesRead} sayfa / ${p.session.durationMinutes} dk)`}</title>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill="#3B82F6"
                  stroke="var(--bg-main)"
                  strokeWidth="2"
                />
                {/* WPM Değeri Etiketi */}
                <text
                  x={p.x}
                  y={p.y - 7}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="var(--text-main)"
                >
                  {p.session.wpm}
                </text>
                {/* Tarih Etiketi */}
                <text
                  x={p.x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--text-muted)"
                >
                  {p.session.sessionDate.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* 4. Kategori Hız Rozetleri */}
      {summary.categories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="#8B5CF6" />
            <span>Kategori Bazında Okuma Hızı</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: selectedCategory === null ? 'var(--text-main)' : 'var(--surface-subtle)',
                color: selectedCategory === null ? 'var(--bg-main)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Tüm Kategoriler ({summary.totalSessions})
            </button>
            {summary.categories.map(c => {
              const isSelected = selectedCategory === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : c.category)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? '#3B82F6' : 'var(--border)'}`,
                    background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'var(--surface-subtle)',
                    color: isSelected ? '#3B82F6' : 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{c.category}:</span>
                  <span style={{ color: '#3B82F6', fontWeight: 800 }}>{c.avgWpm} WPM</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>({c.totalPages}s)</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Son Seanslar Listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={14} color="var(--text-muted)" />
          <span>Son Okuma Seansları ({displayedSessions.length})</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
          {displayedSessions.slice(0, 10).map((s: EnrichedReadingSession) => (
            <div
              key={s.sessionId}
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.bookTitle}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{s.sessionDate}</span>
                  <span>•</span>
                  <span>{s.category}</span>
                  <span>•</span>
                  <span>{s.pagesRead} sayfa / {s.durationMinutes} dk</span>
                </div>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 900,
                  color: '#3B82F6',
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  flexShrink: 0
                }}
              >
                {s.wpm} WPM
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
