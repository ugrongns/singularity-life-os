'use client';
import { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

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
          muayene_date: muayeneDate || null,
          sigorta_date: sigortaDate || null,
          sigorta_policy: sigortaPolicy.trim() || null,
          kasko_date: kaskoDate || null,
          kasko_policy: kaskoPolicy.trim() || null
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || 'Yasal hatırlatıcılar güncellendi.');
        onClose();
      } else {
        setError(json.error || 'Güncelleme yapılamadı.');
      }
    } catch {
      setError('Sunucu hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '460px' }}
      >
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-blue">
              <ShieldCheck size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Muayene & Sigorta Tarihleri
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {vehicle.plate} • {vehicle.make} {vehicle.model}
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

        {error && (
          <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* TÜVTÜRK Muayene */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              🔍 TÜVTÜRK Muayene Geçerlilik Tarihi
            </label>
            <input
              type="date"
              value={muayeneDate}
              onChange={e => setMuayeneDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ruhsatta veya TÜVTÜRK raporunda yazan son muayene geçerlilik tarihi.
            </div>
          </div>

          {/* Zorunlu Trafik Sigortası */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              📄 Zorunlu Trafik Sigortası Bitiş Tarihi
            </label>
            <input
              type="date"
              value={sigortaDate}
              onChange={e => setSigortaDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Poliçe No (Opsiyonel)"
                value={sigortaPolicy}
                onChange={e => setSigortaPolicy(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: '12px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)', color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* Kasko Poliçesi */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              🛡️ Kasko Sigortası Bitiş Tarihi
            </label>
            <input
              type="date"
              value={kaskoDate}
              onChange={e => setKaskoDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Kasko Poliçe No (Opsiyonel)"
                value={kaskoPolicy}
                onChange={e => setKaskoPolicy(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: '12px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)', color: 'var(--text-main)'
                }}
              />
            </div>
          </div>

          {/* Butonlar */}
          <div className="modal-sticky-footer" style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-subtle"
              style={{ flex: 1, padding: '12px', fontWeight: 700, minHeight: '44px' }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ flex: 2, padding: '12px', fontWeight: 800, margin: 0, minHeight: '44px' }}
            >
              {saving ? 'Kaydediliyor...' : 'Tarihleri Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
