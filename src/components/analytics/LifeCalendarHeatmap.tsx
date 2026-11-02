'use client';

import React, { useState, useEffect } from 'react';
import {
  HeatmapSummary,
  DayHeatmapCell
} from '@/lib/calendar-heatmap';
import {
  Sparkles,
  Clock,
  BookOpen,
  ShieldCheck,
  Calendar,
  X,
  Award,
  Flame,
  Droplet
} from 'lucide-react';

type HeatmapMode = 'holistic' | 'fasting' | 'reading' | 'nospend';

export default function LifeCalendarHeatmap() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<HeatmapSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<HeatmapMode>('holistic');
  const [rangeDays, setRangeDays] = useState<number>(365);
  const [selectedCell, setSelectedCell] = useState<DayHeatmapCell | null>(null);

  const fetchHeatmap = () => {
    setLoading(true);
    fetch(`/api/analytics/calendar?days=${rangeDays}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setSummary(json.data);
          // Varsayılan olarak bugünü veya son hücreyi seç
          if (json.data.days && json.data.days.length > 0) {
            setSelectedCell(json.data.days[json.data.days.length - 1]);
          }
        } else {
          setError(json.error ?? 'Yaşam takvimi verisi alınamadı.');
        }
      })
      .catch(err => setError(err.message ?? 'Bağlantı hatası.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHeatmap();

    const handleRefresh = () => fetchHeatmap();
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, [rangeDays]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🌌</div>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>Bütünsel Yaşam Takvimi Yükleniyor...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="card" style={{ padding: '16px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
          🌌 Bütünsel Yaşam Takvimi (Heatmap Matrix)
        </div>
        <div style={{ fontSize: '12px' }}>{error ? `⚠️ ${error}` : 'Veri bulunamadı.'}</div>
      </div>
    );
  }

  // Hücre Rengi Belirleme
  const getCellColor = (cell: DayHeatmapCell): string => {
    switch (mode) {
      case 'holistic':
        if (cell.dominantLevel === 3) return '#10B981'; // Mükemmel
        if (cell.dominantLevel === 2) return 'rgba(16, 185, 129, 0.65)';
        if (cell.dominantLevel === 1) return 'rgba(16, 185, 129, 0.3)';
        return 'var(--surface-subtle)';

      case 'fasting':
        if (cell.fastingHours >= 24) return '#EC4899'; // Tam otofaji & kök hücre
        if (cell.fastingHours >= 16) return '#8B5CF6'; // Temel otofaji
        if (cell.fastingHours >= 12) return '#3B82F6'; // Standart / ketozis
        if (cell.fastingHours > 0) return 'rgba(59, 130, 246, 0.4)';
        return 'var(--surface-subtle)';

      case 'reading':
        if (cell.pagesRead >= 35) return '#3B82F6'; // Yoğun okuma
        if (cell.pagesRead >= 20) return 'rgba(59, 130, 246, 0.7)';
        if (cell.pagesRead >= 10) return 'rgba(59, 130, 246, 0.45)';
        if (cell.pagesRead > 0) return 'rgba(59, 130, 246, 0.25)';
        return 'var(--surface-subtle)';

      case 'nospend':
        if (cell.isNoSpend) return '#F59E0B'; // Altın No-Spend günü!
        if (cell.spentAmount <= 300) return 'rgba(16, 185, 129, 0.35)'; // Düşük bütçe
        return 'rgba(239, 68, 68, 0.35)'; // Harcama yapıldı
    }
  };

  // GitHub Tarzı 7 Satırlı Izgara Matrisine Dönüştürme
  // Günleri haftalara (sütunlara) böl: Her sütun 7 gün (0 = Pazar, 1 = Pzt, ..., 6 = Cmt)
  const daysList = summary.days;
  const weeks: DayHeatmapCell[][] = [];
  let currentWeek: DayHeatmapCell[] = [];

  // İlk günün haftanın hangi günü olduğuna göre ön boşluk bırak (Pzt = 1 baz alınır)
  const firstDay = daysList[0];
  const firstDayOffset = (firstDay.dayOfWeek + 6) % 7; // Pzt: 0, Sal: 1, ..., Paz: 6

  for (let b = 0; b < firstDayOffset; b++) {
    currentWeek.push(null as any);
  }

  for (const cell of daysList) {
    currentWeek.push(cell);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null as any);
    }
    weeks.push(currentWeek);
  }

  // SVG Boyutları
  const cellSide = 11;
  const cellGap = 3;
  const leftPad = 26;
  const topPad = 18;
  const numWeeks = weeks.length;
  const svgTotalWidth = leftPad + numWeeks * (cellSide + cellGap) + 10;
  const svgTotalHeight = topPad + 7 * (cellSide + cellGap) + 8;

  const dayRowNames = ['Pzt', '', 'Çar', '', 'Cum', '', 'Paz'];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Başlık ve Görünüm Seçici Sekmeler */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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
              <Sparkles size={18} color="#10B981" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Bütünsel Yaşam Takvimi (Holistic Heatmap Matrix)
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Sağlık, Zihin ve Finans Disiplinlerinin 365 Günlük Katkı Matrisi
              </div>
            </div>
          </div>

          {/* Tarih Aralığı Seçici */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { days: 90, label: '3 Ay' },
              { days: 180, label: '6 Ay' },
              { days: 365, label: '1 Yıl' }
            ].map(r => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRangeDays(r.days)}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: rangeDays === r.days ? 'var(--text-main)' : 'var(--surface-subtle)',
                  color: rangeDays === r.days ? 'var(--bg-main)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Ana Görünüm Sekmesi */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setMode('holistic')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '999px',
              border: `1px solid ${mode === 'holistic' ? '#10B981' : 'var(--border)'}`,
              background: mode === 'holistic' ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-subtle)',
              color: mode === 'holistic' ? '#10B981' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🌌</span>
            <span>Bütünsel Denge</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('fasting')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '999px',
              border: `1px solid ${mode === 'fasting' ? '#8B5CF6' : 'var(--border)'}`,
              background: mode === 'fasting' ? 'rgba(139, 92, 246, 0.15)' : 'var(--surface-subtle)',
              color: mode === 'fasting' ? '#8B5CF6' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>⏳</span>
            <span>Oruç & Ötofaji</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('reading')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '999px',
              border: `1px solid ${mode === 'reading' ? '#3B82F6' : 'var(--border)'}`,
              background: mode === 'reading' ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface-subtle)',
              color: mode === 'reading' ? '#3B82F6' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>📚</span>
            <span>Kitap Okuma</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('nospend')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '999px',
              border: `1px solid ${mode === 'nospend' ? '#F59E0B' : 'var(--border)'}`,
              background: mode === 'nospend' ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-subtle)',
              color: mode === 'nospend' ? '#F59E0B' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>💰</span>
            <span>Harcamasız Günler</span>
          </button>
        </div>
      </div>

      {/* 2. Mini KPI Bento Şeridi */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px'
        }}
      >
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>MÜKEMMEL GÜNLER</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
            {summary.perfectDaysCount} <span style={{ fontSize: '11px', fontWeight: 700 }}>gün 🏆</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>ÖTOFAJİ DERİNLİĞİ</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#8B5CF6', marginTop: '2px' }}>
            {summary.totalAutophagyHours} <span style={{ fontSize: '11px', fontWeight: 700 }}>sa 🧬</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>OKUMA HACMİ</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#3B82F6', marginTop: '2px' }}>
            {summary.totalPagesRead} <span style={{ fontSize: '11px', fontWeight: 700 }}>sayfa 📖</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>NO-SPEND GÜNLERİ</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
            {summary.totalNoSpendDays} <span style={{ fontSize: '11px', fontWeight: 700 }}>gün 🛡️</span>
          </div>
        </div>
      </div>

      {/* 3. GitHub Tarzı Saf SVG Isı Haritası */}
      <div
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          overflowX: 'auto'
        }}
      >
        <svg
          viewBox={`0 0 ${svgTotalWidth} ${svgTotalHeight}`}
          style={{ width: '100%', minWidth: `${Math.min(svgTotalWidth, 750)}px`, height: 'auto', display: 'block' }}
        >
          {/* Sol Gün Etiketleri (Pzt, Çar, Cum, Paz) */}
          {dayRowNames.map((name, rIdx) => {
            if (!name) return null;
            const y = topPad + rIdx * (cellSide + cellGap) + cellSide - 2;
            return (
              <text
                key={rIdx}
                x={leftPad - 6}
                y={y}
                textAnchor="end"
                fontSize="8"
                fill="var(--text-muted)"
                fontWeight="bold"
              >
                {name}
              </text>
            );
          })}

          {/* Hafta Sütunları ve Gün Hücreleri */}
          {weeks.map((week, wIdx) => {
            const x = leftPad + wIdx * (cellSide + cellGap);
            return (
              <g key={wIdx}>
                {week.map((cell, dIdx) => {
                  if (!cell) return null;
                  const y = topPad + dIdx * (cellSide + cellGap);
                  const isSelected = selectedCell?.date === cell.date;
                  const color = getCellColor(cell);

                  return (
                    <rect
                      key={cell.date}
                      x={x}
                      y={y}
                      width={cellSide}
                      height={cellSide}
                      rx={2.5}
                      fill={color}
                      stroke={isSelected ? 'var(--text-main)' : 'rgba(255, 255, 255, 0.05)'}
                      strokeWidth={isSelected ? 1.5 : 0.5}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onClick={() => setSelectedCell(cell)}
                    >
                      <title>{`${cell.dayLabel} (${cell.date})\n• Oruç: ${cell.fastingHours}s (Ötofaji: ${cell.autophagyHours}s)\n• Okuma: ${cell.pagesRead} sayfa (${cell.avgWpm} WPM)\n• Harcama: ₺${cell.spentAmount} (${cell.isNoSpend ? 'No-Spend' : 'Harcamalı'})\n• Alışkanlık: ${cell.habitsMetCount}/4`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Lejant (Az -> Çok) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>Az</span>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: mode === 'fasting' ? 'rgba(139, 92, 246, 0.3)' : mode === 'reading' ? 'rgba(59, 130, 246, 0.35)' : mode === 'nospend' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: mode === 'fasting' ? '#8B5CF6' : mode === 'reading' ? 'rgba(59, 130, 246, 0.7)' : mode === 'nospend' ? '#F59E0B' : 'rgba(16, 185, 129, 0.65)' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: mode === 'fasting' ? '#EC4899' : mode === 'reading' ? '#3B82F6' : mode === 'nospend' ? '#F59E0B' : '#10B981' }} />
          <span>Çok</span>
        </div>
      </div>

      {/* 4. Etkileşimli Gün Popover / Detay Kartı */}
      {selectedCell && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
              <Calendar size={15} color="#10B981" />
              <span>{selectedCell.dayLabel} ({selectedCell.date}) Günlük Analitiği</span>
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                background: selectedCell.dominantLevel === 3 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: selectedCell.dominantLevel === 3 ? '#10B981' : 'var(--text-muted)',
                border: `1px solid ${selectedCell.dominantLevel === 3 ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`
              }}
            >
              {selectedCell.habitsMetCount} / 4 Alışkanlık Sağlandı {selectedCell.dominantLevel === 3 ? '🏆' : ''}
            </span>
          </div>

          {/* 4 Boyutlu Günlük Döküm */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px'
            }}
          >
            {/* Oruç */}
            <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#8B5CF6', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> ORUÇ & ÖTOFAJİ
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {selectedCell.fastingHours > 0 ? `${selectedCell.fastingHours} sa oruç` : 'Oruç tutulmadı'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {selectedCell.autophagyHours > 0 ? `🧬 +${selectedCell.autophagyHours}s ötofaji` : 'Temel sindirim evresi'}
              </div>
            </div>

            {/* Okuma */}
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#3B82F6', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <BookOpen size={12} /> KİTAP OKUMA
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {selectedCell.pagesRead > 0 ? `${selectedCell.pagesRead} sayfa okundu` : 'Okuma yapılmadı'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {selectedCell.avgWpm > 0 ? `⚡ ${selectedCell.avgWpm} WPM tempo` : 'Hedef: Günlük 15 sayfa'}
              </div>
            </div>

            {/* Harcama */}
            <div style={{ background: selectedCell.isNoSpend ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${selectedCell.isNoSpend ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: selectedCell.isNoSpend ? '#F59E0B' : '#EF4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={12} /> BÜTÇE & HARCAMA
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {selectedCell.isNoSpend ? '0 TL harcama (🛡️ No-Spend)' : `₺${selectedCell.spentAmount} harcandı`}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {selectedCell.isNoSpend ? 'Gereksiz harcama yapılmadı' : 'Günlük harcama kaydı'}
              </div>
            </div>

            {/* Su & Sağlık */}
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Droplet size={12} /> HİDRASYON
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {selectedCell.waterMl > 0 ? `${selectedCell.waterMl} ml su` : 'Su girilmedi'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {selectedCell.waterMl >= 2000 ? '✓ Optimum hidrasyon' : 'Hedef: 2.000 ml'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
