'use client';
import { useState, useEffect } from 'react';

interface EditVehicleLegalModalProps {
  isOpen: boolean;
  vehicle: any;
  legalReminders: any[];
  onClose: () => void;
  onSuccess: (msg?: string) => void;
}

export default function EditVehicleLegalModal({
  isOpen,
  vehicle,
  legalReminders,
  onClose,
  onSuccess
}: EditVehicleLegalModalProps) {
  const [muayeneDate, setMuayeneDate] = useState('');
  const [sigortaDate, setSigortaDate] = useState('');
  const [sigortaPolicy, setSigortaPolicy] = useState('');
  const [kaskoDate, setKaskoDate] = useState('');
  const [kaskoPolicy, setKaskoPolicy] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && legalReminders) {
      const muayeneRem = legalReminders.find(r => r.type === 'muayene');
      const sigortaRem = legalReminders.find(r => r.type === 'sigorta');
      const kaskoRem = legalReminders.find(r => r.type === 'kasko');

      setMuayeneDate(muayeneRem?.due_date || '');
      setSigortaDate(sigortaRem?.due_date || '');
      setSigortaPolicy(sigortaRem?.policy_no || '');
      setKaskoDate(kaskoRem?.due_date || '');
      setKaskoPolicy(kaskoRem?.policy_no || '');
      setError(null);
    }
  }, [isOpen, legalReminders]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!muayeneDate && !sigortaDate && !kaskoDate) {
      setError('Lütfen en az bir tarih girin.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_legal_dates',
          vehicle_id: vehicle.id,
          muayene_date: muayeneDate || undefined,
          sigorta_date: sigortaDate || undefined,
          sigorta_policy_no: sigortaPolicy.trim() || undefined,
          kasko_date: kaskoDate || undefined,
          kasko_policy_no: kaskoPolicy.trim() || undefined
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(json.message || '🛡️ Tarihler güncellendi!');
        onClose();
      } else {
        setError(json.error || 'Güncelleme başarısız.');
      }
    } catch {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '440px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ color: 'var(--text-main)' }}>
              🛡️ Muayene & Sigorta Tarihleri
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {vehicle.plate} • {vehicle.make} {vehicle.model}
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECDD3', color: '#991B1B', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* TÜVTÜRK Muayene */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔍</span>
              <span>TÜVTÜRK Muayene Geçerlilik Tarihi</span>
            </label>
            <input
              type="date"
              value={muayeneDate}
              onChange={e => setMuayeneDate(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '6px',
                background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ruhsatta veya TÜVTÜRK raporunda yazan son muayene geçerlilik tarihi.
            </div>
          </div>

          {/* Zorunlu Trafik Sigortası */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📄</span>
              <span>Zorunlu Trafik Sigortası Bitiş Tarihi</span>
            </label>
            <input
              type="date"
              value={sigortaDate}
              onChange={e => setSigortaDate(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '6px',
                background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>POLİÇE NUMARASI (OPSİYONEL)</label>
              <input
                type="text"
                placeholder="Örn: 2026-TR-849201"
                value={sigortaPolicy}
                onChange={e => setSigortaPolicy(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', fontSize: '12px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '3px',
                  background: 'var(--surface)', color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* Kasko (Opsiyonel) */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🚙</span>
              <span>Kasko Bitiş Tarihi (Varsa)</span>
            </label>
            <input
              type="date"
              value={kaskoDate}
              onChange={e => setKaskoDate(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '6px',
                background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>KASKO POLİÇE NO (OPSİYONEL)</label>
              <input
                type="text"
                placeholder="Örn: 2026-KSK-9021"
                value={kaskoPolicy}
                onChange={e => setKaskoPolicy(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', fontSize: '12px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '3px',
                  background: 'var(--surface)', color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer'
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2, padding: '10px', borderRadius: 'var(--radius-md)',
                border: 'none', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                color: 'white', fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {saving ? 'Kaydediliyor...' : '✓ Tarihleri Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
