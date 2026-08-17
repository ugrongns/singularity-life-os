'use client';

import React, { useState, useRef } from 'react';

interface SmartScaleScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function SmartScaleScanModal({ isOpen, onClose, onSuccess }: SmartScaleScanModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState('');
  const [bmi, setBmi] = useState('');
  const [bodyFatPercent, setBodyFatPercent] = useState('');
  const [bodyFatMassKg, setBodyFatMassKg] = useState('');
  const [skeletalMusclePercent, setSkeletalMusclePercent] = useState('');
  const [skeletalMuscleMassKg, setSkeletalMuscleMassKg] = useState('');
  const [musclePercent, setMusclePercent] = useState('');
  const [muscleMassKg, setMuscleMassKg] = useState('');
  const [waterPercent, setWaterPercent] = useState('');
  const [waterMassKg, setWaterMassKg] = useState('');
  const [visceralFatRating, setVisceralFatRating] = useState('');
  const [boneMassKg, setBoneMassKg] = useState('');
  const [bmrCalories, setBmrCalories] = useState('');
  const [proteinPercent, setProteinPercent] = useState('');
  const [obesityDegreePercent, setObesityDegreePercent] = useState('');
  const [metabolicAge, setMetabolicAge] = useState('');
  const [fatFreeMassKg, setFatFreeMassKg] = useState('');
  const [actualAge, setActualAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX = 1800;
          if (width > height && width > MAX) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else if (height > MAX) {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.90));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const compressedBase64 = await compressImage(file);
      const res = await fetch('/api/wellness/scan-scale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: compressedBase64,
          mime_type: 'image/jpeg'
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        // Tarih normalize: DD.MM.YYYY veya DD/MM/YYYY → YYYY-MM-DD, 2025 → bugün
        if (d.measurement_date) {
          let rawDate = d.measurement_date.split(' ')[0];
          // DD.MM.YYYY veya DD/MM/YYYY formatını YYYY-MM-DD'ye çevir
          const dotMatch = rawDate.match(/^(\d{2})[.\/](\d{2})[.\/](\d{4})$/);
          if (dotMatch) {
            rawDate = `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
          } else {
            rawDate = rawDate.replace(/\//g, '-');
          }
          const today = new Date().toISOString().split('T')[0];
          // Eğer eski yıl ise (2025 vb.) bugünü kullan
          if (!rawDate.startsWith('2026')) rawDate = today;
          setMeasurementDate(rawDate);
        }
        if (d.weight_kg) setWeightKg(d.weight_kg.toString());
        if (d.bmi) setBmi(d.bmi.toString());
        if (d.body_fat_percent) setBodyFatPercent(d.body_fat_percent.toString());
        if (d.body_fat_mass_kg) setBodyFatMassKg(d.body_fat_mass_kg.toString());
        if (d.skeletal_muscle_percent) setSkeletalMusclePercent(d.skeletal_muscle_percent.toString());
        if (d.skeletal_muscle_mass_kg) setSkeletalMuscleMassKg(d.skeletal_muscle_mass_kg.toString());
        if (d.muscle_percent) setMusclePercent(d.muscle_percent.toString());
        if (d.muscle_mass_kg) setMuscleMassKg(d.muscle_mass_kg.toString());
        if (d.water_percent) setWaterPercent(d.water_percent.toString());
        if (d.water_mass_kg) setWaterMassKg(d.water_mass_kg.toString());
        if (d.visceral_fat_rating) setVisceralFatRating(d.visceral_fat_rating.toString());
        if (d.bone_mass_kg) setBoneMassKg(d.bone_mass_kg.toString());
        if (d.bmr_calories) setBmrCalories(d.bmr_calories.toString());
        if (d.protein_percent) setProteinPercent(d.protein_percent.toString());
        if (d.obesity_degree_percent) setObesityDegreePercent(d.obesity_degree_percent.toString());
        if (d.metabolic_age) setMetabolicAge(d.metabolic_age.toString());
        if (d.fat_free_mass_kg) setFatFreeMassKg(d.fat_free_mass_kg.toString());
        if (d.actual_age) setActualAge(d.actual_age.toString());
        if (d.height_cm) setHeightCm(d.height_cm.toString());

        alert('🤖 Akıllı Tartı Ekranı Taranıp Tüm Metrikler Çıkarıldı!');
      } else {
        alert(json.error || 'Ekran görüntüsünden veri okunamadı.');
      }
    } catch (err) {
      alert('Yapay zeka tarama hatası.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightKg) {
      alert('Lütfen en azından Kilo (Kg) değerini girin.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/wellness/scale-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurement_date: measurementDate,
          weight_kg: weightKg,
          bmi,
          body_fat_percent: bodyFatPercent,
          body_fat_mass_kg: bodyFatMassKg,
          skeletal_muscle_percent: skeletalMusclePercent,
          skeletal_muscle_mass_kg: skeletalMuscleMassKg,
          muscle_percent: musclePercent,
          muscle_mass_kg: muscleMassKg,
          water_percent: waterPercent,
          water_mass_kg: waterMassKg,
          visceral_fat_rating: visceralFatRating,
          bone_mass_kg: boneMassKg,
          bmr_calories: bmrCalories,
          protein_percent: proteinPercent,
          obesity_degree_percent: obesityDegreePercent,
          metabolic_age: metabolicAge,
          fat_free_mass_kg: fatFreeMassKg,
          actual_age: actualAge,
          height_cm: heightCm,
          notes
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message);
        onClose();
      } else {
        alert(json.error || 'Kayıt hatası.');
      }
    } catch (err) {
      alert('İşlem başarısız.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>
        <div style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚖️</span> Akıllı Tartı Ölçümü Ekle
        </div>

        {/* AI Tarama Butonu */}
        <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', textAlign: 'center', marginTop: '10px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Akıllı tartı uygulamanızın (Xiaomi, Huawei, Anker vb.) ekran görüntüsünü yükleyin; tüm biyo-impeditif metrikler otomatik okunsun.
          </p>

          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />

          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isScanning}
            style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>📸</span>
            <span>{isScanning ? 'YAPAY ZEKÂ METRİKLERİ OKUYOR...' : 'AKILLI TARTI EKRAN GÖRÜNTÜSÜ TARA (AI)'}</span>
          </button>
        </div>

        {/* Manuel Form / AI Tarafından Doldurulan Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Ölçüm Tarihi:</label>
              <input type="date" value={measurementDate} onChange={e => setMeasurementDate(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '2px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Ağırlık (Kg): *</label>
              <input type="number" step="0.01" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="Örn: 84.65" required style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 800, color: '#10B981', marginTop: '2px' }} />
            </div>
          </div>

          <div style={{ fontWeight: 800, fontSize: '13px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '4px', color: 'var(--text-main)' }}>
            📊 Vücut Kompozisyonu Metrikleri
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BMI:</label>
              <input type="number" step="0.1" value={bmi} onChange={e => setBmi(e.target.value)} placeholder="27.6" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Yağ (%):</label>
              <input type="number" step="0.1" value={bodyFatPercent} onChange={e => setBodyFatPercent(e.target.value)} placeholder="26.1" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vücut Yağ (Kg):</label>
              <input type="number" step="0.1" value={bodyFatMassKg} onChange={e => setBodyFatMassKg(e.target.value)} placeholder="22.1" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>İskelet Kası (%):</label>
              <input type="number" step="0.1" value={skeletalMusclePercent} onChange={e => setSkeletalMusclePercent(e.target.value)} placeholder="38.8" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>İskelet Kası (Kg):</label>
              <input type="number" step="0.1" value={skeletalMuscleMassKg} onChange={e => setSkeletalMuscleMassKg(e.target.value)} placeholder="32.8" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kas (%):</label>
              <input type="number" step="0.1" value={musclePercent} onChange={e => setMusclePercent(e.target.value)} placeholder="70.4" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kas Ağırlığı (Kg):</label>
              <input type="number" step="0.1" value={muscleMassKg} onChange={e => setMuscleMassKg(e.target.value)} placeholder="59.6" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Su (%):</label>
              <input type="number" step="0.1" value={waterPercent} onChange={e => setWaterPercent(e.target.value)} placeholder="52.9" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sıvı Ağırlığı (Kg):</label>
              <input type="number" step="0.1" value={waterMassKg} onChange={e => setWaterMassKg(e.target.value)} placeholder="44.8" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700 }}>V-Yağ (İç Organ):</label>
              <input type="number" step="0.1" value={visceralFatRating} onChange={e => setVisceralFatRating(e.target.value)} placeholder="14.5" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kemik Kütlesi (Kg):</label>
              <input type="number" step="0.01" value={boneMassKg} onChange={e => setBoneMassKg(e.target.value)} placeholder="2.87" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Metabolizma (kcal):</label>
              <input type="number" step="1" value={bmrCalories} onChange={e => setBmrCalories(e.target.value)} placeholder="1771" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Protein (%):</label>
              <input type="number" step="0.1" value={proteinPercent} onChange={e => setProteinPercent(e.target.value)} placeholder="17.5" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Obezite Derecesi (%):</label>
              <input type="number" step="0.1" value={obesityDegreePercent} onChange={e => setObesityDegreePercent(e.target.value)} placeholder="27.3" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Metabolik Yaş:</label>
              <input type="number" step="1" value={metabolicAge} onChange={e => setMetabolicAge(e.target.value)} placeholder="43" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Yağsız Ağırlık (Kg):</label>
              <input type="number" step="0.01" value={fatFreeMassKg} onChange={e => setFatFreeMassKg(e.target.value)} placeholder="62.53" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Gerçek Yaş:</label>
              <input type="number" value={actualAge} onChange={e => setActualAge(e.target.value)} placeholder="39" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Boy (cm):</label>
              <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={isSaving} style={{ padding: '12px', marginTop: '6px', fontWeight: 800 }}>
            {isSaving ? 'Kaydediliyor...' : '💾 Ölçüm Verilerini Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
