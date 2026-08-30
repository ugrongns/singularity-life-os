'use client';
import { useState } from 'react';

interface HomeMaintenanceRecord {
  id: string;
  item_type: string;
  title: string;
  last_serviced_date: string;
  next_due_date: string;
  interval_months: number;
  cost_estimate: number;
  days_left: number;
  status: 'ok' | 'warning' | 'urgent';
}

interface HomeAppliance {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  purchase_date?: string;
  warranty_months?: number;
  warranty_expiry_date?: string;
  days_left_warranty?: number | null;
  is_warranty_active?: boolean;
  service_phone?: string;
  receipt_url?: string;
}

interface Props {
  maintenanceRecords: HomeMaintenanceRecord[];
  appliances: HomeAppliance[];
  onOpenAddModal: () => void;
  onRefresh: () => void;
  onToast?: (msg: string) => void;
}

export default function HomeOperationsCard({
  maintenanceRecords,
  appliances,
  onOpenAddModal,
  onRefresh,
  onToast
}: Props) {
  const [activeTab, setActiveTab] = useState<'maintenance' | 'appliances'>('maintenance');

  const handleResetFilter = async (id: string, intervalMonths: number) => {
    try {
      const res = await fetch('/api/home-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_filter', record_id: id, months: intervalMonths })
      });
      const json = await res.json();
      if (json.success) {
        if (onToast) onToast(json.message || '🚰 Bakım yenilendi ve yeni periyot başlatıldı!');
        onRefresh();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      }
    } catch {
      if (onToast) onToast('❌ Bakım yenileme hatası.');
    }
  };

  const handleDeleteAppliance = async (id: string) => {
    if (!confirm('Bu cihaz kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch('/api/home-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_appliance', id })
      });
      const json = await res.json();
      if (onToast) onToast(json.message || 'Cihaz kaydı silindi.');
      onRefresh();
      window.dispatchEvent(new CustomEvent('singularity-refresh'));
    } catch {
      if (onToast) onToast('❌ Silme hatası.');
    }
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🏠</span>
          <span>Ev Operasyonları & Garanti Takibi</span>
        </div>
      </div>

      <div className="card-action-bar">
        <button className="btn-primary" style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '12px' }} onClick={onOpenAddModal}>
          + Ev Kaydı Ekle
        </button>
      </div>

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 800, borderRadius: '6px', cursor: 'pointer',
            border: activeTab === 'maintenance' ? '1px solid #4F46E5' : '1px solid transparent',
            background: activeTab === 'maintenance' ? '#EEF2FF' : 'transparent',
            color: activeTab === 'maintenance' ? '#4F46E5' : 'var(--text-muted)'
          }}
        >
          💧 Periyodik Ev Bakımları ({maintenanceRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('appliances')}
          style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 800, borderRadius: '6px', cursor: 'pointer',
            border: activeTab === 'appliances' ? '1px solid #4F46E5' : '1px solid transparent',
            background: activeTab === 'appliances' ? '#EEF2FF' : 'transparent',
            color: activeTab === 'appliances' ? '#4F46E5' : 'var(--text-muted)'
          }}
        >
          📺 Garanti & Demirbaşlar ({appliances.length})
        </button>
      </div>

      {activeTab === 'maintenance' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {maintenanceRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
              Henüz ev bakım kaydı bulunmuyor.
            </div>
          ) : (
            maintenanceRecords.map(rec => {
              const isUrgent = rec.status === 'urgent';
              const isWarning = rec.status === 'warning';

              return (
                <div
                  key={rec.id}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: isUrgent ? '#FEF2F2' : isWarning ? '#FFFBEB' : 'var(--surface-subtle)',
                    border: `1px solid ${isUrgent ? '#FCA5A5' : isWarning ? '#FDE68A' : 'var(--border)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {rec.title}
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                      background: isUrgent ? '#DC2626' : isWarning ? '#D97706' : '#059669', color: 'white'
                    }}>
                      {isUrgent ? '⚠️ BAKIM ZAMANI GELDİ!' : isWarning ? '⚡ YAKLAŞTI' : '✓ DURUM İYİ'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div>
                      <span>Son Bakım: <strong>{rec.last_serviced_date}</strong></span>
                      <span style={{ margin: '0 6px' }}>•</span>
                      <span>Gelecek: <strong>{rec.next_due_date}</strong></span>
                    </div>
                    <div style={{ fontWeight: 800, color: isUrgent ? '#DC2626' : isWarning ? '#D97706' : '#059669' }}>
                      {rec.days_left <= 0 ? 'Bugün Bakım Günü!' : `${rec.days_left} Gün Kaldı`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Tahmini Tutar: ₺{rec.cost_estimate} ({rec.interval_months} Ayda Bir)
                    </span>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleResetFilter(rec.id, rec.interval_months)}
                      style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 800, background: isUrgent ? '#DC2626' : 'var(--text-main)' }}
                    >
                      🔄 Bakım Yapıldı (Sıfırla)
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {appliances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
              Henüz kayıtlı beyaz eşya veya garanti bulunmuyor.
            </div>
          ) : (
            appliances.map(app => (
              <div
                key={app.id}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                    📺 {app.name} {app.brand && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({app.brand} {app.model})</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                    <span>Satın Alma: {app.purchase_date}</span>
                    <span>•</span>
                    <span>Garanti: {app.warranty_months} Ay</span>
                  </div>
                  {app.warranty_expiry_date && (
                    <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: 700, color: app.is_warranty_active ? '#059669' : '#DC2626' }}>
                      {app.is_warranty_active ? `✓ Garanti Bitiş: ${app.warranty_expiry_date} (${app.days_left_warranty} gün kaldı)` : `❌ Garanti Süresi Doldu (${app.warranty_expiry_date})`}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {app.receipt_url && (
                    <a
                      href={app.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '6px 10px', fontSize: '11px', fontWeight: 800, background: '#ECFDF5',
                        color: '#059669', border: '1px solid #A7F3D0', borderRadius: '6px', textDecoration: 'none'
                      }}
                    >
                      🧾 Fatura
                    </a>
                  )}

                  {app.service_phone && (
                    <a
                      href={`tel:${app.service_phone}`}
                      style={{
                        padding: '6px 10px', fontSize: '11px', fontWeight: 800, background: '#EEF2FF',
                        color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '6px', textDecoration: 'none'
                      }}
                    >
                      📞 Servis
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAppliance(app.id)}
                    style={{ background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', opacity: 0.6 }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
