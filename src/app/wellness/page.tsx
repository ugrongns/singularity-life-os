'use client';

import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import HealthSubNav, { FamilyMemberItem } from '@/components/layout/HealthSubNav';
import WellnessCard from '@/components/health/WellnessCard';
import HomeWorkoutTrackerCard from '@/components/health/HomeWorkoutTrackerCard';
import AddSupplementModal from '@/components/modals/AddSupplementModal';
import { SmartScaleTrendDashboard } from '@/components/wellness/SmartScaleTrendDashboard';
import { SmartScaleScanModal } from '@/components/modals/SmartScaleScanModal';

export default function WellnessPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
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

  const fetchData = async (memberId: string | null = selectedMemberId) => {
    try {
      const memberQuery = memberId ? `?member_id=${memberId}` : '';
      const [wellRes, notifRes, membersRes] = await Promise.all([
        fetch(`/api/wellness${memberQuery}`),
        fetch('/api/notifications'),
        fetch('/api/family-members')
      ]);

      const [wellJ, notifJ, membersJ] = await Promise.all([
        wellRes.json(),
        notifRes.json(),
        membersRes.json().catch(() => ({ success: false, data: [] }))
      ]);

      if (wellJ.success) setData(wellJ.data);
      if (notifJ.success) setNotifData(notifJ.data);
      if (membersJ.success && Array.isArray(membersJ.data)) {
        setMembers(membersJ.data);
      }
    } catch (err) {
      console.error('Wellness fetchData error:', err);
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

  const handleSelectMember = (id: string | null) => {
    setSelectedMemberId(id);
    fetchData(id);
  };

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
        <div 
          style={{ 
            position: 'fixed', 
            top: '20px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: 'var(--text-main)', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: 'var(--radius-full)', 
            fontSize: '13px', 
            zIndex: 999,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Üst Başlık & Yapışkan Navigasyon */}
      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          💊 Wellness & Rutin
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 14px' }}>
          Whoop, Oura Ring ve Strava kalitesinde günlük takviye, toparlanma, antrenman ve tartı panosu
        </p>

        {/* 1. Yapışkan Segmented Control & Aile Üyesi Seçici */}
        <HealthSubNav
          members={members}
          selectedMemberId={selectedMemberId}
          onSelectMember={handleSelectMember}
        />
      </div>

      {/* Ana Bento Izgarası */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ÜST SATIR (1024px+ Masaüstü 2 Sütun Eşit Yükseklik): Sol: Wellness & Takviye Rutini, Sağ: Antrenman Performans Panosu */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '20px',
            alignItems: 'stretch'
          }}
        >
          {/* Sol Sütun: Günlük Wellness & Takviye Rutini */}
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

          {/* Sağ Sütun: Antrenman & Egzersiz Performans Panosu */}
          <HomeWorkoutTrackerCard />
        </div>

        {/* ALT SATIR: Akıllı Tartı Vücut Kompozisyonu Trend Grafikleri (Tam Genişlik / Full-Span) */}
        <div>
          <SmartScaleTrendDashboard 
            logs={data?.scaleLogs || []} 
            onOpenScanModal={() => setIsScaleModalOpen(true)} 
          />
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
