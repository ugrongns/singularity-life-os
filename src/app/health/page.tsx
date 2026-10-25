'use client';

import React, { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import HealthSubNav, { FamilyMemberItem } from '@/components/layout/HealthSubNav';
import MacroSummaryCard from '@/components/health/MacroSummaryCard';
import FastingTimerCard from '@/components/health/FastingTimerCard';
import FoodQualityScoreCard from '@/components/health/FoodQualityScoreCard';
import HomeWorkoutTrackerCard from '@/components/health/HomeWorkoutTrackerCard';
import NutrientProfileCard from '@/components/health/NutrientProfileCard';
import PlateScanModal from '@/components/modals/PlateScanModal';
import BarcodeScanModal from '@/components/modals/BarcodeScanModal';
import DietPlanModal from '@/components/modals/DietPlanModal';
import AddMealModal from '@/components/modals/AddMealModal';
import EditHealthProfileModal from '@/components/modals/EditHealthProfileModal';

export default function HealthPage() {
  const [nutritionData, setNutritionData] = useState<any>(null);
  const [waterData, setWaterData] = useState<any>(null);
  const [fastingData, setFastingData] = useState<any>(null);
  const [foodScanData, setFoodScanData] = useState<any[]>([]);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isPlateScanOpen, setIsPlateScanOpen] = useState(false);
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);
  const [isDietOpen, setIsDietOpen] = useState(false);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [defaultMealType, setDefaultMealType] = useState<string | undefined>(undefined);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async (memberId: string | null = selectedMemberId) => {
    try {
      const memberQuery = memberId ? `?member_id=${memberId}` : '';
      const [nutRes, waterRes, fastRes, scanRes, notifRes, membersRes] = await Promise.all([
        fetch(`/api/health/nutrition${memberQuery}`),
        fetch(`/api/health/water${memberQuery}`),
        fetch(`/api/health/fasting${memberQuery}`),
        fetch('/api/health/scan-food'),
        fetch('/api/notifications'),
        fetch('/api/family-members')
      ]);

      const [nutJ, waterJ, fastJ, scanJ, notifJ, membersJ] = await Promise.all([
        nutRes.json(),
        waterRes.json(),
        fastRes.json(),
        scanRes.json(),
        notifRes.json(),
        membersRes.json().catch(() => ({ success: false, data: [] }))
      ]);

      if (nutJ.success) setNutritionData(nutJ.data);
      if (waterJ.success) setWaterData(waterJ.data);
      if (fastJ.success) setFastingData(fastJ.data);
      if (scanJ.success) setFoodScanData(scanJ.data || []);
      if (notifJ.success) setNotifData(notifJ.data);
      if (membersJ.success && Array.isArray(membersJ.data)) {
        setMembers(membersJ.data);
      }
    } catch (err) {
      console.error('Health data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMemberId);

    const handleRefresh = () => {
      fetchData(selectedMemberId);
    };
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, [selectedMemberId]);

  const handleUpdate = (msg?: string) => {
    fetchData(selectedMemberId);
    window.dispatchEvent(new CustomEvent('singularity-refresh'));
    if (msg) showToast(msg);
  };

  const handleSelectMember = (memberId: string | null) => {
    setSelectedMemberId(memberId);
  };

  const handleAddWater = async (amount: number) => {
    try {
      const res = await fetch('/api/health/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: amount, member_id: selectedMemberId })
      });
      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        handleUpdate(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFasting = async (action: 'start' | 'end', protocol: string = '16:8') => {
    try {
      const res = await fetch('/api/health/fasting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, protocol, member_id: selectedMemberId })
      });
      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        handleUpdate(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm('Bu öğün kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/health/nutrition?id=${mealId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        handleUpdate('🗑️ Öğün kaydı başarıyla silindi.');
      } else {
        alert(json.error || 'Öğün silinemedi.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧬</div>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Sağlık & Biyometrik Veriler Yükleniyor...</div>
        </div>
      </SharedLayout>
    );
  }

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div className="toast-glass">
          {toastMsg}
        </div>
      )}

      {/* Sayfa Üst Başlığı & Bilgilendirme */}
      <div style={{ padding: '0 4px 6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          🧬 Sağlık & Beslenme
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 14px' }}>
          Apple Health, MacroFactor ve Zero Fasting kalitesinde biyometrik takip panosu
        </p>

        {/* 1. Yapışkan Segmented Control & Aile Üyesi Seçici */}
        <HealthSubNav
          members={members}
          selectedMemberId={selectedMemberId}
          onSelectMember={handleSelectMember}
        />
      </div>

      {/* Ana Bento Izgarası: Masaüstü 1024px+ Eşit Yükseklik & 2 Sütun Hiyerarşisi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ÜST SATIR: Makro & Kalori Panosu (Sol) + Aralıklı Oruç Sayacı (Sağ) - Eşit Yükseklik */}
        <div className="health-bento-grid">
          {nutritionData && (
            <MacroSummaryCard
              summary={nutritionData.summary}
              meals={nutritionData.meals || []}
              waterData={waterData}
              onOpenPlateScan={() => setIsPlateScanOpen(true)}
              onOpenDietModal={() => setIsDietOpen(true)}
              onOpenAddMeal={(mealType) => {
                setDefaultMealType(mealType);
                setIsAddMealOpen(true);
              }}
              onOpenEditProfile={() => setIsEditProfileOpen(true)}
              onAddWater={handleAddWater}
              onDeleteMeal={handleDeleteMeal}
            />
          )}

          {fastingData && (
            <FastingTimerCard
              fastingData={fastingData}
              onToggleFasting={handleToggleFasting}
            />
          )}
        </div>

        {/* ALT SATIR: 2 Sütunlu Analitik Paneller (360° Vitamin & Gıda Analiz Karnesi) */}
        <div className="health-bento-grid">
          <NutrientProfileCard />

          <FoodQualityScoreCard
            scans={foodScanData}
            onOpenBarcodeScan={() => setIsBarcodeScanOpen(true)}
            onRefresh={() => fetchData(selectedMemberId)}
          />
        </div>

        {/* Egzersiz & Antrenman Takip Kartı */}
        <div>
          <HomeWorkoutTrackerCard />
        </div>
      </div>

      {/* Modallar */}
      <PlateScanModal
        isOpen={isPlateScanOpen}
        onClose={() => setIsPlateScanOpen(false)}
        onSuccess={(msg) => handleUpdate(msg)}
      />

      <BarcodeScanModal
        isOpen={isBarcodeScanOpen}
        onClose={() => setIsBarcodeScanOpen(false)}
        onSuccess={(msg) => handleUpdate(msg)}
      />

      <DietPlanModal
        isOpen={isDietOpen}
        onClose={() => setIsDietOpen(false)}
        onSuccess={(msg) => handleUpdate(msg)}
      />

      <AddMealModal
        isOpen={isAddMealOpen}
        initialMealType={defaultMealType}
        onClose={() => {
          setIsAddMealOpen(false);
          setDefaultMealType(undefined);
        }}
        onSuccess={(msg) => handleUpdate(msg)}
      />

      <EditHealthProfileModal
        isOpen={isEditProfileOpen}
        profile={nutritionData?.profile || nutritionData?.summary?.targets}
        onClose={() => setIsEditProfileOpen(false)}
        onSuccess={(msg) => handleUpdate(msg)}
      />
    </SharedLayout>
  );
}
