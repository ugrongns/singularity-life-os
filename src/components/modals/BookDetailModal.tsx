'use client';
import { useState, useEffect } from 'react';
import { BOOK_CATEGORIES } from '@/lib/book-categories';

interface Book {
  id: string;
  title: string;
  author: string;
  translator?: string;
  publisher?: string;
  total_pages: number;
  current_page: number;
  status: string;
  format?: string;
  shelf_location?: string;
  cover_url?: string;
  rating?: number;
  category?: string;
  start_date?: string;
  finish_date?: string;
  purchased_date?: string;
  purchased_from?: string;
  purchase_price?: number;
  notes?: string;
  is_lent_out?: number;
  lent_to_name?: string;
  lent_date?: string;
  stats?: {
    wpm?: number;
    totalDurationText?: string;
    sessionCount?: number;
    avgMinutesPerPage?: string;
  };
}

interface BookDetailModalProps {
  isOpen: boolean;
  book: Book | null;
  onClose: () => void;
  onSuccess: (msg?: string) => void;
  onOpenSession?: (bookId: string) => void;
}

export default function BookDetailModal({ isOpen, book, onClose, onSuccess, onOpenSession }: BookDetailModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [category, setCategory] = useState('Kişisel Gelişim');
  const [status, setStatus] = useState('reading');
  const [format, setFormat] = useState('physical');
  const [shelfLocation, setShelfLocation] = useState('Salon Kitaplığı');
  const [totalPages, setTotalPages] = useState<number | ''>(200);
  const [currentPage, setCurrentPage] = useState<number | ''>(0);
  const [rating, setRating] = useState<number>(5);
  const [coverUrl, setCoverUrl] = useState('');
  const [purchasedFrom, setPurchasedFrom] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [purchasedDate, setPurchasedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [finishDate, setFinishDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isLentOut, setIsLentOut] = useState(false);
  const [lentToName, setLentToName] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (book) {
      setTitle(book.title || '');
      setAuthor(book.author || '');
      setPublisher(book.publisher || '');
      setCategory(book.category || 'Kişisel Gelişim');
      setStatus(book.status || 'reading');
      setFormat(book.format || 'physical');
      setShelfLocation(book.shelf_location || 'Salon Kitaplığı');
      setTotalPages(book.total_pages ?? 200);
      setCurrentPage(book.current_page ?? 0);
      setRating(book.rating ?? 5);
      setCoverUrl(book.cover_url || '');
      setPurchasedFrom(book.purchased_from || '');
      setPurchasePrice(book.purchase_price ?? '');
      setPurchasedDate(book.purchased_date || '');
      setStartDate(book.start_date || '');
      setFinishDate(book.finish_date || '');
      setNotes(book.notes || '');
      setIsLentOut(Boolean(book.is_lent_out));
      setLentToName(book.lent_to_name || '');
      setErrorMsg(null);
    }
  }, [book]);

  if (!isOpen || !book) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Kitap başlığı boş olamaz.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          book_id: book.id,
          title: title.trim(),
          author: author.trim(),
          publisher: publisher.trim(),
          category,
          status,
          format,
          shelf_location: shelfLocation,
          total_pages: Number(totalPages) || 0,
          current_page: Number(currentPage) || 0,
          rating,
          cover_url: coverUrl.trim(),
          purchased_from: purchasedFrom.trim(),
          purchase_price: purchasePrice !== '' ? Number(purchasePrice) : null,
          purchased_date: purchasedDate || null,
          start_date: startDate || null,
          finish_date: finishDate || null,
          notes: notes.trim(),
          is_lent_out: isLentOut ? 1 : 0,
          lent_to_name: isLentOut ? lentToName.trim() : null
        })
      });

      const json = await res.json();

      if (json.success) {
        onSuccess(json.message);
        onClose();
      } else {
        setErrorMsg(json.error || 'Kaydetme başarısız oldu.');
      }
    } catch {
      setErrorMsg('Bir sunucu hatası oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const [uploadingCover, setUploadingCover] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/library/upload-cover', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success && json.url) {
        setCoverUrl(json.url);
      } else {
        setErrorMsg(json.error || 'Fotoğraf yükleme başarısız.');
      }
    } catch {
      setErrorMsg('Fotoğraf yüklenirken bir hata oluştu.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!confirm(`"${book.title}" kitabını kütüphanenizden silmek istediğinize emin misiniz?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/library?id=${book.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        onSuccess(json.message);
        onClose();
      } else {
        setErrorMsg(json.error || 'Silme işlemi başarısız.');
      }
    } catch {
      setErrorMsg('Silme hatası.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>

        {/* Üst Bilgi & Kapak Resmi Bölümü */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <label style={{ cursor: 'pointer', position: 'relative', flexShrink: 0 }} title="Kapak Fotoğrafı Yükle">
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={uploadingCover}
            />
            {coverUrl ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={coverUrl}
                  alt={title}
                  style={{
                    width: '76px', height: '106px', objectFit: 'cover',
                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'block'
                  }}
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <div style={{
                  position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)',
                  color: 'white', fontSize: '10px', padding: '2px 5px', borderRadius: '4px', fontWeight: 700
                }}>
                  📷 Değiştir
                </div>
              </div>
            ) : (
              <div style={{
                width: '76px', height: '106px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', gap: '4px'
              }}>
                <span style={{ fontSize: '28px' }}>📖</span>
                <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                  {uploadingCover ? 'Yükleniyor...' : '📷 Yükle'}
                </span>
              </div>
            )}
          </label>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', lineHeight: '1.2' }}>
              {book.title}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
              {book.author}
            </div>

            {/* Cihazdan Görsel Yükle / Kaldır Butonları */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE',
                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                cursor: 'pointer'
              }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={uploadingCover}
                />
                <span>📷 {uploadingCover ? 'Fotoğraf Yükleniyor...' : coverUrl ? 'Fotoğrafı Değiştir' : 'Cihazdan Fotoğraf Seç'}</span>
              </label>

              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl('')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5',
                    padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Kapak Fotoğrafını Kaldır"
                >
                  <span>🗑️ Kaldır</span>
                </button>
              )}
            </div>

            {/* Skorlama Yıldızları */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '18px', padding: '0 2px', transition: 'transform 0.1s'
                  }}
                  title={`${star} Yıldız`}
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', marginLeft: '4px' }}>
                ({rating}/5)
              </span>
            </div>
          </div>

          <button
            onClick={handleDeleteBook}
            disabled={deleting}
            style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}
            title="Kitabı Sil"
          >
            🗑️
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', marginBottom: '12px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Temel Kitap Bilgileri */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>KİTAP ADI *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>YAZAR *</label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>YAYINEVİ</label>
              <input
                type="text"
                value={publisher}
                onChange={e => setPublisher(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>KATEGORİ</label>
              <input
                type="text"
                list="book-categories-list"
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
                placeholder="Kategori seçin veya yazın..."
              />
              <datalist id="book-categories-list">
                {BOOK_CATEGORIES.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>FORMAT</label>
              <select
                value={format}
                onChange={e => setFormat(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              >
                <option value="physical">📚 Fiziki Kitap</option>
                <option value="ebook">📱 E-Kitap (Kindle)</option>
                <option value="audiobook">🎧 Sesli Kitap</option>
              </select>
            </div>
          </div>

          {/* İlerleme & Durum */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-main)' }}>
              📖 Okuma İlerlemesi & Durum
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>DURUM</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'white' }}
                >
                  <option value="reading">📖 Okunuyor</option>
                  <option value="completed">🏆 Tamamlandı</option>
                  <option value="wishlist">📌 İstek Listesi</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>GÜNCEL SAYFA</label>
                <input
                  type="number"
                  value={currentPage}
                  onChange={e => setCurrentPage(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'white' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>TOPLAM SAYFA</label>
                <input
                  type="number"
                  value={totalPages}
                  onChange={e => setTotalPages(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'white' }}
                />
              </div>
            </div>

            {/* O Kitaba Özel Okuma Hızı & Seans İstatistikleri (Otomatik) */}
            <div style={{
              marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>OKUMA HIZI (KİTABA ÖZEL)</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#6366F1', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>⚡ {book.stats?.wpm || 220} WPM</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    (~{book.stats?.avgMinutesPerPage || '0.8'} dk / sayfa)
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>OKUNAN SÜRE & SEANSLAR</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  ⏱️ {book.stats?.totalDurationText || '0 dk'} ({book.stats?.sessionCount || 0} Seans)
                </div>
              </div>
            </div>

            {onOpenSession && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onClose();
                  onOpenSession(book.id);
                }}
                style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px', fontWeight: 700 }}
              >
                <span>⏱️</span>
                <span>Bu Kitap İçin Okuma Seansı Kaydet (Özel Sayfa & Dakika)</span>
              </button>
            )}
          </div>

          {/* Satın Alım / Edinme Detayları */}
          <div style={{ background: '#F0FDF4', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #BBF7D0' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '8px', color: '#166534' }}>
              🛒 Satın Alım & Finans Bilgileri
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#166534' }}>NEREDEN ALINDI?</label>
                <input
                  type="text"
                  placeholder="Ör. Amazon, D&R, Sahaf"
                  value={purchasedFrom}
                  onChange={e => setPurchasedFrom(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #86EFAC', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'white' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#166534' }}>ALIM FİYATI (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ör. 185.50"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #86EFAC', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'white' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#166534' }}>ALIM TARİHİ</label>
                <input
                  type="date"
                  value={purchasedDate}
                  onChange={e => setPurchasedDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px', border: '1px solid #86EFAC', borderRadius: 'var(--radius-md)', marginTop: '2px', background: 'white' }}
                />
              </div>
            </div>
          </div>

          {/* Tarih Çizelgesi */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>🚀 BAŞLAMA TARİHİ</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>🎯 BİTİRME TARİHİ</label>
              <input
                type="date"
                value={finishDate}
                onChange={e => setFinishDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px' }}
              />
            </div>
          </div>

          {/* Notlar & Değerlendirme */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>📝 KİTAP NOTLARI & ÖZETİ & DEĞERLENDİRME</label>
            <textarea
              rows={4}
              placeholder="Bu kitap hakkında aklınızda kalanlar, ana fikirler veya kişisel düşünceleriniz..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '2px', resize: 'vertical' }}
            />
          </div>

          {/* Emanet Verildi Bilgisi */}
          <div style={{ borderTop: '1px border var(--border)', paddingTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isLentOut}
                onChange={e => setIsLentOut(e.target.checked)}
              />
              <span>🤝 Bu kitap birine emanet verildi mi?</span>
            </label>

            {isLentOut && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Emanet verilen kişinin adı (Ör. Ahmet Yılmaz)"
                  value={lentToName}
                  onChange={e => setLentToName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                />
              </div>
            )}
          </div>

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn-subtle"
              onClick={onClose}
              style={{ flex: 1, padding: '10px' }}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ flex: 2, padding: '10px', fontWeight: 800 }}
            >
              {saving ? 'Kaydediliyor...' : '💾 Kitap Detaylarını Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
