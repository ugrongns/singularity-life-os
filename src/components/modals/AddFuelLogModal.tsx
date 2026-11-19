'use client';
import { useState, useEffect } from 'react';
import { Fuel, X, CreditCard, Calendar, Navigation } from 'lucide-react';
import { getTodayTurkeyDate } from '@/lib/date-utils';

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
  const [km, setKm] = useState(currentKm > 0 ? String(currentKm) : '');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [fuelStation, setFuelStation] = useState('Opet');
  const [fuelDate, setFuelDate] = useState(getTodayTurkeyDate());
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [isFullTank, setIsFullTank] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKm(currentKm > 0 ? String(currentKm) : '');
      setFuelDate(getTodayTurkeyDate());
      setIsFullTank(true);
      setSelectedWalletId(prev => (prev && wallets.some(w => w.id === prev) ? prev : (wallets[0]?.id || '')));
    }
  }, [isOpen, currentKm, wallets]);

  if (!isOpen) return null;

  const numLiters = parseFloat(liters) || 0;
  const numPrice = parseFloat(pricePerLiter) || 0;
  const totalAmount = Math.round(numLiters * numPrice);

  const handlePresetAmount = (presetLira: number) => {
    if (numPrice > 0) {
      const calculatedLiters = (presetLira / numPrice).toFixed(2);
      setLiters(calculatedLiters);
    }
  };

  const handlePresetLiters = (presetLiters: number) => {
    setLiters(String(presetLiters));
  };

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
          wallet_id: selectedWalletId,
          is_full_tank: isFullTank ? 1 : 0
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="bottom-sheet" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />

        {/* Modal Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-emerald">
              <Fuel size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Yakıt Alım Kaydı
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                İstasyon dolum detaylarını hızlıca işleyin
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
          {/* Hızlı Dolum Kısayolları (Presets) */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, display: 'block', marginBottom: '6px' }}>
              ⚡ HIZLI DOLUM SEÇENEKLERİ
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handlePresetAmount(250)}
                className="btn-subtle"
                style={{ padding: '8px 4px', fontSize: '11px', fontWeight: 800, textAlign: 'center', borderRadius: 'var(--radius-sm)' }}
              >
                +250 ₺
              </button>
              <button
                type="button"
                onClick={() => handlePresetAmount(500)}
                className="btn-subtle"
                style={{ padding: '8px 4px', fontSize: '11px', fontWeight: 800, textAlign: 'center', borderRadius: 'var(--radius-sm)' }}
              >
                +500 ₺
              </button>
              <button
                type="button"
                onClick={() => handlePresetAmount(1000)}
                className="btn-subtle"
                style={{ padding: '8px 4px', fontSize: '11px', fontWeight: 800, textAlign: 'center', borderRadius: 'var(--radius-sm)' }}
              >
                +1.000 ₺
              </button>
              <button
                type="button"
                onClick={() => handlePresetLiters(50)}
                className="btn-subtle"
                style={{ padding: '8px 4px', fontSize: '11px', fontWeight: 800, textAlign: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--emerald)' }}
              >
                Depo (50L)
              </button>
            </div>
          </div>

          {/* Güncel KM & İstasyon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>GÜNCEL KM *</label>
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
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>İSTASYON *</label>
              <select
                value={fuelStation}
                onChange={e => setFuelStation(e.target.value)}
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 600,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              >
                <option value="Opet">⛽ Opet</option>
                <option value="Shell">⛽ Shell</option>
                <option value="BP">⛽ BP</option>
                <option value="Petrol Ofisi">⛽ Petrol Ofisi</option>
                <option value="TotalEnergies">⛽ Total</option>
                <option value="Aytemiz">⛽ Aytemiz</option>
                <option value="Diğer">⛽ Diğer</option>
              </select>
            </div>
          </div>

          {/* Litre & Litre Fiyatı */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>ALINAN LİTRE (L) *</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={liters}
                onChange={e => setLiters(e.target.value)}
                required
                className="tabular-nums"
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>LİTRE FİYATI (₺) *</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={pricePerLiter}
                onChange={e => setPricePerLiter(e.target.value)}
                required
                className="tabular-nums"
                style={{ 
                  width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                  marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)',
                  minHeight: '44px'
                }}
              />
            </div>
          </div>

          {/* Hesaplanmış Toplam Tutar Paneli */}
          <div 
            style={{ 
              background: 'var(--emerald-bg)', 
              padding: '12px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid rgba(16, 185, 129, 0.4)', 
              textAlign: 'center' 
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800, letterSpacing: '0.5px' }}>
              HESAPLANAN TOPLAM TUTAR
            </div>
            <div className="tabular-nums" style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              ₺{totalAmount.toLocaleString('tr-TR')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {numLiters} L × ₺{numPrice.toFixed(2)}
            </div>
          </div>

          {/* Dolum Tipi (Tam Depo / Parçalı Dolum) */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, display: 'block', marginBottom: '6px' }}>
              DOLUM TİPİ (TÜKETİM HESABI)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsFullTank(true)}
                style={{
                  padding: '9px 10px',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: 'var(--radius-md)',
                  border: isFullTank ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                  background: isFullTank ? 'var(--emerald-bg)' : 'var(--surface-subtle)',
                  color: isFullTank ? 'var(--emerald)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                ⛽ Tam Depo
              </button>
              <button
                type="button"
                onClick={() => setIsFullTank(false)}
                style={{
                  padding: '9px 10px',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: 'var(--radius-md)',
                  border: !isFullTank ? '1.5px solid var(--amber)' : '1px solid var(--border)',
                  background: !isFullTank ? 'var(--amber-bg)' : 'var(--surface-subtle)',
                  color: !isFullTank ? 'var(--amber)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                💧 Parçalı Dolum
              </button>
            </div>
            {!isFullTank && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Parçalı dolumlar, L/100km ortalaması için bir sonraki tam depo kaydına kadar biriktirilir.
              </div>
            )}
          </div>

          {/* Cüzdan Seçimi */}
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

          {/* Alım Tarihi */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>ALIM TARİHİ *</label>
            <input
              type="date"
              value={fuelDate}
              onChange={e => setFuelDate(e.target.value)}
              required
              style={{ 
                width: '100%', padding: '10px 12px', fontSize: '13px', fontWeight: 700,
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                marginTop: '4px', minHeight: '44px', background: 'var(--surface)', color: 'var(--text-main)'
              }}
            />
          </div>

          {/* Submit Butonu */}
          <div className="modal-sticky-footer" style={{ marginTop: '4px' }}>
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
              <Fuel size={17} />
              <span>{submitting ? 'İşleniyor...' : 'Yakıt Kaydını İşle'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
