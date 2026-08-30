'use client';
import { useState, useEffect, ReactNode } from 'react';

type TimeContextMode = 'auto' | 'morning' | 'day' | 'evening';

interface TimeContextualFeedProps {
  morningWidgets: ReactNode;
  dayWidgets: ReactNode;
  eveningWidgets: ReactNode;
  /** Her dönem için ayrı secondary — primary ile çakışmayı önler */
  morningSecondary: ReactNode;
  daySecondary: ReactNode;
  eveningSecondary: ReactNode;
}

export default function TimeContextualFeed({
  morningWidgets,
  dayWidgets,
  eveningWidgets,
  morningSecondary,
  daySecondary,
  eveningSecondary,
}: TimeContextualFeedProps) {
  const [mode, setMode] = useState<TimeContextMode>('auto');
  const [currentPeriod, setCurrentPeriod] = useState<'morning' | 'day' | 'evening'>('day');

  useEffect(() => {
    const determinePeriod = () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 11) return 'morning';
      if (hour >= 11 && hour < 18) return 'day';
      return 'evening';
    };
    setCurrentPeriod(determinePeriod());
  }, []);

  const activePeriod = mode === 'auto' ? currentPeriod : mode;

  const greetings = {
    morning: { title: 'Günaydın 🌅', desc: 'Rutinlerini tamamla, güne zinde ve planlı başla.' },
    day:     { title: 'İyi Günler ☀️', desc: 'Harcamalarını kaydet, hedeflerine ve görevlerine odaklan.' },
    evening: { title: 'İyi Akşamlar 🌙', desc: 'Günün finans özetini incele, kitabını oku ve dinlen.' },
  };

  const secondaryByPeriod = {
    morning: morningSecondary,
    day: daySecondary,
    evening: eveningSecondary,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Time Context Banner & Filter Pills */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.4px' }}>
            {greetings[activePeriod].title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {greetings[activePeriod].desc}
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setMode('auto')}
            style={{
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'auto' ? '#3B82F6' : 'transparent',
              color: mode === 'auto' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            ⚡ Akıllı Otomatik
          </button>
          <button
            onClick={() => setMode('morning')}
            style={{
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'morning' ? '#F59E0B' : 'transparent',
              color: mode === 'morning' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            🌅 Sabah
          </button>
          <button
            onClick={() => setMode('day')}
            style={{
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'day' ? '#3B82F6' : 'transparent',
              color: mode === 'day' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            ☀️ Gün İçi
          </button>
          <button
            onClick={() => setMode('evening')}
            style={{
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: mode === 'evening' ? '#8B5CF6' : 'transparent',
              color: mode === 'evening' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            🌙 Akşam
          </button>
        </div>
      </div>

      {/* Öncelikli Zaman Bloğu (Dynamic Feed) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {activePeriod === 'morning' && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              🌅 Sabah Odak Noktaları
            </div>
            {morningWidgets}
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: '12px' }}>
              📊 Genel Yaşam Panosu
            </div>
            {secondaryByPeriod.morning}
          </>
        )}

        {activePeriod === 'day' && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              ☀️ Gün İçi Öncelikleri & Operasyon
            </div>
            {dayWidgets}
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: '12px' }}>
              📊 Genel Yaşam Panosu
            </div>
            {secondaryByPeriod.day}
          </>
        )}

        {activePeriod === 'evening' && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--indigo)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              🌙 Akşam Özeti & Kütüphane / Dinlenme
            </div>
            {eveningWidgets}
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: '12px' }}>
              📊 Genel Yaşam Panosu
            </div>
            {secondaryByPeriod.evening}
          </>
        )}
      </div>
    </div>
  );
}
