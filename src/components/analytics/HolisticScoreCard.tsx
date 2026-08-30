'use client';

interface Props {
  scoreData: {
    total: number;
    badge: string;
    breakdown: {
      finance: { score: number; max: number; label: string };
      health: { score: number; max: number; label: string };
      wellness: { score: number; max: number; label: string };
      mind: { score: number; max: number; label: string };
    };
    recommendation: string;
  };
}

export default function HolisticScoreCard({ scoreData }: Props) {
  const { total, badge, breakdown, recommendation } = scoreData;

  const scoreColor = total >= 90 ? '#10B981' : total >= 75 ? '#3B82F6' : total >= 50 ? '#F59E0B' : total > 0 ? '#EF4444' : 'var(--text-muted)';

  const pillars = [
    { key: 'finance', icon: '💰', color: '#10B981', ...breakdown.finance },
    { key: 'health', icon: '🧬', color: '#3B82F6', ...breakdown.health },
    { key: 'wellness', icon: '💊', color: '#8B5CF6', ...breakdown.wellness },
    { key: 'mind', icon: '📚', color: '#EC4899', ...breakdown.mind },
  ];

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🌌</span>
          <span>Bütünsel Yaşam Skoru (Holistic Life Score)</span>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: 'var(--radius-full)',
          background: total === 0 ? 'var(--surface-subtle)' : 'var(--emerald-bg)',
          color: total === 0 ? 'var(--text-muted)' : 'var(--emerald)',
          border: total === 0 ? '1px solid var(--border)' : 'none'
        }}>
          {badge}
        </span>
      </div>

      {/* Büyük Skor Göstergesi */}
      <div style={{
        background: 'var(--surface-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '24px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px', position: 'relative', overflow: 'hidden'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            GÜNLÜK ENTEGRE YAŞAM PERFORMANSI
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '48px', fontWeight: 900, color: total === 0 ? 'var(--text-muted)' : scoreColor, lineHeight: 1 }}>
              {total}
            </span>
            <span style={{ fontSize: '18px', color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '8px', fontWeight: 600 }}>
            4 Ana Yaşam Sütununda Tam Senkronizasyon
          </div>
        </div>

        {/* Dairesel Rozet */}
        <div style={{
          width: '84px', height: '84px', borderRadius: '50%',
          border: `4px solid ${total === 0 ? 'var(--border)' : scoreColor}`, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'var(--surface)',
          boxShadow: total === 0 ? 'var(--shadow-sm)' : `0 0 24px ${scoreColor}30`
        }}>
          <span style={{ fontSize: '28px' }}>
            {total >= 90 ? '🏆' : total >= 75 ? '⭐' : '🌿'}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: total === 0 ? 'var(--text-muted)' : scoreColor }}>
            %{total}
          </span>
        </div>
      </div>

      {/* 4 Ana Yaşam Sütunu (Progress Barları) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        {pillars.map(p => (
          <div key={p.key} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: p.color }}>
                {p.score} / {p.max}
              </span>
            </div>
            <div className="budget-bar-track" style={{ height: '5px' }}>
              <div className="budget-bar-fill" style={{ width: `${(p.score / p.max) * 100}%`, backgroundColor: p.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* AI Günlük Tavsiye */}
      <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>💡</span>
        <div style={{ fontSize: '12px', color: 'var(--blue)', lineHeight: '1.4', fontWeight: 500 }}>
          {recommendation}
        </div>
      </div>
    </div>
  );
}
