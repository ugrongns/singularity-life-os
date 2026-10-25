'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronRight, Search, ShieldCheck, Microscope } from 'lucide-react';
import NutrientProfileModal from '@/components/modals/NutrientProfileModal';

export default function NutrientProfileCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState('Ceviz');

  const popularFoods = [
    { name: 'Ceviz', icon: '🌰', highlight: 'Omega-3 %600+, B6, Magnezyum' },
    { name: 'Somon Balığı', icon: '🐟', highlight: 'EPA/DHA, D Vitamini, Selenyum' },
    { name: 'Brezilya Cevizi', icon: '🇧🇷', highlight: 'İyot & Selenyum %1000+' },
    { name: 'Zerdeçal', icon: '🌿', highlight: 'Kurkumin & Biyoaktif Polifenol' },
    { name: 'Yumurta', icon: '🥚', highlight: 'Kolin, B12, Biyoyararlanım BCAA' },
    { name: 'Avokado', icon: '🥑', highlight: 'Oleik Asit, Potasyum, Lif' }
  ];

  const handleOpenForFood = (food: string) => {
    setSelectedFood(food);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
        {/* Başlık Satırı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(20, 184, 166, 0.12)',
                color: '#14B8A6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Microscope size={18} color="#14B8A6" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                360° Vitamin & Mineral Laboratuvarı
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                TÜRKOMP & USDA Biyolojik Etken Madde Veri Tabanı
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: '10px',
              backgroundColor: 'rgba(20, 184, 166, 0.12)',
              color: '#0D9488',
              border: '1px solid rgba(20, 184, 166, 0.25)',
              padding: '3px 8px',
              borderRadius: '999px',
              fontWeight: 800
            }}
          >
            TÜRKOMP v2
          </span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
          Tükettiğiniz gıdaların biyoaktif bileşenlerini, yağ asidi profillerini, esansiyel aminoasitlerini ve mikro besin değerlerini sorgulayın.
        </p>

        {/* Hızlı Arama Tetikleyicisi */}
        <div
          onClick={() => handleOpenForFood('Ceviz')}
          style={{
            cursor: 'pointer',
            padding: '12px 14px',
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-muted)',
            transition: 'border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="#0D9488" />
            <span>Herhangi bir gıda aratın (Örn: Ceviz, Somon, Zerdeçal...)</span>
          </div>
          <span
            style={{
              backgroundColor: '#0D9488',
              color: '#fff',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              boxShadow: '0 1px 4px rgba(13, 148, 136, 0.25)'
            }}
          >
            Sorgula ➔
          </span>
        </div>

        {/* Popüler Besinler Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Öne Çıkan Süper Gıdalar:</span>
            <span style={{ color: '#0D9488' }}>Tıkla & Laboratuvar Karnesini Gör</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
            {popularFoods.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleOpenForFood(f.name)}
                style={{
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '18px' }}>{f.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.highlight}
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginLeft: '4px' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <NutrientProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialFoodName={selectedFood}
        initialGrams={100}
      />
    </>
  );
}
