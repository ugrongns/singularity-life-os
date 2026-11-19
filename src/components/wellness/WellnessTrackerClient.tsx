'use client';

import { useState, useEffect, useCallback } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import HealthSubNav, { FamilyMemberItem } from '@/components/layout/HealthSubNav';
import WellnessCard from '@/components/health/WellnessCard';
import HomeWorkoutTrackerCard from '@/components/health/HomeWorkoutTrackerCard';
import AddSupplementModal from '@/components/modals/AddSupplementModal';
import { SmartScaleTrendDashboard } from '@/components/wellness/SmartScaleTrendDashboard';
import { SmartScaleScanModal } from '@/components/modals/SmartScaleScanModal';
import DailyTrackerCalendarBar from '@/components/wellness/DailyTrackerCalendarBar';
import { getTodayTurkeyDate } from '@/lib/date-utils';
import PageLoadingState from '@/components/ui/PageLoadingState';

interface WellnessTrackerClientProps {
  isBoostRoute?: boolean;
}

export default function WellnessTrackerClient({ isBoostRoute = false }: WellnessTrackerClientProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayTurkeyDate());
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [members, setMembers] = useState<FamilyMemberItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State
  const [isSuppOpen, setIsSuppOpen] = useState(false);
  const [suppEditItem, setSuppEditItem] = useState<any>(null);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const fetchData = useCallback(async (memberId: string | null = selectedMemberId, date: string = selectedDate) => {
    try {
      setFetchError(null);
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (memberId) params.set('member_id', memberId);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const [wellRes, notifRes, membersRes] = await Promise.all([
        fetch(`/api/wellness${queryStr}`),
        fetch('/api/notifications'),
        fetch('/api/family-members')
      ]);

      const [wellJ, notifJ, membersJ] = await Promise.all([
        wellRes.json(),
        notifRes.json(),
        membersRes.json().catch(() => ({ success: false, data: [] }))
      ]);

      if (wellRes.ok && wellJ.success) {
        setData(wellJ.data);
      } else {
        setFetchError(wellJ.error || 'Wellness verileri yüklenemedi.');
      }
      if (notifJ.success) setNotifData(notifJ.data);
      if (membersJ.success && Array.isArray(membersJ.data)) {
        setMembers(membersJ.data);
      }
    } catch (err) {
      console.error('Wellness fetchData error:', err);
      setFetchError('Wellness verileri alınırken bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  }, [selectedMemberId, selectedDate]);

  useEffect(() => {
    fetchData(selectedMemberId, selectedDate);

    const handleRefresh = () => {
      fetchData(selectedMemberId, selectedDate);
    };
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, [selectedDate, selectedMemberId, fetchData]);

  // Gece yarısı rollover ve sekme yeniden açıldığında otomatik gün sıfırlama/güncelleme
  useEffect(() => {
    let lastTrackedToday = getTodayTurkeyDate();

    const checkDateRollover = () => {
      const currentToday = getTodayTurkeyDate();
      if (currentToday !== lastTrackedToday) {
        lastTrackedToday = currentToday;
        setSelectedDate(currentToday);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDateRollover();
        fetchData(selectedMemberId, selectedDate);
      }
    };

    const interval = setInterval(checkDateRollover, 30000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [selectedMemberId, selectedDate, fetchData]);

  const handleSelectMember = (id: string | null) => {
    setSelectedMemberId(id);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleResetDay = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_day', date: selectedDate, member_id: selectedMemberId })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || 'Günlük rutin takip verileri sıfırlandı.');
        fetchData(selectedMemberId, selectedDate);
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      } else {
        showToast(json.error || 'Sıfırlama başarısız oldu.');
      }
    } catch (err) {
      console.error('Reset day error:', err);
      showToast('Sıfırlama sırasında hata oluştu.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSuccess = (msg?: string) => {
    fetchData(selectedMemberId, selectedDate);
    window.dispatchEvent(new CustomEvent('singularity-refresh'));
    if (msg) showToast(msg);
  };

  const handleDeleteScaleLog = async (logId: string) => {
    if (!confirm('Bu akıllı tartı ölçümünü silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/wellness/scale-logs?id=${encodeURIComponent(logId)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || 'Akıllı tartı ölçümü silindi.');
        fetchData(selectedMemberId, selectedDate);
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      } else {
        showToast(json.error || 'Ölçüm silinemedi.');
      }
    } catch (err) {
      console.error('Delete scale log error:', err);
      showToast('Ölçüm silinirken bağlantı hatası oluştu.');
    }
  };

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <PageLoadingState
          icon="✨"
          title="Wellness & Yaşam Ritmi Yükleniyor..."
          description="Takviye rutinleri, uyku döngüsü ve 14 günlük biyometrik panosu taranıyor"
          color="#8B5CF6"
        />
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
            color: 'var(--surface)',
            padding: '10px 20px',
            borderRadius: 'var(--radius-full)',
            fontSize: '13px',
            fontWeight: 700,
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
          {isBoostRoute ? '⚡ Boost & Günlük Takviye' : '💊 Wellness & Rutin'}
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 14px' }}>
          Whoop, Oura Ring ve Strava kalitesinde günlük takviye, toparlanma, antrenman ve takvimli takip
        </p>

        {/* 1. Yapışkan Segmented Control & Aile Üyesi Seçici */}
        <HealthSubNav
          members={members}
          selectedMemberId={selectedMemberId}
          onSelectMember={handleSelectMember}
        />

        {/* 2. Günlük Takip Takvimi & Sıfırlama Barı */}
        <div style={{ marginTop: '10px' }}>
          <DailyTrackerCalendarBar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            calendarHistory={data?.calendarHistory}
            onResetDay={handleResetDay}
            isResetting={isResetting}
          />
        </div>
      </div>

      {/* Hata Şeridi */}
      {fetchError && (
        <div style={{ padding: '0 16px 12px' }}>
          <div className="glass-card" style={{ padding: '14px 16px', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#EF4444' }}>
              ⚠️ {fetchError}
            </div>
            <button
              type="button"
              onClick={() => fetchData(selectedMemberId, selectedDate)}
              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 800, borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'var(--surface)', color: 'var(--text-main)', cursor: 'pointer' }}
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {/* Ana Bento Izgarası */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ÜST SATIR (1024px+ Masaüstü 2 Sütun Eşit Yükseklik): Sol: Wellness & Takviye Rutini, Sağ: Antrenman Performans Panosu */}
        <div className="wellness-top-grid">
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
            selectedDate={selectedDate}
            isToday={data?.isToday ?? (selectedDate === getTodayTurkeyDate())}
            memberId={selectedMemberId}
            onNotify={showToast}
            onResetDay={handleResetDay}
            onOpenAddSupplement={(item) => {
              setSuppEditItem(item || null);
              setIsSuppOpen(true);
            }}
            onRefresh={() => fetchData(selectedMemberId, selectedDate)}
          />

          {/* Sağ Sütun: Antrenman & Egzersiz Performans Panosu */}
          <HomeWorkoutTrackerCard memberId={selectedMemberId} />
        </div>

        {/* ALT SATIR: Akıllı Tartı Vücut Kompozisyonu Trend Grafikleri (Tam Genişlik / Full-Span) */}
        <div>
          <SmartScaleTrendDashboard
            logs={data?.scaleLogs || []}
            onOpenScanModal={() => setIsScaleModalOpen(true)}
            onDeleteLog={handleDeleteScaleLog}
          />
        </div>
      </div>

      {/* Add/Edit Supplement Modal */}
      <AddSupplementModal
        isOpen={isSuppOpen}
        item={suppEditItem}
        memberId={selectedMemberId}
        onClose={() => {
          setIsSuppOpen(false);
          setSuppEditItem(null);
        }}
        onSuccess={(msg) => handleSuccess(msg)}
      />

      {/* Smart Scale Scan & Entry Modal */}
      <SmartScaleScanModal
        isOpen={isScaleModalOpen}
        memberId={selectedMemberId}
        onClose={() => setIsScaleModalOpen(false)}
        onSuccess={(msg) => handleSuccess(msg)}
      />
    </SharedLayout>
  );
}
