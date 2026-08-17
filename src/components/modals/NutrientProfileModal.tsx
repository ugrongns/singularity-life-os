'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Sparkles, Scale, Info, Flame, Droplet, ShieldCheck, HeartPulse, Activity } from 'lucide-react';

interface NutrientItem {
  label: string;
  value: string;
  daily_percent: number | null;
}

interface NutrientProfileData {
  food_name: string;
  portion_g: number;
  categories: {
    macros?: NutrientItem[];
    vitamins?: NutrientItem[];
    minerals?: NutrientItem[];
    special_compounds?: NutrientItem[];
  };
}

interface NutrientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFoodName?: string;
  initialGrams?: number;
}

export default function NutrientProfileModal({
  isOpen,
  onClose,
  initialFoodName = 'Ceviz',
  initialGrams = 100
}: NutrientProfileModalProps) {
  const [searchQuery, setSearchQuery] = useState(initialFoodName);
  const [grams, setGrams] = useState(initialGrams);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NutrientProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (food: string, portionGrams: number) => {
    if (!food.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/health/nutrition-profile?food_name=${encodeURIComponent(food)}&grams=${portionGrams}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'İçerik bilgisi alınamadı.');
      }
    } catch (err: any) {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialFoodName);
      setGrams(initialGrams);
      fetchProfile(initialFoodName, initialGrams);
    }
  }, [isOpen, initialFoodName, initialGrams]);

  if (!isOpen) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProfile(searchQuery, grams);
  };

  const handleGramsChange = (newGrams: number) => {
    setGrams(newGrams);
    fetchProfile(searchQuery, newGrams);
  };

  const getPercentBadgeColor = (percent: number | null) => {
    if (percent === null) return 'bg-slate-700/50 text-slate-300 border-slate-700';
    if (percent >= 100) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
    if (percent >= 30) return 'bg-teal-500/20 text-teal-300 border-teal-500/30 font-semibold';
    if (percent >= 10) return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-teal-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                360° Besin, Vitamin & Mineral Profileri
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">TÜRKOMP & USDA</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Makro besinler, yağ asitleri, vitaminler, mineraller ve özel biyo-aktif etken maddeler
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Grams Bar */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[280px] relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gıda adı yazın (Örn: Çiğ Ceviz, Somon, Zerdeçal, Brezilya Cevizi...)"
              className="w-full pl-11 pr-24 py-3 bg-slate-950/80 border border-slate-800 focus:border-teal-500 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <button
              type="submit"
              className="absolute right-2 top-2 px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-xl transition-all shadow-md shadow-teal-500/20"
            >
              Araştir
            </button>
          </form>

          {/* Portion Selector Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-teal-400" /> Porsiyon:
            </span>
            {[30, 50, 100, 150, 200].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => handleGramsChange(g)}
                className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-all ${
                  grams === g
                    ? 'bg-teal-500 text-slate-950 shadow-sm font-semibold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/50'
                }`}
              >
                {g}g
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-400 rounded-full animate-spin"></div>
              <p className="text-sm text-teal-300 font-medium animate-pulse">
                {searchQuery} için TÜRKOMP & USDA verileri sorgulanıyor...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm text-center">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Product Header Banner */}
              <div className="p-5 bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-950 border border-teal-500/20 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">{data.food_name}</h3>
                  <p className="text-xs text-teal-400 mt-1 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> 100 gram ve {data.portion_g}g ölçeğindeki tüm temel makro ve mikro besin içerikleri
                  </p>
                </div>
                <div className="px-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-right">
                  <div className="text-xs text-slate-400">Porsiyon Miktarı</div>
                  <div className="text-lg font-bold text-teal-300">{data.portion_g} Gram</div>
                </div>
              </div>

              {/* Table Section 1: Makro Besinler ve Yağ Asidi Profili */}
              {data.categories?.macros && data.categories.macros.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Makro Besinler ve Enerji Değerleri</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Besin Öğesi</th>
                          <th className="py-3 px-4 font-semibold">{data.portion_g} Gramdaki Miktar</th>
                          <th className="py-3 px-4 font-semibold text-right">Günlük Karşılama Oranı (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {data.categories.macros.map((item, idx) => {
                          const isSub = item.label.startsWith('└');
                          return (
                            <tr key={idx} className={`hover:bg-slate-900/40 transition-colors ${isSub ? 'italic text-slate-300' : 'font-semibold text-white'}`}>
                              <td className="py-2.5 px-4 pl-4">{item.label}</td>
                              <td className="py-2.5 px-4 font-mono text-teal-300">{item.value}</td>
                              <td className="py-2.5 px-4 text-right">
                                {item.daily_percent !== null ? (
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] ${getPercentBadgeColor(item.daily_percent)}`}>
                                    %{item.daily_percent}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Table Section 2: Önemli Vitaminler */}
              {data.categories?.vitamins && data.categories.vitamins.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-2">
                    <HeartPulse className="w-4 h-4 text-rose-400" />
                    <span>Önemli Vitaminler</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Vitamin</th>
                          <th className="py-3 px-4 font-semibold">{data.portion_g} Gramdaki Miktar</th>
                          <th className="py-3 px-4 font-semibold text-right">Günlük Karşılama Oranı (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {data.categories.vitamins.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-4 font-medium text-white">{item.label}</td>
                            <td className="py-2.5 px-4 font-mono text-teal-300">{item.value}</td>
                            <td className="py-2.5 px-4 text-right">
                              {item.daily_percent !== null ? (
                                <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] ${getPercentBadgeColor(item.daily_percent)}`}>
                                  %{item.daily_percent}
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Table Section 3: Temel Mineraller */}
              {data.categories?.minerals && data.categories.minerals.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>Temel Mineraller</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Mineral</th>
                          <th className="py-3 px-4 font-semibold">{data.portion_g} Gramdaki Miktar</th>
                          <th className="py-3 px-4 font-semibold text-right">Günlük Karşılama Oranı (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {data.categories.minerals.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-4 font-medium text-white">{item.label}</td>
                            <td className="py-2.5 px-4 font-mono text-teal-300">{item.value}</td>
                            <td className="py-2.5 px-4 text-right">
                              {item.daily_percent !== null ? (
                                <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] ${getPercentBadgeColor(item.daily_percent)}`}>
                                  %{item.daily_percent}
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Table Section 4: Özel Biyo-Aktif Bileşenler, Antioksidanlar & Polifenoller */}
              {data.categories?.special_compounds && data.categories.special_compounds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-purple-300 border-b border-slate-800 pb-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Özel Biyo-Aktif Etken Maddeler, Antioksidanlar & Polifenoller</span>
                  </div>
                  <div className="bg-slate-950/60 border border-purple-500/20 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-purple-950/30 text-purple-200 border-b border-purple-900/40">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Bileşen / Etken Madde</th>
                          <th className="py-3 px-4 font-semibold">{data.portion_g} Gramdaki Miktar</th>
                          <th className="py-3 px-4 font-semibold text-right">Günlük Karşılama Oranı (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-900/30 text-slate-200">
                        {data.categories.special_compounds.map((item, idx) => (
                          <tr key={idx} className="hover:bg-purple-900/20 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-purple-200">{item.label}</td>
                            <td className="py-2.5 px-4 font-mono text-purple-300">{item.value}</td>
                            <td className="py-2.5 px-4 text-right">
                              {item.daily_percent !== null ? (
                                <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] ${getPercentBadgeColor(item.daily_percent)}`}>
                                  %{item.daily_percent}
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px]">Özel Etken Madde</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-300">Not:</strong> Günlük karşılama oranları (% RDA), ortalama 2000 kalorilik bir yetişkin diyeti baz alınarak TÜRKOMP ve USDA referans verileriyle hesaplanmıştır.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
