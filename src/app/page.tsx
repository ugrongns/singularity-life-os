'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import NetWorthHero from '@/components/budget/NetWorthHero';
import RecentTxCard from '@/components/budget/RecentTxCard';
import PortfolioHeroCard from '@/components/investments/PortfolioHeroCard';
import VehicleFleetCard from '@/components/vehicle/VehicleFleetCard';
import LibraryHeroCard from '@/components/library/LibraryHeroCard';
import FastingTimerCard from '@/components/health/FastingTimerCard';
import WellnessCard from '@/components/health/WellnessCard';
import ShoppingListCard from '@/components/shopping/ShoppingListCard';
import LandingPage from '@/components/landing/LandingPage';
// Sayfa-özel Modaller (SharedLayout'ta olmayan modaller)
import MaintenanceHistoryModal from '@/components/vehicle/MaintenanceHistoryModal';
import DividendModal from '@/components/modals/DividendModal';
import ReadingSessionModal from '@/components/modals/ReadingSessionModal';
import AddFuelLogModal from '@/components/modals/AddFuelLogModal';
import AddVehicleServiceModal from '@/components/modals/AddVehicleServiceModal';

export default function HomePage() {
  const [session,      setSession]      = useState<any>(null);
  const [budgetData,   setBudgetData]   = useState<any>(null);
  const [investData,   setInvestData]   = useState<any>(null);
  const [vehicleData,  setVehicleData]  = useState<any>(null);
  const [libraryData,  setLibraryData]  = useState<any>(null);
  const [fastingData,  setFastingData]  = useState<any>(null);
  const [wellnessData, setWellnessData] = useState<any>(null);
  const [shoppingData, setShoppingData] = useState<any>(null);
  const [notifData,    setNotifData]    = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // Sayfa-özel modal state'leri (SharedLayout'ta yönetilmeyen modaller)
  const [isMaintHistOpen,   setIsMaintHistOpen]   = useState(false);
  const [isDividendOpen,    setIsDividendOpen]    = useState(false);
  const [isSessionOpen,     setIsSessionOpen]     = useState(false);
  const [isFuelOpen,        setIsFuelOpen]        = useState(false);
  const [isServiceOpen,     setIsServiceOpen]     = useState(false);

  const fetchData = async () => {
    try {
      setFetchError(null);
      const [sessRes, budRes, invRes, vehRes, libRes, fastRes, wellRes, shopRes, notifRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/budget'),
        fetch('/api/investments'),
        fetch('/api/vehicles'),
        fetch('/api/library'),
        fetch('/api/health/fasting'),
        fetch('/api/wellness'),
        fetch('/api/shopping-list'),
        fetch('/api/notifications'),
      ]);
      const [sessJ, budJ, invJ, vehJ, libJ, fastJ, wellJ, shopJ, notifJ] = await Promise.all([
        sessRes.json(), budRes.json(), invRes.json(), vehRes.json(), libRes.json(),
        fastRes.json(), wellRes.json(), shopRes.json(), notifRes.json(),
      ]);
      if (sessJ.success)  setSession(sessJ.data);
      if (budJ.success)   setBudgetData(budJ.data);
      if (invJ.success)   setInvestData(invJ.data);
      if (vehJ.success)   setVehicleData(vehJ.data);
      if (libJ.success)   setLibraryData(libJ.data);
      if (fastJ.success)  setFastingData(fastJ.data);
      if (wellJ.success)  setWellnessData(wellJ.data);
      if (shopJ.success)  setShoppingData(shopJ.data);
      if (notifJ.success) setNotifData(notifJ.data);
    } catch (err) {
      console.error(err);
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

  // Session guard: Oturum yoksa veya doğrulanmamışsa LandingPage göster
  if (!session || !session.is_authenticated || !session.is_initialized) {
    return <LandingPage />;
  }

  // Hata durumu
  if (fetchError && !budgetData && !investData) {
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

  return (
    <SharedLayout notifications={notifData}>
      {/* Net Worth Hero — her zaman en üstte */}
      <NetWorthHero netWorth={budgetData?.netWorth || { totalNetWorthTRY: 0, totalNetWorthUSD: 0, totalNetWorthEUR: 0, currencyBreakdown: { TRY: 0, USD: 0, EUR: 0, Gold: 0, BTC: 0 } }} />

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Sol Sütun */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 📈 Portföy Özeti */}
          <PortfolioHeroCard
            summary={investData?.summary || { totalPortfolioValueTRY: 0, unreleasedPlTRY: 0, unreleasedPlPercent: 0 }}
            allocation={investData?.allocation || []}
            onOpenDividendModal={() => setIsDividendOpen(true)}
            onOpenAddAssetModal={() => {}}
          />

          {/* ⏱️ Aralıklı Oruç Sayacı */}
          <FastingTimerCard
            fastingData={fastingData || { is_active: false, protocol: '16:8' }}
            onToggleFasting={handleToggleFasting}
          />

          {/* 📚 Aktif Kitap & WPM */}
          <LibraryHeroCard
            profile={libraryData?.profile || { yearly_target_books: 24, completedBooksCount: 0, targetProgressPercent: 0, calibrated_avg_wpm: 220, avgMinutesPerPage: '1.4' }}
            activeBook={libraryData?.activeReadingBook}
            onOpenSession={() => setIsSessionOpen(true)}
            onOpenQuotes={() => {}}
          />

          {/* 💊 Takviye Rutini */}
          <WellnessCard
            supplements={wellnessData?.supplements || { morning: [], evening: [], with_meal: [], total: 0, taken: 0 }}
            todayMood={wellnessData?.todayMood}
            todaySleep={wellnessData?.todaySleep}
            moodHistory={wellnessData?.moodHistory || []}
            sleepHistory={wellnessData?.sleepHistory || []}
          />
        </div>

        {/* Sağ Sütun */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 🚗 Araç Filosu */}
          <VehicleFleetCard
            data={vehicleData || { vehicles: [], maintenanceRecords: [] }}
            onOpenHistory={() => setIsMaintHistOpen(true)}
            onOpenFuelModal={() => setIsFuelOpen(true)}
            onOpenServiceModal={() => setIsServiceOpen(true)}
            onRefresh={handleUpdate}
          />

          {/* 💰 Son Harcamalar & Yaklaşan Ödemeler */}
          <RecentTxCard
            transactions={budgetData?.recentTransactions || []}
            upcomingPayments={budgetData?.upcomingPayments || []}
          />

          {/* 🛒 Market Listesi */}
          <ShoppingListCard
            items={shoppingData?.items || []}
            summary={shoppingData?.summary || { total: 0, remaining: 0, done: 0, totalEstimated: 0, remainingEstimated: 0 }}
            byCategory={shoppingData?.byCategory || {}}
          />
        </div>
      </div>

      {/* Sayfa-Özel Modaller (SharedLayout'ta olmayanlar) */}
      <MaintenanceHistoryModal isOpen={isMaintHistOpen} onClose={() => setIsMaintHistOpen(false)} />
      <DividendModal
        isOpen={isDividendOpen} onClose={() => setIsDividendOpen(false)}
        assets={investData?.assets || []}
        accounts={budgetData?.accounts || []}
        onSuccess={() => handleUpdate()}
      />
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
    </SharedLayout>
  );
}
