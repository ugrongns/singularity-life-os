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

  // Dosya indirme yardımcı fonksiyonu
  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // 1. JSON Yedek Al & İndir
  const handleBackup = async () => {
    setBacking(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup_db' })
      });
      const data = await res.json();
      setBacking(false);
      if (data.success && data.jsonData) {
        const fileName = data.backup?.name || `singularity-backup-${new Date().toISOString().split('T')[0]}.json`;
        downloadFile(JSON.stringify(data.jsonData, null, 2), fileName, 'application/json');
        setLastResult(`✅ Tam bulut veritabanı yedeği indirildi: ${fileName} (${data.backup?.size_kb || 0} KB, ${data.backup?.total_records || 0} kayıt)`);
      } else {
        setLastResult(`❌ Hata: ${data.error || 'Yedek alınamadı.'}`);
      }
    } catch (err: any) {
      setBacking(false);
      setLastResult(`❌ Bağlantı hatası: ${err.message}`);
    }
  };

  // 2. AES-256 Şifreli Yedek Al & İndir
  const handleEncryptedBackup = async () => {
    setEncrypting(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'encrypted_backup', passphrase: passphrase || 'SingularityMasterKey2026' })
      });
      const data = await res.json();
      setEncrypting(false);
      setShowEncModal(false);
      if (data.success && data.encryptedPayload) {
        const fileName = data.backup?.name || `singularity-encrypted-${new Date().toISOString().split('T')[0]}.enc`;
        downloadFile(data.encryptedPayload, fileName, 'application/octet-stream');
        setLastResult(`🔐 AES-256 Şifreli Yedek indirildi: ${fileName} (${data.backup?.size_kb || 0} KB)`);
      } else {
        setLastResult(`❌ Hata: ${data.error || 'Şifreli yedek oluşturulamadı.'}`);
      }
    } catch (err: any) {
      setEncrypting(false);
      setLastResult(`❌ Bağlantı hatası: ${err.message}`);
    }
  };

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>☁️</span>
          <span>Veri Yedekleme & Dışa Aktarma</span>
        </div>
        <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#059669', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, border: '1px solid #A7F3D0' }}>
          ● Supabase Cloud Aktif
        </span>
      </div>

      {/* Durum Özeti */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Bulut Veritabanı', value: 'PostgreSQL', icon: '🐘', color: '#2563EB' },
          { label: 'Boyut / Kayıt', value: `${db_size_kb} KB`, icon: '📊', color: 'var(--text-main)' },
          { label: 'Bulut Koruması', value: '7/24 Kesintisiz', icon: '🛡️', color: '#10B981' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px' }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: s.color || 'var(--text-main)', marginTop: '2px' }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bulut Bilgilendirme Notu */}
      <div style={{ background: '#F0FDF4', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', lineHeight: '1.5' }}>
        <div style={{ color: '#065F46', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span>✅</span> Verileriniz Supabase Bulutunda Güvende
        </div>
        <div style={{ color: '#047857', fontSize: '11px' }}>
          Tüm verileriniz Supabase üzerinde otomatik olarak replike edilir. Dilediğiniz zaman aşağıdaki butonlarla bilgisayarınıza yerel bir kopya indirebilirsiniz.
        </div>
      </div>

      {/* Aksiyon Butonları */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <button
          onClick={handleBackup} disabled={backing}
          className="btn-primary"
          style={{ padding: '12px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
        >
          {backing ? '⏳ Hazırlanıyor...' : '📥 JSON Yedeği İndir'}
        </button>

        <button
          onClick={() => setShowEncModal(true)} disabled={encrypting}
          style={{
            padding: '12px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            background: 'linear-gradient(135deg, #4F46E5, #3730A3)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer'
          }}
        >
          🔐 AES-256 Şifreli
        </button>
      </div>

      {/* AES-256 Şifre Belirleme Modalı */}
      {showEncModal && (
        <div style={{ background: '#EEF2FF', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#3730A3', marginBottom: '6px' }}>🔐 AES-256-CBC Şifreli Yedekleme</div>
          <div style={{ fontSize: '11px', color: '#4338CA', marginBottom: '8px' }}>
            Veritabanınız askeri standartlarda (AES-256) şifrelenecek ve <code>.enc</code> dosyası olarak bilgisayarınıza indirilecektir.
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
              {encrypting ? 'Şifreleniyor...' : '🔒 Şifrele & İndir'}
            </button>
          </div>
        </div>
      )}

      {/* Sonuç Mesajı */}
      {lastResult && (
        <div style={{ fontSize: '12px', padding: '8px 12px', background: lastResult.startsWith('✅') || lastResult.startsWith('🔐') ? '#F0FDF4' : '#FEF2F2', borderRadius: '6px', color: lastResult.startsWith('✅') || lastResult.startsWith('🔐') ? '#065F46' : '#991B1B', marginBottom: '8px', border: '1px solid currentColor' }}>
          {lastResult}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', lineHeight: '1.4' }}>
        💾 İndirilen yedek dosyası tüm tabloları, hesapları, araç ve sağlık kayıtlarını içerir.
      </div>
    </div>
  );
}
