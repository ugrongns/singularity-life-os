'use client';
import { useState, useRef } from 'react';

interface VaultItem {
  id?: string;
  title: string;
  type: string;
  owner: string;
  issuer?: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  remind_days_before?: number;
  document_image_url?: string;
  notes?: string;
}

interface AddVaultItemModalProps {
  isOpen: boolean;
  item?: VaultItem | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

async function compressImageIfNeeded(file: File): Promise<File> {
  // PDF dosyalarını sıkıştırma
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return file;
  }
  // 800 KB altı görseller zaten yeterince küçük
  if (file.size <= 800 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function AddVaultItemModal({ isOpen, item, onClose, onSuccess }: AddVaultItemModalProps) {
  const isEditing = Boolean(item?.id);
  const [title, setTitle] = useState(item?.title || '');
  const [type, setType] = useState(item?.type || 'passport');
  const [owner, setOwner] = useState(item?.owner || 'Kullanıcı');
  const [issuer, setIssuer] = useState(item?.issuer || '');
  const [documentNumber, setDocumentNumber] = useState(item?.document_number || '');
  const [issueDate, setIssueDate] = useState(item?.issue_date || '');
  const [expiryDate, setExpiryDate] = useState(item?.expiry_date || '');
  const [remindDaysBefore, setRemindDaysBefore] = useState(String(item?.remind_days_before || 30));
  const [documentImageUrl, setDocumentImageUrl] = useState(item?.document_image_url || '');
  const [notes, setNotes] = useState(item?.notes || '');

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanningAI, setScanningAI] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processAndScanFile = async (rawFile: File) => {
    setScanningAI(true);
    setAiSuccessMsg(null);
    try {
      const file = await compressImageIfNeeded(rawFile);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/digital-vault/scan-document', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        if (d.title) setTitle(d.title);
        if (d.type) setType(d.type);
        if (d.owner) setOwner(d.owner);
        if (d.issuer) setIssuer(d.issuer);
        if (d.document_number) setDocumentNumber(d.document_number);
        if (d.issue_date) setIssueDate(d.issue_date);
        if (d.expiry_date) setExpiryDate(d.expiry_date);
        if (d.notes) setNotes(d.notes);
        if (d.document_image_url) setDocumentImageUrl(d.document_image_url);

        setAiSuccessMsg('✨ Belge başarıyla tarandı ve bilgiler otomatik dolduruldu!');
        setTimeout(() => setAiSuccessMsg(null), 5000);
      } else {
        alert(json.error || 'Belge tarama başarısız.');
      }
    } catch {
      alert('Belge AI tarama hatası.');
    } finally {
      setScanningAI(false);
    }
  };

  const handleAIScanInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndScanFile(file);
      e.target.value = '';
    }
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setUploading(true);
    try {
      const file = await compressImageIfNeeded(rawFile);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/digital-vault/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success && json.url) {
        setDocumentImageUrl(json.url);
      } else {
        alert(json.error || 'Dosya yükleme başarısız.');
      }
    } catch {
      alert('Dosya yükleme hatası.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndScanFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch('/api/digital-vault', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'vault',
          id: item?.id,
          title,
          type,
          owner,
          issuer,
          document_number: documentNumber,
          issue_date: issueDate,
          expiry_date: expiryDate,
          remind_days_before: parseInt(remindDaysBefore) || 30,
          document_image_url: documentImageUrl,
          notes
        })
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(isEditing ? '📁 Belge güncellendi!' : '📁 Yeni belge kasaya eklendi!');
        onClose();
      } else {
        alert(json.error || 'İşlem başarısız.');
      }
    } catch {
      alert('Kayıt hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '860px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px'
        }}
      >
        <div className="sheet-handle"></div>

        {/* Modal Üst Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{isEditing ? '✏️' : '📁'}</span>
              <span>{isEditing ? 'Belgeyi Düzenle' : 'Kasaya Yeni Belge / Evrak Ekle'}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              1Password & Apple Wallet standartlarında güvenli saklama ve AI belge ayrıştırma
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            ✕
          </button>
        </div>

        {/* AI Başarı Bildirimi */}
        {aiSuccessMsg && (
          <div style={{
            background: 'var(--emerald-bg)',
            color: 'var(--emerald)',
            border: '1px solid var(--emerald)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>✓</span>
            <span>{aiSuccessMsg}</span>
          </div>
        )}

        {/* 2 Sütunlu Responsive Düzen (Desktop Split / Mobile Stack) */}
        <div className="vault-modal-split">
          {/* SOL SÜTUN: Belge Yükleme, Önizleme ve AI Tarama Alanı */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              BELGE GÖRSELİ VEYA PDF
            </label>

            {/* Drag & Drop Alanı / Önizleme Kutusu */}
            <div
              className={`vault-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                position: 'relative',
                background: documentImageUrl ? 'var(--surface)' : isDragging ? 'rgba(99, 102, 241, 0.08)' : 'var(--surface-subtle)',
                borderColor: isDragging ? '#6366F1' : documentImageUrl ? 'var(--border)' : 'var(--border)'
              }}
            >
              {scanningAI ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px 0' }}>
                  <div style={{ fontSize: '32px', animation: 'spin 1.5s linear infinite' }}>✨</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#4F46E5' }}>AI Belgeyi İnceliyor...</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Metinler okunuyor, belge türü ve tarihler tespit ediliyor.
                  </div>
                </div>
              ) : documentImageUrl ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '100%', height: '170px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {documentImageUrl.startsWith('data:application/pdf') || documentImageUrl.endsWith('.pdf') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '40px' }}>📄</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>PDF Belgesi Yüklendi</span>
                      </div>
                    ) : (
                      <img
                        src={documentImageUrl}
                        alt="Yüklenen Belge"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => setDocumentImageUrl('')}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: 'var(--rose-bg)',
                        color: 'var(--rose)',
                        border: '1px solid var(--rose)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Görseli Kaldır
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: 'var(--surface-subtle)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 Değiştir
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '36px' }}>📂</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Dosyayı Buraya Sürükleyin
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    veya aşağıdaki butonlarla cihazdan seçin
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    PNG, JPG, WEBP veya PDF (Maks. 4.5 MB)
                  </div>
                </>
              )}
            </div>

            {/* Gizli Inputlar */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleAIScanInput}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={handleAIScanInput}
            />

            {/* Aksiyon Butonları (Mobil Kamera ve Dosya Seçimi) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={scanningAI || uploading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #4F46E5, #3B82F6)',
                  color: '#FFFFFF',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
                }}
              >
                <span>📸</span>
                <span>Kameradan Çek & AI ile Tara</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanningAI || uploading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-main)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                <span>📁</span>
                <span>Galeriden / Dosyalardan Seç</span>
              </button>
            </div>

            <div style={{ background: 'var(--surface-subtle)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              💡 <strong>AI Vision Avantajı:</strong> Yüklediğiniz pasaport, kimlik veya garanti belgesindeki başlık, kişi adı, seri no ve geçerlilik tarihleri otomatik olarak okunur.
            </div>
          </div>

          {/* SAĞ SÜTUN: Belge Meta Veri Formu */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>BELGE ADI / BAŞLIK *</label>
              <input
                type="text"
                placeholder="Ör. T.C. Bordo Pasaport, Kadıköy Tapu, Samsung TV Garanti"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>BELGE TÜRÜ *</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                >
                  <option value="passport">🛂 Pasaport</option>
                  <option value="id_card">🪪 Kimlik Kartı</option>
                  <option value="license">📋 Ehliyet / Ruhsat</option>
                  <option value="warranty">🛡️ Garanti Belgesi</option>
                  <option value="contract">📄 Sözleşme / Kontrat</option>
                  <option value="title_deed">🏠 Tapu / Gayrimenkul</option>
                  <option value="health">🩺 Sağlık Raporu / Aşı</option>
                  <option value="insurance">🏥 Sigorta / Kasko / DASK</option>
                  <option value="invoice">🧾 Fatura / Makbuz</option>
                  <option value="other">📁 Diğer Belge</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>BELGE SAHİBİ</label>
                <input
                  type="text"
                  placeholder="Ör. Ben, Eşim, Aile"
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>BELGE / SERİ NO</label>
                <input
                  type="text"
                  placeholder="Ör. U12345678, SN992-881"
                  value={documentNumber}
                  onChange={e => setDocumentNumber(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>VEREN KURUM / MARKA</label>
                <input
                  type="text"
                  placeholder="Ör. NVİ, Samsung, Aksigorta"
                  value={issuer}
                  onChange={e => setIssuer(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>VERİLİŞ TARİHİ</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'var(--surface)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>SON KULLANMA / BİTİŞ</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'var(--surface)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>UYARI (GÜN ÖNCE)</label>
                <input
                  type="number"
                  value={remindDaysBefore}
                  onChange={e => setRemindDaysBefore(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'var(--surface)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>NOTLAR & SAKLAMA DETAYLARI</label>
              <textarea
                rows={2}
                placeholder="Fiziksel saklama dolabı, poliçe detayları veya önemli şartlar..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface)', color: 'var(--text-main)', resize: 'vertical' }}
              />
            </div>

            {/* Alt Butonlar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer'
                }}
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={submitting || scanningAI}
                style={{
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: 800,
                  background: 'var(--text-main)',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{submitting ? 'Kaydediliyor...' : isEditing ? '💾 Değişiklikleri Kaydet' : '➕ Kasaya Kaydet'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
