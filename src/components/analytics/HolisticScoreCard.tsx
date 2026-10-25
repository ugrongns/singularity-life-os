'use client';
import Link from 'next/link';

interface TopAction {
  title: string;
  desc: string;
  impact: string;
  scoreGain: number;
  pillar: string;
  link?: string;
  isCompleted?: boolean;
}

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
    topActions?: TopAction[];
    recommendation?: string;
  };
}

export default function HolisticScoreCard({ scoreData }: Props) {
  const { total, badge, breakdown, topActions, recommendation } = scoreData;

  // Skor Renk Paleti & Gradyan Tanımları
  const getScoreTheme = (val: number) => {
    if (val >= 90) return { primary: '#10B981', secondary: '#059669', bg: 'rgba(16, 185, 129, 0.12)', label: 'Elit Performans' };
    if (val >= 75) return { primary: '#3B82F6', secondary: '#6366F1', bg: 'rgba(59, 130, 246, 0.12)', label: 'Harika Denge' };
    if (val >= 50) return { primary: '#F59E0B', secondary: '#D97706', bg: 'rgba(245, 158, 11, 0.12)', label: 'Sağlıklı İlerleme' };
    if (val > 0) return { primary: '#EF4444', secondary: '#B91C1C', bg: 'rgba(239, 68, 68, 0.12)', label: 'Gelişim Alanı' };
    return { primary: 'var(--text-muted)', secondary: 'var(--border)', bg: 'var(--surface-subtle)', label: 'Veri Bekleniyor' };
  };

  const theme = getScoreTheme(total);

  // SVG Radial Gauge Geometrisi (r = 72, C ≈ 452.39)
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, total))) / 100;

  // 4 Ana Yaşam Sütunu
  const pillars = [
    { key: 'finance', icon: '💰', color: '#10B981', sublabel: 'Bütçe & Pozitif Varlık', link: '/budget', ...breakdown.finance },
    { key: 'health', icon: '🧬', color: '#3B82F6', sublabel: 'Su, Öğün & Tartı', link: '/health', ...breakdown.health },
    { key: 'wellness', icon: '💊', color: '#8B5CF6', sublabel: 'Uyku, Ruh Hali & Takviye', link: '/wellness', ...breakdown.wellness },
    { key: 'mind', icon: '📚', color: '#EC4899', sublabel: 'Kitap & Seanslar', link: '/library', ...breakdown.mind },
  ];

  // En Güçlü ve En Zayıf Sütun Tespiti
  const sortedPillars = [...pillars].sort((a, b) => (b.score / b.max) - (a.score / a.max));
  const bestPillar = sortedPillars[0];
  const weakestPillar = sortedPillars[sortedPillars.length - 1];

  // En Yüksek Etkili 3 Aksiyon Listesi (API'den gelmezse dinamik fallback)
  const defaultActions: TopAction[] = [
    {
      pillar: 'finance',
      title: 'Bütçe & Harcama Disiplini',
      desc: 'Bu ayki harcamalarınızı kategori limitleri içinde tutun.',
      impact: '+8 Puan',
      scoreGain: 8,
      link: '/budget'
    },
    {
      pillar: 'health',
      title: '2.5L Su & Öğün Kaydı',
      desc: 'Günlük su tüketiminizi tamamlayın ve bugün en az 1 öğün kaydedin.',
      impact: '+6 Puan',
      scoreGain: 6,
      link: '/health'
    },
    {
      pillar: 'wellness',
      title: 'Uyku & Takviye Rutini',
      desc: 'Günlük takviyelerinizi aldım olarak işaretleyin ve uyku sürenizi kaydedin.',
      impact: '+5 Puan',
      scoreGain: 5,
      link: '/wellness'
    }
  ];

  const actionsToShow = topActions && topActions.length > 0 ? topActions : defaultActions;

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Kart Başlığı & Rozet */}
      <div className="card-title-row" style={{ marginBottom: 0 }}>
        <div className="card-title">
          <span style={{ fontSize: '20px' }}>🌌</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px' }}>Bütünsel Yaşam Skoru</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Holistic Life Score • 4 Temel Yaşam Ekseni</div>
          </div>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: 'var(--radius-full)',
          background: theme.bg, color: theme.primary, border: `1px solid ${theme.primary}40`,
          display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          <span>{total >= 90 ? '🏆' : total >= 75 ? '⭐' : total >= 50 ? '🌿' : '🌱'}</span>
          <span>{badge}</span>
        </span>
      </div>

      {/* 1. KADRAN: SVG Radial Gauge & Executive Özet Kutusu */}
      <div className="analytics-radial-box">
        {/* SVG Radial Gauge */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg className="analytics-radial-svg" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="holisticGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.primary} />
                <stop offset="100%" stopColor={theme.secondary} />
              </linearGradient>
              <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Arka Plan İzi */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth="14"
              strokeLinecap="round"
              opacity="0.4"
            />

            {/* İlerleme Yayı */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="url(#holisticGaugeGrad)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 100 100)"
              style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
              filter={total > 0 ? 'url(#gaugeGlow)' : undefined}
            />
          </svg>

          {/* Kadran Merkez Metinleri */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', pointerEvents: 'none'
          }}>
            <div style={{
              fontSize: '44px', fontWeight: 900, lineHeight: 1,
              color: theme.primary, fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-1px'
            }}>
              {total}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px' }}>
              / 100 SKOR
            </div>
            <div style={{
              fontSize: '10px', fontWeight: 800, marginTop: '4px',
              padding: '2px 8px', borderRadius: '4px',
              background: 'var(--surface)', color: 'var(--text-main)',
              border: '1px solid var(--border)'
            }}>
              %{total} Uyum
            </div>
          </div>
        </div>

        {/* Yan Executive Özet Metrikleri */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px', flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            BÜTÜNSEL YAŞAM SENTEZİ
          </div>

          <div style={{
            background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>{bestPillar.icon}</span>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>En Güçlü Sütun</div>
                <div style={{ fontSize: '12px', fontWeight: 800 }}>{bestPillar.label}</div>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 900, color: bestPillar.color, fontVariantNumeric: 'tabular-nums' }}>
              %{Math.round((bestPillar.score / bestPillar.max) * 100)}
            </span>
          </div>

          <div style={{
            background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>{weakestPillar.icon}</span>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Öncelikli Gelişim</div>
                <div style={{ fontSize: '12px', fontWeight: 800 }}>{weakestPillar.label}</div>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 900, color: weakestPillar.color, fontVariantNumeric: 'tabular-nums' }}>
              %{Math.round((weakestPillar.score / weakestPillar.max) * 100)}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '2px' }}>
            ⚡ 4 eksendeki günlük veri girişleri skoru anlık optimize eder.
          </div>
        </div>
      </div>

      {/* 2. DÖRT EKSENLİ DENGE MATRİSİ (4 SÜTUN) */}
      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '10px', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)'
        }}>
          <span>4 EKSENLİ YAŞAM MATRİSİ</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Maksimum 25 Puan / Eksen</span>
        </div>

        <div className="analytics-pillars-grid">
          {pillars.map(p => {
            const pct = Math.round((p.score / p.max) * 100);
            const statusLabel = pct >= 100 ? 'Mükemmel' : pct >= 75 ? 'Güçlü' : pct >= 50 ? 'Dengeli' : pct > 0 ? 'Gelişmeli' : 'Kayıt Yok';
            return (
              <div
                key={p.key}
                style={{
                  background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex',
                  flexDirection: 'column', gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>{p.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.sublabel}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: p.color, fontVariantNumeric: 'tabular-nums' }}>
                      {p.score} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>/ 25</span>
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px',
                      background: 'var(--surface)', color: p.color, border: `1px solid ${p.color}40`
                    }}>
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {/* İlerleme Çubuğu */}
                <div className="budget-bar-track" style={{ height: '6px', background: 'var(--surface)' }}>
                  <div
                    className="budget-bar-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: p.color,
                      boxShadow: pct > 0 ? `0 0 8px ${p.color}60` : 'none',
                      transition: 'width 0.8s ease'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. EN YÜKSEK ETKİLİ 3 AKSİYON BENTO KUTUSU */}
      <div style={{
        background: 'var(--surface-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800 }}>
            <span>⚡</span>
            <span>Skoru Yükseltecek En Yüksek Etkili 3 Aksiyon</span>
          </div>
          <span style={{ fontSize: '10px', background: 'var(--amber-bg)', color: 'var(--amber)', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
            Hızlı Puan Kazanımı
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {actionsToShow.map((action, idx) => (
            <div key={idx} className="analytics-action-item">
              <span style={{
                fontSize: '11px', fontWeight: 900, background: 'var(--surface-subtle)',
                color: 'var(--primary)', width: '22px', height: '22px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: '1px solid var(--border)'
              }}>
                {idx + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-main)' }}>
                    {action.title}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, color: 'var(--emerald)',
                    background: 'var(--emerald-bg)', padding: '1px 6px', borderRadius: '4px'
                  }}>
                    {action.impact}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.35' }}>
                  {action.desc}
                </div>
              </div>

              {action.link && (
                <Link
                  href={action.link}
                  style={{
                    fontSize: '11px', fontWeight: 700, color: 'var(--primary)',
                    textDecoration: 'none', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                    whiteSpace: 'nowrap', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '2px'
                  }}
                >
                  Git ↗
                </Link>
              )}
            </div>
          ))}
        </div>

        {recommendation && (
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface)',
            padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span>💡</span>
            <span>{recommendation}</span>
          </div>
        )}
      </div>
    </div>
  );
}
