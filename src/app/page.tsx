'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import LandingPage from '@/components/landing/LandingPage';

// Executive Bento Bileşenleri
import HeroNetWorthBentoCard from '@/components/home/HeroNetWorthBentoCard';
import QuickIngestHub from '@/components/home/QuickIngestHub';
import TimeContextualFeed from '@/components/home/TimeContextualFeed';
import HomeOperationsCard from '@/components/home/HomeOperationsCard';
import HomeBentoSkeleton from '@/components/home/HomeBentoSkeleton';

// Modaller
import ReadingSessionModal from '@/components/modals/ReadingSessionModal';
import ReceiptScanModal from '@/components/modals/ReceiptScanModal';
import PlateScanModal from '@/components/modals/PlateScanModal';
import VoiceCommandModal from '@/components/modals/VoiceCommandModal';
import BarcodeScanModal from '@/components/modals/BarcodeScanModal';
import AddHomeItemModal from '@/components/modals/AddHomeItemModal';

export default function HomePage() {
  const [session, setSession] = useState<any>(null);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [libraryData, setLibraryData] = useState<any>(null);
  const [fastingData, setFastingData] = useState<any>(null);
  const [wellnessData, setWellnessData] = useState<any>(null);
  const [shoppingData, setShoppingData] = useState<any>(null);
  const [homeData, setHomeData] = useState<any>(null);
  const [marketRates, setMarketRates] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modaller
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [isReceiptScanOpen, setIsReceiptScanOpen] = useState(false);
  const [isFoodScanOpen, setIsFoodScanOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async () => {
    try {
      setFetchError(null);
      const res = await fetch('/api/dashboard/composite');
      const json = await res.json();

      if (!json.success || !json.data?.session?.is_authenticated) {
        setSession({
          is_authenticated: false,
          is_initialized: json.data?.session?.is_initialized ?? true,
          user: null
        });
        setLoading(false);
        return;
      }

      setSession(json.data.session);
      setBudgetData(json.data.budget);
      setVehicleData(json.data.vehicles);
      setLibraryData(json.data.library);
      setFastingData(json.data.fasting);
      setWellnessData(json.data.wellness);
      setShoppingData(json.data.shopping);
      setHomeData(json.data.home);
      setMarketRates(json.data.market_rates || json.data.budget?.marketRates);
      setNotifData(json.data.notifications || { notifications: [], critical: 0, warning: 0 });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setFetchError('Veriler yüklenirken bir bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // SharedLayout veya modalların veriyi güncellediğini bildirmesi için dinleyici
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('singularity-refresh', handler);
    return () => window.removeEventListener('singularity-refresh', handler);
  }, []);

  const handleUpdate = () => {
    fetchData();
  };

  const handleQuickAddWater = async () => {
    try {
      await fetch('/api/health/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: 500 })
      });
      showToast('💧 +500ml Su tüketimi kaydedildi!');
      handleUpdate();
    } catch (e) {
      console.error('Water add error:', e);
      showToast('Su eklenirken hata oluştu.');
    }
  };

  const handleQuickTakeSupplements = async () => {
    try {
      await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'take_all' })
      });
      showToast('💊 Tüm günlük takviyeler alındı işaretlendi!');
      handleUpdate();
    } catch (e) {
      console.error('Supplements take error:', e);
      showToast('Takviye durumu güncellenirken hata oluştu.');
    }
  };

  // 1. Shimmer / Skeleton Durumu (Sıfır CLS)
  if (loading) {
    return (
      <SharedLayout notifications={{ notifications: [], critical: 0, warning: 0 }}>
        <HomeBentoSkeleton />
      </SharedLayout>
    );
  }

  // 2. Session Guard
  if (!session || !session.is_authenticated || !session.is_initialized) {
    return <LandingPage />;
  }

  // 3. Hata Durumu
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

  return (
    <SharedLayout notifications={notifData}>
      {/* Toast Bildirimi */}
      {toastMsg && (
        <div className="toast-glass" role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}

      {/* 🏛️ Executive Bento Command Center */}
      <div className="bento-grid" style={{ width: '100%', alignItems: 'stretch' }}>
        {/* Üst Satır Sol (8 Sütun): FinTech Hero Net Worth & Hızlı KPI'lar */}
        <div className="col-span-8">
          <HeroNetWorthBentoCard
            netWorthData={budgetData?.netWorth}
            monthlySummary={budgetData?.monthlySummary}
            marketRates={marketRates}
          />
        </div>

        {/* Üst Satır Sağ (4 Sütun): Hızlı İşlem & Veri Giriş Hub'ı (2x2 Grid) */}
        <div className="col-span-4">
          <QuickIngestHub
            onOpenReceiptScan={() => setIsReceiptScanOpen(true)}
            onOpenFoodScan={() => setIsFoodScanOpen(true)}
            onOpenVoiceCommand={() => setIsVoiceOpen(true)}
            onOpenBarcodeScan={() => setIsBarcodeOpen(true)}
            onOpenReadingSession={() => setIsSessionOpen(true)}
            onQuickAddWater={handleQuickAddWater}
            onQuickTakeSupplements={handleQuickTakeSupplements}
          />
        </div>

        {/* Alt Satır Sol (6 Sütun): Bağlamsal Günlük Akış & Kritik Aksiyonlar */}
        <div className="col-span-6">
          <TimeContextualFeed
            userName={session?.user?.full_name?.split(' ')[0] || session?.user?.username}
            upcomingPayments={budgetData?.upcomingPayments || []}
            wellnessData={wellnessData}
            fastingData={fastingData}
            libraryData={libraryData}
            homeData={homeData}
            shoppingData={shoppingData}
            onOpenReadingSession={() => setIsSessionOpen(true)}
            onQuickTakeSupplements={handleQuickTakeSupplements}
            onQuickAddWater={handleQuickAddWater}
          />
        </div>

        {/* Alt Satır Sağ (6 Sütun): Ev Operasyonları & Garanti Takibi */}
        <div className="col-span-6">
          <HomeOperationsCard
            maintenanceRecords={homeData?.maintenanceRecords || []}
            appliances={homeData?.appliances || []}
            onOpenAddModal={() => setIsHomeModalOpen(true)}
            onRefresh={fetchData}
            onToast={showToast}
          />
        </div>
      </div>

      {/* Sayfa-Özel Modaller */}
      <ReadingSessionModal
        isOpen={isSessionOpen}
        onClose={() => setIsSessionOpen(false)}
        books={libraryData?.books || []}
        onSuccess={() => handleUpdate()}
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
      <BarcodeScanModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        onSuccess={() => { setIsBarcodeOpen(false); handleUpdate(); }}
      />
      <AddHomeItemModal
        isOpen={isHomeModalOpen}
        onClose={() => setIsHomeModalOpen(false)}
        onSuccess={(msg) => { setIsHomeModalOpen(false); showToast(msg || 'Ev kaydı eklendi'); handleUpdate(); }}
      />
    </SharedLayout>
  );
}
