'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, ShieldCheck, AlertTriangle, Leaf, Plus, Sparkles, Tag, ShieldAlert } from 'lucide-react';
import NutrientProfileModal from '@/components/modals/NutrientProfileModal';

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
  micronutrient_profile?: string;
}

interface FoodQualityProps {
  scans: FoodScan[];
  onOpenBarcodeScan: () => void;
  onRefresh?: () => void;
}

export default function FoodQualityScoreCard({ scans: initialScans, onOpenBarcodeScan, onRefresh }: FoodQualityProps) {
  const [items, setItems] = useState<FoodScan[]>([]);
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState(false);
  const [selectedNutrientFood, setSelectedNutrientFood] = useState('');
  const [selectedNutrientProfile, setSelectedNutrientProfile] = useState<string | null>(null);

  useEffect(() => {
    if (Array.isArray(initialScans)) {
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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      {/* Başlık Çubuğu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(236, 72, 153, 0.12)',
              color: '#EC4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Tag size={18} color="#EC4899" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Paketli Gıda Analiz Karnesi
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              E-Kodlu Katkı Maddeleri, Pestisit & Toksik Madde Analizi
            </div>
          </div>
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

      {/* Aksiyon Barı */}
      <button
        type="button"
        className="btn-primary"
        onClick={onOpenBarcodeScan}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '10px 14px',
          fontSize: '12px',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #EC4899 0%, #D946EF 100%)',
          boxShadow: '0 2px 8px rgba(236, 72, 153, 0.25)',
          borderRadius: '8px',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer'
        }}
      >
        <Plus size={14} />
        <span>📷 Yeni Barkod / Etiket Tara</span>
      </button>

      {/* Taranan Gıda Kartları Listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 16px',
              backgroundColor: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏷️</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
              Henüz Kayıtlı Paketli Gıda Bulunmuyor
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '320px', margin: '4px auto 0', lineHeight: 1.4 }}>
              Market alışverişlerinde paket arkasındaki barkodu okutarak koruyucu kimyasalları, emülgatörleri ve toksisite skorunu anında görün.
            </div>
          </div>
        ) : (
          items.map(scan => {
            const isClean = scan.health_score >= 70;
            return (
              <div
                key={scan.id}
                style={{
                  backgroundColor: 'var(--surface-subtle)',
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
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {scan.product_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {scan.brand || 'Genel'} {scan.barcode ? `• Barkod: ${scan.barcode}` : ''}
                    </div>
                  </div>

                  <span
                    style={{
                      backgroundColor: isClean ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      color: isClean ? '#10B981' : '#F43F5E',
                      border: `1px solid ${isClean ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {scan.health_score} / 100
                  </span>
                </div>

                {/* Silme Butonu */}
                <button
                  type="button"
                  onClick={e => handleDeleteItem(scan.id, e)}
                  title="Listeden Sil"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <Trash2 className="w-4 h-4 hover:text-rose-500" />
                </button>

                {/* Katkı Maddeleri Analizi */}
                {scan.additives_detected && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: isClean ? '#10B981' : '#F43F5E',
                      lineHeight: 1.4,
                      backgroundColor: isClean ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                      border: `1px solid ${isClean ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                      padding: '6px 10px',
                      borderRadius: '6px'
                    }}
                  >
                    ⚠️ <strong>İçerik Analizi:</strong> {scan.additives_detected}
                  </div>
                )}

                {/* Pestisit Bilgisi */}
                {scan.pesticide_risk_summary && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span><strong>Pestisit:</strong> {scan.pesticide_risk_summary}</span>
                  </div>
                )}

                {/* 360° Vitamin & Mineral Karnesini Gör Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNutrientFood(scan.product_name);
                    setSelectedNutrientProfile(scan.micronutrient_profile || null);
                    setIsNutrientModalOpen(true);
                  }}
                  style={{
                    marginTop: '2px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: '#10B981',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  <span>360° Vitamin & Mineral Laboratuvarı ➔</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      <NutrientProfileModal
        isOpen={isNutrientModalOpen}
        onClose={() => setIsNutrientModalOpen(false)}
        initialFoodName={selectedNutrientFood}
        initialGrams={100}
        initialProfile={selectedNutrientProfile}
      />
    </div>
  );
}
