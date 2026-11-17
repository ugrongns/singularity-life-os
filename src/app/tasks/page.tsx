'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import SharedLayout from '@/components/layout/SharedLayout';
import TasksClient from '@/components/tasks/TasksClient';
import PageLoadingState from '@/components/ui/PageLoadingState';

export default function TasksPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [tasksRes, notifRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/notifications')
      ]);

      const [tasksJ, notifJ] = await Promise.all([
        tasksRes.json(),
        notifRes.json()
      ]);

      if (tasksJ.success) setData(tasksJ.data);
      if (notifJ.success) setNotifData(notifJ.data);
    } catch (err) {
      console.error('Tasks page fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, []);

  if (loading) {
    return (
      <SharedLayout notifications={notifData}>
        <PageLoadingState
          icon="🎯"
          title="Görevler & Odak Merkezi Yükleniyor..."
          description="Günün 3 Odağı (MIT), alt görevler, rutinler ve sistem köprüsü taranıyor"
          color="#F59E0B"
        />
      </SharedLayout>
    );
  }

  return (
    <SharedLayout notifications={notifData}>
      {/* Sayfa Başlık Alanı */}
      <div style={{ padding: '0 4px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
            🎯 Görevler & Odak Merkezi
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Günün 3 Odağı (MIT), alt görevler, tekrarlayan rutinler ve sistem entegrasyonu
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setIsCalendarOpen(prev => !prev)}
            className="btn-subtle"
            aria-expanded={isCalendarOpen}
            style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: `1px solid ${isCalendarOpen ? 'rgba(59, 130, 246, 0.45)' : 'var(--border)'}`,
              background: isCalendarOpen ? 'rgba(59, 130, 246, 0.12)' : undefined,
              color: isCalendarOpen ? '#3B82F6' : undefined
            }}
            title={isCalendarOpen ? 'Takvimi Gizle' : 'Takvimi Göster'}
          >
            <Calendar size={14} />
            <span>Takvim</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="btn-subtle"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid var(--border)'
            }}
            title="Verileri Yenile"
          >
            <span>🔄</span>
            <span className="hidden-mobile">Yenile</span>
          </button>
        </div>
      </div>

      <TasksClient
        initialData={data}
        isCalendarOpen={isCalendarOpen}
        onCloseCalendar={() => setIsCalendarOpen(false)}
      />
    </SharedLayout>
  );
}
