'use client';

import React, { useState, useEffect } from 'react';
import HomeWorkoutModal from '@/components/modals/HomeWorkoutModal';

interface SetData {
  set_number?: number;
  weight_kg: string | number;
  reps: string | number;
}

interface ExerciseLog {
  id: string;
  exercise_name: string;
  category: string;
  equipment: string;
  sets: SetData[];
  max_weight_kg: number;
  total_reps: number;
}

interface WorkoutSession {
  id: string;
  title: string;
  sport_type?: string;
  date: string;
  start_time?: string;
  duration_minutes: number;
  total_volume_kg: number;
  distance_km?: number;
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

const SPORT_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  cycling: { icon: '🚴', label: 'Bisiklet', color: '#3B82F6' },
  running: { icon: '🏃', label: 'Koşu', color: '#10B981' },
  walking: { icon: '🚶', label: 'Yürüyüş', color: '#F59E0B' },
  swimming: { icon: '🏊', label: 'Yüzme', color: '#06B6D4' },
  strength: { icon: '🏋️', label: 'Kuvvet', color: '#8B5CF6' },
  hiit: { icon: '⚡', label: 'Kardiyo', color: '#EC4899' },
  other: { icon: '🏅', label: 'Antrenman', color: '#6B7280' }
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
        alert(json.message);
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
    } catch (err: any) {
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

  // Toplam haftalık / genel özetler
  const totalKm = workouts.reduce((sum, w) => sum + (w.distance_km || 0), 0).toFixed(1);
  const totalCalories = workouts.reduce((sum, w) => sum + (w.calories || 0), 0);
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);

  return (
    <div className="card">
      {/* Üst Başlık ve Aksiyon Butonları */}
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">
          <span>🏅</span>
          <span>Antrenman & Spor Günlüğü</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={syncingStrava}
            onClick={handleStravaSync}
            style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Strava'dan son antrenmanları otomatik çek"
          >
            <span>{syncingStrava ? '⏳' : '🔄'}</span>
            <span>{syncingStrava ? 'Çekiliyor...' : 'Strava Senkronize Et'}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 800, background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>+</span>
            <span>YENİ ANTRENMAN / TARA</span>
          </button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
        Koşu, Bisiklet, Yürüyüş, Yüzme ve Kuvvet antrenmanlarınızı takip edin. Samsung Health ekran görüntülerinizi yükleyerek yapay zeka ile saniyeler içinde kaydedin.
      </p>

      {/* Performans Özet Şeridi */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '14px' }}>
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>TOPLAM MESAFE</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--emerald)', marginTop: '2px' }}>{totalKm} km</div>
        </div>
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>YAKILAN KALORİ</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--rose)', marginTop: '2px' }}>{totalCalories} kcal</div>
        </div>
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>AKTİF SÜRE</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--indigo)', marginTop: '2px' }}>
            {Math.floor(totalMinutes / 60)} sa {totalMinutes % 60} dk
          </div>
        </div>
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>ANTRENMAN</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{workouts.length} Seans</div>
        </div>
      </div>

      {/* Antrenmanlar Listesi */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Antrenmanlar yükleniyor...
        </div>
      ) : workouts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {workouts.map(wk => {
            const sportInfo = SPORT_ICONS[wk.sport_type || 'other'] || SPORT_ICONS.other;
            return (
              <div
                key={wk.id}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Başlık & Butonlar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}>
                      {sportInfo.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{wk.title}</span>
                        {wk.source && wk.source !== 'manual' && (
                          <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--indigo)' }}>
                            {wk.source === 'strava' ? 'STRAVA' : wk.source === 'ai_ocr' ? 'AI OCR' : wk.source.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        📅 {wk.date} {wk.start_time ? `• ${wk.start_time}` : ''} • ⏱️ {wk.duration_minutes || 0} Dk
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteWorkout(wk.id)}
                    style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '13px', cursor: 'pointer', padding: '4px' }}
                    title="Sil"
                  >
                    🗑️
                  </button>
                </div>

                {/* Önemli Metrik Rozetleri */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {/* Mesafe */}
                  {wk.distance_km !== undefined && wk.distance_km > 0 && (
                    <span style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10B981', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      📍 {wk.sport_type === 'swimming' ? `${Math.round(wk.distance_km * 1000)} m` : `${wk.distance_km} km`}
                    </span>
                  )}

                  {/* Kalori */}
                  {wk.calories !== undefined && wk.calories > 0 && (
                    <span style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#EF4444', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      🔥 {wk.calories} kcal
                    </span>
                  )}

                  {/* Hız */}
                  {wk.avg_speed_kmh !== undefined && wk.avg_speed_kmh > 0 && (
                    <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                      ⚡ {wk.avg_speed_kmh} km/sa {wk.max_speed_kmh ? `(Maks ${wk.max_speed_kmh})` : ''}
                    </span>
                  )}

                  {/* Pace */}
                  {wk.avg_pace && (
                    <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                      ⏱️ {wk.avg_pace}
                    </span>
                  )}

                  {/* Nabız */}
                  {wk.avg_heart_rate !== undefined && wk.avg_heart_rate > 0 && (
                    <span style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', color: '#F43F5E', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      ❤️ {wk.avg_heart_rate} bpm {wk.max_heart_rate ? `(Maks ${wk.max_heart_rate})` : ''}
                    </span>
                  )}

                  {/* VO2 Max */}
                  {wk.vo2_max !== undefined && wk.vo2_max > 0 && (
                    <span style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--indigo)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      🫁 VO2: {wk.vo2_max}
                    </span>
                  )}

                  {/* Adım */}
                  {wk.step_count !== undefined && wk.step_count > 0 && (
                    <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                      👟 {wk.step_count.toLocaleString('tr-TR')} Adım
                    </span>
                  )}

                  {/* Ter Kaybı */}
                  {wk.sweat_loss_ml !== undefined && wk.sweat_loss_ml > 0 && (
                    <span style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)', color: '#06B6D4', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      💧 {wk.sweat_loss_ml} ml Ter
                    </span>
                  )}

                  {/* Yüzme: SWOLF & Kulaç */}
                  {wk.swim_avg_swolf !== undefined && wk.swim_avg_swolf > 0 && (
                    <span style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)', color: '#06B6D4', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      🏊 SWOLF: {wk.swim_avg_swolf} • {wk.swim_stroke_count || 0} Kulaç
                    </span>
                  )}

                  {/* Kuvvet: Hacim */}
                  {wk.sport_type === 'strength' && wk.total_volume_kg > 0 && (
                    <span style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#8B5CF6', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      🏋️ Hacim: {wk.total_volume_kg} kg
                    </span>
                  )}
                </div>

                {/* Kuvvet Egzersizleri ve Setler (Varsa) */}
                {wk.exercises && wk.exercises.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px', marginTop: '4px' }}>
                    {wk.exercises.map((ex, exIdx) => (
                      <div
                        key={exIdx}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '8px',
                          fontSize: '11px'
                        }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '3px' }}>
                          {ex.exercise_name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {ex.sets && ex.sets.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10B981',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700
                              }}
                            >
                              S{sIdx + 1}: {s.weight_kg}kg × {s.reps}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {wk.notes && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface)', padding: '6px 8px', borderRadius: '6px' }}>
                    💬 {wk.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', background: 'var(--surface-subtle)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏅</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Henüz antrenman kaydı yok</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Koşu, bisiklet, yürüyüş veya yüzme antrenmanınızı ekran görüntüsüyle taramak veya manuel girmek için yukarıdaki yeşil butona tıklayın!
          </div>
        </div>
      )}

      {/* Kayıt ve Tarama Modalı */}
      <HomeWorkoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchWorkouts();
        }}
      />
    </div>
  );
}
