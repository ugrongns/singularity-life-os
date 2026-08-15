'use client';

interface FoodScan {
  id: string;
  product_name: string;
  brand?: string;
  barcode?: string;
  health_score: number;
  risk_level: string;
  additives_detected?: string;
  pesticide_risk_summary?: string;
  alternative_suggestions?: string;
}

interface FoodQualityProps {
  scans: FoodScan[];
  onOpenBarcodeScan: () => void;
}

export default function FoodQualityScoreCard({ scans, onOpenBarcodeScan }: FoodQualityProps) {
  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🏷️</span>
          <span>Paketli Gıda & Pestisit Skoru</span>
        </div>
      </div>

      <div className="card-action-bar">
        <button className="btn-subtle" onClick={onOpenBarcodeScan}>
          + Barkod / Etiket Tara ➔
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(!Array.isArray(scans) || scans.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏷️</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Henüz Taratılan Paketli Gıda Bulunmuyor</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '14px' }}>
              Barkod okutarak paketli gıdaların NOVA işlenmişlik seviyesini, E-kodlu katkı maddelerini ve pestisit risk karnesini analiz edebilirsiniz.
            </div>
            <button className="btn-primary" onClick={onOpenBarcodeScan} style={{ fontSize: '12px', padding: '8px 16px' }}>
              + 📷 Barkod / Etiket Tara
            </button>
          </div>
        ) : (
          scans.map(scan => {
            const isClean = scan.health_score >= 70;
            return (
              <div 
                key={scan.id} 
                style={{ 
                  background: 'var(--surface-subtle)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{scan.product_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{scan.brand} • Barkod: {scan.barcode}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span 
                      style={{ 
                        background: isClean ? 'var(--emerald-bg)' : 'var(--rose-bg)', 
                        color: isClean ? 'var(--emerald)' : 'var(--rose)',
                        fontSize: '13px',
                        fontWeight: 800,
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-full)'
                      }}
                    >
                      {scan.health_score} / 100
                    </span>
                  </div>
                </div>

                {/* Katkı Maddeleri Analizi */}
                <div style={{ fontSize: '12px', color: isClean ? '#065F46' : '#991B1B', lineHeight: 1.4, background: isClean ? '#ECFDF5' : '#FEF2F2', padding: '6px 10px', borderRadius: '6px' }}>
                  ⚠️ <strong>İçerik Analizi:</strong> {scan.additives_detected}
                </div>

                {/* Pestisit & Öneri */}
                {scan.pesticide_risk_summary && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    🌱 <strong>Pestisit Riski:</strong> {scan.pesticide_risk_summary}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
