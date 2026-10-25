'use client';
import { useState, useEffect } from 'react';
import { Car, X } from 'lucide-react';

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
    color: '#3B82F6',
    muayene_date: '',
    sigorta_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC tuşuyla kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        setForm({ plate: '', make: '', model: '', year: String(new Date().getFullYear()), current_km: '', fuel_type: 'Benzin', color: '#3B82F6', muayene_date: '', sigorta_date: '' });
        onSuccess();
        onClose();
      } else {
        setError(j.error || 'Araç eklenemedi.');
      }
    } catch {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="sheet-handle" />

        {/* Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-cyan">
              <Car size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>Yeni Araç Ekle</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                KM, yakıt ve bakım takibiniz için araç bilgilerini girin
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Kapat"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Plaka */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
              PLAKA *
            </label>
            <input
              type="text"
              placeholder="34 ABC 123"
              value={form.plate}
              onChange={e => handleChange('plate', e.target.value.toUpperCase())}
              maxLength={11}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-main)', fontSize: '15px', fontWeight: 800, letterSpacing: '1px'
              }}
            />
          </div>

          {/* Marka + Model */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                MARKA *
              </label>
              <input
                type="text"
                list="makes-list"
                placeholder="Toyota"
                value={form.make}
                onChange={e => handleChange('make', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px'
                }}
              />
              <datalist id="makes-list">
                {POPULAR_MAKES.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                MODEL *
              </label>
              <input
                type="text"
                placeholder="Corolla"
                value={form.model}
                onChange={e => handleChange('model', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Yıl + Güncel KM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                MODEL YILI *
              </label>
              <input
                type="number"
                placeholder="2022"
                value={form.year}
                min="1980" max={new Date().getFullYear() + 1}
                className="tabular-nums"
                onChange={e => handleChange('year', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                GÜNCEL KM
              </label>
              <input
                type="number"
                placeholder="45000"
                value={form.current_km}
                className="tabular-nums"
                onChange={e => handleChange('current_km', e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* Yakıt Türü */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
              YAKIT TÜRÜ
            </label>
            <select
              value={form.fuel_type}
              onChange={e => handleChange('fuel_type', e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-main)', fontSize: '14px'
              }}
            >
              {FUEL_TYPES.map(ft => (
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </select>
          </div>

          {/* Muayene & Sigorta Tarihleri (Opsiyonel) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                MUAYENE GEÇERLİLİK
              </label>
              <input
                type="date"
                value={form.muayene_date}
                onChange={e => handleChange('muayene_date', e.target.value)}
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '13px'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                SİGORTA BİTİŞ
              </label>
              <input
                type="date"
                value={form.sigorta_date}
                onChange={e => handleChange('sigorta_date', e.target.value)}
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-main)', fontSize: '13px'
                }}
              />
            </div>
          </div>

          {/* Hata Mesajı */}
          {error && (
            <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: 'var(--rose)', fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Sabit Alt Butonlar */}
          <div className="modal-sticky-footer" style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              className="btn-subtle"
              style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: 600, minHeight: '44px' }}
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
              style={{
                flex: 2, padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                margin: 0, minHeight: '44px'
              }}
            >
              {loading ? 'Ekleniyor...' : 'Garajıma Ekle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
