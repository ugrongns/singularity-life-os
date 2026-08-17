'use client';
import { useState, useRef } from 'react';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddBookModal({ isOpen, onClose, onSuccess }: AddBookModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState('Kişisel Gelişim');
  const [totalPages, setTotalPages] = useState('200');
  const [currentPage, setCurrentPage] = useState('0');
  const [status, setStatus] = useState<'reading' | 'wishlist' | 'completed'>('reading');
  const [format, setFormat] = useState<'physical' | 'ebook' | 'audiobook'>('physical');
  const [shelfLocation, setShelfLocation] = useState('Salon Kitaplığı A-3');
  const [wordsPerPage, setWordsPerPage] = useState('250');
  const [summary, setSummary] = useState('');
  const [rating, setRating] = useState('5');
  const [coverUrl, setCoverUrl] = useState('');

  // Emanet Takip
  const [isLentOut, setIsLentOut] = useState(false);
  const [lentToName, setLentToName] = useState('');
  const [lentDate, setLentDate] = useState(new Date().toISOString().split('T')[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setPublisher('');
    setIsbn('');
    setCategory('Kişisel Gelişim');
    setTotalPages('200');
    setCurrentPage('0');
    setStatus('reading');
    setFormat('physical');
    setShelfLocation('Salon Kitaplığı A-3');
    setWordsPerPage('250');
    setSummary('');
    setRating('5');
    setCoverUrl('');
    setIsLentOut(false);
    setLentToName('');
    setLentDate(new Date().toISOString().split('T')[0]);
    setErrorMessage(null);
    setSuccessNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // İstemci tarafında hızlı görsel sıkıştırma (Max 1024px, 0.75 Kalite)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 2. Aşama: Kapak Fotoğrafından Otomatik Bilgi Çıkarma Handlerı
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPhoto(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const compressedBase64 = await compressImage(file);

      const res = await fetch('/api/library/scan-isbn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: compressedBase64,
          mime_type: 'image/jpeg'
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        const b = json.data;
        if (b.title) setTitle(b.title);
        if (b.author) setAuthor(b.author);
        if (b.publisher) setPublisher(b.publisher);
        if (b.isbn) setIsbn(b.isbn);
        if (b.total_pages) setTotalPages(String(b.total_pages));
        if (b.category) setCategory(b.category);
        if (b.summary) setSummary(b.summary);

        setSuccessNotice(json.message || `📸 Kitap kapağından "${b.title}" başarıyla okundu!`);
      } else {
        setErrorMessage(json.error || 'Görselden kitap bilgisi okunamadı. Lütfen fotoğrafın net olduğundan emin olun.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Fotoğraf işlenirken bir bağlantı hatası oluştu.');
    } finally {
      setIsAnalyzingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      setErrorMessage('Lütfen Kitap Adı ve Yazar alanlarını doldurun.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_book',
          title: title.trim(),
          author: author.trim(),
          publisher: publisher.trim(),
          isbn: isbn.trim(),
          category,
          total_pages: parseInt(totalPages) || 200,
          current_page: parseInt(currentPage) || 0,
          status,
          format,
          shelf_location: shelfLocation.trim(),
          words_per_page: parseInt(wordsPerPage) || 250,
          summary: summary.trim(),
          rating: parseInt(rating) || 5,
          cover_url: coverUrl.trim() || null,
          is_lent_out: isLentOut ? 1 : 0,
          lent_to_name: isLentOut ? lentToName.trim() : null,
          lent_date: isLentOut ? lentDate : null
        })
      });

      const json = await res.json();
      if (json.success) {
        resetForm();
        onClose();
        onSuccess(json.message || `📚 "${title}" kütüphaneye başarıyla eklendi!`);
      } else {
        setErrorMessage(json.error || 'Kitap eklenirken bir hata oluştu.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Bağlantı hatası oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '24px',
        maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        color: '#111827', boxShadow: '0 20px 45px -15px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FAFAFA', borderTopLeftRadius: '24px', borderTopRightRadius: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px', background: '#F3E8FF',
              color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>
              📚
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>Yeni Kitap Ekle</h2>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0 0' }}>Kapağını çekerek veya manuel bilgilerle kitap ekleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F3F4F6', border: 'none', color: '#6B7280',
              fontSize: '16px', fontWeight: 600, cursor: 'pointer',
              width: '32px', height: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* 2. Aşama: Kapak Fotoğrafı Çek / Yükle Butonu & Gizli Input */}
        <div style={{ padding: '20px 24px 0 24px' }}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzingPhoto}
            style={{
              width: '100%',
              background: isAnalyzingPhoto ? '#F5F3FF' : '#F3E8FF',
              border: '2px dashed #C084FC',
              borderRadius: '16px',
              padding: '16px',
              color: '#7C3AED',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isAnalyzingPhoto ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)'
            }}
          >
            {isAnalyzingPhoto ? (
              <>✨ Yapay Zeka Kapak Fotoğrafını Okuyor...</>
            ) : (
              <>📸 Kitap Kapağını Çek / Görsel Seç & Otomatik Doldur</>
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {errorMessage && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              borderRadius: '12px', padding: '12px 16px', color: '#991B1B', fontSize: '13px', fontWeight: 500
            }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {successNotice && (
            <div style={{
              background: '#ECFDF5', border: '1px solid #6EE7B7',
              borderRadius: '12px', padding: '12px 16px', color: '#065F46', fontSize: '13px', fontWeight: 500
            }}>
              {successNotice}
            </div>
          )}

          {/* Section 1: Temel Bilgiler */}
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#6D28D9', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1. Temel Kitap Bilgileri
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Kitap Adı *</label>
                <input
                  type="text"
                  placeholder="Örn: Atomik Alışkanlıklar"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Yazar *</label>
                <input
                  type="text"
                  placeholder="Örn: James Clear"
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Yayınevi</label>
                <input
                  type="text"
                  placeholder="Örn: Pegasus Yayınları"
                  value={publisher}
                  onChange={e => setPublisher(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>ISBN Numarası</label>
                <input
                  type="text"
                  placeholder="Örn: 9786052999844"
                  value={isbn}
                  onChange={e => setIsbn(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Kategori</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="Kişisel Gelişim">Kişisel Gelişim</option>
                  <option value="Edebiyat / Roman">Edebiyat / Roman</option>
                  <option value="İş & Ekonomi">İş & Ekonomi</option>
                  <option value="Felsefe">Felsefe</option>
                  <option value="Tarih">Tarih</option>
                  <option value="Bilim & Teknoloji">Bilim & Teknoloji</option>
                  <option value="Psikoloji">Psikoloji</option>
                  <option value="Biyografi">Biyografi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Okuma & Format Bilgileri */}
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#6D28D9', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              2. Okuma & Format Bilgileri
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Toplam Sayfa *</label>
                <input
                  type="number"
                  value={totalPages}
                  onChange={e => setTotalPages(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Okunan Sayfa</label>
                <input
                  type="number"
                  value={currentPage}
                  onChange={e => setCurrentPage(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Okuma Durumu</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="reading">📖 Okunuyor</option>
                  <option value="wishlist">📌 Okunacak</option>
                  <option value="completed">✅ Tamamlandı</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Kitap Formatı</label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value as any)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="physical">📘 Fiziki Kitap</option>
                  <option value="ebook">📱 E-Kitap (Kindle)</option>
                  <option value="audiobook">🎧 Sesli Kitap</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Raf / Konum</label>
                <input
                  type="text"
                  placeholder="Örn: Salon Kitaplığı A-3"
                  value={shelfLocation}
                  onChange={e => setShelfLocation(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Puan (1 - 5)</label>
                <select
                  value={rating}
                  onChange={e => setRating(e.target.value)}
                  style={{
                    width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                    padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
                  <option value="4">⭐⭐⭐⭐ (4/5)</option>
                  <option value="3">⭐⭐⭐ (3/5)</option>
                  <option value="2">⭐⭐ (2/5)</option>
                  <option value="1">⭐ (1/5)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Özet & Notlar */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Özet / Notlar</label>
            <textarea
              rows={3}
              placeholder="Kitap hakkında kişisel özetiniz veya almak istediğiniz notlar..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              style={{
                width: '100%', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px',
                padding: '11px 14px', color: '#111827', fontSize: '14px', outline: 'none', resize: 'vertical'
              }}
            />
          </div>

          {/* Section 4: Emanet Takibi */}
          <div style={{
            background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '16px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              <input
                type="checkbox"
                checked={isLentOut}
                onChange={e => setIsLentOut(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#7c3aed' }}
              />
              🤝 Bu kitabı başkasına emanet verdim
            </label>

            {isLentOut && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Emanet Edilen Kişi</label>
                  <input
                    type="text"
                    placeholder="Örn: Ahmet Yılmaz"
                    value={lentToName}
                    onChange={e => setLentToName(e.target.value)}
                    style={{
                      width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '10px',
                      padding: '9px 12px', color: '#111827', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Emanet Tarihi</label>
                  <input
                    type="date"
                    value={lentDate}
                    onChange={e => setLentDate(e.target.value)}
                    style={{
                      width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '10px',
                      padding: '9px 12px', color: '#111827', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#F3F4F6', color: '#4B5563', border: 'none', padding: '12px 20px',
                borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 600
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: isSubmitting ? '#6D28D9' : '#7C3AED', color: '#FFFFFF', border: 'none',
                padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px',
                fontWeight: 600, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {isSubmitting ? 'Kaydediliyor...' : '📚 Kütüphaneme Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
