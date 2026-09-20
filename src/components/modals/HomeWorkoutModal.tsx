'use client';

import React, { useState, useEffect, useRef } from 'react';

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

type SportType = 'cycling' | 'running' | 'walking' | 'swimming' | 'strength' | 'hiit' | 'other';

const SPORTS: { type: SportType; label: string; icon: string }[] = [
  { type: 'cycling', label: 'Bisiklet', icon: '🚴' },
  { type: 'running', label: 'Koşu', icon: '🏃' },
  { type: 'walking', label: 'Yürüyüş', icon: '🚶' },
  { type: 'swimming', label: 'Yüzme', icon: '🏊' },
  { type: 'strength', label: 'Kuvvet', icon: '🏋️' },
  { type: 'hiit', label: 'Kardiyo / Diğer', icon: '⚡' },
];

const PRESET_EXERCISES = [
  { name: 'Incline Dumbbell Bench Press', category: 'gogus', equipment: 'bench', icon: '🛋️' },
  { name: 'Flat Dumbbell Bench Press', category: 'gogus', equipment: 'bench', icon: '🛋️' },
  { name: 'Dumbbell Fly', category: 'gogus', equipment: 'bench', icon: '🛋️' },
  { name: 'Seated Dumbbell Shoulder Press', category: 'omuz', equipment: 'bench', icon: '🛋️' },
  { name: 'Incline Dumbbell Biceps Curl', category: 'kol', equipment: 'bench', icon: '🛋️' },
  { name: 'One-Arm Dumbbell Row', category: 'sirt', equipment: 'bench', icon: '🛋️' },
  { name: 'Dumbbell Goblet Squat', category: 'bacak', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Romanian Deadlift', category: 'bacak', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Lunge', category: 'bacak', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Dumbbell Lateral Raise', category: 'omuz', equipment: 'dumbbell', icon: '🏋️‍♂️' },
  { name: 'Band Face Pull', category: 'omuz', equipment: 'band', icon: '🎗️' },
  { name: 'Band Lat Pulldown / Row', category: 'sirt', equipment: 'band', icon: '🎗️' },
  { name: 'Balance Board Squat', category: 'bacak', equipment: 'balance_board', icon: '🛹' }
];

export default function HomeWorkoutModal({ isOpen, onClose, onSuccess }: HomeWorkoutModalProps) {
  const [sportType, setSportType] = useState<SportType>('cycling');
  const [title, setTitle] = useState('Bisiklet Antrenmanı');
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationInput, setDurationInput] = useState('45:00');
  const [distanceKm, setDistanceKm] = useState('');
  const [calories, setCalories] = useState('');
  const [avgSpeedKmh, setAvgSpeedKmh] = useState('');
  const [maxSpeedKmh, setMaxSpeedKmh] = useState('');
  const [avgPace, setAvgPace] = useState('');
  const [avgHeartRate, setAvgHeartRate] = useState('');
  const [maxHeartRate, setMaxHeartRate] = useState('');
  const [vo2Max, setVo2Max] = useState('');
  const [elevationGainM, setElevationGainM] = useState('');
  const [stepCount, setStepCount] = useState('');
  const [cadenceSpm, setCadenceSpm] = useState('');
  const [sweatLossMl, setSweatLossMl] = useState('');
  
  // Yüzme alanları
  const [swimPoolLengthM, setSwimPoolLengthM] = useState('25');
  const [swimTotalLengths, setSwimTotalLengths] = useState('');
  const [swimStrokeCount, setSwimStrokeCount] = useState('');
  const [swimAvgSwolf, setSwimAvgSwolf] = useState('');
  const [swimStyle, setSwimStyle] = useState('Serbest stil');

  // Ham telemetri verileri (JSON)
  const [heartRateZones, setHeartRateZones] = useState<any>(null);
  const [splitsData, setSplitsData] = useState<any>(null);
  const [runningDynamics, setRunningDynamics] = useState<any>(null);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kuvvet egzersizleri
  const [exerciseEntries, setExerciseEntries] = useState<ExerciseEntry[]>([
    {
      exercise_name: 'Incline Dumbbell Bench Press',
      category: 'gogus',
      equipment: 'bench',
      sets: [
        { set_number: 1, weight_kg: '15', reps: '12' },
        { set_number: 2, weight_kg: '17.5', reps: '10' }
      ]
    }
  ]);

  // Dinlenme sayacı
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

  // Spor türü değiştikçe varsayılan başlığı ayarla
  const handleSportChange = (type: SportType) => {
    setSportType(type);
    const titles: Record<SportType, string> = {
      cycling: 'Bisiklet Sürüşü',
      running: 'Koşu Antrenmanı',
      walking: 'Açık Hava Yürüyüşü',
      swimming: 'Havuzda Yüzme',
      strength: 'Evde Kuvvet Antrenmanı',
      hiit: 'Kardiyo / HIIT',
      other: 'Antrenman'
    };
    setTitle(titles[type] || 'Antrenman');
  };

  // Ekran görüntüsü OCR yükleme işleyicisi
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setScanning(true);
    setScanMessage(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('/api/health/workouts/ocr', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (json.success && json.data) {
        const d = json.data;
        if (d.sport_type && SPORTS.some(s => s.type === d.sport_type)) {
          setSportType(d.sport_type as SportType);
        }
        if (d.title) setTitle(d.title);
        if (d.date) setWorkoutDate(d.date);
        if (d.duration_text) {
          setDurationInput(d.duration_text);
        } else if (d.duration_minutes) {
          setDurationInput(`${Math.round(Number(d.duration_minutes))}:00`);
        }
        if (d.distance_km !== undefined) setDistanceKm(String(d.distance_km));
        if (d.calories !== undefined) setCalories(String(d.calories));
        if (d.avg_speed_kmh !== undefined) setAvgSpeedKmh(String(d.avg_speed_kmh));
        if (d.max_speed_kmh !== undefined) setMaxSpeedKmh(String(d.max_speed_kmh));
        if (d.avg_pace) setAvgPace(d.avg_pace);
        if (d.avg_heart_rate !== undefined) setAvgHeartRate(String(d.avg_heart_rate));
        if (d.max_heart_rate !== undefined) setMaxHeartRate(String(d.max_heart_rate));
        if (d.vo2_max !== undefined) setVo2Max(String(d.vo2_max));
        if (d.elevation_gain_m !== undefined) setElevationGainM(String(d.elevation_gain_m));
        if (d.step_count !== undefined) setStepCount(String(d.step_count));
        if (d.cadence_spm !== undefined) setCadenceSpm(String(d.cadence_spm));
        if (d.sweat_loss_ml !== undefined) setSweatLossMl(String(d.sweat_loss_ml));

        // Yüzme alanları
        if (d.swim_pool_length_m !== undefined) setSwimPoolLengthM(String(d.swim_pool_length_m));
        if (d.swim_total_lengths !== undefined) setSwimTotalLengths(String(d.swim_total_lengths));
        if (d.swim_stroke_count !== undefined) setSwimStrokeCount(String(d.swim_stroke_count));
        if (d.swim_avg_swolf !== undefined) setSwimAvgSwolf(String(d.swim_avg_swolf));
        if (d.swim_style) setSwimStyle(d.swim_style);

        // Telemetri
        if (d.heart_rate_zones) setHeartRateZones(d.heart_rate_zones);
        if (d.splits_data) setSplitsData(d.splits_data);
        if (d.running_dynamics) setRunningDynamics(d.running_dynamics);

        setScanMessage(`✨ ${d.device_source || 'Akıllı Saat'} ekran görüntüsü başarıyla ayrıştırıldı ve forma aktarıldı!`);
      } else {
        alert(json.error || 'Görsel analiz edilemedi.');
      }
    } catch (err) {
      console.error(err);
      alert('Görsel yükleme ve analiz hatası.');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sportType === 'strength' && exerciseEntries.length === 0) {
      alert('Lütfen en az bir egzersiz ekleyin.');
      return;
    }

    const parseNum = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      const cleaned = String(val).replace(',', '.').trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? null : n;
    };

    const parseIntNum = (val: any): number | null => {
      const n = parseNum(val);
      return n !== null ? Math.round(n) : null;
    };

    setSubmitting(true);
    try {
      const distVal = parseNum(distanceKm) ?? 0;
      const distMeters = sportType === 'swimming'
        ? distVal
        : (distVal > 0 ? Math.round(distVal * 1000) : null);
      const distKm = sportType === 'swimming'
        ? Number((distVal / 1000).toFixed(3))
        : distVal;
      const formattedDist = distanceKm
        ? (sportType === 'swimming' ? `${distVal} m` : `${distVal} km`)
        : null;

      const payload: any = {
        action: 'create',
        sport_type: sportType,
        title,
        date: workoutDate,
        duration_minutes: durationInput,
        formatted_duration: durationInput,
        distance_km: distKm,
        distance_meters: distMeters,
        formatted_distance: formattedDist,
        calories: parseNum(calories) ?? 0,
        avg_speed_kmh: parseNum(avgSpeedKmh),
        max_speed_kmh: parseNum(maxSpeedKmh),
        avg_pace: avgPace || null,
        avg_heart_rate: parseIntNum(avgHeartRate),
        max_heart_rate: parseIntNum(maxHeartRate),
        vo2_max: parseNum(vo2Max),
        elevation_gain_m: parseNum(elevationGainM),
        step_count: parseIntNum(stepCount),
        cadence_spm: parseIntNum(cadenceSpm),
        sweat_loss_ml: parseIntNum(sweatLossMl),
        swim_pool_length_m: sportType === 'swimming' ? parseIntNum(swimPoolLengthM) : null,
        swim_total_lengths: sportType === 'swimming' ? parseIntNum(swimTotalLengths) : null,
        swim_stroke_count: sportType === 'swimming' ? parseIntNum(swimStrokeCount) : null,
        swim_avg_swolf: sportType === 'swimming' ? parseIntNum(swimAvgSwolf) : null,
        swim_style: sportType === 'swimming' ? swimStyle : null,
        heart_rate_zones: heartRateZones,
        splits_data: splitsData,
        running_dynamics: runningDynamics,
        notes,
        exercises: sportType === 'strength' ? exerciseEntries : []
      };

      const res = await fetch('/api/health/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        let msg = json.message || '🏅 Antrenman başarıyla kaydedildi!';
        if (json.sweat_loss_ml) {
          msg += ` (💧 ${json.sweat_loss_ml} ml ter kaybı hidrasyon hedefinize eklendi)`;
        }
        onSuccess(msg);
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
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        {/* Modal Başlık Satırı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏅</span> Antrenman Kaydet & Tara
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* 📸 AI Vision Ekran Görüntüsü Yükleme Bandı */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px dashed var(--indigo)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📸</span> Akıllı Saat / Samsung Health Ekran Görüntüsü Yükle
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Ekran görüntüsünü yükleyin; süre, mesafe, nabız, kalori ve turlar otomatik dolsun.
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              multiple
              style={{ display: 'none' }}
            />

            <button
              type="button"
              disabled={scanning}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '8px',
                border: '1px solid var(--indigo)',
                background: 'var(--indigo)',
                color: '#FFF',
                cursor: scanning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {scanning ? '⏳ Taranıyor...' : '⚡ Görsel Seç & Tara'}
            </button>
          </div>

          {scanMessage && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--emerald)', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
              {scanMessage}
            </div>
          )}
        </div>

        {/* Spor Türü Seçici Sekmeler */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '12px', scrollbarWidth: 'thin' }}>
          {SPORTS.map(s => {
            const isActive = sportType === s.type;
            return (
              <button
                key={s.type}
                type="button"
                onClick={() => handleSportChange(s.type)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: isActive ? 'var(--indigo-bg)' : 'var(--surface-subtle)',
                  color: isActive ? 'var(--primary)' : 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Antrenman Adı & Tarih */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Antrenman Başlığı:</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '13px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: '8px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Tarih:</label>
              <input
                type="date"
                value={workoutDate}
                onChange={e => setWorkoutDate(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          {/* Dinamik Metrik Alanları (Kardiyo / Bisiklet / Koşu / Yürüyüş / Yüzme) */}
          {sportType !== 'strength' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Performans & Telemetri Metrikleri
              </div>

              {/* Süre, Mesafe, Kalori */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>⏱️ Süre (Örn: 46:24):</label>
                  <input
                    type="text"
                    value={durationInput}
                    onChange={e => setDurationInput(e.target.value)}
                    placeholder="46:24"
                    required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {sportType === 'swimming' ? '🏊 Mesafe (Metre):' : '📍 Mesafe (Km):'}
                  </label>
                  <input
                    type="number"
                    step={sportType === 'swimming' ? '1' : '0.01'}
                    value={distanceKm}
                    onChange={e => setDistanceKm(e.target.value)}
                    placeholder={sportType === 'swimming' ? '425' : '9.70'}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--emerald)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>🔥 Kalori (kcal):</label>
                  <input
                    type="number"
                    value={calories}
                    onChange={e => setCalories(e.target.value)}
                    placeholder="350"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--rose)' }}
                  />
                </div>
              </div>

              {/* Hız, Pace, Nabız */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>⚡ Ort. Hız (km/sa):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={avgSpeedKmh}
                    onChange={e => setAvgSpeedKmh(e.target.value)}
                    placeholder="15.2"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {sportType === 'swimming' ? '⏱️ Pace (/100m):' : '⏱️ Pace (/km):'}
                  </label>
                  <input
                    type="text"
                    value={avgPace}
                    onChange={e => setAvgPace(e.target.value)}
                    placeholder={sportType === 'swimming' ? "05'13\" /100 m" : "04'30\" /km"}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>❤️ Ort. Nabız (BPM):</label>
                  <input
                    type="number"
                    value={avgHeartRate}
                    onChange={e => setAvgHeartRate(e.target.value)}
                    placeholder="128"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              {/* Yüzmeye Özel Alanlar */}
              {sportType === 'swimming' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Havuz Boyu:</label>
                    <select
                      value={swimPoolLengthM}
                      onChange={e => setSwimPoolLengthM(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    >
                      <option value="25">25 Metre</option>
                      <option value="50">50 Metre</option>
                      <option value="0">Açık Su</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Toplam Tur:</label>
                    <input
                      type="number"
                      value={swimTotalLengths}
                      onChange={e => setSwimTotalLengths(e.target.value)}
                      placeholder="17"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Toplam Kulaç:</label>
                    <input
                      type="number"
                      value={swimStrokeCount}
                      onChange={e => setSwimStrokeCount(e.target.value)}
                      placeholder="464"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SWOLF Skoru:</label>
                    <input
                      type="number"
                      value={swimAvgSwolf}
                      onChange={e => setSwimAvgSwolf(e.target.value)}
                      placeholder="105"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
              )}

              {/* Koşu & Yürüyüşe Özel Alanlar (Adım, Ter Kaybı, VO2 Max) */}
              {(sportType === 'running' || sportType === 'walking' || sportType === 'cycling') && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                  {(sportType === 'running' || sportType === 'walking') && (
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>👟 Adım Sayısı:</label>
                      <input
                        type="number"
                        value={stepCount}
                        onChange={e => setStepCount(e.target.value)}
                        placeholder="6476"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                      />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>🫁 VO2 Max:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vo2Max}
                      onChange={e => setVo2Max(e.target.value)}
                      placeholder="39.6"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>💧 Ter Kaybı (ml):</label>
                    <input
                      type="number"
                      value={sweatLossMl}
                      onChange={e => setSweatLossMl(e.target.value)}
                      placeholder="244"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>⛰️ Tırmanış (m):</label>
                    <input
                      type="number"
                      value={elevationGainM}
                      onChange={e => setElevationGainM(e.target.value)}
                      placeholder="340"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Kuvvet / Ağırlık Alanları */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Dinlenme Barı */}
              <div style={{ background: 'var(--indigo-bg)', border: '1px solid var(--indigo)', padding: '10px 14px', borderRadius: 'var(--radius-md)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
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

              {/* Egzersiz Listesi */}
              {exerciseEntries.map((ex, exIndex) => (
                <div 
                  key={exIndex}
                  style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
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
                      onClick={() => setExerciseEntries(exerciseEntries.filter((_, i) => i !== exIndex))}
                      style={{ background: 'none', border: 'none', color: 'var(--rose)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Setler */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {ex.sets.map((s, sIndex) => (
                      <div key={sIndex} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 1fr) 28px', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, textAlign: 'center', color: 'var(--text-muted)' }}>{s.set_number}</span>
                        <input
                          type="number"
                          step="0.5"
                          value={s.weight_kg}
                          onChange={e => {
                            const updated = [...exerciseEntries];
                            updated[exIndex].sets[sIndex].weight_kg = e.target.value;
                            setExerciseEntries(updated);
                          }}
                          placeholder="Ağırlık (kg)"
                          style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '6px', fontSize: '12px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--emerald)', background: 'var(--surface)', textAlign: 'center' }}
                        />
                        <input
                          type="number"
                          value={s.reps}
                          onChange={e => {
                            const updated = [...exerciseEntries];
                            updated[exIndex].sets[sIndex].reps = e.target.value;
                            setExerciseEntries(updated);
                          }}
                          placeholder="Tekrar"
                          style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '6px', fontSize: '12px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--primary)', background: 'var(--surface)', textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...exerciseEntries];
                            updated[exIndex].sets = updated[exIndex].sets.filter((_, i) => i !== sIndex);
                            setExerciseEntries(updated);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...exerciseEntries];
                        const lastSet = updated[exIndex].sets[updated[exIndex].sets.length - 1];
                        updated[exIndex].sets.push({
                          set_number: updated[exIndex].sets.length + 1,
                          weight_kg: lastSet ? lastSet.weight_kg : '15',
                          reps: lastSet ? lastSet.reps : '10'
                        });
                        setExerciseEntries(updated);
                      }}
                      style={{ marginTop: '4px', padding: '5px 8px', fontSize: '11px', fontWeight: 800, borderRadius: '6px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', width: 'fit-content' }}
                    >
                      + Set Ekle
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setExerciseEntries([...exerciseEntries, { exercise_name: PRESET_EXERCISES[0].name, category: PRESET_EXERCISES[0].category, equipment: PRESET_EXERCISES[0].equipment, sets: [{ set_number: 1, weight_kg: '15', reps: '10' }] }])}
                style={{ padding: '8px', fontSize: '12px', fontWeight: 800, borderRadius: '8px', border: '1px dashed var(--primary)', background: 'var(--indigo-bg)', color: 'var(--primary)', cursor: 'pointer' }}
              >
                ➕ Yeni Hareket Ekle
              </button>
            </div>
          )}

          {/* Notlar */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Notlar & Değerlendirme:</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Örn: Göksu Parkı parkuru rahattı. Rüzgar hafifti, ortalama tempo korundu."
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{ padding: '12px', fontSize: '14px', fontWeight: 800, background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', marginTop: '4px' }}
          >
            {submitting ? 'Kaydediliyor...' : '💾 Antrenmanı Günlüğe Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
