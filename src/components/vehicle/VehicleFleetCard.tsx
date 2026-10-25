'use client';
import { useState } from 'react';
import EditVehicleLegalModal from '@/components/modals/EditVehicleLegalModal';
import { 
  Car, 
  Fuel, 
  Wrench, 
  Gauge, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  History, 
  Plus, 
  TrendingUp, 
  ChevronRight,
  Edit3
} from 'lucide-react';

interface VehicleFleetCardProps {
  data: any;
  selectedVehicleId?: string;
  onSelectVehicle?: (vehicleId: string) => void;
  onOpenHistory?: () => void;
  onOpenFuelModal?: () => void;
  onOpenServiceModal?: () => void;
  onRefresh?: () => void;
  onAddVehicle?: () => void;
  onToast?: (msg: string) => void;
}

export function TurkishPlateBadge({ plate }: { plate: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        background: '#FFFFFF',
        color: '#0F172A',
        border: '1.5px solid #0F172A',
        borderRadius: '5px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        fontFamily: "'DIN Alternate', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace",
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      <div
        style={{
          background: '#003399',
          color: '#FFFFFF',
          padding: '4px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: '9px',
          letterSpacing: '0.5px',
          borderRight: '1.5px solid #0F172A',
          minWidth: '22px'
        }}
      >
        <span style={{ fontSize: '6px', opacity: 0.85, lineHeight: 1 }}>★</span>
        <span>TR</span>
      </div>
      <div
        style={{
          padding: '5px 10px',
          fontWeight: 900,
          fontSize: '15px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {plate}
      </div>
    </div>
  );
}

export default function VehicleFleetCard({
  data,
  selectedVehicleId,
  onSelectVehicle,
  onOpenHistory,
  onOpenFuelModal,
  onOpenServiceModal,
  onRefresh,
  onAddVehicle,
  onToast
}: VehicleFleetCardProps) {
  const [kmInput, setKmInput] = useState('');
  const [updatingKm, setUpdatingKm] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);

  const vehicle = data?.vehicle || null;

  if (!vehicle) {
    return (
      <div className="card">
        <div className="card-header-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-cyan">
              <Car size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                Garaj & Filo
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Araç Filosu & Bakım Takibi
              </h2>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>🚗</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>Henüz Kayıtlı Araç Bulunmuyor</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '360px', margin: '0 auto 20px' }}>
            Garajınıza yeni bir araç ekleyerek KM, periyodik bakım ve yakıt tüketim analizlerinizi takip edebilirsiniz.
          </div>
          {onAddVehicle && (
            <button
              onClick={onAddVehicle}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-full)',
                fontSize: '13px',
                fontWeight: 800
              }}
            >
              <Plus size={16} />
              <span>Garajıma Araç Ekle</span>
            </button>
          )}
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
        if (onToast) onToast(json.message);
        setKmInput('');
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      }
    } catch {
      if (onToast) onToast('❌ KM güncelleme hatası.');
    } finally {
      setUpdatingKm(false);
    }
  };

  const getLegalStatus = (daysLeft: number) => {
    if (daysLeft <= 0) {
      return {
        badgeText: 'Vadesi Doldu!',
        bg: 'var(--rose-bg)',
        color: 'var(--rose)',
        border: '1px solid rgba(244, 63, 94, 0.4)',
        level: 'urgent'
      };
    }
    if (daysLeft <= 7) {
      return {
        badgeText: `${daysLeft} Gün Kaldı`,
        bg: 'var(--rose-bg)',
        color: 'var(--rose)',
        border: '1px solid rgba(244, 63, 94, 0.4)',
        level: 'critical'
      };
    }
    if (daysLeft <= 30) {
      return {
        badgeText: `${daysLeft} Gün Kaldı`,
        bg: 'var(--amber-bg)',
        color: 'var(--amber)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        level: 'warning'
      };
    }
    return {
      badgeText: `${daysLeft} Gün Kaldı`,
      bg: 'var(--emerald-bg)',
      color: 'var(--emerald)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      level: 'good'
    };
  };

  const getTypeName = (t: string) => {
    if (t === 'muayene') return 'TÜVTÜRK Muayene';
    if (t === 'sigorta') return 'Trafik Sigortası';
    if (t === 'kasko') return 'Kasko Poliçesi';
    if (t === 'mtv_1') return 'MTV 1. Taksit';
    if (t === 'mtv_2') return 'MTV 2. Taksit';
    return t.toUpperCase();
  };

  const getTypeIcon = (t: string) => {
    if (t === 'muayene') return '🔍';
    if (t === 'sigorta') return '📄';
    if (t === 'kasko') return '🛡️';
    if (t.startsWith('mtv')) return '🏛️';
    return '🚗';
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Kart Başlığı & Hızlı Aksiyonlar */}
      <div className="card-header-block" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="icon-badge icon-badge-cyan">
            <Car size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              Garaj & Telemetri
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Araç Filosu & Bakım Takibi
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="btn-subtle"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700
              }}
              title="Tüm servis ve periyodik bakım defterini inceleyin"
            >
              <History size={13} />
              <span>Servis Defteri</span>
            </button>
          )}

          {onAddVehicle && (
            <button
              type="button"
              onClick={onAddVehicle}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 800
              }}
            >
              <Plus size={14} />
              <span>Araç Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* Çoklu Araç Filo Seçici Tabs (varsa) */}
      {data?.vehicles && data.vehicles.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {data.vehicles.map((v: any) => {
            const isSelected = v.id === vehicle.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVehicle && onSelectVehicle(v.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '2px solid var(--blue)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--blue-bg)' : 'var(--surface-subtle)',
                  color: isSelected ? 'var(--blue)' : 'var(--text-main)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>🚗</span>
                <span>{v.plate} ({v.make} {v.model})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tesla Stili Araç Kimlik & Telemetri Bento Kutusu */}
      <div
        style={{
          background: 'var(--surface-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {/* Üst Satır: TR Plaka, Model ve Güncel KM */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <TurkishPlateBadge plate={vehicle.plate} />
              <span
                style={{
                  fontSize: '11px',
                  background: 'var(--indigo-bg)',
                  color: 'var(--indigo)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 800,
                  border: '1px solid rgba(99, 102, 241, 0.25)'
                }}
              >
                {vehicle.fuel_type || 'Benzin'}
              </span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
              {vehicle.make} {vehicle.model} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>• {vehicle.year}</span>
            </div>
          </div>

          {/* Odometer Göstergesi */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              textAlign: 'right',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px' }}>
              CANLI ODOMETER
            </div>
            <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '0.5px' }}>
              {currentKm.toLocaleString('tr-TR')} <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>KM</span>
            </div>
          </div>
        </div>

        {/* 3'lü Telemetri & Tüketim Barı */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
            paddingTop: '6px',
            borderTop: '1px solid var(--border)'
          }}
        >
          {/* Ortalama Yakıt (L/100km) */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{ color: 'var(--indigo)', display: 'flex', alignItems: 'center' }}>
              <Fuel size={16} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>TÜKETİM</div>
              <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                {consumption.avgLitersPer100Km || '0'} <span style={{ fontSize: '10px', fontWeight: 600 }}>L/100km</span>
              </div>
            </div>
          </div>

          {/* Kilometre Maliyeti (TL/km) */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{ color: 'var(--emerald)', display: 'flex', alignItems: 'center' }}>
              <TrendingUp size={16} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>BİRİM GİDER</div>
              <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                ₺{consumption.avgCostPerKm || '0.00'} <span style={{ fontSize: '10px', fontWeight: 600 }}>/ km</span>
              </div>
            </div>
          </div>

          {/* Son Servis Durumu */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div style={{ color: isDueSoon ? 'var(--rose)' : 'var(--blue)', display: 'flex', alignItems: 'center' }}>
              <Gauge size={16} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>BAKIM VADESİ</div>
              <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 800, color: isDueSoon ? 'var(--rose)' : 'var(--text-main)' }}>
                {remainingKm.toLocaleString('tr-TR')} <span style={{ fontSize: '10px', fontWeight: 600 }}>KM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hızlı Aksiyonlar & KM Güncelleme Çubuğu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px' }}>
          {/* Hızlı KM Girişi */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              inputMode="numeric"
              placeholder={`KM Güncelle (örn: ${currentKm})`}
              value={kmInput}
              onChange={e => setKmInput(e.target.value)}
              className="tabular-nums"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
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
              disabled={updatingKm || !kmInput}
              className="btn-subtle"
              style={{
                padding: '9px 14px',
                fontSize: '12px',
                fontWeight: 800,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                minHeight: '38px'
              }}
            >
              {updatingKm ? 'İşleniyor...' : 'KM Kaydet'}
            </button>
          </div>

          {/* 2'li Ana Aksiyon Butonları (Yakıt & Servis) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={onOpenFuelModal}
              style={{
                padding: '11px 14px',
                fontSize: '13px',
                fontWeight: 800,
                background: '#059669',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                minHeight: '44px'
              }}
            >
              <Fuel size={16} />
              <span>Yakıt Alımı Ekle</span>
            </button>

            <button
              type="button"
              onClick={onOpenServiceModal}
              style={{
                padding: '11px 14px',
                fontSize: '13px',
                fontWeight: 800,
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                minHeight: '44px'
              }}
            >
              <Wrench size={16} />
              <span>Servis / Bakım Ekle</span>
            </button>
          </div>
        </div>
      </div>

      {/* 15.000 KM Periyodik Bakım Çubuğu */}
      <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 800, marginBottom: '6px', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wrench size={14} className="text-muted" />
            <span>Periyodik Bakım Döngüsü ({nextServiceKm.toLocaleString('tr-TR')} KM)</span>
          </span>
          <span className="tabular-nums" style={{ color: isDueSoon ? 'var(--rose)' : 'var(--emerald)', flexShrink: 0, fontWeight: 900 }}>
            {remainingKm.toLocaleString('tr-TR')} KM Kaldı
          </span>
        </div>
        
        <div className="progress-bar" style={{ height: '8px', marginBottom: '8px' }}>
          <div 
            className={`progress-fill ${isDueSoon ? 'rose' : 'emerald'}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} 
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Önceki Bakım: {(nextServiceKm - 15000).toLocaleString('tr-TR')} KM</span>
          <span>Hedef: {nextServiceKm.toLocaleString('tr-TR')} KM</span>
        </div>
      </div>

      {/* 3 Kademeli Yasal Tarihler & Geri Sayım Şeridi */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={15} style={{ color: 'var(--blue)' }} />
            <span>Yasal Belgeler & Muayene Takvimi</span>
          </div>
          <button
            type="button"
            onClick={() => setIsLegalModalOpen(true)}
            className="btn-subtle"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              fontWeight: 800
            }}
          >
            <Edit3 size={12} />
            <span>Tarihleri Düzenle</span>
          </button>
        </div>

        {/* 3'lü Yasal Tarih Bento Kartları (Mobilde daralmadan responsive sarılır) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px'
          }}
        >
          {legalReminders.map((rem: any) => {
            const dueDate = new Date(rem.due_date);
            const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const status = getLegalStatus(daysLeft);

            return (
              <div 
                key={rem.id}
                onClick={() => setIsLegalModalOpen(true)}
                style={{
                  background: status.bg,
                  border: status.border,
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                title="Tarihleri düzenlemek için tıklayın"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: status.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{getTypeIcon(rem.type)}</span>
                    <span>{getTypeName(rem.type)}</span>
                  </span>
                </div>

                <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: status.color, marginTop: '2px' }}>
                  {status.badgeText}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px dashed var(--border)' }}>
                  <span>Vade: {rem.due_date}</span>
                  {rem.policy_no && <span style={{ fontWeight: 600 }}>#{rem.policy_no}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Son Yakıt Kayıtları Şeridi */}
      <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Fuel size={14} className="text-muted" />
            <span>Son Yakıt Alımları</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Son {recentFuels.slice(0, 3).length} Kayıt
          </span>
        </div>

        {recentFuels.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
            Henüz yakıt kaydı bulunmuyor. Yakıt alımlarınızı ekleyerek tüketim analizi yapabilirsiniz.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentFuels.slice(0, 3).map((fuel: any) => (
              <div 
                key={fuel.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  fontSize: '11px', 
                  padding: '7px 10px', 
                  background: 'var(--surface-subtle)', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid var(--border)' 
                }}
              >
                <div>
                  <span style={{ fontWeight: 800 }}>⛽ {fuel.fuel_station || 'İstasyon'}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({fuel.liters}L @ ₺{fuel.price_per_liter})</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tabular-nums" style={{ fontWeight: 900, color: 'var(--text-main)' }}>₺{Number(fuel.total_amount).toLocaleString('tr-TR')}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>• {Number(fuel.km).toLocaleString('tr-TR')} KM</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yasal Tarihleri Düzenleme Modalı */}
      <EditVehicleLegalModal
        isOpen={isLegalModalOpen}
        vehicle={vehicle}
        legalReminders={legalReminders}
        onClose={() => setIsLegalModalOpen(false)}
        onSuccess={(msg) => {
          if (onToast && msg) onToast(msg);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
