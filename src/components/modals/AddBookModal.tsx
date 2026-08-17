'use client';
import { useState } from 'react';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#121215', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px',
        maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        color: '#fff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>
              📚
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Yeni Kitap Ekle</h2>
              <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '2px 0 0 0' }}>Manuel bilgi girişi ile kütüphanenizi zenginleştirin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#a1a1aa',
              fontSize: '20px', cursor: 'pointer', padding: '8px', borderRadius: '8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px', padding: '12px 16px', color: '#f87171', fontSize: '13px'
            }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Section 1: Temel Bilgiler */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#a78bfa', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1. Temel Kitap Bilgileri
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Kitap Adı *</label>
                <input
                  type="text"
                  placeholder="Örn: Atomik Alışkanlıklar"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Yazar *</label>
                <input
                  type="text"
                  placeholder="Örn: James Clear"
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Yayınevi</label>
                <input
                  type="text"
                  placeholder="Örn: Pegasus Yayınları"
                  value={publisher}
                  onChange={e => setPublisher(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>ISBN Numarası</label>
                <input
                  type="text"
                  placeholder="Örn: 9786052999844"
                  value={isbn}
                  onChange={e => setIsbn(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Kategori</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
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

          {/* Section 2: Okuma & İlerleme Detayları */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#a78bfa', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              2. Okuma & Format Bilgileri
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Toplam Sayfa *</label>
                <input
                  type="number"
                  value={totalPages}
                  onChange={e => setTotalPages(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Okunan Sayfa</label>
                <input
                  type="number"
                  value={currentPage}
                  onChange={e => setCurrentPage(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Okuma Durumu</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="reading">📖 Okunuyor</option>
                  <option value="wishlist">📌 Okunacak</option>
                  <option value="completed">✅ Tamamlandı</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Kitap Formatı</label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value as any)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                >
                  <option value="physical">📘 Fiziki Kitap</option>
                  <option value="ebook">📱 E-Kitap (Kindle)</option>
                  <option value="audiobook">🎧 Sesli Kitap</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Raf / Konum</label>
                <input
                  type="text"
                  placeholder="Örn: Salon Kitaplığı A-3"
                  value={shelfLocation}
                  onChange={e => setShelfLocation(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Puan (1 - 5)</label>
                <select
                  value={rating}
                  onChange={e => setRating(e.target.value)}
                  style={{
                    width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none'
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
            <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Özet / Notlar</label>
            <textarea
              rows={3}
              placeholder="Kitap hakkında kişisel özetiniz veya almak istediğiniz notlar..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              style={{
                width: '100%', background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '10px',
                padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical'
              }}
            />
          </div>

          {/* Section 4: Emanet Takibi */}
          <div style={{
            background: '#1a1a1e', border: '1px solid #27272a', borderRadius: '12px', padding: '16px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isLentOut}
                onChange={e => setIsLentOut(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }}
              />
              🤝 Bu kitabı başkasına emanet verdim
            </label>

            {isLentOut && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Emanet Edilen Kişi</label>
                  <input
                    type="text"
                    placeholder="Örn: Ahmet Yılmaz"
                    value={lentToName}
                    onChange={e => setLentToName(e.target.value)}
                    style={{
                      width: '100%', background: '#121215', border: '1px solid #27272a', borderRadius: '8px',
                      padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Emanet Tarihi</label>
                  <input
                    type="date"
                    value={lentDate}
                    onChange={e => setLentDate(e.target.value)}
                    style={{
                      width: '100%', background: '#121215', border: '1px solid #27272a', borderRadius: '8px',
                      padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#27272a', color: '#a1a1aa', border: 'none', padding: '12px 20px',
                borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 500
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: isSubmitting ? '#5b21b6' : '#7c3aed', color: '#fff', border: 'none',
                padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px',
                fontWeight: 600, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
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
