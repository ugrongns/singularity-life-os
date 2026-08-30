'use client';
import { useState } from 'react';

interface Supplement {
  id?: string;
  name: string;
  dose: string;
  timing: string;
  frequency_type?: string;
  interval_days?: number;
  total_pills?: number;
  remaining_pills?: number;
  notes?: string;
}

interface AddSupplementModalProps {
  isOpen: boolean;
  item?: Supplement | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddSupplementModal({ isOpen, item, onClose, onSuccess }: AddSupplementModalProps) {
  const isEditing = Boolean(item?.id);
  const [name, setName] = useState(item?.name || '');
  const [dose, setDose] = useState(item?.dose || '1000 mg');
  const [timing, setTiming] = useState(item?.timing || 'morning');
  const [frequencyType, setFrequencyType] = useState(item?.frequency_type || 'daily');
  const [intervalDays, setIntervalDays] = useState(String(item?.interval_days || 2));
  const [totalPills, setTotalPills] = useState(String(item?.total_pills || 60));
  const [remainingPills, setRemainingPills] = useState(String(item?.remaining_pills ?? item?.total_pills ?? 60));
  const [notes, setNotes] = useState(item?.notes || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const action = isEditing ? 'update_supplement' : 'add_supplement';
      const res = await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: item?.id,
          name,
          dose,
          timing: frequencyType === 'as_needed' ? 'as_needed' : timing,
          frequency_type: frequencyType,
          interval_days: frequencyType === 'interval' ? (parseInt(intervalDays) || 2) : 1,
          total_pills: parseInt(totalPills) || 60,
          remaining_pills: parseInt(remainingPills) || 60,
          notes
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(isEditing ? '💊 Takviye güncellendi!' : '💊 Yeni takviye eklendi!');
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
            {isEditing ? '✏️ Takviyeyi Düzenle' : '💊 Yeni Takviye / İlaç Ekle'}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TAKVİYE / İLAÇ ADI *</label>
            <input
              type="text"
              placeholder="Ör. D3 Vitamini, Magnezyum, B12 Ampul, Parasetamol"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>DOZAJ *</label>
              <input
                type="text"
                placeholder="Ör. 5000 IU, 1 Ampul, 1 Kapsül"
                value={dose}
                onChange={e => setDose(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KULLANIM SIKLIĞI *</label>
              <select
                value={frequencyType}
                onChange={e => setFrequencyType(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              >
                <option value="daily">☀️ Her Gün Düzenli</option>
                <option value="interval">⏳ Periyodik / Belirli Aralıkla</option>
                <option value="as_needed">🚑 İhtiyaç Halinde / Düzensiz</option>
              </select>
            </div>
          </div>

          {/* Periyodik Süre Ayarı */}
          {frequencyType === 'interval' && (
            <div style={{ background: 'var(--indigo-bg)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--indigo)' }}>
              <label style={{ fontSize: '11px', color: 'var(--indigo)', fontWeight: 800 }}>KAÇ GÜNDE BİR ALINACAK? *</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="2"
                  max="365"
                  placeholder="Ör. 2"
                  value={intervalDays}
                  onChange={e => setIntervalDays(e.target.value)}
                  required
                  style={{ width: '100px', padding: '8px', fontSize: '14px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-main)' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  günde bir ({intervalDays === '7' ? 'Haftalık' : intervalDays === '30' ? 'Aylık Ampul' : `${intervalDays} Günde Bir`})
                </span>
              </div>
            </div>
          )}

          {frequencyType !== 'as_needed' && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>GÜN İÇİ ALINMA ZAMANI *</label>
              <select
                value={timing}
                onChange={e => setTiming(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              >
                <option value="morning">🌅 Sabah</option>
                <option value="with_meal">🥗 Yemekle Birlikte</option>
                <option value="evening">🌙 Akşam / Gece</option>
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KUTU KAPSÜL SAYISI</label>
              <input
                type="number"
                placeholder="Ör. 60"
                value={totalPills}
                onChange={e => setTotalPills(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KALAN KAPSÜL (STOK)</label>
              <input
                type="number"
                placeholder="Ör. 45"
                value={remainingPills}
                onChange={e => setRemainingPills(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>NOTLAR & KULLANIM TALİMATI</label>
            <textarea
              rows={2}
              placeholder="Aç karınla alınacak, bol su ile içilecek..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : isEditing ? '💾 Güncelle' : '➕ Takviye Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
