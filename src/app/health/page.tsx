'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import HealthSubNav from '@/components/layout/HealthSubNav';
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
  const [loading, setLoading] = useState(true);

  // Modals
  const [isPlateScanOpen, setIsPlateScanOpen] = useState(false);
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);
  const [isDietOpen, setIsDietOpen] = useState(false);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [nutRes, waterRes, fastRes, scanRes, notifRes] = await Promise.all([
        fetch('/api/health/nutrition'),
        fetch('/api/health/water'),
        fetch('/api/health/fasting'),
        fetch('/api/health/scan-food'),
        fetch('/api/notifications')
      ]);

      const [nutJ, waterJ, fastJ, scanJ, notifJ] = await Promise.all([
        nutRes.json(),
        waterRes.json(),
        fastRes.json(),
        scanRes.json(),
        notifRes.json()
      ]);

      if (nutJ.success) setNutritionData(nutJ.data);
      if (waterJ.success) setWaterData(waterJ.data);
      if (fastJ.success) setFastingData(fastJ.data);
      if (scanJ.success) setFoodScanData(scanJ.data || []);
      if (notifJ.success) setNotifData(notifJ.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, []);

  const handleUpdate = (msg?: string) => {
    fetchData();
    window.dispatchEvent(new CustomEvent('singularity-refresh'));
    if (msg) showToast(msg);
  };

  const handleAddWater = async (amount: number) => {
    try {
      const res = await fetch('/api/health/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: amount })
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
        body: JSON.stringify({ action, protocol })
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

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Yükleniyor...</div>
      </SharedLayout>
    );
  }

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 500, boxShadow: 'var(--shadow-lg)', zIndex: 999 }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>🧬 Sağlık & Beslenme</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 12px' }}>Makro takibi, aralıklı oruç ve yemek tabağı analizi</p>
        
        {/* Modüller Arası Geçiş Sekme Barı */}
        <HealthSubNav />
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {nutritionData && (
            <MacroSummaryCard
              summary={nutritionData.summary}
              waterData={waterData}
              onOpenPlateScan={() => setIsPlateScanOpen(true)}
              onOpenDietModal={() => setIsDietOpen(true)}
              onOpenAddMeal={() => setIsAddMealOpen(true)}
              onOpenEditProfile={() => setIsEditProfileOpen(true)}
              onAddWater={handleAddWater}
            />
          )}
          {fastingData && (
            <FastingTimerCard
              fastingData={fastingData}
              onToggleFasting={handleToggleFasting}
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <NutrientProfileCard />
          <FoodQualityScoreCard
            scans={foodScanData}
            onOpenBarcodeScan={() => setIsBarcodeScanOpen(true)}
          />
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
        onClose={() => setIsAddMealOpen(false)}
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
