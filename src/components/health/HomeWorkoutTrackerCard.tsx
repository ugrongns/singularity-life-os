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
  date: string;
  duration_minutes: number;
  total_volume_kg: number;
  notes?: string;
  exercises: ExerciseLog[];
}

export default function HomeWorkoutTrackerCard() {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => {
    fetchWorkouts();
  }, []);

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

  return (
    <div className="card">
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title">
          <span>🏋️‍♂️</span>
          <span>Evde Spor & Antrenman Günlüğü</span>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
          style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 800, background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
        >
          + YENİ ANTRENMAN KAYDET
        </button>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
        Dambıl, Spor Sehpası, Direnç Bantları ve Denge Tahtası ile yaptığınız günlük hareketleri, ağırlıkları, set ve tekrarları takip edin.
      </p>

      {/* Antrenmanlar Listesi */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Antrenmanlar yükleniyor...
        </div>
      ) : workouts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {workouts.map(wk => (
            <div
              key={wk.id}
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🏋️</span> {wk.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    📅 {wk.date} • ⏱️ {wk.duration_minutes || 45} Dk • ⚡ Hacim: {wk.total_volume_kg || 0} Kg Total Yük
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteWorkout(wk.id)}
                  style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '13px', cursor: 'pointer' }}
                  title="Sil"
                >
                  🗑️
                </button>
              </div>

              {/* Egzersizler ve Setler */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                {wk.exercises && wk.exercises.map((ex, exIdx) => (
                  <div
                    key={exIdx}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {ex.exercise_name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {ex.sets && ex.sets.map((s, sIdx) => (
                        <span
                          key={sIdx}
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#10B981',
                            padding: '2px 6px',
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

              {wk.notes && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.02)', padding: '6px 8px', borderRadius: '6px' }}>
                  💬 {wk.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', background: 'var(--surface-subtle)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏋️‍♂️</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Henüz antrenman kaydı yok</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '12px' }}>
            Dambıl, sehpa ve direnç bandı hareketlerinizi kaydetmeye başlamak için yukarıdaki butona tıklayın!
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 800 }}
          >
            + İLK ANTRENMANINI KAYDET
          </button>
        </div>
      )}

      {/* Kayıt Modalı */}
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
