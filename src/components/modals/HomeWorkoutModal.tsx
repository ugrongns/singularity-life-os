'use client';

import React, { useState, useEffect } from 'react';

interface SetItem {
  set_number: number;
  weight_kg: string;
  reps: string;
  resistance_level?: string;
}

interface ExerciseEntry {
  exercise_name: string;
  category: string;
  equipment: string;
  sets: SetItem[];
}

interface HomeWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const PRESET_EXERCISES = [
  // Spor Sehpası + Dambıl
  { name: 'Incline Dumbbell Bench Press', category: 'gogus', equipment: 'bench', icon: '🛋️' },
  { name: 'Flat Dumbbell Bench Press', category: 'gogus', equipment: 'bench', icon: '🛋️' },
  { name: 'Dumbbell Fly', category: 'gogus', equipment: 'bench', icon: '🛋️' },
  { name: 'Seated Dumbbell Shoulder Press', category: 'omuz', equipment: 'bench', icon: '🛋️' },
  { name: 'Incline Dumbbell Biceps Curl', category: 'kol', equipment: 'bench', icon: '🛋️' },
  { name: 'One-Arm Dumbbell Row', category: 'sirt', equipment: 'bench', icon: '🛋️' },

  // Dambıl
  { name: 'Dumbbell Goblet Squat', category: 'bacak', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Romanian Deadlift', category: 'bacak', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Lunge', category: 'bacak', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Lateral Raise', category: 'omuz', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Standing Biceps Curl', category: 'kol', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Overhead Triceps Extension', category: 'kol', equipment: 'dumbbell', icon: '🏋️‍♂️' },

  // Direnç Bandı
  { name: 'Band Face Pull', category: 'omuz', equipment: 'band', icon: '🎗️' },
  { name: 'Band Lat Pulldown / Row', category: 'sirt', equipment: 'band', icon: '🎗️' },
  { name: 'Band Chest Fly', category: 'gogus', equipment: 'band', icon: '🎗️' },
  { name: 'Band Triceps Pushdown', category: 'kol', equipment: 'band', icon: '🎗️' },
  { name: 'Band Lateral Walk', category: 'bacak', equipment: 'band', icon: '🎗️' },

  // Denge Tahtası
  { name: 'Balance Board Squat', category: 'bacak', equipment: 'balance_board', icon: '🛹' },
  { name: 'Balance Board Plank Hold', category: 'core', equipment: 'balance_board', icon: '🛹' },
  { name: 'Balance Board Single-Leg Hold', category: 'core', equipment: 'balance_board', icon: '🛹' }
];

export default function HomeWorkoutModal({ isOpen, onClose, onSuccess }: HomeWorkoutModalProps) {
  const [title, setTitle] = useState('Evde Antrenman');
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Egzersizler listesi
  const [exerciseEntries, setExerciseEntries] = useState<ExerciseEntry[]>([
    {
      exercise_name: 'Incline Dumbbell Bench Press',
      category: 'gogus',
      equipment: 'bench',
      sets: [
        { set_number: 1, weight_kg: '15', reps: '12' },
        { set_number: 2, weight_kg: '17.5', reps: '10' },
        { set_number: 3, weight_kg: '20', reps: '8' }
      ]
    }
  ]);

  // Dinlenme zamanlayıcısı state'i
  const [restSeconds, setRestSeconds] = useState<number | null>(null);

  useEffect(() => {
    let timer: any = null;
    if (restSeconds !== null && restSeconds > 0) {
      timer = setInterval(() => {
        setRestSeconds(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [restSeconds]);

  if (!isOpen) return null;

  const addExercise = (presetName?: string) => {
    const selectedPreset = PRESET_EXERCISES.find(p => p.name === presetName) || PRESET_EXERCISES[0];
    setExerciseEntries([
      ...exerciseEntries,
      {
        exercise_name: selectedPreset.name,
        category: selectedPreset.category,
        equipment: selectedPreset.equipment,
        sets: [
          { set_number: 1, weight_kg: '15', reps: '10' },
          { set_number: 2, weight_kg: '15', reps: '10' }
        ]
      }
    ]);
  };

  const removeExercise = (index: number) => {
    setExerciseEntries(exerciseEntries.filter((_, i) => i !== index));
  };

  const addSet = (exIndex: number) => {
    const updated = [...exerciseEntries];
    const currentSets = updated[exIndex].sets;
    const lastSet = currentSets[currentSets.length - 1];
    updated[exIndex].sets.push({
      set_number: currentSets.length + 1,
      weight_kg: lastSet ? lastSet.weight_kg : '15',
      reps: lastSet ? lastSet.reps : '10'
    });
    setExerciseEntries(updated);
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    const updated = [...exerciseEntries];
    updated[exIndex].sets = updated[exIndex].sets.filter((_, i) => i !== setIndex);
    setExerciseEntries(updated);
  };

  const updateSetField = (exIndex: number, setIndex: number, field: 'weight_kg' | 'reps', val: string) => {
    const updated = [...exerciseEntries];
    updated[exIndex].sets[setIndex][field] = val;
    setExerciseEntries(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exerciseEntries.length === 0) {
      alert('Lütfen en az bir egzersiz ekleyin.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/health/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title,
          date: workoutDate,
          duration_minutes: Number(durationMinutes),
          notes,
          exercises: exerciseEntries
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || '🏋️ Antrenman başarıyla kaydedildi!');
        onClose();
      } else {
        alert(json.error || 'Kayıt başarısız.');
      }
    } catch {
      alert('Kayıt hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏋️‍♂️</span> Evde Antrenman & Set Kaydı
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Set Arası Kronometre / Dinlenme Barı */}
        <div style={{ background: 'var(--indigo-bg)', border: '1px solid var(--indigo)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '14px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
            <span style={{ fontSize: '18px' }}>⏱️</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Set Arası Dinlenme:</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: restSeconds !== null && restSeconds === 0 ? 'var(--rose)' : 'var(--indigo)' }}>
                {restSeconds !== null ? (restSeconds === 0 ? '🔔 DİNLENME BİTTİ!' : `${Math.floor(restSeconds / 60)} dk ${restSeconds % 60} sn`) : 'Başlatılmadı'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" onClick={() => setRestSeconds(60)} style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--indigo)', background: 'var(--indigo)', color: '#FFF', cursor: 'pointer' }}>60s</button>
            <button type="button" onClick={() => setRestSeconds(90)} style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--indigo)', background: 'var(--indigo)', color: '#FFF', cursor: 'pointer' }}>90s</button>
            <button type="button" onClick={() => setRestSeconds(120)} style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--indigo)', background: 'var(--indigo)', color: '#FFF', cursor: 'pointer' }}>120s</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Antrenman Başlığı & Tarih & Süre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Antrenman Adı / Programı:</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Örn: Göğüs & Sırt Güç Antrenmanı"
                required
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '13px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: '8px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Tarih:</label>
                <input
                  type="date"
                  value={workoutDate}
                  onChange={e => setWorkoutDate(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Süre (Dk):</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(e.target.value)}
                  placeholder="45"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>
            </div>
          </div>

          {/* Hazır Ekipman Egzersiz Hızlı Ekleme Barı */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Ekipmanlarınıza Özel Hareket Ekle:
            </label>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'thin' }}>
              {PRESET_EXERCISES.slice(0, 7).map(pe => (
                <button
                  key={pe.name}
                  type="button"
                  onClick={() => addExercise(pe.name)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  + {pe.icon} {pe.name}
                </button>
              ))}
            </div>
          </div>

          {/* Egzersizler ve Set Tabloları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {exerciseEntries.map((ex, exIndex) => (
              <div 
                key={exIndex}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)' }}>#{exIndex + 1}</span>
                    <select
                      value={ex.exercise_name}
                      onChange={e => {
                        const updated = [...exerciseEntries];
                        updated[exIndex].exercise_name = e.target.value;
                        setExerciseEntries(updated);
                      }}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 800, fontSize: '12px', width: '100%', background: 'var(--surface)', color: 'var(--text-main)' }}
                    >
                      {PRESET_EXERCISES.map(p => (
                        <option key={p.name} value={p.name}>{p.icon} {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(exIndex)}
                    style={{ background: 'none', border: 'none', color: 'var(--rose)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}
                  >
                    🗑️ Hareketi Sil
                  </button>
                </div>

                {/* Setler Tablosu */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 1fr) 28px', gap: '6px', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>
                    <span>SET</span>
                    <span>AĞIRLIK (KG)</span>
                    <span>TEKRAR</span>
                    <span></span>
                  </div>

                  {ex.sets.map((s, sIndex) => (
                    <div key={sIndex} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 1fr) 28px', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, textAlign: 'center', color: 'var(--text-muted)' }}>{s.set_number}</span>
                      <input
                        type="number"
                        step="0.5"
                        value={s.weight_kg}
                        onChange={e => updateSetField(exIndex, sIndex, 'weight_kg', e.target.value)}
                        placeholder="17.5"
                        style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '8px 6px', fontSize: '13px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--emerald)', background: 'var(--surface)', textAlign: 'center' }}
                      />
                      <input
                        type="number"
                        value={s.reps}
                        onChange={e => updateSetField(exIndex, sIndex, 'reps', e.target.value)}
                        placeholder="10"
                        style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '8px 6px', fontSize: '13px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--primary)', background: 'var(--surface)', textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeSet(exIndex, sIndex)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                        title="Seti Sil"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSet(exIndex)}
                    style={{ marginTop: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', textAlign: 'left', width: 'fit-content' }}
                  >
                    + Set Ekle
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addExercise()}
            style={{ padding: '10px', fontSize: '12px', fontWeight: 800, borderRadius: '8px', border: '1px dashed var(--primary)', background: 'var(--indigo-bg)', color: 'var(--primary)', cursor: 'pointer' }}
          >
            ➕ Yeni Egzersiz Ekle
          </button>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Antrenman Notları:</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Örn: Incline Sehpa açısı 30 dereceydi. Dambıllar zorlamadı, haftaya 22.5 kg geçilebilir."
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
            {submitting ? 'Kaydediliyor...' : '💾 Antrenmanı Günlüğe Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
