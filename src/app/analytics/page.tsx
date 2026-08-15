'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import HolisticScoreCard from '@/components/analytics/HolisticScoreCard';
import FireAnalyticsCard from '@/components/analytics/FireAnalyticsCard';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [anaRes, notifRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/notifications')
      ]);

      const [anaJ, notifJ] = await Promise.all([
        anaRes.json(),
        notifRes.json()
      ]);

      if (anaJ.success) setData(anaJ.data);
      if (notifJ.success) setNotifData(notifJ.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Yükleniyor...</div>
      </SharedLayout>
    );
  }

  return (
    <SharedLayout notifications={notifData}>
      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📊 Analitik & Yaşam Skoru</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Bütünsel yaşam performansı, FIRE finansal özgürlük ve kişisel enflasyon</p>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {data?.holisticScore && <HolisticScoreCard scoreData={data.holisticScore} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {data?.fireMetrics && (
            <FireAnalyticsCard
              fireMetrics={data.fireMetrics}
              inflationMetrics={data.inflationMetrics}
            />
          )}
        </div>
      </div>
    </SharedLayout>
  );
}
