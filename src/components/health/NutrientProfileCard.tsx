'use client';

import React, { useState } from 'react';
import { Sparkles, Table, ChevronRight, Activity, Search, ShieldCheck } from 'lucide-react';
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
      <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/30 rounded-3xl p-6 transition-all duration-300 shadow-xl space-y-5">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-teal-500/20 to-emerald-500/10 border border-teal-500/30 rounded-2xl text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                360° Vitamin & Mineral Analizi
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
                  TÜRKOMP & USDA
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Gıdaların makro, yağ asidi, vitamin, mineral ve etken madde dökümü
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenForFood('Ceviz')}
            className="p-2 bg-slate-800/80 hover:bg-teal-500/20 text-slate-300 hover:text-teal-300 rounded-xl border border-slate-700/60 transition-colors"
            title="Detaylı Tablo Aç"
          >
            <Table className="w-4 h-4" />
          </button>
        </div>

        {/* Search Launcher Trigger */}
        <div 
          onClick={() => handleOpenForFood('Ceviz')}
          className="cursor-pointer p-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-teal-500/40 rounded-2xl flex items-center justify-between text-xs text-slate-400 transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
            <span>Herhangi bir gıda aratın (Örn: Çiğ Ceviz, Zerdeçal, Avokado...)</span>
          </div>
          <div className="px-2.5 py-1 bg-teal-500/20 text-teal-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 group-hover:bg-teal-500 group-hover:text-slate-950 transition-colors">
            Sorgula <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Quick Access Badges */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Popüler Gıda İçerik Rehberi:</span>
            <span className="text-teal-400 font-normal">Tıkla & İncele</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {popularFoods.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleOpenForFood(f.name)}
                className="p-2.5 bg-slate-950/60 hover:bg-slate-800/70 border border-slate-800 hover:border-teal-500/30 rounded-xl text-left flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{f.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">{f.name}</div>
                    <div className="text-[10px] text-slate-400">{f.highlight}</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
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
