'use client';
import { useState, useEffect } from 'react';

interface MaintenanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MaintenanceHistoryModal({ isOpen, onClose }: MaintenanceHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/vehicles/maintenance')
        .then(res => res.json())
        .then(json => {
          if (json.success) setHistory(json.data);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatMoney = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>🛠️ Araç Servis & Bakım Defteri</div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>34 SG 2026</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>Yükleniyor...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
            {history.map(item => (
              <div 
                key={item.id} 
                style={{ 
                  background: 'var(--surface-subtle)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '14px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>
                    {item.km_at_service.toLocaleString('tr-TR')} KM Periyodik Bakım
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {formatMoney(item.cost)}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  📋 <strong>Değişen Parçalar:</strong> {item.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px dashed var(--border)' }}>
                  <span>🏢 Servis: {item.service_provider}</span>
                  <span>🗓️ Tarih: {item.service_date}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="btn-secondary" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  );
}
