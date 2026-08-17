'use client';

import React, { useState } from 'react';
import { Sparkles, Table, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import NutrientProfileModal from '@/components/modals/NutrientProfileModal';

export default function NutrientProfileCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState('Ceviz');

  const popularFoods = [
    { name: 'Ceviz', icon: '🌰', highlight: 'Omega-3 %600+, B6, Magnezyum' },
    { name: 'Somon Balığı', icon: '🐟', highlight: 'EPA/DHA, D Vitamini, Selenyum' },
    { name: 'Brezilya Cevizi', icon: '🇧🇷', highlight: 'İyot & Selenyum %1000+' },
    { name: 'Zerdeçal', icon: '🌿', highlight: 'Kurkumin & Polifenoller' },
    { name: 'Yumurta', icon: '🥚', highlight: 'Kolin, B12, BCAA' }
  ];

  const handleOpenForFood = (food: string) => {
    setSelectedFood(food);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="card">
        <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles className="w-5 h-5 text-teal-400" />
            <span>360° Vitamin & Mineral Analizi</span>
          </div>
          <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
            TÜRKOMP & USDA
          </span>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '14px' }}>
          Gıdaların makro, yağ asidi, vitamin, mineral ve biyo-aktif etken madde haritası
        </div>

        {/* Search Launcher Trigger */}
        <div 
          onClick={() => handleOpenForFood('Ceviz')}
          style={{
            cursor: 'pointer',
            padding: '12px 14px',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search className="w-4 h-4 text-teal-400" />
            <span>Herhangi bir gıda aratın (Örn: Ceviz, Somon, Zerdeçal...)</span>
          </div>
          <span style={{ background: '#10B981', color: '#091512', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', fontSize: '11px' }}>
            Sorgula ➔
          </span>
        </div>

        {/* Quick Access Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Popüler Gıda İçerik Rehberi:</span>
            <span style={{ color: '#10B981' }}>Tıkla & İncele</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            {popularFoods.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleOpenForFood(f.name)}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>{f.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{f.highlight}</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
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
