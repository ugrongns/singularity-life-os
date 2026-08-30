'use client';
import { useState } from 'react';

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddMealModal({ isOpen, onClose, onSuccess }: AddMealModalProps) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [calories, setCalories] = useState('450');
  const [proteinG, setProteinG] = useState('35');
  const [carbsG, setCarbsG] = useState('40');
  const [fatG, setFatG] = useState('15');
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
          action: 'add_meal',
          name,
          meal_type: mealType,
          calories: Number(calories),
          protein_g: Number(proteinG),
          carbs_g: Number(carbsG),
          fat_g: Number(fatG)
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || '🥗 Öğün eklendi!');
        onClose();
      } else {
        alert(json.error || 'İşlem başarısız.');
      }
    } catch {
      alert('Kayıt hatası.');
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
            ✍️ Manuel Öğün Ekle
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>YEMEK ADI *</label>
            <input
              type="text"
              placeholder="Ör. Izgara Tavuklu Salata, Yulaf Lapası, Izgara Köfte"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ÖĞÜN TÜRÜ *</label>
            <select
              value={mealType}
              onChange={e => setMealType(e.target.value)}
              style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
            >
              <option value="breakfast">🌅 Kahvaltı</option>
              <option value="lunch">☀️ Öğle Yemeği</option>
              <option value="dinner">🌙 Akşam Yemeği</option>
              <option value="snack">🍎 Ara Öğün / Atıştırmalık</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KALORİ (KCAL) *</label>
              <input
                type="number"
                value={calories}
                onChange={e => setCalories(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PROTEİN (GRAM) *</label>
              <input
                type="number"
                value={proteinG}
                onChange={e => setProteinG(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KARBONHİDRAT (GRAM)</label>
              <input
                type="number"
                value={carbsG}
                onChange={e => setCarbsG(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>YAĞ (GRAM)</label>
              <input
                type="number"
                value={fatG}
                onChange={e => setFatG(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : '🥗 Öğünü Beslenmeye Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
