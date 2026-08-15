'use client';
import { useState } from 'react';

interface Supplement {
  id: string;
  name: string;
  dose: string;
  timing: string;
  frequency_type?: string;
  interval_days?: number;
  is_taken_today: number;
  streak_days: number;
  remaining_pills?: number | null;
  total_pills?: number | null;
  last_taken_date?: string | null;
  notes?: string | null;
}

interface SleepLog {
  bedtime: string;
  wake_time: string;
  duration_hours: number;
  quality_rating: number;
  notes?: string | null;
  date: string;
}

interface MoodLog {
  mood_emoji: string;
  mood_score: number;
  energy_level: number;
  stress_level?: number;
  note?: string | null;
  date: string;
}

interface WaterLog {
  amount_ml: number;
  goal_ml: number;
}

interface Props {
  supplements: { morning: Supplement[]; evening: Supplement[]; with_meal: Supplement[]; total: number; taken: number; all?: Supplement[] };
  todayMood: MoodLog | null;
  todaySleep: SleepLog | null;
  todayWater?: WaterLog;
  moodHistory: MoodLog[];
  sleepHistory: SleepLog[];
  waterHistory?: WaterLog[];
  aiInsight?: string;
  onOpenAddSupplement?: (item?: Supplement) => void;
  onRefresh?: () => void;
}

const MOODS = [
  { emoji: '😄', label: 'Harika', score: 5, color: '#059669' },
  { emoji: '😊', label: 'İyi',    score: 4, color: '#10B981' },
  { emoji: '😐', label: 'Normal', score: 3, color: '#D97706' },
  { emoji: '😔', label: 'Kötü',   score: 2, color: '#EF4444' },
  { emoji: '😤', label: 'Berbat', score: 1, color: '#991B1B' },
];

function getDaysPassed(lastTakenDate?: string | null) {
  if (!lastTakenDate) return 999;
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastTakenDate === todayStr) return 0;
  const today = new Date(todayStr);
  const last = new Date(lastTakenDate);
  const diffTime = today.getTime() - last.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 3600 * 24)));
}

export default function WellnessCard({
  supplements,
  todayMood,
  todaySleep,
  todayWater,
  moodHistory,
  sleepHistory,
  aiInsight,
  onOpenAddSupplement,
  onRefresh
}: Props) {
  const [tab, setTab] = useState<'supplements' | 'water' | 'sleep' | 'mood' | 'ai'>('supplements');
  const [taking, setTaking] = useState<string | null>(null);

  // Water State
  const [waterAmount, setWaterAmount] = useState(todayWater?.amount_ml || 0);
  const [savingWater, setSavingWater] = useState(false);

  // Sleep State
  const [sleepForm, setSleepForm] = useState({
    bedtime: todaySleep?.bedtime || '23:00',
    wake_time: todaySleep?.wake_time || '07:00',
    quality_rating: todaySleep?.quality_rating || 4,
    notes: todaySleep?.notes || ''
  });
  const [savingSleep, setSavingSleep] = useState(false);

  // Mood & Energy & Stres State
  const [selectedMood, setSelectedMood] = useState<number | null>(todayMood?.mood_score || 4);
  const [energyLevel, setEnergyLevel] = useState<number>(todayMood?.energy_level || 3);
  const [stressLevel, setStressLevel] = useState<number>(todayMood?.stress_level || 2);
  const [wellnessNote, setWellnessNote] = useState<string>(todayMood?.note || '');
  const [savingMood, setSavingMood] = useState(false);

  const allSupps = supplements.all || [...supplements.morning, ...supplements.with_meal, ...supplements.evening];

  const dailySupps = allSupps.filter(s => !s.frequency_type || s.frequency_type === 'daily');
  const intervalSupps = allSupps.filter(s => s.frequency_type === 'interval');
  const asNeededSupps = allSupps.filter(s => s.frequency_type === 'as_needed');

  const takenDaily = dailySupps.filter(s => s.is_taken_today === 1).length;
  const totalDaily = dailySupps.length;
  const suppProgress = totalDaily > 0 ? Math.round((takenDaily / totalDaily) * 100) : 100;

  const waterGoal = todayWater?.goal_ml || 2500;
  const waterProgress = Math.min(100, Math.round((waterAmount / waterGoal) * 100));

  const handleTake = async (id: string) => {
    setTaking(id);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_supplement', id })
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } finally {
      setTaking(null);
    }
  };

  const handleDeleteSupp = async (id: string) => {
    if (!confirm('Bu takviyeyi silmek istediğinize emin misiniz?')) return;
    await fetch('/api/wellness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_supplement', id })
    });
    if (onRefresh) onRefresh();
    else window.location.reload();
  };

  const handleUpdateWater = async (deltaMl: number) => {
    const newAmount = Math.max(0, waterAmount + deltaMl);
    setWaterAmount(newAmount);
    setSavingWater(true);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_water', amount_ml: newAmount, goal_ml: waterGoal })
      });
    } finally {
      setSavingWater(false);
    }
  };

  const handleSaveSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSleep(true);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_sleep', ...sleepForm })
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } finally {
      setSavingSleep(false);
    }
  };

  const handleSaveMood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMood === null) return;
    setSavingMood(true);
    try {
      const selected = MOODS.find(m => m.score === selectedMood);
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_mood',
          mood_emoji: selected?.emoji || '😊',
          mood_score: selectedMood,
          energy_level: energyLevel,
          stress_level: stressLevel,
          note: wellnessNote
        })
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } finally {
      setSavingMood(false);
    }
  };

  const renderSupplementGroup = (list: Supplement[], title: string, icon: string) => {
    if (list.length === 0) return null;

    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
          {icon} {title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {list.map(s => {
            const isLowStock = s.remaining_pills !== null && s.remaining_pills !== undefined && s.remaining_pills <= 7;
            return (
              <div
                key={s.id}
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: s.is_taken_today ? '#F0FDF4' : isLowStock ? '#FFFBEB' : 'var(--surface-subtle)',
                  border: `1px solid ${s.is_taken_today ? 'rgba(16,185,129,0.3)' : isLowStock ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: s.is_taken_today ? 'var(--emerald)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.is_taken_today ? <span style={{ color: 'white', fontSize: '12px', fontWeight: 800 }}>✓</span> : null}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: s.is_taken_today ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: s.is_taken_today ? 'line-through' : 'none' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                      <span>💊 {s.dose}</span>
                      {s.streak_days > 0 && <span style={{ color: 'var(--amber)', fontWeight: 700 }}>🔥 {s.streak_days} Gün Seri</span>}
                      {s.remaining_pills !== null && s.remaining_pills !== undefined && (
                        <span style={{ color: isLowStock ? '#D97706' : 'var(--text-muted)', fontWeight: isLowStock ? 800 : 500 }}>
                          • Kalan: {s.remaining_pills} kapsül {isLowStock ? '⚠️ (Stok Azaldı!)' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {!s.is_taken_today ? (
                    <button
                      className="btn-primary"
                      style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 800 }}
                      onClick={() => handleTake(s.id)}
                      disabled={taking === s.id}
                    >
                      {taking === s.id ? '...' : 'Al ✓'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800 }}>Alındı</span>
                  )}
                  {onOpenAddSupplement && (
                    <button
                      type="button"
                      onClick={() => onOpenAddSupplement(s)}
                      style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}
                      title="Düzenle"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteSupp(s.id)}
                    style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}
                    title="Sil"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>💊</span>
          <span>Wellness & Yaşam Merkezi</span>
        </div>
      </div>

      {tab === 'supplements' && onOpenAddSupplement && (
        <div className="card-action-bar">
          <button className="btn-primary" onClick={() => onOpenAddSupplement()}>
            + Yeni Takviye / İlaç Ekle
          </button>
        </div>
      )}

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button className={`choice-pill ${tab === 'supplements' ? 'selected' : ''}`} onClick={() => setTab('supplements')} style={{ flex: 1, padding: '7px 4px', fontSize: '11px', fontWeight: 800 }}>
          💊 Takviyeler & İlaçlar ({takenDaily}/{totalDaily})
        </button>
        <button className={`choice-pill ${tab === 'water' ? 'selected' : ''}`} onClick={() => setTab('water')} style={{ flex: 1, padding: '7px 4px', fontSize: '11px', fontWeight: 800 }}>
          💧 Su ({waterAmount} ml)
        </button>
        <button className={`choice-pill ${tab === 'sleep' ? 'selected' : ''}`} onClick={() => setTab('sleep')} style={{ flex: 1, padding: '7px 4px', fontSize: '11px', fontWeight: 800 }}>
          😴 Uyku ({todaySleep ? `${todaySleep.duration_hours} sa` : 'Ekle'})
        </button>
        <button className={`choice-pill ${tab === 'mood' ? 'selected' : ''}`} onClick={() => setTab('mood')} style={{ flex: 1, padding: '7px 4px', fontSize: '11px', fontWeight: 800 }}>
          🎭 Mod & Enerji
        </button>
        <button className={`choice-pill ${tab === 'ai' ? 'selected' : ''}`} onClick={() => setTab('ai')} style={{ flex: 1, padding: '7px 4px', fontSize: '11px', fontWeight: 800 }}>
          ✨ AI Analiz
        </button>
      </div>

      {/* 1. TAKVİYELER */}
      {tab === 'supplements' && (
        <div>
          {totalDaily > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>GÜNLÜK RUTİN TAMAMLAMA</span>
                <span>%{suppProgress}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill emerald" style={{ width: `${suppProgress}%` }} />
              </div>
            </div>
          )}

          {allSupps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Henüz takviye veya ilaç rutini eklenmedi. <strong>+ Yeni Takviye / İlaç</strong> butonuna basarak ekleyebilirsiniz.
            </div>
          ) : (
            <>
              {/* Günlük Rutinler */}
              {renderSupplementGroup(dailySupps.filter(s => s.timing === 'morning'), 'SABAH TAKVİYELERİ (HER GÜN)', '🌅')}
              {renderSupplementGroup(dailySupps.filter(s => s.timing === 'with_meal'), 'YEMEKLERLE BİRLİKTE (HER GÜN)', '🥗')}
              {renderSupplementGroup(dailySupps.filter(s => s.timing === 'evening'), 'AKŞAM / GECE TAKVİYELERİ (HER GÜN)', '🌙')}

              {/* PERİYODİK (KAÇ GÜNDE BİR) TAKVİYE & İLAÇLAR */}
              {intervalSupps.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#3730A3', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    ⏳ PERİYODİK (BELİRLİ ARALIKLA ALINANLAR)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {intervalSupps.map(s => {
                      const daysPassed = getDaysPassed(s.last_taken_date);
                      const interval = s.interval_days || 2;
                      const isDue = s.is_taken_today ? false : daysPassed >= interval;
                      const daysLeft = Math.max(0, interval - daysPassed);

                      return (
                        <div
                          key={s.id}
                          style={{
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: s.is_taken_today ? '#F0FDF4' : isDue ? '#FEF2F2' : '#EEF2FF',
                            border: `1px solid ${s.is_taken_today ? '#A7F3D0' : isDue ? '#FECACA' : '#C7D2FE'}`,
                            borderRadius: 'var(--radius-md)'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                              ⏳ {s.name} <span style={{ fontSize: '11px', fontWeight: 600, color: '#4338CA' }}>({interval} Günde Bir)</span>
                            </div>
                            <div style={{ fontSize: '11px', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span>💊 {s.dose}</span>
                              <span>•</span>
                              <span style={{ fontWeight: 700, color: s.is_taken_today ? '#059669' : isDue ? '#DC2626' : '#4338CA' }}>
                                {s.is_taken_today
                                  ? '✓ Bugün Alındı'
                                  : isDue
                                  ? `🚨 Bugün Alınma Zamanı! (${daysPassed} gün oldu)`
                                  : `⏳ ${daysLeft} gün sonra alınacak (${s.last_taken_date || 'Yeni'})`}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {!s.is_taken_today ? (
                              <button
                                className="btn-primary"
                                style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 800, background: isDue ? '#DC2626' : '#4F46E5' }}
                                onClick={() => handleTake(s.id)}
                                disabled={taking === s.id}
                              >
                                {taking === s.id ? '...' : 'Şimdi Aldım ✓'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800 }}>✓ Alındı</span>
                            )}
                            {onOpenAddSupplement && (
                              <button type="button" onClick={() => onOpenAddSupplement(s)} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}>✏️</button>
                            )}
                            <button type="button" onClick={() => handleDeleteSupp(s.id)} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}>🗑️</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* İHTİYAÇ HALİNDE / DÜZENSİZ İLAÇLAR */}
              {asNeededSupps.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    🚑 İHTİYAÇ HALİNDE (DÜZENSİZ KULLANILAN İLAÇ & TAKVİYELER)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {asNeededSupps.map(s => {
                      const daysPassed = getDaysPassed(s.last_taken_date);
                      return (
                        <div
                          key={s.id}
                          style={{
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            borderRadius: 'var(--radius-md)'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                              🚑 {s.name} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>({s.dose})</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 700, marginTop: '2px' }}>
                              🕒 En Son Alındı: {s.last_taken_date ? `${daysPassed === 0 ? 'Bugün' : `${daysPassed} gün önce`} (${s.last_taken_date})` : 'Henüz Kayıt Yok'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="btn-subtle"
                              style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 800, background: 'white', border: '1px solid #F59E0B', color: '#B45309' }}
                              onClick={() => handleTake(s.id)}
                              disabled={taking === s.id}
                            >
                              {taking === s.id ? '...' : '💊 Şimdi Aldım'}
                            </button>
                            {onOpenAddSupplement && (
                              <button type="button" onClick={() => onOpenAddSupplement(s)} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}>✏️</button>
                            )}
                            <button type="button" onClick={() => handleDeleteSupp(s.id)} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', opacity: 0.6 }}>🗑️</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 2. SU TAKİBİ */}
      {tab === 'water' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#EFF6FF', border: '1px solid rgba(59,130,246,0.3)', padding: '16px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '32px' }}>💧</div>
            <div className="tabular-nums" style={{ fontSize: '28px', fontWeight: 900, color: '#1E40AF', marginTop: '4px' }}>
              {waterAmount} <span style={{ fontSize: '16px', fontWeight: 500, color: '#3B82F6' }}>/ {waterGoal} ml</span>
            </div>
            <div style={{ fontSize: '12px', color: '#2563EB', fontWeight: 700, marginTop: '2px' }}>
              %{waterProgress} Tamamlandı
            </div>

            <div className="progress-bar" style={{ height: '8px', marginTop: '12px' }}>
              <div className="progress-fill" style={{ width: `${waterProgress}%`, backgroundColor: '#3B82F6' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                disabled={savingWater}
                onClick={() => handleUpdateWater(250)}
                style={{ background: '#2563EB', fontSize: '13px', padding: '8px 14px' }}
              >
                +250 ml (Bardak)
              </button>
              <button
                className="btn-primary"
                disabled={savingWater}
                onClick={() => handleUpdateWater(500)}
                style={{ background: '#1D4ED8', fontSize: '13px', padding: '8px 14px' }}
              >
                +500 ml (Şişe)
              </button>
              <button
                className="btn-subtle"
                disabled={savingWater}
                onClick={() => handleUpdateWater(-250)}
                style={{ fontSize: '13px', padding: '8px 12px' }}
              >
                -250 ml
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. UYKU */}
      {tab === 'sleep' && (
        <form onSubmit={handleSaveSleep} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>YATMA SAATİ</label>
              <input
                type="time"
                value={sleepForm.bedtime}
                onChange={e => setSleepForm({ ...sleepForm, bedtime: e.target.value })}
                required
                style={{ width: '100%', padding: '9px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>UYANMA SAATİ</label>
              <input
                type="time"
                value={sleepForm.wake_time}
                onChange={e => setSleepForm({ ...sleepForm, wake_time: e.target.value })}
                required
                style={{ width: '100%', padding: '9px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>UYKU KALİTESİ (1 - 5)</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSleepForm({ ...sleepForm, quality_rating: star })}
                  style={{
                    flex: 1, padding: '8px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--border)',
                    background: sleepForm.quality_rating === star ? '#FEF3C7' : 'white',
                    color: sleepForm.quality_rating === star ? '#D97706' : 'var(--text-main)', cursor: 'pointer'
                  }}
                >
                  {'⭐'.repeat(star)}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={savingSleep} style={{ padding: '10px', fontSize: '13px', fontWeight: 800 }}>
            {savingSleep ? 'Kaydediliyor...' : '😴 Uyku Kaydını Güncelle'}
          </button>
        </form>
      )}

      {/* 4. MOD & ENERJİ */}
      {tab === 'mood' && (
        <form onSubmit={handleSaveMood} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BUGÜNKÜ RUH HALİNİZ</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '6px' }}>
              {MOODS.map(m => (
                <button
                  key={m.score}
                  type="button"
                  onClick={() => setSelectedMood(m.score)}
                  style={{
                    padding: '8px 4px', textAlign: 'center', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: selectedMood === m.score ? 'var(--surface-subtle)' : 'white',
                    outline: selectedMood === m.score ? `2px solid ${m.color}` : 'none', cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '20px' }}>{m.emoji}</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: m.color, marginTop: '2px' }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>⚡ ENERJİ SEVİYESİ ({energyLevel}/5)</label>
              <input
                type="range" min="1" max="5" value={energyLevel}
                onChange={e => setEnergyLevel(Number(e.target.value))}
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>🤯 STRES SEVİYESİ ({stressLevel}/5)</label>
              <input
                type="range" min="1" max="5" value={stressLevel}
                onChange={e => setStressLevel(Number(e.target.value))}
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={savingMood} style={{ padding: '10px', fontSize: '13px', fontWeight: 800 }}>
            {savingMood ? 'Kaydediliyor...' : '🎭 Mod ve Stres Seviyemi Kaydet'}
          </button>
        </form>
      )}

      {/* 5. AI ANALİZ */}
      {tab === 'ai' && (
        <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '14px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#3730A3', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✨ AI Wellness & Biyometrik Korelasyon Analizi</span>
          </div>
          <p style={{ fontSize: '12px', color: '#4338CA', margin: '8px 0 0', lineHeight: 1.5 }}>
            {aiInsight || 'Düzenli su, uyku ve takviye verileriniz toplandıkça AI modelimiz enerji seviyeniz ile uyku kaliteniz arasındaki bağı analiz edecektir.'}
          </p>
        </div>
      )}

    </div>
  );
}
