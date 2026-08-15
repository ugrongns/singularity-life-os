'use client';
import { useState } from 'react';

interface Property {
  id: string;
  title: string;
  address?: string;
  property_type: string;
  estimated_market_value: number;
  monthly_rent_income: number;
  tenant_name?: string;
  tenant_phone?: string;
  rent_due_day: number;
  is_occupied: number;
  tufe_rate_percent?: number;
}

interface Props {
  properties: Property[];
  onRentCollectedSuccess: () => void;
}

export default function RealEstateCard({ properties, onRentCollectedSuccess }: Props) {
  const [isCollecting, setIsCollecting] = useState<string | null>(null);
  const [showTufeModal, setShowTufeModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [customTufeRate, setCustomTufeRate] = useState('58.5');

  const formatMoney = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  const handleCollectRent = async (p: Property) => {
    setIsCollecting(p.id);
    try {
      const res = await fetch('/api/real-estate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: p.id,
          wallet_id: 'wallet-garanti',
          month: new Date().toISOString().slice(0, 7)
        })
      });
      const json = await res.json();
      if (json.success) {
        onRentCollectedSuccess();
      } else {
        alert(json.error || 'Kira işlenemedi.');
      }
    } catch (err) {
      alert('Kira tahsilatında hata oluştu.');
    } finally {
      setIsCollecting(null);
    }
  };

  const handleOpenTufe = (p: Property) => {
    setSelectedProperty(p);
    setCustomTufeRate(p.tufe_rate_percent?.toString() || '58.5');
    setShowTufeModal(true);
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🏠</span>
          <span>Gayrimenkul & Kira Motoru</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {properties.map(p => {
          const annualRent = p.monthly_rent_income * 12;
          const grossYield = p.estimated_market_value > 0 ? ((annualRent / p.estimated_market_value) * 100).toFixed(1) : '0';
          const amortizationYears = annualRent > 0 ? (p.estimated_market_value / annualRent).toFixed(1) : '0';
          
          const tufeRate = parseFloat(customTufeRate) || 58.5;
          const maxLegalRent = Math.round(p.monthly_rent_income * (1 + (tufeRate / 100)));

          return (
            <div 
              key={p.id}
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{p.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.address}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Rayiç Piyasa Değeri</div>
                  <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 800 }}>
                    {formatMoney(p.estimated_market_value)}
                  </div>
                </div>
              </div>

              {/* Kiracı ve Kira Detayı */}
              <div style={{ background: 'white', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Kiracı: {p.tenant_name}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--emerald)', marginTop: '2px' }}>
                    {formatMoney(p.monthly_rent_income)} / Ay (Her ayın {p.rent_due_day}. günü)
                  </div>
                </div>

                <button 
                  className="btn-primary"
                  onClick={() => handleCollectRent(p)}
                  disabled={isCollecting === p.id}
                  style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                >
                  {isCollecting === p.id ? 'İşleniyor...' : '💰 Kira Tahsil Et'}
                </button>
              </div>

              {/* Getiri, Amortisman ve TÜFE Tavan Rozeti */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '6px' }}>
                <div style={{ background: '#F0FDF4', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Brüt Getiri</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#16A34A' }}>%{grossYield} Yıllık</div>
                </div>
                <div style={{ background: '#F0FDF4', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Amortisman</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#16A34A' }}>{amortizationYears} Yıl</div>
                </div>
                <button 
                  type="button" 
                  className="btn-subtle" 
                  onClick={() => handleOpenTufe(p)}
                  style={{ background: '#EFF6FF', padding: '6px 8px', borderRadius: '4px', textAlign: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                >
                  <div style={{ fontSize: '10px', color: '#1E40AF', fontWeight: 600 }}>⚖️ TÜFE Yasal Tavan</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB' }}>{formatMoney(maxLegalRent)} ➔</div>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* TÜFE Yasal Kira Artış Tavanı Modalı */}
      {showTufeModal && selectedProperty && (
        <div className="modal-overlay" onClick={() => setShowTufeModal(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="sheet-handle"></div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>⚖️ TÜFE Yasal Kira Artış Tavanı Hesaplayıcı</div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Borçlar Kanunu gereğince konut kiralarında yenileme döneminde uygulanabilecek <strong>azami yasal kira artış oranı</strong> 12 aylık ortalama TÜFE oranıdır.
            </p>

            <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Mevcut Kira Bedeli:</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{formatMoney(selectedProperty.monthly_rent_income)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>12 Aylık Ort. TÜFE Oranı (%):</span>
                <input 
                  type="number"
                  step="0.1"
                  value={customTufeRate}
                  onChange={e => setCustomTufeRate(e.target.value)}
                  style={{ width: '80px', padding: '6px', fontSize: '13px', fontWeight: 700, textAlign: 'right', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E40AF' }}>Yasal Azami Yeni Kira:</span>
                <span className="tabular-nums" style={{ fontSize: '18px', fontWeight: 800, color: '#2563EB' }}>
                  {formatMoney(Math.round(selectedProperty.monthly_rent_income * (1 + (parseFloat(customTufeRate) || 58.5) / 100)))}
                </span>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setShowTufeModal(false)} style={{ padding: '12px' }}>
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
