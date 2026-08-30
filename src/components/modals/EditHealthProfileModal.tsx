'use client';

import React, { useState, useEffect } from 'react';

interface HealthProfile {
  daily_calorie_target: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  daily_water_target_ml?: number;
}

interface EditHealthProfileModalProps {
  isOpen: boolean;
  profile?: HealthProfile | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function EditHealthProfileModal({
  isOpen,
  profile,
  onClose,
  onSuccess
}: EditHealthProfileModalProps) {
  const [calorieTarget, setCalorieTarget] = useState(String(profile?.daily_calorie_target || 2000));
  const [proteinTarget, setProteinTarget] = useState(String(profile?.target_protein_g || 150));
  const [carbsTarget, setCarbsTarget] = useState(String(profile?.target_carbs_g || 200));
  const [fatTarget, setFatTarget] = useState(String(profile?.target_fat_g || 65));
  const [waterTarget, setWaterTarget] = useState(String(profile?.daily_water_target_ml || 2500));
  const [submitting, setSubmitting] = useState(false);

  // Profile değiştiğinde state'leri senkronize et
  useEffect(() => {
    if (profile) {
      setCalorieTarget(String(profile.daily_calorie_target || 2000));
      setProteinTarget(String(profile.target_protein_g || 150));
      setCarbsTarget(String(profile.target_carbs_g || 200));
      setFatTarget(String(profile.target_fat_g || 65));
      setWaterTarget(String(profile.daily_water_target_ml || 2500));
    }
  }, [profile]);

  if (!isOpen) return null;

  const pG = Math.max(0, Number(proteinTarget) || 0);
  const cG = Math.max(0, Number(carbsTarget) || 0);
  const fG = Math.max(0, Number(fatTarget) || 0);

  const pCals = pG * 4;
  const cCals = cG * 4;
  const fCals = fG * 9;
  const totalCalculatedCals = pCals + cCals + fCals;

  const pPct = totalCalculatedCals > 0 ? Math.round((pCals / totalCalculatedCals) * 100) : 0;
  const cPct = totalCalculatedCals > 0 ? Math.round((cCals / totalCalculatedCals) * 100) : 0;
  const fPct = totalCalculatedCals > 0 ? Math.round((fCals / totalCalculatedCals) * 100) : 0;

  // YÖN 1: Makrolar Değiştiğinde Kaloriyi Güncelle (Atwater Standart: P*4 + C*4 + F*9)
  const handleProteinChange = (val: string) => {
    setProteinTarget(val);
    const newP = Math.max(0, Number(val) || 0);
    const newTotal = (newP * 4) + (cG * 4) + (fG * 9);
    setCalorieTarget(String(newTotal));
  };

  const handleCarbsChange = (val: string) => {
    setCarbsTarget(val);
    const newC = Math.max(0, Number(val) || 0);
    const newTotal = (pG * 4) + (newC * 4) + (fG * 9);
    setCalorieTarget(String(newTotal));
  };

  const handleFatChange = (val: string) => {
    setFatTarget(val);
    const newF = Math.max(0, Number(val) || 0);
    const newTotal = (pG * 4) + (cG * 4) + (newF * 9);
    setCalorieTarget(String(newTotal));
  };

  // YÖN 2: Kalori Değiştiğinde Makroları Oransal Ölçekle (Kalori ➔ Makro)
  const handleCalorieChange = (val: string) => {
    setCalorieTarget(val);
    const newCals = Math.max(0, Number(val) || 0);
    if (newCals === 0) return;

    // Mevcut makro oranlarını al veya varsayılan %30 P / %40 K / %30 Y kullan
    const pRatio = totalCalculatedCals > 0 ? pCals / totalCalculatedCals : 0.30;
    const cRatio = totalCalculatedCals > 0 ? cCals / totalCalculatedCals : 0.40;
    const fRatio = totalCalculatedCals > 0 ? fCals / totalCalculatedCals : 0.30;

    const newP = Math.round((newCals * pRatio) / 4);
    const newC = Math.round((newCals * cRatio) / 4);
    const newF = Math.round((newCals * fRatio) / 9);

    setProteinTarget(String(newP));
    setCarbsTarget(String(newC));
    setFatTarget(String(newF));
  };

  // Makro Dağılım Şablonları (Presets)
  const applyPreset = (pRatio: number, cRatio: number, fRatio: number) => {
    const targetCals = Number(calorieTarget) || 2000;
    const newP = Math.round((targetCals * pRatio) / 4);
    const newC = Math.round((targetCals * cRatio) / 4);
    const newF = Math.round((targetCals * fRatio) / 9);

    setProteinTarget(String(newP));
    setCarbsTarget(String(newC));
    setFatTarget(String(newF));
    setCalorieTarget(String((newP * 4) + (newC * 4) + (newF * 9)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/health/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          daily_calorie_target: Number(calorieTarget),
          target_protein_g: Number(proteinTarget),
          target_carbs_g: Number(carbsTarget),
          target_fat_g: Number(fatTarget),
          daily_water_target_ml: Number(waterTarget) || 2500
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || '⚙️ Hedefler güncellendi!');
        onClose();
      } else {
        alert(json.error || 'İşlem başarısız.');
      }
    } catch {
      alert('Güncelleme hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🧮</span> Günlük Kalori, Makro & Su Hedefleri
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Canlı Hesaplanan Makro Dağılım Çubuğu */}
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Makro Dağılım Oranları (Atwater Standards):</span>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#10B981' }}>{totalCalculatedCals} kcal</span>
          </div>

          <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '2px', background: 'var(--border)' }}>
            <div style={{ width: `${pPct}%`, background: '#3B82F6', transition: 'width 0.3s' }} title={`Protein: %${pPct}`} />
            <div style={{ width: `${cPct}%`, background: '#F59E0B', transition: 'width 0.3s' }} title={`Karbonhidrat: %${cPct}`} />
            <div style={{ width: `${fPct}%`, background: '#EF4444', transition: 'width 0.3s' }} title={`Yağ: %${fPct}`} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginTop: '8px' }}>
            <span style={{ color: '#3B82F6' }}>🥩 Protein: %{pPct} ({pCals} kcal)</span>
            <span style={{ color: '#F59E0B' }}>🌾 Karb: %{cPct} ({cCals} kcal)</span>
            <span style={{ color: '#EF4444' }}>🥑 Yağ: %{fPct} ({fCals} kcal)</span>
          </div>
        </div>

        {/* Hazır Makro Dağılım Butonları */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
            Hazır Makro Şablonu Uygula:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <button
              type="button"
              onClick={() => applyPreset(0.40, 0.40, 0.20)}
              style={{ padding: '6px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer' }}
            >
              🏋️ Sporcu (%40/%40/%20)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(0.30, 0.40, 0.30)}
              style={{ padding: '6px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer' }}
            >
              ⚖️ Dengeli (%30/%40/%30)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(0.25, 0.05, 0.70)}
              style={{ padding: '6px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer' }}
            >
              🥑 Keto (%25/%5/%70)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Kalori Girişi (Yön 2: Kalori ➔ Makro) */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>GÜNLÜK KALORİ HEDEFİ (KCAL) *</span>
              <span style={{ color: '#10B981', fontSize: '10px' }}>🔄 Çift Yönlü Canlı Sync</span>
            </label>
            <input
              type="number"
              placeholder="Ör. 2000"
              value={calorieTarget}
              onChange={e => handleCalorieChange(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '15px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', color: '#10B981' }}
            />
          </div>

          {/* Makro Gramaj Girişleri (Yön 1: Makro ➔ Kalori) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#3B82F6', fontWeight: 800 }}>PROTEİN (G) *</label>
              <input
                type="number"
                value={proteinTarget}
                onChange={e => handleProteinChange(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', fontWeight: 800, border: '1px solid #3B82F6', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>1g = 4 kcal</div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 800 }}>KARB (G) *</label>
              <input
                type="number"
                value={carbsTarget}
                onChange={e => handleCarbsChange(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', fontWeight: 800, border: '1px solid #F59E0B', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>1g = 4 kcal</div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#EF4444', fontWeight: 800 }}>YAĞ (G) *</label>
              <input
                type="number"
                value={fatTarget}
                onChange={e => handleFatChange(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', fontWeight: 800, border: '1px solid #EF4444', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>1g = 9 kcal</div>
            </div>
          </div>

          {/* 💧 Günlük Su Tüketim Hedefi Bölümü */}
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>💧</span> GÜNLÜK SU TÜKETİM HEDEFİ (ML) *
              </label>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>
                {waterTarget} ml ({Math.round(Number(waterTarget) / 250)} Bardak)
              </span>
            </div>

            {/* Hızlı Su Şablon Butonları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
              {[
                { ml: 2000, label: '2.000 ml' },
                { ml: 2500, label: '2.500 ml' },
                { ml: 3000, label: '3.000 ml' },
                { ml: 3500, label: '3.500 ml' }
              ].map(w => (
                <button
                  key={w.ml}
                  type="button"
                  onClick={() => setWaterTarget(String(w.ml))}
                  style={{
                    padding: '6px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: `1px solid ${Number(waterTarget) === w.ml ? 'var(--primary)' : 'var(--border)'}`,
                    background: Number(waterTarget) === w.ml ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface)',
                    color: Number(waterTarget) === w.ml ? 'var(--primary)' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={500}
              max={10000}
              step={50}
              value={waterTarget}
              onChange={e => setWaterTarget(e.target.value)}
              required
              style={{ width: '100%', padding: '9px', fontSize: '13px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}
            />
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '8px 10px', borderRadius: '6px' }}>
            💡 <strong>Atwater Standardı:</strong> Makroları değiştirdiğinizde toplam kalori otomatik güncellenir. Kaloriyi değiştirdiğinizde makro oranlarınız korunarak gramajlar hesaplanır.
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : '💾 Hedefleri Güncelle'}
          </button>
        </form>
      </div>
    </div>
  );
}


