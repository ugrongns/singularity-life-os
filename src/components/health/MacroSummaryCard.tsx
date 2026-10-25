'use client';

import React, { useState } from 'react';
import {
  Utensils,
  Camera,
  FileText,
  Plus,
  Settings2,
  Droplets,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Flame,
  CheckCircle2,
  Trash2
} from 'lucide-react';

export interface MealItem {
  id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  date?: string;
  created_at?: string;
}

interface MacroSummaryProps {
  summary: {
    consumed: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    targets: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    percentages: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  };
  meals?: MealItem[];
  waterData?: {
    consumed_ml: number;
    target_ml: number;
    percentage: number;
  };
  onOpenPlateScan: () => void;
  onOpenDietModal?: () => void;
  onOpenAddMeal?: (defaultType?: string) => void;
  onOpenEditProfile?: () => void;
  onAddWater?: (amount: number) => void;
  onDeleteMeal?: (mealId: string) => void;
}

const MEAL_CATEGORIES = [
  { key: 'breakfast', label: 'Kahvaltı', icon: '🍳', defaultCaloriesTarget: 550 },
  { key: 'lunch', label: 'Öğle Yemeği', icon: '🥗', defaultCaloriesTarget: 750 },
  { key: 'dinner', label: 'Akşam Yemeği', icon: '🥩', defaultCaloriesTarget: 650 },
  { key: 'snack', label: 'Ara Öğün & Atıştırmalık', icon: '🍏', defaultCaloriesTarget: 250 }
];

export default function MacroSummaryCard({
  summary,
  meals = [],
  waterData,
  onOpenPlateScan,
  onOpenDietModal,
  onOpenAddMeal,
  onOpenEditProfile,
  onAddWater,
  onDeleteMeal
}: MacroSummaryProps) {
  const { consumed, targets, percentages } = summary;
  const water = waterData || { consumed_ml: 1250, target_ml: 2500, percentage: 50 };

  // Akordeon açık/kapalı durumu (varsayılan olarak içinde yemek olanlar açık)
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    breakfast: true,
    lunch: true,
    dinner: false,
    snack: false
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // SVG Radial Ring Hesaplaması (Apple Health & MacroFactor Tarzı)
  const radius = 54;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const calPercent = Math.min(100, Math.max(0, percentages.calories || 0));
  const strokeDashoffset = circumference - (calPercent / 100) * circumference;
  const remainingCalories = Math.max(0, targets.calories - consumed.calories);

  // Öğünleri kategorilere ayır
  const groupedMeals: Record<string, MealItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
  };

  meals.forEach(m => {
    const type = (m.meal_type || 'snack').toLowerCase();
    if (groupedMeals[type]) {
      groupedMeals[type].push(m);
    } else {
      groupedMeals.snack.push(m);
    }
  });

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* 1. Üst Başlık & Eylemler */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#6366F1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Flame size={18} color="#6366F1" />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Beslenme & Biyometrik Makrolar
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              MacroFactor & Apple Health Algoritması
            </div>
          </div>
        </div>

        {onOpenEditProfile && (
          <button
            type="button"
            onClick={onOpenEditProfile}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700
            }}
            title="Hedef Kalori ve Makroları Düzenle"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Hedefler</span>
          </button>
        )}
      </div>

      {/* 2. Hızlı Aksiyon Araç Çubuğu */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px'
        }}
      >
        <button
          type="button"
          className="btn-primary"
          onClick={onOpenPlateScan}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
            borderRadius: '8px',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          <Camera size={14} />
          <span>Tabak Tara (AI)</span>
        </button>

        {onOpenAddMeal && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenAddMeal()}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderRadius: '8px'
            }}
          >
            <Plus size={14} />
            <span>Manuel Öğün</span>
          </button>
        )}

        {onOpenDietModal && (
          <button
            type="button"
            className="btn-subtle"
            onClick={onOpenDietModal}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderRadius: '8px'
            }}
          >
            <FileText size={14} color="#6366F1" />
            <span>Diyet Planı</span>
          </button>
        )}
      </div>

      {/* 3. Kalori Radial Progress Ring & 3'lü Makro Barları Bento Kutusu */}
      <div
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        {/* Sol Sütun: Dairesel Kalori Halkası */}
        <div style={{ position: 'relative', width: `${radius * 2}px`, height: `${radius * 2}px`, flexShrink: 0 }}>
          <svg
            height={radius * 2}
            width={radius * 2}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          >
            <defs>
              <linearGradient id="calorieRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#FB7185" />
              </linearGradient>
            </defs>

            {/* Arka Plan İzi */}
            <circle
              stroke="var(--border)"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />

            {/* İlerleme Çemberi */}
            <circle
              stroke="url(#calorieRingGradient)"
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              style={{
                strokeDashoffset,
                transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>

          {/* Daire İçi Metin */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              pointerEvents: 'none'
            }}
          >
            <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1.1, color: 'var(--text-main)' }}>
              {consumed.calories}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>
              / {targets.calories} kcal
            </div>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                color: calPercent >= 100 ? '#10B981' : '#F43F5E',
                marginTop: '2px'
              }}
            >
              %{calPercent}
            </span>
          </div>
        </div>

        {/* Sağ Sütun: 3'lü Makro Göstergeleri (Indigo, Amber, Emerald) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {/* Protein (Indigo) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
              <span style={{ color: '#6366F1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366F1' }} />
                🥩 Protein
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-main)' }}>
                {consumed.protein_g}g <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {targets.protein_g}g</span> (%{percentages.protein})
              </span>
            </div>
            <div style={{ height: '7px', backgroundColor: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, percentages.protein)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366F1 0%, #818CF8 100%)',
                  borderRadius: '999px',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
          </div>

          {/* Karbonhidrat (Amber) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
              <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                🌾 Karbonhidrat
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-main)' }}>
                {consumed.carbs_g}g <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {targets.carbs_g}g</span> (%{percentages.carbs})
              </span>
            </div>
            <div style={{ height: '7px', backgroundColor: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, percentages.carbs)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)',
                  borderRadius: '999px',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
          </div>

          {/* Sağlıklı Yağ (Emerald) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
              <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                🥑 Sağlıklı Yağ
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-main)' }}>
                {consumed.fat_g}g <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {targets.fat_g}g</span> (%{percentages.fat})
              </span>
            </div>
            <div style={{ height: '7px', backgroundColor: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, percentages.fat)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)',
                  borderRadius: '999px',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Günlük Su Takip Bandı (Sky Blue) */}
      <div
        style={{
          background: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Droplets className="w-4 h-4 text-sky-400" />
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
              Günlük Su: {water.consumed_ml} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {water.target_ml} ml</span>
            </span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7' }}>
            %{water.percentage}
          </span>
        </div>

        <div style={{ height: '6px', backgroundColor: 'rgba(14, 165, 233, 0.2)', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, water.percentage)}%`,
              height: '100%',
              backgroundColor: '#0284C7',
              borderRadius: '999px',
              transition: 'width 0.5s ease'
            }}
          />
        </div>

        {onAddWater && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => onAddWater(250)}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#0284C7',
                backgroundColor: 'var(--surface)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              +250 ml Bardak
            </button>
            <button
              type="button"
              onClick={() => onAddWater(500)}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#0284C7',
                backgroundColor: 'var(--surface)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              +500 ml Şişe
            </button>
          </div>
        )}
      </div>

      {/* 5. Günün Öğünleri Akordeon Listesi (Collapsible Accordion) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Günün Öğün Kayıtları ({meals.length})
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Kalan: <strong style={{ color: '#10B981' }}>{remainingCalories} kcal</strong>
          </span>
        </div>

        {MEAL_CATEGORIES.map(cat => {
          const catMeals = groupedMeals[cat.key] || [];
          const isOpen = openAccordions[cat.key];
          const totalCal = catMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
          const totalProt = catMeals.reduce((sum, m) => sum + (m.protein_g || 0), 0);
          const totalCarb = catMeals.reduce((sum, m) => sum + (m.carbs_g || 0), 0);
          const totalF = catMeals.reduce((sum, m) => sum + (m.fat_g || 0), 0);

          return (
            <div
              key={cat.key}
              style={{
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                transition: 'border-color 0.15s ease'
              }}
            >
              {/* Akordeon Başlık Çubuğu */}
              <div
                onClick={() => toggleAccordion(cat.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {cat.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({catMeals.length} kayıt)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: totalCal > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {totalCal} <span style={{ fontSize: '10px', fontWeight: 500 }}>kcal</span>
                    </span>
                    {totalCal > 0 && (
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '-1px' }}>
                        P:{totalProt}g • C:{totalCarb}g • Y:{totalF}g
                      </div>
                    )}
                  </div>
                  {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>
              </div>

              {/* Akordeon İçeriği */}
              {isOpen && (
                <div
                  style={{
                    padding: '8px 12px 12px',
                    borderTop: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)'
                  }}
                >
                  {catMeals.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Bu öğün için henüz kayıt eklenmedi.
                      </span>
                      {onOpenAddMeal && (
                        <button
                          type="button"
                          onClick={() => onOpenAddMeal(cat.key)}
                          style={{
                            background: 'none',
                            border: '1px dashed var(--border)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--blue)',
                            cursor: 'pointer'
                          }}
                        >
                          + Ekle
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {catMeals.map(meal => (
                        <div
                          key={meal.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--surface-subtle)',
                            fontSize: '12px'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{meal.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                              <span style={{ color: '#6366F1' }}>P: {meal.protein_g}g</span>
                              <span style={{ color: '#F59E0B' }}>C: {meal.carbs_g}g</span>
                              <span style={{ color: '#10B981' }}>Y: {meal.fat_g}g</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="tabular-nums" style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '12px' }}>
                              {meal.calories} kcal
                            </span>
                            {onDeleteMeal && (
                              <button
                                type="button"
                                onClick={() => onDeleteMeal(meal.id)}
                                title="Öğünü Sil"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '2px'
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5 hover:text-rose-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {onOpenAddMeal && (
                        <button
                          type="button"
                          onClick={() => onOpenAddMeal(cat.key)}
                          style={{
                            marginTop: '4px',
                            padding: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--blue)',
                            background: 'none',
                            border: '1px dashed var(--border)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          + {cat.label} Ekle
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
