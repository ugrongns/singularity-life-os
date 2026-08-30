'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import HealthSubNav from '@/components/layout/HealthSubNav';
import WellnessCard from '@/components/health/WellnessCard';
import AddSupplementModal from '@/components/modals/AddSupplementModal';
import { SmartScaleTrendDashboard } from '@/components/wellness/SmartScaleTrendDashboard';
import { SmartScaleScanModal } from '@/components/modals/SmartScaleScanModal';

export default function WellnessPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State
  const [isSuppOpen, setIsSuppOpen] = useState(false);
  const [suppEditItem, setSuppEditItem] = useState<any>(null);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [wellRes, notifRes] = await Promise.all([
        fetch('/api/wellness'),
        fetch('/api/notifications')
      ]);

      const [wellJ, notifJ] = await Promise.all([
        wellRes.json(),
        notifRes.json()
      ]);

      if (wellJ.success) setData(wellJ.data);
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

  const handleSuccess = (msg?: string) => {
    fetchData();
    window.dispatchEvent(new CustomEvent('singularity-refresh'));
    if (msg) showToast(msg);
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
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', zIndex: 999 }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>💊 Wellness & Yaşam Merkezi</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 12px' }}>
          Takviye stok takibi, su tüketimi, uyku kalitesi, stres seviyesi ve akıllı tartı analitiği
        </p>

        {/* Modüller Arası Geçiş Sekme Barı */}
        <HealthSubNav />
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Akıllı Tartı & Biyo-İmpedans Değişim Grafikleri */}
        <SmartScaleTrendDashboard 
          logs={data?.scaleLogs || []} 
          onOpenScanModal={() => setIsScaleModalOpen(true)} 
        />

        <div className="dashboard-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <WellnessCard
              supplements={data?.supplements || { morning: [], evening: [], with_meal: [], total: 0, taken: 0, all: [] }}
              todayMood={data?.todayMood}
              todaySleep={data?.todaySleep}
              todayWater={data?.todayWater || { amount_ml: 0, goal_ml: 2500 }}
              moodHistory={data?.moodHistory || []}
              sleepHistory={data?.sleepHistory || []}
              waterHistory={data?.waterHistory || []}
              aiInsight={data?.aiInsight}
              onOpenAddSupplement={(item) => {
                setSuppEditItem(item || null);
                setIsSuppOpen(true);
              }}
              onRefresh={fetchData}
            />
          </div>
        </div>
      </div>

      {/* Add/Edit Supplement Modal */}
      <AddSupplementModal
        isOpen={isSuppOpen}
        item={suppEditItem}
        onClose={() => {
          setIsSuppOpen(false);
          setSuppEditItem(null);
        }}
        onSuccess={(msg) => handleSuccess(msg)}
      />

      {/* Smart Scale Scan & Entry Modal */}
      <SmartScaleScanModal
        isOpen={isScaleModalOpen}
        onClose={() => setIsScaleModalOpen(false)}
        onSuccess={(msg) => handleSuccess(msg)}
      />
    </SharedLayout>
  );
}
