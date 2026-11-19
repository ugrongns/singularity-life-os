'use client';
import { useState } from 'react';

interface AddHomeItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddHomeItemModal({ isOpen, onClose, onSuccess }: AddHomeItemModalProps) {
  const [tab, setTab] = useState<'maintenance' | 'appliance'>('appliance');
  
  // Maintenance Form State
  const [title, setTitle] = useState('');
  const [itemType, setItemType] = useState('water_filter');
  const [intervalMonths, setIntervalMonths] = useState('6');
  const [costEstimate, setCostEstimate] = useState('');

  // Appliance Form State
  const [applianceName, setApplianceName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyMonths, setWarrantyMonths] = useState('24');
  const [servicePhone, setServicePhone] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [scanningAI, setScanningAI] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleScanInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningAI(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/home-operations/scan-invoice', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success && json.data) {
        setApplianceName(json.data.name || applianceName);
        if (json.data.brand) setBrand(json.data.brand);
        if (json.data.model) setModel(json.data.model);
        if (json.data.purchase_date) setPurchaseDate(json.data.purchase_date);
        if (json.data.warranty_months) setWarrantyMonths(String(json.data.warranty_months));
        if (json.data.service_phone) setServicePhone(json.data.service_phone);
        if (json.data.notes) setNotes(json.data.notes);
        if (json.receiptUrl) setReceiptUrl(json.receiptUrl);

        alert(json.message || '🧾 Fatura okundu ve bilgiler dolduruldu!');
      } else {
        alert(json.error || 'Fatura okuma başarısız.');
      }
    } catch {
      alert('Fatura AI okuma hatası.');
    } finally {
      setScanningAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (tab === 'maintenance') {
        const res = await fetch('/api/home-operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_maintenance',
            title,
            item_type: itemType,
            interval_months: Number(intervalMonths),
            cost_estimate: Number(costEstimate)
          })
        });

        const json = await res.json();
        if (json.success) {
          onSuccess(json.message || '🏠 Ev bakımı eklendi!');
          onClose();
        } else {
          alert(json.error || 'İşlem başarısız.');
        }
      } else {
        const res = await fetch('/api/home-operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_appliance',
            name: applianceName,
            brand,
            model,
            purchase_date: purchaseDate,
            warranty_months: Number(warrantyMonths),
            service_phone: servicePhone,
            receipt_url: receiptUrl,
            notes
          })
        });

        const json = await res.json();
        if (json.success) {
          onSuccess(json.message || '📺 Ev demirbaşı kaydedildi!');
          onClose();
        } else {
          alert(json.error || 'İşlem başarısız.');
        }
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
            🏠 Ev Operasyonu & Garanti Kaydı
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-main)' }}
          >
            ✕
          </button>
        </div>

        {/* Sekme Butonları */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setTab('appliance')}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '6px',
              border: 'none',
              background: tab === 'appliance' ? 'var(--blue)' : 'transparent',
              color: tab === 'appliance' ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: tab === 'appliance' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            📺 Demirbaş / Garanti
          </button>
          <button
            type="button"
            onClick={() => setTab('maintenance')}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '6px',
              border: 'none',
              background: tab === 'maintenance' ? 'var(--blue)' : 'transparent',
              color: tab === 'maintenance' ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: tab === 'maintenance' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            💧 Periyodik Bakım Görevi
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tab === 'appliance' ? (
            <>
              {/* AI Fatura Okuyucu Banner */}
              <div
                style={{
                  background: 'var(--indigo-bg)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--indigo)' }}>📸 Fatura Fotoğrafı Okut (AI)</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Fatura veya garanti belgesini çekin, tüm alanlar otomatik dolsun.</div>
                </div>

                <label style={{
                  background: 'var(--indigo)', color: '#FFFFFF', padding: '6px 12px', borderRadius: '6px',
                  fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap'
                }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanInvoice} disabled={scanningAI} />
                  <span>{scanningAI ? 'Okunuyor...' : 'Görsel Seç'}</span>
                </label>
              </div>

              {receiptUrl && (
                <div style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 700, background: 'var(--emerald-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>✓ Fatura Görseli Yüklendi</span>
                  <a href={receiptUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--emerald)', textDecoration: 'underline' }}>Görüntüle</a>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>CİHAZ / DEMİRBAŞ ADI *</label>
                <input
                  type="text"
                  placeholder="Ör. Çamaşır Makinesi, Buzdolabı, Robot Süpürge"
                  value={applianceName}
                  onChange={e => setApplianceName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>MARKA</label>
                  <input
                    type="text"
                    placeholder="Ör. Bosch, Siemens, Roborock"
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>MODEL / KOD</label>
                  <input
                    type="text"
                    placeholder="Ör. Series 6, S7 MaxV"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SATIN ALMA TARİHİ *</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>GARANTİ SÜRESİ (AY) *</label>
                  <select
                    value={warrantyMonths}
                    onChange={e => setWarrantyMonths(e.target.value)}
                    style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                  >
                    <option value="12">1 Yıl (12 Ay)</option>
                    <option value="24">2 Yıl (24 Ay)</option>
                    <option value="36">3 Yıl (36 Ay)</option>
                    <option value="60">5 Yıl (60 Ay)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>YETKİLİ SERVİS TELEFONU</label>
                <input
                  type="tel"
                  placeholder="Ör. 444 6 333"
                  value={servicePhone}
                  onChange={e => setServicePhone(e.target.value)}
                  style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BAKIM TANIMI *</label>
                <input
                  type="text"
                  placeholder="Ör. Su Arıtma Filtresi, Kombi Bakımı, Robot Süpürge"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TEKRAR PERİYODU (AY) *</label>
                  <select
                    value={intervalMonths}
                    onChange={e => setIntervalMonths(e.target.value)}
                    style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                  >
                    <option value="3">3 Ayda Bir</option>
                    <option value="6">6 Ayda Bir</option>
                    <option value="12">12 Ayda (Yılda Bir)</option>
                    <option value="24">2 Yılda Bir</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TAHMİNİ TUTAR (₺)</label>
                  <input
                    type="number"
                    placeholder="Ör. 450"
                    value={costEstimate}
                    onChange={e => setCostEstimate(e.target.value)}
                    style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
                  />
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : tab === 'maintenance' ? '🏠 Bakım Görevini Ekle' : '📺 Cihaz Kaydını Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
}
