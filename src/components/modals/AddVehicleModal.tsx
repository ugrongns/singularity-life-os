'use client';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FUEL_TYPES = ['Benzin', 'Dizel', 'LPG', 'Elektrik', 'Hibrit', 'Benzin + LPG'];
const POPULAR_MAKES = ['Audi', 'BMW', 'Citroën', 'Dacia', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Nissan', 'Opel', 'Peugeot', 'Renault', 'Seat', 'Skoda', 'Tofaş', 'Toyota', 'Volkswagen', 'Volvo'];

export default function AddVehicleModal({ isOpen, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    plate: '',
    make: '',
    model: '',
    year: String(new Date().getFullYear()),
    current_km: '',
    fuel_type: 'Benzin',
    color: '#3B82F6'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.plate.trim()) return setError('Plaka zorunludur.');
    if (!form.make.trim()) return setError('Marka zorunludur.');
    if (!form.model.trim()) return setError('Model zorunludur.');
    if (!form.year || isNaN(Number(form.year))) return setError('Geçerli bir yıl girin.');

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_vehicle', ...form })
      });
      const j = await res.json();
      if (j.success) {
        setForm({ plate: '', make: '', model: '', year: String(new Date().getFullYear()), current_km: '', fuel_type: 'Benzin', color: '#3B82F6' });
        onSuccess();
        onClose();
      } else {
        setError(j.error || 'Araç eklenemedi.');
      }
    } catch (e) {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
        padding: '28px', width: '100%', maxWidth: '460px', boxShadow: 'var(--shadow-xl)'
      }}>
        {/* Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>🚗 Yeni Araç Ekle</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              KM, yakıt ve bakım takibiniz için araç bilgilerini girin
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Plaka */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>PLAKA *</label>
            <input
              type="text"
              placeholder="34 ABC 123"
              value={form.plate}
              onChange={e => handleChange('plate', e.target.value.toUpperCase())}
              maxLength={9}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-main)', fontSize: '15px', fontWeight: 700, letterSpacing: '2px',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Marka + Model */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>MARKA *</label>
              <input
                type="text"
                list="makes-list"
                placeholder="Toyota"
                value={form.make}
                onChange={e => handleChange('make', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
              <datalist id="makes-list">
                {POPULAR_MAKES.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>MODEL *</label>
              <input
                type="text"
                placeholder="Corolla"
                value={form.model}
                onChange={e => handleChange('model', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Yıl + Güncel KM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>MODEL YILI *</label>
              <input
                type="number"
                placeholder="2022"
                value={form.year}
                min="1980" max={new Date().getFullYear() + 1}
                onChange={e => handleChange('year', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>GÜNCEL KM</label>
              <input
                type="number"
                placeholder="45000"
                value={form.current_km}
                onChange={e => handleChange('current_km', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Yakıt Türü + Renk */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>YAKIT TÜRÜ</label>
              <select
                value={form.fuel_type}
                onChange={e => handleChange('fuel_type', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                }}
              >
                {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>RENK</label>
              <input
                type="color"
                value={form.color}
                onChange={e => handleChange('color', e.target.value)}
                style={{
                  height: '42px', width: '56px', padding: '4px', borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer'
                }}
              />
            </div>
          </div>

          {/* Hata */}
          {error && (
            <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: 'var(--rose)', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-main)', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 2, padding: '12px', borderRadius: 'var(--radius-md)',
                border: 'none', background: loading ? 'var(--border)' : 'var(--blue)',
                color: 'white', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '⏳ Ekleniyor...' : '🚗 Garajıma Ekle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
