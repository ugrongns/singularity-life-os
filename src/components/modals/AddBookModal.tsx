'use client';
import { useState, useRef } from 'react';
import LiveBarcodeScannerModal from './LiveBarcodeScannerModal';
import { BOOK_CATEGORIES, sortCategoriesInTurkish } from '@/lib/book-categories';

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
  const [categoriesList, setCategoriesList] = useState<string[]>(() => sortCategoriesInTurkish(BOOK_CATEGORIES));
  const [category, setCategory] = useState('Kişisel Gelişim');
  const [totalPages, setTotalPages] = useState('200');
  const [currentPage, setCurrentPage] = useState('0');
  const [status, setStatus] = useState<'reading' | 'wishlist' | 'completed'>('wishlist');
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

  // Modallar ve Durumlar
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const applyIncomingCategory = (incomingCategory?: string) => {
    if (!incomingCategory) return;
    const clean = incomingCategory.trim();
    if (!clean) return;
    setCategoriesList(prev => {
      if (!prev.includes(clean)) {
        return sortCategoriesInTurkish([...prev, clean]);
      }
      return prev;
    });
    setCategory(clean);
  };

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setPublisher('');
    setIsbn('');
    setCategoriesList(sortCategoriesInTurkish(BOOK_CATEGORIES));
    setCategory('Kişisel Gelişim');
    setTotalPages('200');
    setCurrentPage('0');
    setStatus('wishlist');
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
    setIsBarcodeScannerOpen(false);
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

  // 2. Aşama: Kapak Fotoğrafından Otomatik Bilgi Çıkarma & Kapak Resmi Olarak Kaydetme
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const compressedBase64 = await compressImage(file);
      // Çekilen kapak fotoğrafını doğrudan kapak görseli olarak kaydet
      setCoverUrl(compressedBase64);

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
        if (b.category) applyIncomingCategory(b.category);
        if (b.summary) setSummary(b.summary);

        setSuccessNotice(json.message || `📸 Kitap kapağından "${b.title}" okundu ve görsel eklendi!`);
      } else {
        setSuccessNotice('📸 Kapak fotoğrafı eklendi. Detaylı künye bilgilerini aşağıdan doldurabilirsiniz.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Fotoğraf işlenirken bir bağlantı hatası oluştu.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. Aşama: Canlı Barkod Kamera Tarama Handlerı (4 Kaynaklı Sorgu)
  const handleBarcodeDetected = async (detectedIsbn: string) => {
    setIsBarcodeScannerOpen(false);
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    const clean = detectedIsbn.replace(/[^0-9X]/gi, '').trim();
    setIsbn(clean);

    try {
      const res = await fetch('/api/library/scan-isbn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: clean })
      });

      const json = await res.json();
      if (json.success && json.data) {
        const b = json.data;
        if (b.title) setTitle(b.title);
        if (b.author) setAuthor(b.author);
        if (b.publisher) setPublisher(b.publisher);
        if (b.total_pages) setTotalPages(String(b.total_pages));
        if (b.category) applyIncomingCategory(b.category);
        if (b.summary) setSummary(b.summary);
        if (b.cover_url) setCoverUrl(b.cover_url);

        setSuccessNotice(json.message || `🔍 "${b.title}" (ISBN: ${clean}) veritabanında bulundu!`);
      } else {
        setErrorMessage(json.error || `ISBN (${clean}) veritabanında bulunamadı. Lütfen detayları manuel doldurun.`);
      }
    } catch (err: any) {
      setErrorMessage('Sorgulama yapılırken bağlantı hatası oluştu.');
    } finally {
      setIsAnalyzing(false);
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
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
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
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
      }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px',
          maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
          color: 'var(--text-main)', boxShadow: 'var(--shadow-lg)'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface-subtle)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px', background: 'var(--indigo-bg)',
                color: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
              }}>
                📚
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Yeni Kitap Ekle</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Barkod tarayarak, fotoğraf çekerek veya manuel ekleyin</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: 'var(--text-main)',
                fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>

          {/* Aksiyon Butonları (Barkod & Kapak Fotoğrafı) */}
          <div style={{ padding: '20px 24px 0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handlePhotoCapture}
              style={{ display: 'none' }}
            />

            {/* 3. Aşama: Canlı Barkod Kamera Butonu */}
            <button
              type="button"
              onClick={() => setIsBarcodeScannerOpen(true)}
              disabled={isAnalyzing}
              style={{
                background: 'var(--emerald)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '16px',
                padding: '14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              📷 Canlı Barkod Tara
            </button>

            {/* 2. Aşama: Kapak Fotoğrafı Çek / Seç Butonu */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              style={{
                background: 'var(--indigo-bg)',
                border: '1.5px solid var(--indigo)',
                borderRadius: '16px',
                padding: '14px',
                color: 'var(--indigo)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              📸 Kapak Çek / Yükle
            </button>
          </div>

          {/* Kapak Önizleme Paneli */}
          {coverUrl && (
            <div style={{
              margin: '16px 24px 0 24px', padding: '12px 16px', background: 'var(--surface-subtle)',
              border: '1px solid var(--border)', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={coverUrl}
                  alt="Kapak Önizleme"
                  style={{ width: '48px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>🖼️ Kitap Kapağı Eklendi</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Görsel kitap kartlarında gösterilecektir</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCoverUrl('')}
                style={{
                  background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)',
                  padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Kapağı Kaldır
              </button>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isAnalyzing && (
              <div style={{
                background: 'var(--indigo-bg)', border: '1px solid var(--indigo)',
                borderRadius: '12px', padding: '12px 16px', color: 'var(--indigo)', fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                ✨ 4 Kaynaklı Arama Motoru Kitap Bilgilerini Çözümlüyor...
              </div>
            )}

            {errorMessage && (
              <div style={{
                background: 'var(--rose-bg)', border: '1px solid var(--rose)',
                borderRadius: '12px', padding: '12px 16px', color: 'var(--rose)', fontSize: '13px', fontWeight: 600
              }}>
                ⚠️ {errorMessage}
              </div>
            )}

            {successNotice && (
              <div style={{
                background: 'var(--emerald-bg)', border: '1px solid var(--emerald)',
                borderRadius: '12px', padding: '12px 16px', color: 'var(--emerald)', fontSize: '13px', fontWeight: 600
              }}>
                {successNotice}
              </div>
            )}

            {/* Section 1: Temel Bilgiler */}
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--indigo)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Temel Kitap Bilgileri
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Kitap Adı *</label>
                  <input
                    type="text"
                    placeholder="Örn: Atomik Alışkanlıklar"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Yazar *</label>
                  <input
                    type="text"
                    placeholder="Örn: James Clear"
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Yayınevi</label>
                  <input
                    type="text"
                    placeholder="Örn: Pegasus Yayınları"
                    value={publisher}
                    onChange={e => setPublisher(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>ISBN Numarası</label>
                  <input
                    type="text"
                    placeholder="Örn: 9786052999844"
                    value={isbn}
                    onChange={e => setIsbn(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Kategori</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat} style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Kapak Resmi URL (İsteğe Bağlı)</label>
                  <input
                    type="text"
                    placeholder="https://... ile başlayan kapak resmi internet bağlantısı"
                    value={coverUrl}
                    onChange={e => setCoverUrl(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Okuma & Format Bilgileri */}
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--indigo)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. Okuma & Format Bilgileri
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Toplam Sayfa *</label>
                  <input
                    type="number"
                    value={totalPages}
                    onChange={e => setTotalPages(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Okunan Sayfa</label>
                  <input
                    type="number"
                    value={currentPage}
                    onChange={e => setCurrentPage(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Okuma Durumu</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  >
                    <option value="wishlist" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>📌 Okunacak</option>
                    <option value="reading" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>📖 Okunuyor</option>
                    <option value="completed" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>✅ Tamamlandı</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Kitap Formatı</label>
                  <select
                    value={format}
                    onChange={e => setFormat(e.target.value as any)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  >
                    <option value="physical" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>📘 Fiziki Kitap</option>
                    <option value="ebook" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>📱 E-Kitap (Kindle)</option>
                    <option value="audiobook" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>🎧 Sesli Kitap</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Raf / Konum</label>
                  <input
                    type="text"
                    placeholder="Örn: Salon Kitaplığı A-3"
                    value={shelfLocation}
                    onChange={e => setShelfLocation(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Puan (1 - 5)</label>
                  <select
                    value={rating}
                    onChange={e => setRating(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                      padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                    }}
                  >
                    <option value="5" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>⭐⭐⭐⭐⭐ (5/5)</option>
                    <option value="4" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>⭐⭐⭐⭐ (4/5)</option>
                    <option value="3" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>⭐⭐⭐ (3/5)</option>
                    <option value="2" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>⭐⭐ (2/5)</option>
                    <option value="1" style={{ background: 'var(--surface)', color: 'var(--text-main)' }}>⭐ (1/5)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Özet & Notlar */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Özet / Notlar</label>
              <textarea
                rows={3}
                placeholder="Kitap hakkında kişisel özetiniz veya almak istediğiniz notlar..."
                value={summary}
                onChange={e => setSummary(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px',
                  padding: '11px 14px', color: 'var(--text-main)', fontSize: '14px', outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            {/* Section 4: Emanet Takibi */}
            <div style={{
              background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={isLentOut}
                  onChange={e => setIsLentOut(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--indigo)' }}
                />
                🤝 Bu kitabı başkasına emanet verdim
              </label>

              {isLentOut && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Emanet Edilen Kişi</label>
                    <input
                      type="text"
                      placeholder="Örn: Ahmet Yılmaz"
                      value={lentToName}
                      onChange={e => setLentToName(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
                        padding: '9px 12px', color: 'var(--text-main)', fontSize: '13px', outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Emanet Tarihi</label>
                    <input
                      type="date"
                      value={lentDate}
                      onChange={e => setLentDate(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
                        padding: '9px 12px', color: 'var(--text-main)', fontSize: '13px', outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'var(--surface-subtle)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '12px 20px',
                  borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 600
                }}
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: isSubmitting ? 'var(--indigo)' : 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', border: 'none',
                  padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px',
                  fontWeight: 700, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {isSubmitting ? 'Kaydediliyor...' : '📚 Kütüphaneme Ekle'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 3. Aşama: Canlı Barkod Kamera Tarayıcı Modalı */}
      <LiveBarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onDetected={handleBarcodeDetected}
      />
    </>
  );
}
