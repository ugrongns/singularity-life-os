'use client';
import { useState } from 'react';

interface Wallet {
  id: string;
  name: string;
  balance: number;
}

interface AddFuelLogModalProps {
  isOpen: boolean;
  vehicleId: string;
  currentKm: number;
  wallets: Wallet[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddFuelLogModal({
  isOpen,
  vehicleId,
  currentKm,
  wallets,
  onClose,
  onSuccess
}: AddFuelLogModalProps) {
  const [km, setKm] = useState(String(currentKm || 70000));
  const [liters, setLiters] = useState('45');
  const [pricePerLiter, setPricePerLiter] = useState('44.50');
  const [fuelStation, setFuelStation] = useState('Opet');
  const [fuelDate, setFuelDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = Math.round((Number(liters) || 0) * (Number(pricePerLiter) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_fuel',
          vehicle_id: vehicleId,
          km: Number(km),
          liters: Number(liters),
          price_per_liter: Number(pricePerLiter),
          total_amount: totalAmount,
          fuel_station: fuelStation,
          fuel_date: fuelDate,
          wallet_id: selectedWalletId
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.message || '⛽ Yakıt alımı kaydedildi!');
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
            ⛽ Yakıt Alım Kaydı Ekle
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>GÜNCEL KM *</label>
              <input
                type="number"
                value={km}
                onChange={e => setKm(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>İSTASYON *</label>
              <select
                value={fuelStation}
                onChange={e => setFuelStation(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'white' }}
              >
                <option value="Opet">⛽ Opet</option>
                <option value="Shell">⛽ Shell</option>
                <option value="BP">⛽ BP</option>
                <option value="Petrol Ofisi">⛽ Petrol Ofisi</option>
                <option value="TotalEnergies">⛽ Total</option>
                <option value="Diğer">⛽ Diğer</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ALINAN LİTRE (L) *</label>
              <input
                type="number"
                step="0.01"
                value={liters}
                onChange={e => setLiters(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>LİTRE FİYATI (₺) *</label>
              <input
                type="number"
                step="0.01"
                value={pricePerLiter}
                onChange={e => setPricePerLiter(e.target.value)}
                required
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ background: '#F0FDF4', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #BBF7D0', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: 800 }}>HESAPLANAN TOPLAM TUTAR</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#15803D', marginTop: '2px' }}>₺{totalAmount.toLocaleString('tr-TR')}</div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ÖDEME YAPILAN CÜZDAN / KART</label>
            <select
              value={selectedWalletId}
              onChange={e => setSelectedWalletId(e.target.value)}
              style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'white' }}
            >
              <option value="">Cüzdandan düşme (Sadece kayıt al)</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  💳 {w.name} (₺{w.balance.toLocaleString('tr-TR')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ALIM TARİHİ *</label>
            <input
              type="date"
              value={fuelDate}
              onChange={e => setFuelDate(e.target.value)}
              required
              style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : '⛽ Yakıt Kaydını İşle'}
          </button>
        </form>
      </div>
    </div>
  );
}
