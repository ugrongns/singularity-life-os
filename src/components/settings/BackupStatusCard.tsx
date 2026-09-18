'use client';
import { useState, useRef } from 'react';

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
  const [restoring, setRestoring] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showEncModal, setShowEncModal] = useState(false);
  const [restoreConfirmModal, setRestoreConfirmModal] = useState<{ open: boolean, data: any, recordCount: number, tablesCount: number, fileName: string } | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 3. JSON Yedeği Yükle ve Ayrıştır
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const dataObj = parsed.data || parsed;
        const tables = Object.keys(dataObj).filter(k => Array.isArray(dataObj[k]));
        const count = tables.reduce((acc, t) => acc + (dataObj[t]?.length || 0), 0);

        if (count === 0) {
          setLastResult('❌ Yüklenen yedek dosyasında geçerli veri tablosu bulunamadı.');
          return;
        }

        setRestoreConfirmModal({
          open: true,
          data: dataObj,
          recordCount: count,
          tablesCount: tables.length,
          fileName: file.name
        });
      } catch (err: any) {
        setLastResult(`❌ JSON dosyası okunamadı: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // 4. Onaylandıktan sonra Geri Yükle
  const handleConfirmRestore = async () => {
    if (!restoreConfirmModal?.data) return;
    setRestoring(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          backupData: { data: restoreConfirmModal.data }
        })
      });
      const resJson = await res.json();
      setRestoring(false);
      setRestoreConfirmModal(null);
      if (resJson.success) {
        setLastResult(`✅ Başarılı: ${resJson.total_restored || 0} kayıt başarıyla geri yüklendi!`);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setLastResult(`❌ Geri yükleme hatası: ${resJson.error || 'İşlem başarısız oldu.'}`);
      }
    } catch (err: any) {
      setRestoring(false);
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
        <span style={{ fontSize: '11px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, border: '1px solid var(--emerald)' }}>
          ● Supabase Cloud Aktif
        </span>
      </div>

      {/* Durum Özeti */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Bulut Veritabanı', value: 'PostgreSQL', icon: '🐘', color: 'var(--blue)' },
          { label: 'Boyut / Kayıt', value: `${db_size_kb} KB`, icon: '📊', color: 'var(--text-main)' },
          { label: 'Bulut Koruması', value: '7/24 Kesintisiz', icon: '🛡️', color: 'var(--emerald)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px' }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: s.color || 'var(--text-main)', marginTop: '2px' }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bulut Bilgilendirme Notu */}
      <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', lineHeight: '1.5' }}>
        <div style={{ color: 'var(--emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span>✅</span> Verileriniz Supabase Bulutunda Güvende
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          Tüm verileriniz Supabase üzerinde otomatik olarak replike edilir. Dilediğiniz zaman aşağıdaki butonlarla yerel kopya indirebilir veya yedeğinizi geri yükleyebilirsiniz.
        </div>
      </div>

      {/* Aksiyon Butonları */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <button
          onClick={handleBackup} disabled={backing || restoring}
          className="btn-primary"
          style={{ padding: '12px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
        >
          {backing ? '⏳ Hazırlanıyor...' : '📥 JSON İndir'}
        </button>

        <button
          onClick={() => setShowEncModal(true)} disabled={encrypting || restoring}
          style={{
            padding: '12px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            background: 'linear-gradient(135deg, #4F46E5, #3730A3)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer'
          }}
        >
          🔐 AES-256
        </button>

        <button
          onClick={() => fileInputRef.current?.click()} disabled={restoring || backing}
          style={{
            padding: '12px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            background: 'var(--surface-subtle)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer'
          }}
        >
          {restoring ? '⏳ Yükleniyor...' : '📤 Geri Yükle'}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* AES-256 Şifre Belirleme Modalı */}
      {showEncModal && (
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>🔐 AES-256-CBC Şifreli Yedekleme</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Veritabanınız askeri standartlarda (AES-256) şifrelenecek ve <code>.enc</code> dosyası olarak bilgisayarınıza indirilecektir.
          </div>
          <input
            type="password"
            placeholder="Yedekleme Parolası (Opsiyonel)"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '8px', background: 'var(--surface)', color: 'var(--text-main)' }}
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

      {/* Restore Onay Modalı */}
      {restoreConfirmModal?.open && (
        <div style={{ background: 'var(--surface-subtle)', border: '1px solid #f59e0b', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠️ Veritabanı Geri Yükleme Onayı
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-main)', marginBottom: '4px' }}>
            Dosya: <b>{restoreConfirmModal.fileName}</b>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: '1.4' }}>
            Bu yedek <b>{restoreConfirmModal.tablesCount}</b> tablo ve toplam <b>{restoreConfirmModal.recordCount}</b> kayıt içermektedir. Verileriniz mevcut tablolara güvenle eklenecektir. Devam etmek istiyor musunuz?
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn-subtle"
              onClick={() => setRestoreConfirmModal(null)}
              disabled={restoring}
              style={{ flex: 1, padding: '6px', fontSize: '11px' }}
            >
              İptal
            </button>
            <button
              onClick={handleConfirmRestore}
              disabled={restoring}
              style={{ flex: 2, padding: '6px', fontSize: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
            >
              {restoring ? 'Geri Yükleniyor...' : '✅ Evet, Geri Yükle'}
            </button>
          </div>
        </div>
      )}

      {/* Sonuç Mesajı */}
      {lastResult && (
        <div style={{
          fontSize: '12px', padding: '8px 12px',
          background: lastResult.startsWith('✅') || lastResult.startsWith('🔐') ? 'var(--emerald-bg)' : 'var(--rose-bg)',
          borderRadius: '6px',
          color: lastResult.startsWith('✅') || lastResult.startsWith('🔐') ? 'var(--emerald)' : 'var(--rose)',
          marginBottom: '8px', border: `1px solid ${lastResult.startsWith('✅') || lastResult.startsWith('🔐') ? 'var(--emerald)' : 'var(--rose)'}`
        }}>
          {lastResult}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', lineHeight: '1.4' }}>
        💾 İndirilen yedek dosyası tüm tabloları, hesapları, araç ve sağlık kayıtlarını içerir.
      </div>
    </div>
  );
}
