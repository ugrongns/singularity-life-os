'use client';
import { useState } from 'react';

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
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [scanningAI, setScanningAI] = useState(false);

  if (!isOpen) return null;

  const handleAIScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningAI(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
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
      } else {
        alert(json.error || 'Belge tarama başarısız.');
      }
    } catch {
      alert('Belge AI tarama hatası.');
    } finally {
      setScanningAI(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
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
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            {isEditing ? '✏️ Kasadaki Belgeyi Düzenle' : '📁 Kasaya Yeni Belge / Evrak Ekle'}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        {/* AI Fotoğraf Tara & Otomatik Doldur Banner */}
        <div style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px dashed #6366F1', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#4F46E5' }}>✨ Belge Fotoğrafı Tara (AI Otomatik Doldur)</div>
              <div style={{ fontSize: '10px', color: '#6366F1', marginTop: '2px' }}>Pasaport, Kimlik, Tapu veya Garanti belgesinin fotoğrafını seçin</div>
            </div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#4F46E5', color: 'white', padding: '7px 12px',
              borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(79,70,229,0.3)', flexShrink: 0
            }}>
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleAIScan} disabled={scanningAI} />
              <span>📸 {scanningAI ? 'AI Okuyor...' : 'Belge Tara'}</span>
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BELGE ADI *</label>
            <input
              type="text"
              placeholder="Ör. Pasaport, Ev Tapusu, Buzdolabı Garantisi"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BELGE TÜRÜ *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              >
                <option value="passport">🛂 Pasaport</option>
                <option value="id_card">🪪 Kimlik Kartı</option>
                <option value="title_deed">🏠 Tapu / Gayrimenkul</option>
                <option value="warranty">🛡️ Garanti Belgesi</option>
                <option value="insurance">🏥 Sigorta / Kasko / DASK</option>
                <option value="contract">📄 Sözleşme / Kontrat</option>
                <option value="license">📋 Ehliyet / Ruhsat</option>
                <option value="other">📁 Diğer</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SAHİBİ</label>
              <input
                type="text"
                placeholder="Ör. Ben, Aile"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BELGE / SERİ NO</label>
              <input
                type="text"
                placeholder="Ör. U12345678"
                value={documentNumber}
                onChange={e => setDocumentNumber(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>VEREN KURUM</label>
              <input
                type="text"
                placeholder="Ör. İçişleri Bkn, Tapu Kadastro"
                value={issuer}
                onChange={e => setIssuer(e.target.value)}
                style={{ width: '100%', padding: '9px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>VERİLİŞ TARİHİ</label>
              <input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                style={{ width: '100%', padding: '7px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>SON KULLANMA</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                style={{ width: '100%', padding: '7px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>HATIRLAT (GÜN ÖNCE)</label>
              <input
                type="number"
                value={remindDaysBefore}
                onChange={e => setRemindDaysBefore(e.target.value)}
                style={{ width: '100%', padding: '7px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              />
            </div>
          </div>

          {/* Belge Yükleme Kutusu */}
          <div style={{ background: '#EEF2FF', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid #C7D2FE' }}>
            <label style={{ fontSize: '11px', color: '#4F46E5', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              📷 CİHAZDAN BELGE / FOTOĞRAF / PDF YÜKLE
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#4F46E5', color: 'white', padding: '6px 12px',
                borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
              }}>
                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                <span>📷 {uploading ? 'Yükleniyor...' : documentImageUrl ? 'Belgeyi Değiştir' : 'Belge Seç & Yükle'}</span>
              </label>

              {documentImageUrl && (
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✓ Yüklendi</span>
                  <button type="button" onClick={() => setDocumentImageUrl('')} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '11px' }}>Sil</button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>NOTLAR & AÇIKLAMA</label>
            <textarea
              rows={2}
              placeholder="Ek bilgiler, şifreler veya saklama konumu..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800, marginTop: '4px' }}>
            {submitting ? 'Kaydediliyor...' : isEditing ? '💾 Değişiklikleri Kaydet' : '➕ Kasaya Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
