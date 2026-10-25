'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import BackupStatusCard from '@/components/settings/BackupStatusCard';
import SecuritySettingsCard from '@/components/settings/SecuritySettingsCard';
import FamilyMembersCard from '@/components/settings/FamilyMembersCard';
import TelegramBotCard from '@/components/settings/TelegramBotCard';

type SettingsTab = 'all' | 'family' | 'security' | 'telegram' | 'backup' | 'privacy';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: string;
  desc: string;
}

const SETTINGS_TABS: TabConfig[] = [
  { id: 'all', label: 'Tüm Tercihler', icon: '⚙️', desc: 'Tüm ayarları tek ekranda inceleyin' },
  { id: 'family', label: 'Aile & Üyeler', icon: '👥', desc: 'Ortak yaşam & davet kodları' },
  { id: 'security', label: 'Güvenlik & PIN', icon: '🔐', desc: 'PIN kodu & master parola' },
  { id: 'telegram', label: 'Telegram Botu', icon: '🤖', desc: 'Hızlı harcama & bildirim asistanı' },
  { id: 'backup', label: 'Yedekleme & DB', icon: '💾', desc: 'Supabase bulut yedekleme' },
  { id: 'privacy', label: 'Gizlilik & Altyapı', icon: '🛡️', desc: 'Veri güvenliği & mimari' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
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
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚙️</div>
          <div>Ayarlar ve sistem durumu yükleniyor...</div>
        </div>
      </SharedLayout>
    );
  }

  const renderPrivacyCard = () => (
    <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="card-title-row">
        <div className="card-title">
          <span>🛡️</span>
          <span>Gizlilik & Bulut Depolama Mimarisi</span>
        </div>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
        <p style={{ margin: '0 0 14px' }}>
          <strong>Singularity Life OS</strong>, tüm finansal, sağlık, kütüphane ve kişisel verilerinizi kurumsal düzeyde şifrelenmiş <strong>Supabase Cloud PostgreSQL</strong> altyapısında saklar.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '14px'
        }}>
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '12px', marginBottom: '4px' }}>⚡ Vercel Edge Serverless</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Düşük gecikmeli, yüksek performanslı API rota yönetimi ve uç bilişim.</div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '12px', marginBottom: '4px' }}>🐘 PostgreSQL & Drizzle</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tam tip güvenli, ACID uyumlu ilişkisel veri modeli ve performanslı sorgular.</div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '12px', marginBottom: '4px' }}>🔐 PBKDF2 & SHA-256</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>100.000 iterasyonlu salt korumalı parola hashleme ve 6 haneli PIN şifrelemesi.</div>
          </div>
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '12px', marginBottom: '4px' }}>🚫 Sıfır Takip / Telemetri</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hiçbir üçüncü taraf izleyici veya analitik kütüphanesi barındırmaz.</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <SharedLayout notifications={notifData}>
      {/* Başlık Alanı */}
      <div style={{ padding: '0 4px 14px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚙️</span>
          <span>Sistem Tercihleri & Güvenlik</span>
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Aile yönetimi, 6 haneli hızlı PIN, Telegram bot asistanı ve Supabase bulut veritabanı senkronizasyonu
        </p>
      </div>

      {/* Mobilde Yatay Kategori Hapları */}
      <div className="settings-pills-mobile" role="tablist" aria-label="Ayarlar Kategorileri">
        {SETTINGS_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`settings-pill-btn ${isActive ? 'active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2 Sütunlu Masaüstü / Tek Sütunlu Mobil Düzende System Preferences */}
      <div className="settings-layout-grid">
        {/* Sol Navigasyon Sidebarı (Masaüstü) */}
        <aside className="settings-sidebar-desktop" aria-label="Ayar Kategorileri">
          <div className="settings-nav-sidebar" style={{ width: '100%' }}>
            <div style={{ padding: '6px 10px 10px', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              SYSTEM PREFERENCES
            </div>
            {SETTINGS_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`settings-nav-item ${isActive ? 'active' : ''}`}
                  style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                >
                  <span style={{ fontSize: '16px' }}>{tab.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: isActive ? 800 : 600 }}>{tab.label}</div>
                    <div style={{ fontSize: '10px', color: isActive ? 'inherit' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tab.desc}
                    </div>
                  </div>
                  {isActive && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Sağ İçerik Alanı */}
        <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'all' && (
            <>
              <FamilyMembersCard />
              <SecuritySettingsCard />
              <TelegramBotCard />
              {data && (
                <BackupStatusCard
                  last_backup={data.last_backup}
                  backup_count={data.backup_count || 0}
                  backups={data.backups || []}
                  db_size_kb={data.db_size_kb || 0}
                />
              )}
              {renderPrivacyCard()}
            </>
          )}

          {activeTab === 'family' && (
            <div>
              <FamilyMembersCard />
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <SecuritySettingsCard />
            </div>
          )}

          {activeTab === 'telegram' && (
            <div>
              <TelegramBotCard />
            </div>
          )}

          {activeTab === 'backup' && (
            <div>
              {data ? (
                <BackupStatusCard
                  last_backup={data.last_backup}
                  backup_count={data.backup_count || 0}
                  backups={data.backups || []}
                  db_size_kb={data.db_size_kb || 0}
                />
              ) : (
                <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Yedekleme verileri yükleniyor...
                </div>
              )}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              {renderPrivacyCard()}
            </div>
          )}
        </main>
      </div>
    </SharedLayout>
  );
}
