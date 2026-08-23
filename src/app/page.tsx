'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import NetWorthHero from '@/components/budget/NetWorthHero';
import RecentTxCard from '@/components/budget/RecentTxCard';
import VehicleFleetCard from '@/components/vehicle/VehicleFleetCard';
import LibraryHeroCard from '@/components/library/LibraryHeroCard';
import FastingTimerCard from '@/components/health/FastingTimerCard';
import WellnessCard from '@/components/health/WellnessCard';
import ShoppingListCard from '@/components/shopping/ShoppingListCard';
import LandingPage from '@/components/landing/LandingPage';
// Sayfa-özel Modaller (SharedLayout'ta olmayan modaller)
import MaintenanceHistoryModal from '@/components/vehicle/MaintenanceHistoryModal';
import ReadingSessionModal from '@/components/modals/ReadingSessionModal';
import AddFuelLogModal from '@/components/modals/AddFuelLogModal';
import AddVehicleServiceModal from '@/components/modals/AddVehicleServiceModal';

import TimeContextualFeed from '@/components/home/TimeContextualFeed';
import QuickIngestHub from '@/components/home/QuickIngestHub';
import ReceiptScanModal from '@/components/modals/ReceiptScanModal';
import PlateScanModal from '@/components/modals/PlateScanModal';
import VoiceCommandModal from '@/components/modals/VoiceCommandModal';

export default function HomePage() {
  const [session,      setSession]      = useState<any>(null);
  const [budgetData,   setBudgetData]   = useState<any>(null);
  const [vehicleData,  setVehicleData]  = useState<any>(null);
  const [libraryData,  setLibraryData]  = useState<any>(null);
  const [fastingData,  setFastingData]  = useState<any>(null);
  const [wellnessData, setWellnessData] = useState<any>(null);
  const [shoppingData, setShoppingData] = useState<any>(null);
  const [notifData,    setNotifData]    = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // Modaller
  const [isMaintHistOpen,   setIsMaintHistOpen]   = useState(false);
  const [isSessionOpen,     setIsSessionOpen]     = useState(false);
  const [isFuelOpen,        setIsFuelOpen]        = useState(false);
  const [isServiceOpen,     setIsServiceOpen]     = useState(false);
  const [isReceiptScanOpen, setIsReceiptScanOpen] = useState(false);
  const [isFoodScanOpen,    setIsFoodScanOpen]    = useState(false);
  const [isVoiceOpen,       setIsVoiceOpen]       = useState(false);

  const fetchData = async () => {
    try {
      setFetchError(null);
      const res = await fetch('/api/dashboard/composite');
      const j = await res.json();
      if (j.success && j.data) {
        const d = j.data;
        if (d.session)     setSession(d.session);
        if (d.budget)      setBudgetData(d.budget);
        if (d.vehicles)    setVehicleData(d.vehicles);
        if (d.library)     setLibraryData(d.library);
        if (d.fasting)     setFastingData(d.fasting);
        if (d.wellness)    setWellnessData(d.wellness);
        if (d.shopping)    setShoppingData(d.shopping);
        if (d.notifications) setNotifData(d.notifications);
      } else {
        setFetchError(j.error || 'Veriler alınamadı.');
      }
    } catch (err) {
      console.error('Composite fetch error:', err);
      setFetchError('Veriler yüklenirken bir bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdate = () => { fetchData(); };

  const handleToggleFasting = async (action: 'start' | 'end', protocol: string = '16:8') => {
    const res = await fetch('/api/health/fasting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, protocol })
    });
    const j = await res.json();
    if (j.success) handleUpdate();
  };

  const handleQuickAddWater = async () => {
    try {
      await fetch('/api/health/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: 500 })
      });
      handleUpdate();
    } catch (e) {
      console.error('Water add error:', e);
    }
  };

  const handleQuickTakeSupplements = async () => {
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_all' })
      });
      handleUpdate();
    } catch (e) {
      console.error('Supplements take error:', e);
    }
  };

  // Loading ekranı
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }} className="loading-pulse">
          <div style={{ fontSize: '42px', marginBottom: '14px' }}>🌌</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>Singularity Life OS</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Verileriniz hazırlanıyor...</div>
        </div>
      </div>
    );
  }

  // Session guard
  if (!session || !session.is_authenticated || !session.is_initialized) {
    return <LandingPage />;
  }

  // Hata durumu
  if (fetchError && !budgetData) {
    return (
      <SharedLayout notifications={notifData}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 20px' }}>
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <div className="error-title">Bağlantı Hatası</div>
            <div className="error-desc">{fetchError}</div>
            <button className="btn-retry" onClick={() => { setLoading(true); fetchData(); }}>
              🔄 Yeniden Dene
            </button>
          </div>
        </div>
      </SharedLayout>
    );
  }

  // Widget Grupları
  const fastingCard = (
    <FastingTimerCard
      fastingData={fastingData || { is_active: false, protocol: '16:8' }}
      onToggleFasting={handleToggleFasting}
    />
  );

  const wellnessCard = (
    <WellnessCard
      supplements={wellnessData?.supplements || { morning: [], evening: [], with_meal: [], total: 0, taken: 0 }}
      todayMood={wellnessData?.todayMood}
      todaySleep={wellnessData?.todaySleep}
      moodHistory={wellnessData?.moodHistory || []}
      sleepHistory={wellnessData?.sleepHistory || []}
    />
  );

  const recentTxCard = (
    <RecentTxCard
      transactions={budgetData?.recentTransactions || []}
      upcomingPayments={budgetData?.upcomingPayments || []}
    />
  );

  const shoppingCard = (
    <ShoppingListCard
      items={shoppingData?.items || []}
      summary={shoppingData?.summary || { total: 0, remaining: 0, done: 0, totalEstimated: 0, remainingEstimated: 0 }}
      byCategory={shoppingData?.byCategory || {}}
    />
  );

  const libraryCard = (
    <LibraryHeroCard
      profile={libraryData?.profile || { yearly_target_books: 24, completedBooksCount: 0, targetProgressPercent: 0, calibrated_avg_wpm: 220, avgMinutesPerPage: '1.4' }}
      activeBook={libraryData?.activeReadingBook}
      onOpenSession={() => setIsSessionOpen(true)}
      onOpenQuotes={() => {}}
    />
  );

  const vehicleCard = (
    <VehicleFleetCard
      data={vehicleData || { vehicles: [], maintenanceRecords: [] }}
      onOpenHistory={() => setIsMaintHistOpen(true)}
      onOpenFuelModal={() => setIsFuelOpen(true)}
      onOpenServiceModal={() => setIsServiceOpen(true)}
      onRefresh={handleUpdate}
    />
  );

  return (
    <SharedLayout notifications={notifData}>
      {/* Net Worth Hero — her zaman en üstte */}
      <NetWorthHero netWorth={budgetData?.netWorth || { TRY: 0, USD: 0, EUR: 0, GOLD_GRAM: '0', BTC: '0' }} />

      {/* Zaman Odaklı Akıllı Dashboard Akışı */}
      <TimeContextualFeed
        morningWidgets={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {wellnessCard}
            {fastingCard}
          </div>
        }
        dayWidgets={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {recentTxCard}
            {shoppingCard}
            {vehicleCard}
          </div>
        }
        eveningWidgets={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {recentTxCard}
            {libraryCard}
            {wellnessCard}
          </div>
        }
        secondaryWidgets={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {vehicleCard}
            {libraryCard}
            {shoppingCard}
          </div>
        }
      />

      {/* ⚡ 1-Dokunuşlu Quick Ingest Hub (Sağ Alt FAB) */}
      <QuickIngestHub
        onOpenReceiptScan={() => setIsReceiptScanOpen(true)}
        onOpenFoodScan={() => setIsFoodScanOpen(true)}
        onOpenVoiceCommand={() => setIsVoiceOpen(true)}
        onOpenReadingSession={() => setIsSessionOpen(true)}
        onQuickAddWater={handleQuickAddWater}
        onQuickTakeSupplements={handleQuickTakeSupplements}
      />

      {/* Modaller */}
      <MaintenanceHistoryModal isOpen={isMaintHistOpen} onClose={() => setIsMaintHistOpen(false)} />
      <ReadingSessionModal
        isOpen={isSessionOpen} onClose={() => setIsSessionOpen(false)}
        books={libraryData?.books || []}
        onSuccess={() => handleUpdate()}
      />
      <AddFuelLogModal
        isOpen={isFuelOpen}
        onClose={() => setIsFuelOpen(false)}
        vehicleId={vehicleData?.vehicle?.id || ''}
        currentKm={vehicleData?.vehicle?.current_km || 0}
        wallets={budgetData?.accounts || []}
        onSuccess={() => { setIsFuelOpen(false); handleUpdate(); }}
      />
      <AddVehicleServiceModal
        isOpen={isServiceOpen}
        onClose={() => setIsServiceOpen(false)}
        vehicleId={vehicleData?.vehicle?.id || ''}
        currentKm={vehicleData?.vehicle?.current_km || 0}
        wallets={budgetData?.accounts || []}
        onSuccess={() => { setIsServiceOpen(false); handleUpdate(); }}
      />
      <ReceiptScanModal
        isOpen={isReceiptScanOpen}
        onClose={() => setIsReceiptScanOpen(false)}
        accounts={budgetData?.accounts || []}
        onSuccess={() => { setIsReceiptScanOpen(false); handleUpdate(); }}
      />
      <PlateScanModal
        isOpen={isFoodScanOpen}
        onClose={() => setIsFoodScanOpen(false)}
        onSuccess={() => { setIsFoodScanOpen(false); handleUpdate(); }}
      />
      <VoiceCommandModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSuccess={() => { setIsVoiceOpen(false); handleUpdate(); }}
      />
    </SharedLayout>
  );
}
