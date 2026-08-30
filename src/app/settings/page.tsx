'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import BackupStatusCard from '@/components/settings/BackupStatusCard';
import SecuritySettingsCard from '@/components/settings/SecuritySettingsCard';
import FamilyMembersCard from '@/components/settings/FamilyMembersCard';
import TelegramBotCard from '@/components/settings/TelegramBotCard';

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

    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
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
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Supabase bulut yedekleme, veri dışa aktarma ve sistem durumu</p>
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
          <TelegramBotCard />
          <div className="card">
            <div className="card-title-row">
              <div className="card-title">
                <span>🛡️</span>
                <span>Gizlilik & Bulut Depolama</span>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 10px' }}>
                <strong>Singularity Life OS</strong>, tüm finansal, sağlık ve kişisel verilerinizi şifreli ve güvenli <strong>Supabase Cloud PostgreSQL</strong> altyapısında saklar.
              </p>
              <div style={{ background: 'var(--surface-subtle)', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '11px', border: '1px solid var(--border)' }}>
                <div>• <strong>Altyapı:</strong> Vercel Edge Serverless + Supabase Cloud</div>
                <div style={{ marginTop: '4px' }}>• <strong>Veritabanı:</strong> PostgreSQL (Drizzle ORM)</div>
                <div style={{ marginTop: '4px' }}>• <strong>Erişim & Süreklilik:</strong> 7/24 Kesintisiz Bulut Senkronizasyonu</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SharedLayout>
  );
}
