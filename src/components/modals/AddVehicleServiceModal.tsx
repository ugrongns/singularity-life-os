'use client';
import { useState } from 'react';

interface Wallet {
  id: string;
  name: string;
  balance: number;
}

interface AddVehicleServiceModalProps {
  isOpen: boolean;
  vehicleId: string;
  currentKm: number;
  wallets: Wallet[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddVehicleServiceModal({
  isOpen,
  vehicleId,
  currentKm,
  wallets,
  onClose,
  onSuccess
}: AddVehicleServiceModalProps) {
  const [km, setKm] = useState(String(currentKm || 70000));
  const [serviceType, setServiceType] = useState('periyodik_bakim');
  const [description, setDescription] = useState('Periyodik Yağ & Filtre Değişimi, Genel Kontrol');
  const [cost, setCost] = useState('4500');
  const [serviceProvider, setServiceProvider] = useState('Borusan Otomotiv Özel Servisi');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_service',
          vehicle_id: vehicleId,
          km_at_service: Number(km),
          type: serviceType,
          description,
          cost: Number(cost),
          service_provider: serviceProvider,
          service_date: serviceDate,
          wallet_id: selectedWalletId
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(json.message || '🔧 Servis kaydı oluşturuldu!');
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
            🔧 Servis & Bakım Kaydı Ekle
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SERVİS KM *</label>
              <input
                type="number"
                value={km}
                onChange={e => setKm(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BAKIM TÜRÜ *</label>
              <select
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              >
                <option value="periyodik_bakim">🔧 Periyodik Yağ & Filtre Bakımı</option>
                <option value="fren_balata">🛑 Fren Balatası / Disk Değişimi</option>
                <option value="lastik_degisim">🛞 Lastik Değişimi & Rot Balans</option>
                <option value="aku_degisim">🔋 Akü Değişimi</option>
                <option value="ariza_onarim">🛠️ Arıza Onarımı & Parça Değişimi</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SERVİS / İSTASYON ADI</label>
            <input
              type="text"
              placeholder="Ör. Borusan Yetkili Servisi"
              value={serviceProvider}
              onChange={e => setServiceProvider(e.target.value)}
              style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>YAPILAN İŞLEMLER & DETAYLAR *</label>
            <textarea
              rows={2}
              placeholder="Ör. Motor yağı (5W-30), yağ filtresi, polen filtresi yenilendi."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SERVİS TUTARI (₺) *</label>
              <input
                type="number"
                value={cost}
                onChange={e => setCost(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SERVİS TARİHİ *</label>
              <input
                type="date"
                value={serviceDate}
                onChange={e => setServiceDate(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ÖDEME YAPILAN CÜZDAN / KART</label>
            <select
              value={selectedWalletId}
              onChange={e => setSelectedWalletId(e.target.value)}
              style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
            >
              <option value="">Cüzdandan düşme (Sadece kayıt al)</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  💳 {w.name} (₺{w.balance.toLocaleString('tr-TR')})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : '🔧 Servis Kaydını Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
