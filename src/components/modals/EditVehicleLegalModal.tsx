'use client';
import { useState, useEffect } from 'react';
import { ShieldCheck, X, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { TurkishPlateBadge } from '@/components/vehicle/VehicleFleetCard';

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

  const calculateDaysLeft = (dateStr: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const renderCountdownChip = (dateStr: string) => {
    const days = calculateDaysLeft(dateStr);
    if (days === null) return null;

    if (days <= 0) {
      return (
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--rose)', background: 'var(--rose-bg)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
          ⚠️ Vadesi Doldu!
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--rose)', background: 'var(--rose-bg)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
          🚨 {days} Gün Kaldı (Kritik)
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          ⏳ {days} Gün Kaldı
        </span>
      );
    }
    return (
      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--emerald)', background: 'var(--emerald-bg)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        ✓ {days} Gün Kaldı
      </span>
    );
  };

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
        style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />

        {/* Modal Başlığı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-blue">
              <ShieldCheck size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Yasal Tarihler & Muayene
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {vehicle.make} {vehicle.model} • {vehicle.year}
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

        {/* Seçili Araç Plaka Rozeti Göstergesi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
            Düzenlenen Araç:
          </div>
          <TurkishPlateBadge plate={vehicle.plate} />
        </div>

        {error && (
          <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* TÜVTÜRK Muayene */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                🔍 TÜVTÜRK Muayene Geçerlilik Tarihi
              </label>
              {renderCountdownChip(muayeneDate)}
            </div>
            <input
              type="date"
              value={muayeneDate}
              onChange={e => setMuayeneDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', color: 'var(--text-main)', minHeight: '44px'
              }}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ruhsatta veya TÜVTÜRK muayene raporunda belirtilen son geçerlilik günü.
            </div>
          </div>

          {/* Zorunlu Trafik Sigortası */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                📄 Zorunlu Trafik Sigortası Bitiş Tarihi
              </label>
              {renderCountdownChip(sigortaDate)}
            </div>
            <input
              type="date"
              value={sigortaDate}
              onChange={e => setSigortaDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', color: 'var(--text-main)', minHeight: '44px'
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Sigorta Poliçe No (Opsiyonel)"
                value={sigortaPolicy}
                onChange={e => setSigortaPolicy(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', fontSize: '12px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)', color: 'var(--text-main)', minHeight: '40px'
                }}
              />
            </div>
          </div>

          {/* Kasko Poliçesi */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                🛡️ Kasko Sigortası Bitiş Tarihi
              </label>
              {renderCountdownChip(kaskoDate)}
            </div>
            <input
              type="date"
              value={kaskoDate}
              onChange={e => setKaskoDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', color: 'var(--text-main)', minHeight: '44px'
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Kasko Poliçe No (Opsiyonel)"
                value={kaskoPolicy}
                onChange={e => setKaskoPolicy(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', fontSize: '12px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)', color: 'var(--text-main)', minHeight: '40px'
                }}
              />
            </div>
          </div>

          {/* Butonlar */}
          <div className="modal-sticky-footer" style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-subtle"
              style={{ flex: 1, padding: '12px', fontWeight: 700, minHeight: '44px' }}
            >
              Vazgeç
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
