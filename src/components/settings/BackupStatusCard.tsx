'use client';
import { useState } from 'react';

interface Backup {
  name: string;
  size_kb: number;
  created_at: string;
  is_encrypted?: boolean;
}

interface Props {
  last_backup: Backup | null;
  backup_count: number;
  backups: Backup[];
  db_size_kb: number;
}

export default function BackupStatusCard({ last_backup, backup_count, backups, db_size_kb }: Props) {
  const [backing, setBacking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showEncModal, setShowEncModal] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleBackup = async () => {
    setBacking(true);
    setLastResult(null);
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backup_db' })
    });
    const data = await res.json();
    setBacking(false);
    if (data.success) {
      setLastResult(`✅ Yedek alındı: ${data.backup.name} (${data.backup.size_kb} KB)`);
      window.location.reload();
    } else {
      setLastResult(`❌ Hata: ${data.error}`);
    }
  };

  const handleEncryptedBackup = async () => {
    setEncrypting(true);
    setLastResult(null);
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'encrypted_backup', passphrase: passphrase || 'SingularityMasterKey2026' })
    });
    const data = await res.json();
    setEncrypting(false);
    setShowEncModal(false);
    if (data.success) {
      setLastResult(`🔐 AES-256 Şifreli Yedek Oluşturuldu: ${data.backup.name} (${data.backup.size_kb} KB)`);
      window.location.reload();
    } else {
      setLastResult(`❌ Hata: ${data.error}`);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setLastResult(null);
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export_json' })
    });
    const data = await res.json();
    setExporting(false);
    if (data.success) {
      setLastResult(`✅ JSON export: ${data.export.name} — ${data.export.tables} tablo, ${data.export.size_kb} KB`);
    } else {
      setLastResult(`❌ Hata: ${data.error}`);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const daysSinceBackup = last_backup
    ? Math.floor((Date.now() - new Date(last_backup.created_at).getTime()) / 86400000)
    : null;

  const backupHealth = daysSinceBackup === null ? 'none'
    : daysSinceBackup === 0 ? 'fresh'
    : daysSinceBackup <= 3 ? 'good'
    : daysSinceBackup <= 7 ? 'warning'
    : 'critical';

  const healthConfig = {
    none:     { color: '#EF4444', label: 'Hiç yedek yok!',     icon: '❌' },
    fresh:    { color: '#10B981', label: 'Yedek güncel',        icon: '✅' },
    good:     { color: '#10B981', label: `${daysSinceBackup} gün önce`, icon: '✅' },
    warning:  { color: '#F59E0B', label: `${daysSinceBackup} gün önce`, icon: '⚠️' },
    critical: { color: '#EF4444', label: `${daysSinceBackup} gün önce`, icon: '🚨' },
  }[backupHealth];

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>💾</span>
          <span>Veri Yedekleme & Güvenlik</span>
        </div>
      </div>

      {/* Durum Özeti */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Veritabanı', value: `${db_size_kb} KB`, icon: '🗄️' },
          { label: 'Toplam Yedek', value: `${backup_count} adet`, icon: '📦' },
          { label: 'Son Yedek', value: healthConfig.label, icon: healthConfig.icon, color: healthConfig.color },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px' }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: s.color || 'var(--text-main)', marginTop: '2px' }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Son Başarılı Yedek */}
      {last_backup && (
        <div style={{ background: '#F0FDF4', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '10px', fontSize: '11px' }}>
          <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>Son yedek:</span> {last_backup.name} — {last_backup.size_kb} KB — {formatDate(last_backup.created_at)}
        </div>
      )}

      {/* Aksiyon Butonları (3'lü Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '6px', marginBottom: '10px' }}>
        <button
          onClick={handleBackup} disabled={backing}
          className="btn-primary"
          style={{ padding: '10px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          {backing ? '⏳...' : '💾 Yerel Yedek'}
        </button>

        <button
          onClick={() => setShowEncModal(true)} disabled={encrypting}
          style={{
            padding: '10px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            background: 'linear-gradient(135deg, #4F46E5, #3730A3)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer'
          }}
        >
          🔐 AES-256 Şifreli
        </button>

        <button
          onClick={handleExport} disabled={exporting}
          className="btn-subtle"
          style={{ padding: '10px 6px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid var(--border)' }}
        >
          {exporting ? '⏳...' : '📤 JSON'}
        </button>
      </div>

      {/* AES-256 Şifre Belirleme Modalı */}
      {showEncModal && (
        <div style={{ background: '#EEF2FF', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#3730A3', marginBottom: '6px' }}>🔐 AES-256-GCM Şifreli Yedekleme</div>
          <div style={{ fontSize: '11px', color: '#4338CA', marginBottom: '8px' }}>
            Veritabanınız askeri standartlarda (AES-256) şifrelenecek ve <code>.enc</code> dosyası olarak kaydedilecektir.
          </div>
          <input
            type="password"
            placeholder="Yedekleme Parolası (Opsiyonel)"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '8px', background: 'white' }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn-subtle" onClick={() => setShowEncModal(false)} style={{ flex: 1, padding: '6px', fontSize: '11px' }}>
              İptal
            </button>
            <button
              onClick={handleEncryptedBackup} disabled={encrypting}
              style={{ flex: 2, padding: '6px', fontSize: '12px', background: '#4F46E5', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
            >
              {encrypting ? 'Şifreleniyor...' : '🔒 Şifrele & Yedekle'}
            </button>
          </div>
        </div>
      )}

      {/* Sonuç Mesajı */}
      {lastResult && (
        <div style={{ fontSize: '11px', padding: '6px 10px', background: lastResult.startsWith('✅') || lastResult.startsWith('🔐') ? '#F0FDF4' : '#FEF2F2', borderRadius: '4px', color: lastResult.startsWith('✅') || lastResult.startsWith('🔐') ? '#065F46' : '#991B1B', marginBottom: '8px' }}>
          {lastResult}
        </div>
      )}

      {/* Yedek Geçmişi */}
      {backups.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>SON YEDEKLER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {backups.slice(0, 5).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'var(--surface-subtle)', borderRadius: '4px', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {b.is_encrypted ? '🔐' : '🗄️'} {b.name.slice(-28)}
                </span>
                <span style={{ fontWeight: 600 }}>{b.size_kb} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', lineHeight: '1.4' }}>
        📁 Yedekler: <code>./backups/</code> klasörüne kaydedilir · Gece 04:00 otomatik yedekleme aktif
      </div>
    </div>
  );
}
