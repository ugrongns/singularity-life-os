'use client';
import { useState, useEffect } from 'react';
import { Wrench, X, History, TrendingUp, Calendar, AlertCircle, DollarSign, Gauge } from 'lucide-react';
import { TurkishPlateBadge } from '@/components/vehicle/VehicleFleetCard';

interface MaintenanceHistoryModalProps {
  isOpen: boolean;
  vehicle?: any;
  onClose: () => void;
}

export default function MaintenanceHistoryModal({ isOpen, vehicle, onClose }: MaintenanceHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/vehicles/maintenance')
        .then(res => res.json())
        .then(json => {
          if (json.success) setHistory(json.data || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  const totalSpent = history.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
  const totalCount = history.length;
  const avgCost = totalCount > 0 ? Math.round(totalSpent / totalCount) : 0;
  const latestRecord = history[0];
  const nextTargetKm = latestRecord ? (Number(latestRecord.km_at_service) || 0) + 15000 : 15000;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="bottom-sheet" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '840px', 
          maxHeight: '90vh', 
          overflowY: 'auto',
          width: '95%'
        }}
      >
        <div className="sheet-handle" />

        {/* Modal Başlık Barı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-badge icon-badge-blue">
              <History size={18} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Araç Servis & Bakım Defteri
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Periyodik bakım ve parça değişim geçmişi
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {vehicle?.plate ? (
              <TurkishPlateBadge plate={vehicle.plate} />
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Filo Genel Bakım</span>
            )}
            <button
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Kapat"
              style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Servis kayıtları yükleniyor...
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🛠️</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>Henüz Servis Kaydı Bulunmuyor</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Periyodik bakım ve servis işlemlerinizi ekleyerek araç bakım maliyetlerinizi analiz edebilirsiniz.
            </div>
          </div>
        ) : (
          /* Split View Container (Masaüstünde Yan Yana, Mobilde Alt Alta) */
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: '20px',
              alignItems: 'flex-start'
            }}
          >
            {/* Sol Sütun: Harcama KPI Kartları (Masaüstü: ~260px, Mobil: %100) */}
            <div
              style={{
                flex: '1 1 240px',
                minWidth: '220px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📊 BAKIM ÖZETİ
              </div>

              {/* Toplam Harcama KPI */}
              <div
                style={{
                  background: 'var(--surface-subtle)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TOPLAM BAKIM GİDERİ</div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                  {formatMoney(totalSpent)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Toplam {totalCount} periyodik işlem
                </div>
              </div>

              {/* Ortalama İşlem Maliyeti KPI */}
              <div
                style={{
                  background: 'var(--surface-subtle)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ORTALAMA SERVİS BEDELİ</div>
                <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                  {formatMoney(avgCost)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  İşlem başına düşen tutar
                </div>
              </div>

              {/* Sonraki Tahmini Bakım Hedefi */}
              <div
                style={{
                  background: 'var(--indigo-bg)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--indigo)', fontWeight: 800 }}>GELECEK SERVİS HEDEFİ</div>
                <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                  {nextTargetKm.toLocaleString('tr-TR')} KM
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  15.000 KM periyodik döngü
                </div>
              </div>
            </div>

            {/* Sağ Sütun: Dikey Zaman Çizelgesi (Timeline) */}
            <div
              style={{
                flex: '2 1 360px',
                minWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxHeight: '520px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⏱️ SERVİS ZAMAN ÇİZELGESİ
              </div>

              <div style={{ position: 'relative', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Dikey Çizgi */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    bottom: '10px',
                    left: '5px',
                    width: '2px',
                    background: 'var(--border)'
                  }}
                />

                {history.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      position: 'relative',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    {/* Timeline Node Noktası */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-17px',
                        top: '14px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: 'var(--blue)',
                        border: '2px solid var(--surface)'
                      }}
                    />

                    {/* Başlık & Tutar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ background: 'var(--blue-bg)', color: 'var(--blue)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                          {item.km_at_service ? `${Number(item.km_at_service).toLocaleString('tr-TR')} KM` : 'KM Belirtilmedi'}
                        </span>
                        <span>{item.type === 'periyodik_bakim' ? 'Periyodik Bakım' : (item.type || 'Bakım')}</span>
                      </span>

                      <span className="tabular-nums" style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '14px' }}>
                        {formatMoney(item.cost)}
                      </span>
                    </div>

                    {/* Değişen Parçalar / Açıklama */}
                    <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>📋 Değişen Parçalar: </span>
                      {item.description || 'Detay girilmedi.'}
                    </div>

                    {/* Alt Bilgi: Servis & Tarih */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '6px', borderTop: '1px dashed var(--border)' }}>
                      <span>🏢 {item.service_provider || 'Özel Servis'}</span>
                      <span>🗓️ {item.service_date || 'Tarih Yok'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="modal-sticky-footer" style={{ marginTop: '16px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ width: '100%', minHeight: '44px', fontWeight: 800 }}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
