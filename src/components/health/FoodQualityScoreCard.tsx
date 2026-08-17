'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, ShieldCheck, AlertTriangle, Leaf, Plus } from 'lucide-react';

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
  onRefresh?: () => void;
}

export default function FoodQualityScoreCard({ scans: initialScans, onOpenBarcodeScan, onRefresh }: FoodQualityProps) {
  const [items, setItems] = useState<FoodScan[]>([]);

  useEffect(() => {
    if (Array.isArray(initialScans)) {
      // Filter out duplicate unparsed items if any
      setItems(initialScans.filter(s => !s.product_name?.includes('Taranan Barkod (')));
    }
  }, [initialScans]);

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await fetch(`/api/health/scan-food?id=${id}`, { method: 'DELETE' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete scan item error:', err);
    }
  };

  const handleClearJunk = async () => {
    setItems(prev => prev.filter(i => !i.product_name?.includes('Taranan Barkod')));
    try {
      await fetch('/api/health/scan-food?clear_junk=true', { method: 'DELETE' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Clear junk error:', err);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏷️</span>
          <span>Paketli Gıda Analiz Karnesi</span>
        </div>
        {items.length > 0 && (
          <button 
            type="button"
            onClick={handleClearJunk}
            style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Temizle
          </button>
        )}
      </div>

      <div className="card-action-bar" style={{ marginTop: '10px', marginBottom: '14px' }}>
        <button className="btn-subtle" onClick={onOpenBarcodeScan} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Plus className="w-4 h-4" />
          <span>Barkod / Etiket Tara</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏷️</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Henüz Kayıtlı Paketli Gıda Bulunmuyor</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '14px' }}>
              Barkod okutarak paketli gıdaların E-kodlu katkı maddelerini ve pestisit risk karnesini analiz edebilirsiniz.
            </div>
            <button className="btn-primary" onClick={onOpenBarcodeScan} style={{ fontSize: '12px', padding: '8px 16px' }}>
              + 📷 Barkod / Etiket Tara
            </button>
          </div>
        ) : (
          items.map(scan => {
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
                  gap: '8px',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: '28px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{scan.product_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {scan.brand || 'Genel'} {scan.barcode ? `• Barkod: ${scan.barcode}` : ''}
                    </div>
                  </div>

                  <span 
                    style={{ 
                      background: isClean ? 'var(--emerald-bg)' : 'var(--rose-bg)', 
                      color: isClean ? 'var(--emerald)' : 'var(--rose)',
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {scan.health_score} / 100
                  </span>
                </div>

                {/* Trash Delete Button */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteItem(scan.id, e)}
                  title="Listeden ve Veritabanından Sil"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Katkı Maddeleri Analizi */}
                {scan.additives_detected && (
                  <div style={{ fontSize: '12px', color: isClean ? '#065F46' : '#991B1B', lineHeight: 1.4, background: isClean ? '#ECFDF5' : '#FEF2F2', padding: '8px 10px', borderRadius: '6px' }}>
                    ⚠️ <strong>İçerik Analizi:</strong> {scan.additives_detected}
                  </div>
                )}

                {/* Pestisit & Öneri */}
                {scan.pesticide_risk_summary && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span><strong>Pestisit Riski:</strong> {scan.pesticide_risk_summary}</span>
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
