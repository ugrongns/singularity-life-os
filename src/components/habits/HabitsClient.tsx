'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Flame, Archive, Trash2, X, Award, Sparkles } from 'lucide-react';
import { getTodayTurkeyDate, shiftTurkeyDate, formatTurkishDisplayDate } from '@/lib/date-utils';
import type { HabitItem, HabitLogItem, HabitStats, HabitBadge } from '@/lib/habits-engine';
import PageLoadingState from '@/components/ui/PageLoadingState';

const HABIT_ICONS: Array<{ key: string; emoji: string }> = [
  { key: 'check', emoji: '✅' },
  { key: 'water', emoji: '💧' },
  { key: 'book', emoji: '📚' },
  { key: 'meditation', emoji: '🧘' },
  { key: 'fitness', emoji: '🏋️' },
  { key: 'walk', emoji: '🚶' },
  { key: 'code', emoji: '💻' },
  { key: 'sleep', emoji: '😴' },
  { key: 'heart', emoji: '❤️' },
  { key: 'bolt', emoji: '⚡' }
];

const HABIT_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

const TIME_SLOTS: Array<{ id: string; label: string; icon: string }> = [
  { id: 'morning', label: 'Sabah Rutinleri', icon: '🌅' },
  { id: 'afternoon', label: 'Öğle Rutinleri', icon: '☀️' },
  { id: 'evening', label: 'Akşam Rutinleri', icon: '🌙' },
  { id: 'all_day', label: 'Gün Boyu', icon: '🔄' }
];

export default function HabitsClient() {
  const [todayTr] = useState(() => getTodayTurkeyDate());
  const [selectedDate, setSelectedDate] = useState(() => getTodayTurkeyDate());
  const [loading, setLoading] = useState(true);
  const [habitsList, setHabitsList] = useState<HabitItem[]>([]);
  const [statsByHabit, setStatsByHabit] = useState<Record<string, HabitStats>>({});
  const [logsByHabit, setLogsByHabit] = useState<Record<string, HabitLogItem>>({});
  const [healthScore, setHealthScore] = useState(0);
  const [badges, setBadges] = useState<HabitBadge[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Detay Matris Modalı
  const [detailHabit, setDetailHabit] = useState<HabitItem | null>(null);

  // Yeni Alışkanlık Modalı
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Sağlık & Beden');
  const [color, setColor] = useState('#10B981');
  const [icon, setIcon] = useState('check');
  const [targetType, setTargetType] = useState<'boolean' | 'numeric' | 'timer'>('boolean');
  const [targetValue, setTargetValue] = useState('1');
  const [unitLabel, setUnitLabel] = useState('kez');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'flexible_weekly' | 'specific_days'>('daily');
  const [weeklyTargetCount, setWeeklyTargetCount] = useState('3');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'all_day'>('all_day');
  const [linkedModule, setLinkedModule] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch(`/api/habits?date=${encodeURIComponent(selectedDate)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setHabitsList(json.data.habits || []);
        setStatsByHabit(json.data.statsByHabit || {});
        setLogsByHabit(json.data.selectedDateLogs || {});
        setHealthScore(json.data.healthScore || 0);
        setBadges(json.data.badges || []);
      }
    } catch {
      showToast('Alışkanlıklar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void fetchHabits();
    const onRefresh = () => void fetchHabits();
    window.addEventListener('singularity-refresh', onRefresh);
    return () => window.removeEventListener('singularity-refresh', onRefresh);
  }, [fetchHabits]);

  const getEmoji = (key: string) => HABIT_ICONS.find(i => i.key === key)?.emoji || '✅';

  const handleToggle = async (habitId: string) => {
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_log', habit_id: habitId, date: selectedDate })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        await fetchHabits();
      }
    } catch {
      showToast('İşlem sırasında hata oluştu.');
    }
  };

  const handleIncrement = async (habitId: string, delta: number) => {
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment_log', habit_id: habitId, date: selectedDate, delta })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        await fetchHabits();
      }
    } catch {
      showToast('Sayaç güncellenemedi.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: title.trim(),
          category,
          color,
          icon,
          target_type: targetType,
          target_value: targetType === 'boolean' ? 1 : Number(targetValue) || 1,
          unit_label: unitLabel,
          frequency_type: frequencyType,
          weekly_target_count: Number(weeklyTargetCount) || 3,
          frequency_days: selectedDays,
          time_of_day: timeOfDay,
          linked_module: linkedModule || null
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsCreateOpen(false);
        setTitle('');
        setLinkedModule('');
        showToast(json.message);
        await fetchHabits();
      } else {
        showToast(json.error || 'Alışkanlık eklenemedi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (habitId: string) => {
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', habit_id: habitId })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message);
      await fetchHabits();
    }
  };

  const handleDelete = async (habitId: string, habitTitle: string) => {
    if (!confirm(`"${habitTitle}" alışkanlığını ve tüm geçmiş kayıtlarını silmek istediğinize emin misiniz?`)) return;
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', habit_id: habitId })
    });
    const json = await res.json();
    if (json.success) {
      setDetailHabit(null);
      showToast(json.message);
      await fetchHabits();
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        icon="🔁"
        title="Alışkanlık Motoru Yükleniyor..."
        description="Günlük rutinler, esnek haftalık kotalar ve 16 haftalık seri matrisi hazırlanıyor"
        color="#10B981"
      />
    );
  }

  const visibleHabits = habitsList.filter(h => (showArchived ? h.is_archived === 1 : h.is_archived !== 1));
  const unlockedBadges = badges.filter(b => b.unlocked);

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {toastMsg && (
        <div className="toast-glass" role="status" aria-live="polite" style={{ zIndex: 1100 }}>
          {toastMsg}
        </div>
      )}

      {/* Üst Başlık & Tarih Çubuğu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '21px', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
            🔁 Esnek Alışkanlık &amp; Rutin Motoru
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Cezasız esnek haftalık kotalar, 0–100 sağlık skoru ve otomatik modül köprüsü
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '999px', padding: '4px 8px' }}>
            <button
              type="button"
              onClick={() => setSelectedDate(shiftTurkeyDate(selectedDate, -1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, color: 'var(--text-main)', padding: '2px 6px' }}
            >
              ‹
            </button>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              {formatTurkishDisplayDate(selectedDate, true)}
            </span>
            <button
              type="button"
              disabled={selectedDate >= todayTr}
              onClick={() => setSelectedDate(shiftTurkeyDate(selectedDate, 1))}
              style={{ background: 'none', border: 'none', cursor: selectedDate >= todayTr ? 'default' : 'pointer', fontWeight: 800, color: selectedDate >= todayTr ? 'var(--text-muted)' : 'var(--text-main)', padding: '2px 6px' }}
            >
              ›
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowArchived(prev => !prev)}
            className="btn-subtle"
            style={{ padding: '7px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '999px' }}
          >
            {showArchived ? 'Aktifleri Göster' : 'Arşiv'}
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 800, borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Plus size={15} />
            <span>Yeni Alışkanlık</span>
          </button>
        </div>
      </div>

      {/* Üst KPI & Rozet Şeridi */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Alışkanlık Sağlık Skoru
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
              {healthScore} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Son 30 gün tutarlılık + seri puanı
            </div>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.14)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={24} />
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Award size={13} style={{ color: '#F59E0B' }} /> Rozetler ({unlockedBadges.length}/7)
            </span>
          </div>
          <div className="no-scrollbar" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {badges.map(b => (
              <div
                key={b.id}
                title={`${b.title}: ${b.description}`}
                style={{
                  padding: '5px 9px',
                  borderRadius: '999px',
                  border: `1px solid ${b.unlocked ? 'rgba(245, 158, 11, 0.45)' : 'var(--border)'}`,
                  background: b.unlocked ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-subtle)',
                  opacity: b.unlocked ? 1 : 0.45,
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {b.icon} {b.title}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alışkanlık Listesi (Zaman Dilimine Göre Gruplu) */}
      {visibleHabits.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '34px', marginBottom: '8px' }}>🌱</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
            {showArchived ? 'Arşivlenmiş alışkanlık yok' : 'Henüz aktif alışkanlık tanımlanmadı'}
          </div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            &quot;Yeni Alışkanlık&quot; butonuna tıklayarak günlük veya esnek haftalık rutinlerinizi ekleyebilirsiniz.
          </div>
        </div>
      ) : (
        TIME_SLOTS.map(slot => {
          const slotHabits = visibleHabits.filter(h => (h.time_of_day || 'all_day') === slot.id);
          if (slotHabits.length === 0) return null;

          return (
            <div key={slot.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{slot.icon}</span>
                <span>{slot.label} ({slotHabits.length})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '10px' }}>
                {slotHabits.map(habit => {
                  const st = statsByHabit[habit.id];
                  const dayLog = logsByHabit[habit.id];
                  const isDone = Boolean(dayLog && dayLog.is_completed === 1);
                  const currentVal = dayLog ? dayLog.value : 0;
                  const isNumeric = habit.target_type === 'numeric' || habit.target_type === 'timer';
                  const stepDelta = habit.target_type === 'timer' ? 5 : habit.target_value >= 1000 ? 250 : 1;

                  return (
                    <div
                      key={habit.id}
                      className="card"
                      style={{
                        padding: '14px',
                        borderLeft: `4px solid ${habit.color}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setDetailHabit(habit)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            minWidth: 0,
                            flex: 1
                          }}
                        >
                          <span style={{ fontSize: '22px', flexShrink: 0 }}>{getEmoji(habit.icon)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {habit.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <span>{habit.category}</span>
                              {habit.frequency_type === 'flexible_weekly' && st && (
                                <span style={{ color: st.weeklyQuotaSatisfied ? '#10B981' : '#F59E0B', fontWeight: 800 }}>
                                  • Bu hafta {st.weeklyCompletedCount}/{st.weeklyTargetCount}
                                </span>
                              )}
                              {habit.linked_module && (
                                <span style={{ color: '#3B82F6', fontWeight: 700 }}>
                                  • Otomatik ({habit.linked_module === 'reading' ? 'Okuma' : habit.linked_module === 'workout' ? 'Spor' : 'Su'})
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Tamamlama / Artırma Butonu (44x44px Dokunma Dostu) */}
                        {isNumeric ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleIncrement(habit.id, stepDelta)}
                              style={{
                                minWidth: '44px',
                                minHeight: '44px',
                                padding: '0 10px',
                                borderRadius: '10px',
                                border: `1px solid ${isDone ? '#10B981' : habit.color}`,
                                background: isDone ? 'rgba(16, 185, 129, 0.14)' : 'var(--surface-subtle)',
                                color: isDone ? '#10B981' : habit.color,
                                fontSize: '12px',
                                fontWeight: 900,
                                cursor: 'pointer'
                              }}
                            >
                              +{stepDelta}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggle(habit.id)}
                              aria-label={`${habit.title} tamamla`}
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '10px',
                                border: `1px solid ${isDone ? '#10B981' : 'var(--border)'}`,
                                background: isDone ? '#10B981' : 'var(--surface-subtle)',
                                color: isDone ? '#FFFFFF' : 'var(--text-muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Check size={18} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggle(habit.id)}
                            aria-label={`${habit.title} tamamla`}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '12px',
                              border: `1px solid ${isDone ? '#10B981' : 'var(--border)'}`,
                              background: isDone ? '#10B981' : 'var(--surface-subtle)',
                              color: isDone ? '#FFFFFF' : 'var(--text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            <Check size={20} />
                          </button>
                        )}
                      </div>

                      {isNumeric && (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>İlerleme: {currentVal} / {habit.target_value} {habit.unit_label}</span>
                          <span>%{Math.min(100, Math.round((currentVal / Math.max(1, habit.target_value)) * 100))}</span>
                        </div>
                      )}

                      {/* 14 Günlük Mini Katkı Noktaları + Seri */}
                      {st && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                            {st.last14Days.map(cell => (
                              <span
                                key={cell.date}
                                title={`${cell.date}: ${cell.completed ? 'Tamamlandı' : 'Boş'}`}
                                style={{
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '3px',
                                  background: cell.completed ? habit.color : 'var(--surface-subtle)',
                                  border: `1px solid ${cell.completed ? habit.color : 'var(--border)'}`,
                                  opacity: cell.completed ? 1 : 0.65
                                }}
                              />
                            ))}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: st.currentStreak > 0 ? '#F59E0B' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                            <Flame size={12} /> {st.currentStreak} gün
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Yeni Alışkanlık Modalı */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)} style={{ zIndex: 1100 }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%', padding: '20px', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>🔁 Yeni Alışkanlık Oluştur</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="modal-close-btn" aria-label="Kapat">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Alışkanlık Adı *</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn. Haftada 3 Gün Spor, 20 dk İngilizce" className="input" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hedef Tipi</label>
                  <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="input" style={{ width: '100%' }}>
                    <option value="boolean">Evet / Hayır</option>
                    <option value="numeric">Sayısal Sayaç</option>
                    <option value="timer">Süre Hedefli (dk)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Zaman Dilimi</label>
                  <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value as any)} className="input" style={{ width: '100%' }}>
                    <option value="morning">🌅 Sabah</option>
                    <option value="afternoon">☀️ Öğle</option>
                    <option value="evening">🌙 Akşam</option>
                    <option value="all_day">🔄 Tüm Gün</option>
                  </select>
                </div>
              </div>

              {targetType !== 'boolean' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Günlük Hedef Değer</label>
                    <input type="number" min="1" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="input" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Birim</label>
                    <input type="text" value={unitLabel} onChange={e => setUnitLabel(e.target.value)} placeholder="dk, adım, sayfa" className="input" style={{ width: '100%' }} />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sıklık Kuralı</label>
                <select value={frequencyType} onChange={e => setFrequencyType(e.target.value as any)} className="input" style={{ width: '100%' }}>
                  <option value="daily">Her Gün</option>
                  <option value="flexible_weekly">Esnek Haftalık Kota (Cezasız: Haftada X kez)</option>
                  <option value="specific_days">Haftanın Belirli Günleri</option>
                </select>
              </div>

              {frequencyType === 'flexible_weekly' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Haftalık Hedef Sayısı (1–7)</label>
                  <input type="number" min="1" max="7" value={weeklyTargetCount} onChange={e => setWeeklyTargetCount(e.target.value)} className="input" style={{ width: '100%' }} />
                </div>
              )}

              {frequencyType === 'specific_days' && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 1, l: 'Pzt' }, { id: 2, l: 'Sal' }, { id: 3, l: 'Çar' },
                    { id: 4, l: 'Per' }, { id: 5, l: 'Cum' }, { id: 6, l: 'Cmt' }, { id: 0, l: 'Paz' }
                  ].map(d => {
                    const active = selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDays(prev => (active ? prev.filter(x => x !== d.id) : [...prev, d.id]))}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 800,
                          border: `1px solid ${active ? 'var(--emerald)' : 'var(--border)'}`,
                          background: active ? 'var(--emerald-bg)' : 'var(--surface-subtle)',
                          color: active ? 'var(--emerald)' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>EventBus Otomatik Tamamlama Köprüsü</label>
                <select value={linkedModule} onChange={e => setLinkedModule(e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">Manuel Tamamlama</option>
                  <option value="reading">📚 Kitap Okuma Seansı Kaydedilince Otomatik İşaretle</option>
                  <option value="workout">🏋️ Antrenman Kaydedilince Otomatik İşaretle</option>
                  <option value="water">💧 Günlük Su Hedefine Ulaşılınca Otomatik İşaretle</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>İkon &amp; Renk</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {HABIT_ICONS.map(ic => (
                    <button key={ic.key} type="button" onClick={() => setIcon(ic.key)} style={{ padding: '4px 8px', borderRadius: '6px', border: icon === ic.key ? '2px solid var(--emerald)' : '1px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer', fontSize: '16px' }}>
                      {ic.emoji}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {HABIT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Renk ${c}`} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text-main)' : '1px solid var(--border)', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '10px', fontWeight: 800 }}>
                {submitting ? 'Kaydediliyor...' : 'Alışkanlığı Oluştur'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 16 Haftalık (112 Gün) Matris Detay Modalı */}
      {detailHabit && statsByHabit[detailHabit.id] && (
        <div className="modal-overlay" onClick={() => setDetailHabit(null)} style={{ zIndex: 1100 }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '100%', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                {getEmoji(detailHabit.icon)} {detailHabit.title} — 16 Haftalık Matris
              </h3>
              <button type="button" onClick={() => setDetailHabit(null)} className="modal-close-btn" aria-label="Kapat">
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>Güncel Seri</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#F59E0B' }}>{statsByHabit[detailHabit.id].currentStreak} gün</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>En Uzun Seri</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#10B981' }}>{statsByHabit[detailHabit.id].longestStreak} gün</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>30g Tutarlılık</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#3B82F6' }}>%{statsByHabit[detailHabit.id].consistency30dPercent}</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: '6px' }}>
              <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 14px)', gridAutoFlow: 'column', gap: '4px', width: 'max-content' }}>
                {statsByHabit[detailHabit.id].last112Days.map(cell => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.completed ? 'Tamamlandı' : 'Boş'}`}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '3px',
                      background: cell.completed ? detailHabit.color : 'var(--surface-subtle)',
                      border: `1px solid ${cell.completed ? detailHabit.color : 'var(--border)'}`
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={async () => {
                  await handleArchive(detailHabit.id);
                  setDetailHabit(null);
                }}
                className="btn-subtle"
                style={{ padding: '7px 12px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Archive size={14} /> {detailHabit.is_archived === 1 ? 'Arşivden Çıkar' : 'Arşivle'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(detailHabit.id, detailHabit.title)}
                style={{
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#DC2626',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Trash2 size={14} /> Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
