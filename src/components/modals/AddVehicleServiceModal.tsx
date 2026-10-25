'use client';
import { useState } from 'react';
import { Wrench, X, ShieldCheck, DollarSign, Calendar } from 'lucide-react';

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
  const [serviceProvider, setServiceProvider] = useState('Yetkili / Özel Servis');
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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="bottom-sheet" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-blue">
              <Wrench size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Servis & Bakım Kaydı
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Periyodik veya arıza bakım geçmişini kaydedin
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="modal-close-btn"
            aria-label="Kapat"
            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>SERVİS KM *</label>
              <input
                type="number"
                inputMode="numeric"
                value={km}
                onChange={e => setKm(e.target.value)}
                required
                className="tabular-nums"
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>BAKIM TÜRÜ *</label>
              <select
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              >
                <option value="periyodik_bakim">🔧 Periyodik Yağ & Filtre</option>
                <option value="fren_balata">🛑 Fren Balatası / Disk</option>
                <option value="lastik_degisim">🛞 Lastik & Rot Balans</option>
                <option value="aku_degisim">🔋 Akü Değişimi</option>
                <option value="ariza_onarim">🛠️ Arıza Onarımı</option>
                <option value="diger">⚙️ Diğer İşlemler</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>SERVİS / İSTASYON ADI</label>
            <input
              type="text"
              placeholder="Ör. Yetkili Servis, Bosch Car Service"
              value={serviceProvider}
              onChange={e => setServiceProvider(e.target.value)}
              style={{ 
                width: '100%', padding: '10px 12px', fontSize: '13px', 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)',
                minHeight: '44px'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>YAPILAN İŞLEMLER & DETAYLAR *</label>
            <textarea
              rows={2}
              placeholder="Ör. Motor yağı (5W-30), yağ filtresi, polen ve hava filtresi yenilendi."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              style={{ 
                width: '100%', padding: '10px 12px', fontSize: '13px', 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>SERVİS TUTARI (₺) *</label>
              <input
                type="number"
                inputMode="numeric"
                value={cost}
                onChange={e => setCost(e.target.value)}
                required
                className="tabular-nums"
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 800,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>SERVİS TARİHİ *</label>
              <input
                type="date"
                value={serviceDate}
                onChange={e => setServiceDate(e.target.value)}
                required
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>ÖDEME YAPILAN CÜZDAN / KART</label>
            <select
              value={selectedWalletId}
              onChange={e => setSelectedWalletId(e.target.value)}
              style={{ 
                width: '100%', padding: '10px 12px', fontSize: '13px', 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)',
                minHeight: '44px'
              }}
            >
              <option value="">Cüzdandan düşme (Sadece kayıt al)</option>
              {wallets.map((w: any) => {
                const owner = w.owner_name ? ` • ${w.owner_avatar || '👤'} ${w.owner_name}` : (w.is_joint ? ' • 👥 Ortak' : '');
                return (
                  <option key={w.id} value={w.id}>
                    {w.type === 'credit_card' ? '💳' : '🏦'} {w.name}{owner} (₺{Number(w.balance).toLocaleString('tr-TR')})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="modal-sticky-footer" style={{ marginTop: '6px' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting} 
              style={{ 
                width: '100%', 
                padding: '13px', 
                fontSize: '14px', 
                fontWeight: 900, 
                minHeight: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Wrench size={17} />
              <span>{submitting ? 'Kaydediliyor...' : 'Servis Kaydını Kaydet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
