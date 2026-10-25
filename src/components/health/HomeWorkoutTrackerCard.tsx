'use client';

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  RefreshCw,
  Plus,
  Camera,
  Activity,
  Zap,
  Flame,
  Timer,
  Compass,
  Heart,
  Waves,
  Dumbbell,
  ChevronRight,
  Trash2,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import HomeWorkoutModal from '@/components/modals/HomeWorkoutModal';

export interface SetData {
  set_number?: number;
  weight_kg: string | number;
  reps: string | number;
}

export interface ExerciseLog {
  id: string;
  exercise_name: string;
  category: string;
  equipment: string;
  sets: SetData[];
  max_weight_kg: number;
  total_reps: number;
}

export interface WorkoutSession {
  id: string;
  title: string;
  sport_type?: string;
  date: string;
  start_time?: string;
  duration_minutes: number;
  duration_seconds?: number;
  formatted_duration?: string;
  total_volume_kg: number;
  distance_km?: number;
  distance_meters?: number;
  formatted_distance?: string;
  calories?: number;
  avg_speed_kmh?: number;
  max_speed_kmh?: number;
  avg_pace?: string;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  vo2_max?: number;
  elevation_gain_m?: number;
  step_count?: number;
  cadence_spm?: number;
  sweat_loss_ml?: number;
  swim_pool_length_m?: number;
  swim_total_lengths?: number;
  swim_stroke_count?: number;
  swim_avg_swolf?: number;
  swim_best_swolf?: number;
  swim_style?: string;
  source?: string;
  notes?: string;
  exercises: ExerciseLog[];
}

const SPORT_CONFIGS: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  cycling: { icon: '🚴', label: 'Bisiklet', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  running: { icon: '🏃', label: 'Koşu', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  walking: { icon: '🚶', label: 'Yürüyüş', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  swimming: { icon: '🏊', label: 'Yüzme', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  strength: { icon: '🏋️', label: 'Kuvvet', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  hiit: { icon: '⚡', label: 'Kardiyo', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  other: { icon: '🏅', label: 'Antrenman', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' }
};

export default function HomeWorkoutTrackerCard() {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health/workouts');
      const json = await res.json();
      if (json.success && json.data) {
        setWorkouts(json.data);
      }
    } catch (err) {
      console.error('Workouts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkStravaStatus = async () => {
    try {
      const res = await fetch('/api/health/workouts/strava/sync');
      const json = await res.json();
      if (json.success && json.data) {
        setStravaConnected(json.data.isConnected);
      }
    } catch {
      setStravaConnected(false);
    }
  };

  useEffect(() => {
    fetchWorkouts();
    checkStravaStatus();
  }, []);

  const handleStravaSync = async () => {
    setSyncingStrava(true);
    try {
      const res = await fetch('/api/health/workouts/strava/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        fetchWorkouts();
      } else {
        if (json.error?.includes('bağlı değil')) {
          if (confirm('Strava hesabınız henüz bağlı değil. Şimdi Strava ile bağlanmak ister misiniz?')) {
            window.location.href = '/api/health/workouts/strava/auth';
          }
        } else {
          alert(json.error || 'Senkronizasyon hatası.');
        }
      }
    } catch {
      alert('Strava bağlantı hatası.');
    } finally {
      setSyncingStrava(false);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Bu antrenman kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch('/api/health/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', workout_id: workoutId })
      });
      const json = await res.json();
      if (json.success) {
        fetchWorkouts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Performans Metrikleri
  const totalKm = workouts.reduce((sum, w) => sum + (w.distance_km || 0), 0).toFixed(1);
  const totalCalories = workouts.reduce((sum, w) => sum + (w.calories || 0), 0);
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* 1. ÜST BAŞLIK VE HIZLI EYLEMLER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Trophy size={18} color="#EF4444" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Antrenman & Spor Günlüğü
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Strava, Samsung Health & Çoklu Spor Takibi
            </div>
          </div>
        </div>

        {/* Strava Rozeti & Yeni Antrenman */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Strava Bağlantı / Eşitleme Butonu */}
          <button
            type="button"
            disabled={syncingStrava}
            onClick={handleStravaSync}
            style={{
              height: '34px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
            title="Strava'dan son aktiviteleri otomatik çek"
          >
            <RefreshCw size={13} className={syncingStrava ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">
              {stravaConnected ? 'Strava Eşitle' : 'Strava Bağla'}
            </span>
            {stravaConnected && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
            )}
          </button>

          {/* Yeni Antrenman / OCR Butonu */}
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsModalOpen(true)}
            style={{
              height: '34px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
          >
            <Plus size={14} />
            <span>Yeni Seans / OCR</span>
          </button>
        </div>
      </div>

      {/* 2. PERFORMANS KPI ÖZET ŞERİDİ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '8px'
        }}
      >
        <div style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>TOPLAM MESAFE</div>
          <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#10B981', marginTop: '2px' }}>
            {totalKm} <span style={{ fontSize: '11px', fontWeight: 600 }}>km</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>YAKILAN ENERJİ</div>
          <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#EF4444', marginTop: '2px' }}>
            {totalCalories} <span style={{ fontSize: '11px', fontWeight: 600 }}>kcal</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>AKTİF SÜRE</div>
          <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#6366F1', marginTop: '2px' }}>
            {Math.floor(totalMinutes / 60)}s {totalMinutes % 60}d
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>TOPLAM SEANS</div>
          <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
            {workouts.length}
          </div>
        </div>
      </div>

      {/* 3. ANTRENMAN SEANSLARI LİSTESİ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Antrenman verileri yükleniyor...
          </div>
        ) : workouts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              backgroundColor: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏃</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
              Kayıtlı Antrenman Bulunmuyor
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '14px' }}>
              Koşu, bisiklet, yüzme veya kuvvet antrenmanı ekleyin; Strava hesabınızı bağlayın veya Samsung Health ekran görüntüsü tarayın.
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsModalOpen(true)}
              style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 800 }}
            >
              + İlk Antrenmanı Kaydet
            </button>
          </div>
        ) : (
          workouts.map(wk => {
            const sportInfo = SPORT_CONFIGS[wk.sport_type || 'other'] || SPORT_CONFIGS.other;
            const isStrength = wk.sport_type === 'strength';
            const isSwim = wk.sport_type === 'swimming';
            const isRunOrRide = wk.sport_type === 'running' || wk.sport_type === 'cycling' || wk.sport_type === 'walking';

            return (
              <div
                key={wk.id}
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Başlık & Kaynak & Aksiyon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: sportInfo.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        flexShrink: 0
                      }}
                    >
                      {sportInfo.icon}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {wk.title}
                        </span>
                        {wk.source && wk.source !== 'manual' && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: wk.source === 'strava' ? 'rgba(252, 76, 2, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                              color: wk.source === 'strava' ? '#FC4C02' : '#6366F1'
                            }}
                          >
                            {wk.source === 'strava' ? 'STRAVA' : 'AI VISION'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        📅 {wk.date} {wk.start_time ? `• ${wk.start_time}` : ''} • ⏱️ {wk.formatted_duration || `${wk.duration_minutes || 0} dk`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteWorkout(wk.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    title="Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* BRANŞA ÖZEL SPOR METRİKLERİ PANELLERİ */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                  {/* Mesafe */}
                  {wk.distance_km !== undefined && wk.distance_km > 0 && (
                    <span style={{ backgroundColor: 'var(--surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700 }}>
                      📍 <strong>{wk.formatted_distance || `${wk.distance_km} km`}</strong>
                    </span>
                  )}

                  {/* Kalori */}
                  {wk.calories !== undefined && wk.calories > 0 && (
                    <span style={{ backgroundColor: 'var(--surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, color: '#EF4444' }}>
                      🔥 {wk.calories} kcal
                    </span>
                  )}

                  {/* Ortalama Hız */}
                  {wk.avg_speed_kmh !== undefined && wk.avg_speed_kmh > 0 && (
                    <span style={{ backgroundColor: 'var(--surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700 }}>
                      ⚡ Ort: {wk.avg_speed_kmh} km/s
                    </span>
                  )}

                  {/* Pace (Koşu) */}
                  {wk.avg_pace && (
                    <span style={{ backgroundColor: 'var(--surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, color: '#10B981' }}>
                      ⏱️ Pace: {wk.avg_pace}
                    </span>
                  )}

                  {/* Kalp Atış Hızı */}
                  {wk.avg_heart_rate !== undefined && wk.avg_heart_rate > 0 && (
                    <span style={{ backgroundColor: 'var(--surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, color: '#EC4899' }}>
                      ❤️ {wk.avg_heart_rate} bpm
                    </span>
                  )}

                  {/* Yüzme Havuz & Kulaç */}
                  {isSwim && wk.swim_stroke_count !== undefined && (
                    <span style={{ backgroundColor: 'var(--surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, color: '#06B6D4' }}>
                      🏊 SWOLF: {wk.swim_avg_swolf || '-'} • {wk.swim_stroke_count} Kulaç
                    </span>
                  )}

                  {/* Kuvvet Antrenmanı Tonajı */}
                  {isStrength && wk.total_volume_kg > 0 && (
                    <span style={{ backgroundColor: 'var(--surface)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, color: '#8B5CF6' }}>
                      🏋️ Hacim: {wk.total_volume_kg} kg
                    </span>
                  )}
                </div>

                {/* Kuvvet Egzersizleri Listesi */}
                {isStrength && wk.exercises && wk.exercises.length > 0 && (
                  <div style={{ backgroundColor: 'var(--surface)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '2px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Kaldırılan Ağırlıklar ({wk.exercises.length} Egzersiz)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {wk.exercises.map((ex, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-main)' }}>
                          <span>{ex.exercise_name}</span>
                          <span className="tabular-nums" style={{ color: '#8B5CF6', fontWeight: 700 }}>
                            {ex.sets?.length || 0} Set • Max {ex.max_weight_kg || 0} kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ANTRENMAN MODALI */}
      <HomeWorkoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchWorkouts();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
