'use client';
import { useState } from 'react';

interface VehicleFleetCardProps {
  data: any;
  onOpenHistory?: () => void;
  onOpenFuelModal?: () => void;
  onOpenServiceModal?: () => void;
  onRefresh?: () => void;
}

export default function VehicleFleetCard({
  data,
  onOpenHistory,
  onOpenFuelModal,
  onOpenServiceModal,
  onRefresh
}: VehicleFleetCardProps) {
  const [kmInput, setKmInput] = useState('');
  const [updatingKm, setUpdatingKm] = useState(false);

  const vehicle = data?.vehicle || null;

  if (!vehicle) {
    return (
      <div className="card">
        <div className="card-title-row">
          <div className="card-title">
            <span>🚗</span>
            <span>Araç Filosu & Bakım Takibi</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚗</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Henüz Kayıtlı Araç Bulunmuyor</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Garajınıza yeni bir araç ekleyerek KM, periyodik bakım ve yakıt giderlerinizi takip edebilirsiniz.
          </div>
        </div>
      </div>
    );
  }

  const maintenance = data?.maintenance || {
    cycleStartKm: 0,
    nextServiceKm: 15000,
    remainingKm: 15000,
    kmProgressPercentage: 0
  };

  const recentFuels = data?.recentFuels || [];
  const legalReminders = data?.legalReminders || [];
  const consumption = data?.consumption || { avgLitersPer100Km: 0, avgCostPerKm: 0 };

  const currentKm = vehicle?.current_km || 0;
  const remainingKm = maintenance?.remainingKm !== undefined ? maintenance.remainingKm : 15000;
  const nextServiceKm = maintenance?.nextServiceKm || 15000;
  const progressPercent = maintenance?.kmProgressPercentage !== undefined ? maintenance.kmProgressPercentage : 0;
  const isDueSoon = remainingKm <= 1500;

  const handleUpdateKm = async () => {
    if (!kmInput || isNaN(Number(kmInput))) return;
    setUpdatingKm(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_km',
          vehicle_id: vehicle.id,
          current_km: Number(kmInput)
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setKmInput('');
        if (onRefresh) onRefresh();
        else window.location.reload();
      }
    } catch {
      alert('KM güncelleme hatası.');
    } finally {
      setUpdatingKm(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🚗</span>
          <span>Araç Filosu & Bakım Takibi</span>
        </div>
      </div>

      <div className="card-action-bar">
        <button className="btn-subtle" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={onOpenHistory}>
          📜 Servis Geçmişi & Kayıtlar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Araç Başlık & Canlı KM & KM Güncelleme */}
        <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 900, fontSize: '17px', color: 'var(--text-main)' }}>{vehicle.plate}</span>
                <span style={{ fontSize: '11px', background: 'var(--indigo-bg)', color: 'var(--indigo)', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                  {vehicle.fuel_type}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {vehicle.make} {vehicle.model} ({vehicle.year})
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>GÜNCEL KM</div>
              <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)' }}>
                {currentKm.toLocaleString('tr-TR')} <span style={{ fontSize: '12px', fontWeight: 700 }}>KM</span>
              </div>
            </div>
          </div>

          {/* Hızlı KM Güncelleme & Aksiyon Butonları Barı */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            {/* KM Güncelleme Satırı */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder={`Yeni KM Gir (Mevcut: ${currentKm.toLocaleString('tr-TR')})`}
                value={kmInput}
                onChange={e => setKmInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handleUpdateKm}
                disabled={updatingKm}
                className="btn-subtle"
                style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}
              >
                {updatingKm ? '...' : '⚙️ KM Güncelle'}
              </button>
            </div>

            {/* Aksiyon Butonları Grid (Yakıt & Servis) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={onOpenFuelModal}
                style={{
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'opacity 0.15s'
                }}
              >
                <span>⛽</span>
                <span>Yakıt Kaydı</span>
              </button>

              <button
                type="button"
                onClick={onOpenServiceModal}
                style={{
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: '#2563EB',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'opacity 0.15s'
                }}
              >
                <span>🔧</span>
                <span>Servis Bakımı</span>
              </button>
            </div>
          </div>
        </div>

        {/* 15.000 KM Periyodik Bakım Çubuğu */}
        <div style={{ background: 'white', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>
            <span>Periyodik Bakım Hedefi ({nextServiceKm.toLocaleString('tr-TR')} KM)</span>
            <span className="tabular-nums" style={{ color: isDueSoon ? '#DC2626' : '#059669' }}>
              {remainingKm.toLocaleString('tr-TR')} KM Kaldı
            </span>
          </div>
          
          <div className="progress-bar" style={{ height: '8px', marginBottom: '6px' }}>
            <div 
              className={`progress-fill ${isDueSoon ? 'rose' : 'emerald'}`}
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Son Bakım: 60.000 KM</span>
            <span>Gelecek Bakım: {nextServiceKm.toLocaleString('tr-TR')} KM</span>
          </div>
        </div>

        {/* Yasal Hatırlatıcı Sayaçları (TÜVTÜRK, Kasko, Sigorta) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {legalReminders.map((rem: any) => {
            const dueDate = new Date(rem.due_date);
            const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const isUrgent = daysLeft <= 30;

            return (
              <div 
                key={rem.id}
                style={{
                  background: isUrgent ? '#FEF2F2' : 'var(--surface-subtle)',
                  border: isUrgent ? '1px solid #FCA5A5' : '1px solid var(--border)',
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '11px', color: isUrgent ? '#DC2626' : 'var(--text-muted)', fontWeight: 800 }}>
                  🛡️ {rem.type}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: isUrgent ? '#DC2626' : 'var(--text-main)', marginTop: '2px' }}>
                  {daysLeft} Gün
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Son: {rem.due_date}
                </div>
              </div>
            );
          })}
        </div>

        {/* Yakıt Tüketim Özet Barı & Son Alımlar */}
        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
              ⛽ Yakıt Tüketimi & Ortalama Gider
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, background: '#E0E7FF', color: '#3730A3', padding: '2px 8px', borderRadius: '4px' }}>
                {consumption.avgLitersPer100Km} L / 100km
              </span>
              <span style={{ fontSize: '11px', fontWeight: 800, background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '4px' }}>
                ₺{consumption.avgCostPerKm} / km
              </span>
            </div>
          </div>

          {recentFuels.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
              Henüz yakıt kaydı girilmedi. Yakıt alımlarınızı ekleyerek tüketim analizi yapabilirsiniz.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {recentFuels.slice(0, 3).map((fuel: any) => (
                <div key={fuel.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 8px', background: 'white', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                  <span>⛽ {fuel.fuel_station} ({fuel.liters}L @ ₺{fuel.price_per_liter})</span>
                  <span style={{ fontWeight: 800 }}>₺{fuel.total_amount} • {fuel.km} KM</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
