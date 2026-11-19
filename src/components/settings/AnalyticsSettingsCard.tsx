'use client';
import { useState, useEffect } from 'react';

export default function AnalyticsSettingsCard() {
  const [tuikRate, setTuikRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/analytics')
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const rate = json?.data?.inflationMetrics?.officialTuikRate;
        if (typeof rate === 'number' && Number.isFinite(rate)) {
          setTuikRate(String(rate));
        } else {
          setTuikRate('');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveRate = async (nextValue: string | null) => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/analytics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officialTuikRate: nextValue === null || nextValue.trim() === '' ? null : nextValue.trim()
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setStatusMsg({ text: `❌ ${json.error || 'Ayar kaydedilemedi.'}`, type: 'error' });
        return;
      }
      const saved = json.data?.officialTuikRate;
      setTuikRate(typeof saved === 'number' ? String(saved) : '');
      setStatusMsg({ text: `✅ ${json.message}`, type: 'success' });
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
    } catch {
      setStatusMsg({ text: '❌ Sunucuya bağlanılamadı.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="card-title-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">
          <span>📊</span>
          <span>Analitik &amp; Enflasyon Referansı</span>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
          background: 'var(--amber-bg)', color: 'var(--amber)'
        }}>
          İsteğe Bağlı
        </span>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 14px', lineHeight: 1.5 }}>
        Analitik sayfasındaki <strong>Resmi TÜİK TÜFE</strong> ve <strong>Reel Avantaj</strong> kutuları sabit/sentetik bir oran göstermez. Dilerseniz kendi takip ettiğiniz aylık veya yıllık resmi TÜFE oranını (%) referans olarak tanımlayabilirsiniz.
      </p>

      {loading ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mevcut referans değeri kontrol ediliyor...</div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveRate(tuikRate);
          }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}
        >
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <label
              htmlFor="settings-tuik-rate"
              style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}
            >
              Resmi TÜFE Referans Oranı (%)
            </label>
            <input
              id="settings-tuik-rate"
              type="number"
              step="0.1"
              min="0"
              max="500"
              placeholder="Örn: 48.6 (boş bırakılırsa —)"
              value={tuikRate}
              onChange={(e) => setTuikRate(e.target.value)}
              disabled={saving}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 700
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ padding: '9px 16px', fontSize: '12px', fontWeight: 700 }}
            >
              {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
            </button>
            {tuikRate.trim() !== '' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => saveRate(null)}
                className="btn-subtle"
                style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 700, border: '1px solid var(--border)' }}
              >
                Temizle
              </button>
            )}
          </div>
        </form>
      )}

      {statusMsg && (
        <div
          style={{
            marginTop: '10px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: statusMsg.type === 'success' ? 'var(--emerald-bg)' : 'rgba(239, 68, 68, 0.12)',
            color: statusMsg.type === 'success' ? 'var(--emerald)' : '#EF4444'
          }}
        >
          {statusMsg.text}
        </div>
      )}
    </div>
  );
}
