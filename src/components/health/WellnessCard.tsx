'use client';

import React, { useState, useEffect } from 'react';
import {
  Pill,
  Droplets,
  Moon,
  Smile,
  Sparkles,
  Check,
  RotateCcw,
  Plus,
  Flame,
  AlertTriangle,
  Zap,
  Shield,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sun,
  Sunset
} from 'lucide-react';

export interface Supplement {
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
  form_type?: string | null;
  unit?: string | null;
  taken_at?: string | null;
}

export interface SleepLog {
  bedtime: string;
  wake_time: string;
  duration_hours: number;
  quality_rating: number;
  notes?: string | null;
  date: string;
}

export interface MoodLog {
  mood_emoji: string;
  mood_score: number;
  energy_level: number;
  stress_level?: number;
  note?: string | null;
  date: string;
}

export interface WaterLog {
  amount_ml: number;
  goal_ml: number;
}

interface Props {
  supplements: {
    morning: Supplement[];
    evening: Supplement[];
    with_meal: Supplement[];
    total: number;
    taken: number;
    all?: Supplement[];
  };
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
  { emoji: '😄', label: 'Harika', score: 5, color: '#10B981' },
  { emoji: '😊', label: 'İyi',    score: 4, color: '#34D399' },
  { emoji: '😐', label: 'Normal', score: 3, color: '#F59E0B' },
  { emoji: '😔', label: 'Düşük',  score: 2, color: '#F97316' },
  { emoji: '😤', label: 'Stresli', score: 1, color: '#EF4444' }
];

function getDaysPassed(lastTakenDate?: string | null) {
  if (!lastTakenDate) return 999;
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
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
  const [taking, setTaking] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [takingAll, setTakingAll] = useState(false);

  // 1. Su Durumu
  const [waterAmount, setWaterAmount] = useState(todayWater?.amount_ml || 0);
  const [waterGoal, setWaterGoal] = useState(todayWater?.goal_ml || 2500);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(todayWater?.goal_ml || 2500));
  const [savingWater, setSavingWater] = useState(false);

  useEffect(() => {
    if (todayWater) {
      setWaterAmount(todayWater.amount_ml || 0);
      setWaterGoal(todayWater.goal_ml || 2500);
      setGoalInput(String(todayWater.goal_ml || 2500));
    }
  }, [todayWater]);

  // 2. Uyku Durumu
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [sleepForm, setSleepForm] = useState({
    bedtime: todaySleep?.bedtime || '23:30',
    wake_time: todaySleep?.wake_time || '07:30',
    quality_rating: todaySleep?.quality_rating || 4,
    notes: todaySleep?.notes || ''
  });
  const [savingSleep, setSavingSleep] = useState(false);

  // 3. Mood / Enerji / Stres Durumu
  const [selectedMood, setSelectedMood] = useState<number | null>(todayMood?.mood_score || 4);
  const [energyLevel, setEnergyLevel] = useState<number>(todayMood?.energy_level || 3);
  const [stressLevel, setStressLevel] = useState<number>(todayMood?.stress_level || 2);
  const [wellnessNote, setWellnessNote] = useState<string>(todayMood?.note || '');
  const [savingMood, setSavingMood] = useState(false);

  // Takviyeleri Filtreleme & İlerleme
  const allSupps = supplements.all || [...supplements.morning, ...supplements.with_meal, ...supplements.evening];
  const dailySupps = allSupps.filter(s => !s.frequency_type || s.frequency_type === 'daily');
  const intervalSupps = allSupps.filter(s => s.frequency_type === 'interval');
  const asNeededSupps = allSupps.filter(s => s.frequency_type === 'as_needed');

  const takenDaily = dailySupps.filter(s => s.is_taken_today === 1).length;
  const totalDaily = dailySupps.length;
  const suppProgress = totalDaily > 0 ? Math.round((takenDaily / totalDaily) * 100) : 100;
  const waterProgress = Math.min(100, Math.round((waterAmount / (waterGoal || 2500)) * 100));

  // --- TAKVİYE API EYLEMLERİ ---
  const handleTake = async (id: string) => {
    setTaking(id);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_supplement', id })
      });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
    } finally {
      setTaking(null);
    }
  };

  const handleUndo = async (id: string) => {
    setUndoing(id);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo_supplement', id })
      });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
    } finally {
      setUndoing(null);
    }
  };

  const handleTakeAll = async () => {
    setTakingAll(true);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_all' })
      });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
    } finally {
      setTakingAll(false);
    }
  };

  const handleDeleteSupp = async (id: string) => {
    if (!confirm('Bu takviye kaydını silmek istediğinize emin misiniz?')) return;
    await fetch('/api/wellness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_supplement', id })
    });
    window.dispatchEvent(new CustomEvent('singularity-refresh'));
    if (onRefresh) onRefresh();
  };

  // --- SU API EYLEMLERİ ---
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
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
    } finally {
      setSavingWater(false);
    }
  };

  const handleSaveWaterGoal = async () => {
    const val = Math.max(500, Math.min(10000, parseInt(goalInput) || 2500));
    setWaterGoal(val);
    setIsEditingGoal(false);
    await fetch('/api/wellness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_water_goal', goal_ml: val })
    });
    window.dispatchEvent(new CustomEvent('singularity-refresh'));
    if (onRefresh) onRefresh();
  };

  // --- UYKU API EYLEMLERİ ---
  const handleSaveSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSleep(true);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_sleep', ...sleepForm })
      });
      setIsSleepModalOpen(false);
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
    } finally {
      setSavingSleep(false);
    }
  };

  // --- MOOD & ENERJİ API EYLEMLERİ ---
  const handleSelectMoodScore = async (score: number) => {
    setSelectedMood(score);
    const selected = MOODS.find(m => m.score === score);
    setSavingMood(true);
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_mood',
          mood_emoji: selected?.emoji || '😊',
          mood_score: score,
          energy_level: energyLevel,
          stress_level: stressLevel,
          note: wellnessNote
        })
      });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
      if (onRefresh) onRefresh();
    } finally {
      setSavingMood(false);
    }
  };

  const getFormIcon = (formType?: string | null) => {
    switch (formType) {
      case 'spray': return '💨';
      case 'drop': return '💧';
      case 'powder': return '🥄';
      case 'sachet': return '📦';
      case 'liquid': return '🍶';
      case 'ampoule': return '💉';
      case 'other': return '🏷️';
      default: return '💊';
    }
  };

  const getFormUnit = (s: Supplement) => {
    if (s.unit && s.unit.trim()) return s.unit.trim();
    switch (s.form_type) {
      case 'spray': return 'puf';
      case 'drop': return 'damla';
      case 'powder': return 'ölçek';
      case 'sachet': return 'saşe';
      case 'liquid': return 'ölçek';
      case 'ampoule': return 'ampul';
      case 'other': return 'adet';
      default: return 'kapsül';
    }
  };

  // 2 Katmanlı Mobil-First Takviye Satırı
  const renderSupplementRow = (s: Supplement, timingAccentColor: string = '#10B981') => {
    const isLowStock = s.remaining_pills !== null && s.remaining_pills !== undefined && s.remaining_pills <= 7;
    const isTaken = Boolean(s.is_taken_today);

    return (
      <div
        key={s.id}
        style={{
          backgroundColor: isTaken ? 'rgba(16, 185, 129, 0.06)' : isLowStock ? 'rgba(245, 158, 11, 0.06)' : 'var(--surface-subtle)',
          border: `1px solid ${isTaken ? 'rgba(16, 185, 129, 0.25)' : isLowStock ? 'rgba(245, 158, 11, 0.3)' : 'var(--border)'}`,
          borderRadius: '12px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transition: 'all 0.15s ease'
        }}
      >
        {/* 1. KATMAN: İsim + Seri + Zaman + Aksiyon Menüsü */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{getFormIcon(s.form_type)}</span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: isTaken ? 'var(--text-muted)' : 'var(--text-main)',
                  textDecoration: isTaken ? 'line-through' : 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {s.name}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {s.streak_days > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#F59E0B',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                🔥 {s.streak_days} Gün
              </span>
            )}

            {onOpenAddSupplement && (
              <button
                type="button"
                onClick={() => onOpenAddSupplement(s)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                title="Düzenle"
              >
                <Edit2 size={13} />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDeleteSupp(s.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              title="Sil"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* 2. KATMAN: Doz + Stok Rozeti + Geniş 44px Alındı Butonu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          {/* Sol: Doz ve Kalan Stok */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{s.dose}</span>
            {s.remaining_pills !== null && s.remaining_pills !== undefined && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface)',
                  color: isLowStock ? '#EF4444' : 'var(--text-muted)',
                  border: isLowStock ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border)'
                }}
              >
                {isLowStock ? `⚠️ Kalan: ${s.remaining_pills} ${getFormUnit(s)} (Kritik)` : `📦 ${s.remaining_pills} ${getFormUnit(s)}`}
              </span>
            )}
          </div>

          {/* Sağ: 44px Dokunma Hedefli Aksiyon Butonu */}
          <div style={{ flexShrink: 0 }}>
            {!isTaken ? (
              <button
                type="button"
                onClick={() => handleTake(s.id)}
                disabled={taking === s.id}
                style={{
                  minHeight: '38px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 800,
                  backgroundColor: '#10B981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Check size={14} />
                <span>{taking === s.id ? '...' : 'Alındı'}</span>
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10B981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle2 size={14} color="#10B981" />
                  <span>
                    Alındı
                    {s.taken_at ? ` (${new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(s.taken_at))})` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleUndo(s.id)}
                  disabled={undoing === s.id}
                  title="Alımı Geri Al"
                  style={{
                    minHeight: '34px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={13} />
                  <span>{undoing === s.id ? '...' : 'Geri Al'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTimingSection = (list: Supplement[], title: string, icon: React.ReactNode, accentColor: string) => {
    if (list.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {icon}
          <span>{title} ({list.length})</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {list.map(s => renderSupplementRow(s, accentColor))}
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* 1. ÜST BAŞLIK VE HIZLI EYLEMLER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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
            <Pill size={18} color="#10B981" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Günlük Rutin & Biyometrik Takip
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Whoop & Oura Standardında Biyolojik İyileşme
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {totalDaily > takenDaily && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleTakeAll}
              disabled={takingAll}
              style={{
                height: '34px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 800,
                backgroundColor: '#10B981',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box'
              }}
            >
              <Check size={13} />
              <span>{takingAll ? 'İşleniyor...' : 'Kalan Hepsini Al'}</span>
            </button>
          )}

          {onOpenAddSupplement && (
            <button
              type="button"
              onClick={() => onOpenAddSupplement()}
              style={{
                height: '34px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-main)',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
                lineHeight: 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface)';
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-subtle)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <Plus size={14} style={{ color: '#10B981', flexShrink: 0 }} />
              <span>Yeni Takviye</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 3'LÜ KOMPAKT BENTO SATIRI (SU, UYKU, RUH HALİ & ENERJİ) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '10px'
        }}
      >
        {/* BENTO 1: AKILLI SU SAYACI */}
        <div
          style={{
            backgroundColor: 'rgba(14, 165, 233, 0.06)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: '#0284C7' }}>
              <Droplets size={16} color="#0284C7" />
              <span>Su Takibi</span>
            </div>
            <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7' }}>
              %{waterProgress}
            </span>
          </div>

          <div>
            <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
              {waterAmount} <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>/ {waterGoal} ml</span>
            </div>

            {/* İlerleme Çubuğu */}
            <div style={{ height: '6px', backgroundColor: 'rgba(14, 165, 233, 0.2)', borderRadius: '999px', overflow: 'hidden', marginTop: '4px' }}>
              <div
                style={{
                  width: `${waterProgress}%`,
                  height: '100%',
                  backgroundColor: '#0284C7',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>

          {/* Hızlı Ekleme Butonları */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => handleUpdateWater(250)}
              disabled={savingWater}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#0284C7',
                backgroundColor: 'var(--surface)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              +250ml
            </button>
            <button
              type="button"
              onClick={() => handleUpdateWater(500)}
              disabled={savingWater}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#0284C7',
                backgroundColor: 'var(--surface)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              +500ml
            </button>
          </div>
        </div>

        {/* BENTO 2: UYKU VE RECOVERY (OURA / WHOOP) */}
        <div
          onClick={() => setIsSleepModalOpen(true)}
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.06)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease'
          }}
          title="Uyku kaydını güncellemek için tıklayın"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: '#8B5CF6' }}>
              <Moon size={16} color="#8B5CF6" />
              <span>Uyku & Dinlenme</span>
            </div>
            <Edit2 size={12} color="#A78BFA" />
          </div>

          <div>
            <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
              {todaySleep ? `${todaySleep.duration_hours} sa` : '7.5 sa'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {todaySleep ? `${todaySleep.bedtime} - ${todaySleep.wake_time}` : '23:30 - 07:00'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#8B5CF6' }}>
              {'★'.repeat(todaySleep?.quality_rating || 4)}{'☆'.repeat(5 - (todaySleep?.quality_rating || 4))}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kalite</span>
          </div>
        </div>

        {/* BENTO 3: GÜNLÜK RUH HALİ, ENERJİ & STRES */}
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: '#10B981' }}>
              <Smile size={16} color="#10B981" />
              <span>Mod & Enerji</span>
            </div>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#10B981' }}>
              ⚡ {energyLevel}/5
            </span>
          </div>

          {/* 5'li Emoji Seçim Butonları */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px' }}>
            {MOODS.map(m => (
              <button
                key={m.score}
                type="button"
                onClick={() => handleSelectMoodScore(m.score)}
                disabled={savingMood}
                style={{
                  background: selectedMood === m.score ? 'var(--surface)' : 'transparent',
                  border: selectedMood === m.score ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '3px 4px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transform: selectedMood === m.score ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.15s ease'
                }}
                title={m.label}
              >
                {m.emoji}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>Stres: <strong>{stressLevel}/5</strong></span>
            <span style={{ color: '#10B981', fontWeight: 700 }}>
              {MOODS.find(m => m.score === selectedMood)?.label || 'İyi'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. TAKVİYE TAMAMLAMA ÖZET ÇUBUĞU */}
      {totalDaily > 0 && (
        <div
          style={{
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              GÜNLÜK TAKVİYE TAMAMLAMA ({takenDaily} / {totalDaily})
            </span>
            <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 900, color: '#10B981' }}>
              %{suppProgress}
            </span>
          </div>

          <div style={{ height: '7px', backgroundColor: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${suppProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)',
                borderRadius: '999px',
                transition: 'width 0.5s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* 4. TAKVİYE LİSTESİ: KULLANIM ZAMANINA GÖRE GRUPLANDIRMA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
        {allSupps.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              backgroundColor: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💊</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
              Henüz Takviye veya İlaç Eklenmedi
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '14px' }}>
              Vitamin, mineral, probiyotik veya reçeteli ilaçlarınızı ekleyerek stoklarını ve günlük serilerini takip edin.
            </div>
            {onOpenAddSupplement && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onOpenAddSupplement()}
                style={{
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Plus size={16} />
                <span>İlk Takviyeyi Ekle</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 1. Sabah Takviyeleri */}
            {renderTimingSection(
              dailySupps.filter(s => s.timing === 'morning'),
              'Sabah Rutini (Aç / Tok)',
              <Sun size={15} color="#F59E0B" />,
              '#F59E0B'
            )}

            {/* 2. Öğle / Yemekle Birlikte */}
            {renderTimingSection(
              dailySupps.filter(s => s.timing === 'with_meal' || s.timing === 'lunch'),
              'Öğle & Yemekle Birlikte',
              <Sunset size={15} color="#10B981" />,
              '#10B981'
            )}

            {/* 3. Akşam / Gece */}
            {renderTimingSection(
              dailySupps.filter(s => s.timing === 'evening' || s.timing === 'night'),
              'Akşam & Yatmadan Önce',
              <Moon size={15} color="#8B5CF6" />,
              '#8B5CF6'
            )}

            {/* 4. Periyodik (Kaç Günde Bir) */}
            {intervalSupps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Clock size={15} color="#6366F1" />
                  <span>Periyodik / Aralıklarla Alınanlar ({intervalSupps.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {intervalSupps.map(s => {
                    const daysPassed = getDaysPassed(s.last_taken_date);
                    const interval = s.interval_days || 2;
                    const isDue = !s.is_taken_today && daysPassed >= interval;
                    return (
                      <div key={s.id} style={{ borderLeft: `3px solid ${isDue ? '#EF4444' : '#6366F1'}` }}>
                        {renderSupplementRow(s, isDue ? '#EF4444' : '#6366F1')}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. İhtiyaç Halinde / Düzensiz */}
            {asNeededSupps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#EC4899', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Shield size={15} color="#EC4899" />
                  <span>İhtiyaç Halinde / S.O.S ({asNeededSupps.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {asNeededSupps.map(s => renderSupplementRow(s, '#EC4899'))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* UYKU GÜNCELLEME MODALI */}
      {isSleepModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSleepModalOpen(false)}>
          <div
            className="bottom-sheet"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 14px', color: 'var(--text-main)' }}>
              😴 Uyku Süresi & Kalitesini Güncelle
            </h3>

            <form onSubmit={handleSaveSleep} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>YATIŞ SAATİ</label>
                  <input
                    type="time"
                    value={sleepForm.bedtime}
                    onChange={e => setSleepForm({ ...sleepForm, bedtime: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'inherit', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>UYANMA SAATİ</label>
                  <input
                    type="time"
                    value={sleepForm.wake_time}
                    onChange={e => setSleepForm({ ...sleepForm, wake_time: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'inherit', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>UYKU KALİTESİ (1 - 5 YILDIZ)</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSleepForm({ ...sleepForm, quality_rating: star })}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '6px',
                        border: sleepForm.quality_rating === star ? '1px solid #8B5CF6' : '1px solid var(--border)',
                        background: sleepForm.quality_rating === star ? 'rgba(139, 92, 246, 0.15)' : 'var(--surface)',
                        color: sleepForm.quality_rating === star ? '#8B5CF6' : 'var(--text-muted)',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {star} ★
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingSleep}
                  style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 800 }}
                >
                  {savingSleep ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsSleepModalOpen(false)}
                  style={{ padding: '10px 14px', fontSize: '12px' }}
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
