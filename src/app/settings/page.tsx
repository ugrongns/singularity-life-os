'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import BackupStatusCard from '@/components/settings/BackupStatusCard';
import SecuritySettingsCard from '@/components/settings/SecuritySettingsCard';
import FamilyMembersCard from '@/components/settings/FamilyMembersCard';

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [backupRes, notifRes] = await Promise.all([
        fetch('/api/backup'),
        fetch('/api/notifications')
      ]);

      const [backupJ, notifJ] = await Promise.all([
        backupRes.json(),
        notifRes.json()
      ]);

      if (backupJ.success) setData(backupJ.data);
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
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>⚙️ Ayarlar & Sistem</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Yerel SQLite yedekleme, veri export ve sistem durumu</p>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <FamilyMembersCard />
          {data && (
            <BackupStatusCard
              last_backup={data.last_backup}
              backup_count={data.backup_count || 0}
              backups={data.backups || []}
              db_size_kb={data.db_size_kb || 0}
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SecuritySettingsCard />
          <div className="card">
            <div className="card-title-row">
              <div className="card-title">
                <span>🛡️</span>
                <span>Gizlilik & Yerel Depolama</span>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 10px' }}>
                <strong>Singularity Life OS</strong>, tüm finansal, sağlık ve kişisel verilerinizi %100 yerel cihazınızda (<code>singularity.db</code>) saklar. Hiçbir veriniz üçüncü taraf sunuculara iletilmez.
              </p>
              <div style={{ background: 'var(--surface-subtle)', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '11px', border: '1px solid var(--border)' }}>
                <div>• <strong>Mimari:</strong> Next.js 15 App Router + SQLite (better-sqlite3)</div>
                <div style={{ marginTop: '4px' }}>• <strong>Çevrimdışı Çalışma:</strong> Tam Destekli (Local-First PWA)</div>
                <div style={{ marginTop: '4px' }}>• <strong>Veritabanı Konumu:</strong> <code>./singularity.db</code></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SharedLayout>
  );
}
