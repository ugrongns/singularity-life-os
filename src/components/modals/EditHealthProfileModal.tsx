'use client';
import { useState } from 'react';

interface HealthProfile {
  daily_calorie_target: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
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
  const [calorieTarget, setCalorieTarget] = useState(String(profile?.daily_calorie_target || 2200));
  const [proteinTarget, setProteinTarget] = useState(String(profile?.target_protein_g || 140));
  const [carbsTarget, setCarbsTarget] = useState(String(profile?.target_carbs_g || 180));
  const [fatTarget, setFatTarget] = useState(String(profile?.target_fat_g || 65));
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

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
          target_fat_g: Number(fatTarget)
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
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            ⚙️ Günlük Kalori & Makro Hedeflerini Düzenle
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>GÜNLÜK KALORİ HEDEFİ (KCAL) *</label>
            <input
              type="number"
              placeholder="Ör. 1800 (Diyet) veya 2500 (Bulking)"
              value={calorieTarget}
              onChange={e => setCalorieTarget(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PROTEİN (G) *</label>
              <input
                type="number"
                value={proteinTarget}
                onChange={e => setProteinTarget(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KARB (G) *</label>
              <input
                type="number"
                value={carbsTarget}
                onChange={e => setCarbsTarget(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>YAĞ (G) *</label>
              <input
                type="number"
                value={fatTarget}
                onChange={e => setFatTarget(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '8px 10px', borderRadius: '6px' }}>
            💡 <strong>İpucu:</strong> Hedeflerinizi yaşam tarzınıza (kilo verme, koruma, kas kütlesi artırma) göre dilediğiniz zaman esnekçe güncelleyebilirsiniz.
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : '💾 Hedefleri Güncelle'}
          </button>
        </form>
      </div>
    </div>
  );
}
