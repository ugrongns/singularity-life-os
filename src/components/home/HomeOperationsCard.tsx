'use client';
import { useState } from 'react';
import { Home, Wrench, ShieldCheck, Trash2, FileText, PhoneCall, Plus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
  maintenanceRecords = [],
  appliances = [],
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
      if (json.success) {
        if (onToast) onToast(json.message || 'Cihaz kaydı silindi.');
        onRefresh();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      }
    } catch {
      if (onToast) onToast('❌ Silme hatası.');
    }
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '16px',
        height: '100%',
        minHeight: '320px'
      }}
    >
      {/* Üst Başlık Barı */}
      <div className="card-header-block" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="icon-badge icon-badge-blue">
            <Home size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              Demirbaş & Tesisat
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Ev Operasyonları & Garanti
            </h2>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            borderRadius: 'var(--radius-full)',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 700
          }}
          onClick={onOpenAddModal}
        >
          <Plus size={14} />
          <span>Ev Kaydı Ekle</span>
        </button>
      </div>

      {/* Sekmeler */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          background: 'var(--surface-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 800,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'maintenance' ? 'var(--blue)' : 'transparent',
            color: activeTab === 'maintenance' ? '#FFFFFF' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Wrench size={13} strokeWidth={2} />
          <span>Periyodik Bakımlar ({maintenanceRecords.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appliances')}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 800,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'appliances' ? 'var(--blue)' : 'transparent',
            color: activeTab === 'appliances' ? '#FFFFFF' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <ShieldCheck size={13} strokeWidth={2} />
          <span>Garanti & Demirbaş ({appliances.length})</span>
        </button>
      </div>

      {/* İçerik Listesi */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeTab === 'maintenance' ? (
          maintenanceRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚰</div>
              Kayıtlı ev bakım veya filtre periyodu bulunmuyor.
            </div>
          ) : (
            maintenanceRecords.map((rec) => {
              const isUrgent = rec.status === 'urgent' || rec.days_left <= 0;
              const isWarning = rec.status === 'warning' || (rec.days_left > 0 && rec.days_left <= 15);

              return (
                <div
                  key={rec.id}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-subtle)',
                    border: `1px solid ${isUrgent ? 'rgba(244, 63, 94, 0.4)' : isWarning ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Wrench size={14} className="text-muted" />
                      <span>{rec.title}</span>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: isUrgent ? 'var(--rose-bg)' : isWarning ? 'var(--amber-bg)' : 'var(--emerald-bg)',
                        color: isUrgent ? 'var(--rose)' : isWarning ? 'var(--amber)' : 'var(--emerald)',
                        border: `1px solid ${isUrgent ? 'rgba(244, 63, 94, 0.3)' : isWarning ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}
                    >
                      {isUrgent ? '⚠️ BAKIM ZAMANI' : isWarning ? '⏳ YAKLAŞTI' : '✓ DURUM İYİ'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Son: {rec.last_serviced_date} • Gelecek: {rec.next_due_date}</span>
                    <span className="tabular-nums" style={{ fontWeight: 800, color: isUrgent ? 'var(--rose)' : isWarning ? 'var(--amber)' : 'var(--emerald)' }}>
                      {rec.days_left <= 0 ? 'Bugün Vadesi!' : `${rec.days_left} Gün Kaldı`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                    <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Tahmini: {rec.cost_estimate ? `${Number(rec.cost_estimate).toLocaleString('tr-TR')} ₺` : 'Belirtilmedi'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleResetFilter(rec.id, rec.interval_months)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        padding: '4px 10px',
                        fontWeight: 800,
                        borderRadius: 'var(--radius-full)',
                        background: isUrgent ? 'var(--rose)' : 'var(--surface)',
                        color: isUrgent ? '#FFFFFF' : 'var(--text-main)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={12} />
                      <span>Bakım Yapıldı</span>
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : (
          appliances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📺</div>
              Kayıtlı beyaz eşya veya garanti belgesi bulunmuyor.
            </div>
          ) : (
            appliances.map((app) => (
              <div
                key={app.id}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {app.name} {app.brand && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>({app.brand})</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Satın Alma: {app.purchase_date || '—'} • Garanti: {app.warranty_months || 24} Ay
                  </div>
                  {app.warranty_expiry_date && (
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: '11px',
                        marginTop: '3px',
                        fontWeight: 700,
                        color: app.is_warranty_active ? 'var(--emerald)' : 'var(--rose)'
                      }}
                    >
                      {app.is_warranty_active
                        ? `✓ Bitiş: ${app.warranty_expiry_date} (${app.days_left_warranty} gün)`
                        : `❌ Garanti Doldu (${app.warranty_expiry_date})`}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  {app.receipt_url && (
                    <a
                      href={app.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '5px 8px',
                        fontSize: '10px',
                        fontWeight: 800,
                        background: 'var(--emerald-bg)',
                        color: 'var(--emerald)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'none'
                      }}
                    >
                      <FileText size={11} />
                      <span>Fatura</span>
                    </a>
                  )}

                  {app.service_phone && (
                    <a
                      href={`tel:${app.service_phone}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '5px 8px',
                        fontSize: '10px',
                        fontWeight: 800,
                        background: 'var(--blue-bg)',
                        color: 'var(--blue)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'none'
                      }}
                    >
                      <PhoneCall size={11} />
                      <span>Servis</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteAppliance(app.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Cihazı Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
