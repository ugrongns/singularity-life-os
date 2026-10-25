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
      console.error('Analytics page fetch error:', err);
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

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', animation: 'spin 1.2s linear infinite', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Yaşam Skoru & FIRE Analitiği Yükleniyor...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Finans, Biyometri, Wellness ve Zihin eksenleri sentezleniyor
          </div>
        </div>
      </SharedLayout>
    );
  }

  return (
    <SharedLayout notifications={notifData}>
      {/* Sayfa Başlık Alanı */}
      <div style={{ padding: '0 4px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
            📊 Yaşam Skoru & FIRE Analitiği
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Bütünsel yaşam dengesi, finansal bağımsızlık projeksiyonu ve reel enflasyon endeksi
          </p>
        </div>

        <button
          onClick={fetchData}
          className="btn-subtle"
          style={{
            fontSize: '12px', fontWeight: 700, padding: '8px 12px',
            borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '6px',
            border: '1px solid var(--border)'
          }}
          title="Verileri Güncelle"
        >
          <span>🔄</span>
          <span className="hidden-mobile">Yenile</span>
        </button>
      </div>

      {/* İki Sütunlu Executive Dashboard Izgarası */}
      <div className="analytics-executive-grid">
        <div>
          {data?.holisticScore && <HolisticScoreCard scoreData={data.holisticScore} />}
        </div>
        <div>
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
