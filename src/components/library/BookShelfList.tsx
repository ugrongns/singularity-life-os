'use client';
import { useState } from 'react';
import BookDetailModal from '@/components/modals/BookDetailModal';

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
  words_per_page?: number;
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

interface BookShelfProps {
  books: Book[];
  onQuickPageUpdate: (bookId: string, newPage: number) => void;
  onOpenAddBookModal: () => void;
  onOpenSessionForBook?: (bookId: string) => void;
  onToggleLent?: (bookId: string, isLent: boolean) => void;
  onUpdate?: (msg?: string) => void;
}

export default function BookShelfList({ books, onQuickPageUpdate, onOpenAddBookModal, onOpenSessionForBook, onToggleLent, onUpdate }: BookShelfProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'reading' | 'completed' | 'wishlist' | 'lent'>('reading');
  const [selectedBookDetail, setSelectedBookDetail] = useState<Book | null>(null);

  const readingBooks = books.filter(b => b.status === 'reading' && !b.is_lent_out);
  const completedBooks = books.filter(b => b.status === 'completed');
  const wishlistBooks = books.filter(b => b.status === 'wishlist');
  const lentBooks = books.filter(b => b.is_lent_out === 1);

  const currentList = activeTab === 'all'
    ? books
    : activeTab === 'reading' 
    ? readingBooks 
    : activeTab === 'completed' 
    ? completedBooks 
    : activeTab === 'wishlist' 
    ? wishlistBooks 
    : lentBooks;

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>📖</span>
          <span>Kitaplığım & İkinci Beyin</span>
        </div>
      </div>

      <div className="card-action-bar">
        <button className="btn-primary" onClick={onOpenAddBookModal}>
          + 📷 Kitap Tara / Ekle
        </button>
      </div>

      {/* Sekmeler (Tab Pills) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
        <button 
          className={`choice-pill ${activeTab === 'all' ? 'selected' : ''}`}
          onClick={() => setActiveTab('all')}
          style={{ padding: '6px 2px', fontSize: '11px' }}
        >
          Tümü ({books.length})
        </button>
        <button 
          className={`choice-pill ${activeTab === 'reading' ? 'selected' : ''}`}
          onClick={() => setActiveTab('reading')}
          style={{ padding: '6px 2px', fontSize: '11px' }}
        >
          Okunuyor ({readingBooks.length})
        </button>
        <button 
          className={`choice-pill ${activeTab === 'completed' ? 'selected' : ''}`}
          onClick={() => setActiveTab('completed')}
          style={{ padding: '6px 2px', fontSize: '11px' }}
        >
          Tamamlandı ({completedBooks.length})
        </button>
        <button 
          className={`choice-pill ${activeTab === 'wishlist' ? 'selected' : ''}`}
          onClick={() => setActiveTab('wishlist')}
          style={{ padding: '6px 2px', fontSize: '11px' }}
        >
          Okunacak ({wishlistBooks.length})
        </button>
        <button 
          className={`choice-pill ${activeTab === 'lent' ? 'selected' : ''}`}
          onClick={() => setActiveTab('lent')}
          style={{ padding: '6px 2px', fontSize: '11px', color: lentBooks.length > 0 ? '#D97706' : 'inherit' }}
        >
          🤝 Emanet ({lentBooks.length})
        </button>
      </div>

      {/* Kitap Listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
        {(!Array.isArray(currentList) || currentList.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📚</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Kütüphanenizde Henüz Kitap Bulunmuyor</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '14px' }}>
              ISBN barkodunu kamerayla okutarak veya elle girerek ilk kitabınızı ekleyebilir, okuma hızınızı ve kalan sürelerinizi (ETA) takip edebilirsiniz.
            </div>
            <button className="btn-primary" onClick={onOpenAddBookModal} style={{ fontSize: '12px', padding: '8px 16px' }}>
              + 📷 Kitap Tara / Ekle
            </button>
          </div>
        ) : (
          currentList.map(book => {
            const percent = book.total_pages > 0 ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100)) : 0;
            const formatIcon = book.format === 'ebook' ? '📱 Kindle' : book.format === 'audiobook' ? '🎧 Sesli' : '📚 Fiziki';

            return (
              <div 
                key={book.id}
                style={{
                  padding: '12px',
                  background: book.is_lent_out ? '#FFFBEB' : 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: book.is_lent_out ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onClick={() => setSelectedBookDetail(book)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{
                        width: '36px', height: '50px', borderRadius: '4px',
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                        flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}>
                        📖
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{book.title}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span>{book.author}</span>
                        <span>•</span>
                        <span style={{ background: 'var(--surface-subtle)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border)' }}>
                          {formatIcon}
                        </span>
                        {book.format === 'physical' && book.shelf_location && (
                          <span style={{ color: 'var(--text-muted)' }}>📍 {book.shelf_location}</span>
                        )}
                        {book.rating && (
                          <span style={{ color: 'var(--amber)', fontWeight: 800 }}>⭐ {book.rating}/5</span>
                        )}
                        {book.stats?.wpm && (
                          <span style={{ color: 'var(--indigo)', fontWeight: 700, background: 'var(--indigo-bg)', padding: '1px 5px', borderRadius: '3px' }}>
                            ⚡ {book.stats.wpm} WPM
                          </span>
                        )}
                      </div>

                      {/* Satın alım bilgisi etiketi */}
                      {(book.purchased_from || book.purchase_price) && (
                        <div style={{ fontSize: '10px', color: 'var(--emerald)', marginTop: '2px', fontWeight: 600 }}>
                          🛒 {book.purchased_from ? book.purchased_from : ''} {book.purchase_price ? `(${book.purchase_price} ₺)` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {book.is_lent_out ? (
                    <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      🤝 Emanet
                    </span>
                  ) : book.status === 'completed' ? (
                    <span style={{ fontSize: '11px', background: 'var(--emerald-bg)', color: 'var(--emerald)', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      🏆 Tamamlandı
                    </span>
                  ) : book.status === 'wishlist' ? (
                    <span style={{ fontSize: '11px', background: 'var(--indigo-bg)', color: 'var(--indigo)', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      📌 Okunacak
                    </span>
                  ) : (
                    <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--emerald)' }}>
                      %{percent}
                    </span>
                  )}
                </div>

                {/* Not Özeti Snippet */}
                {book.notes && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    📝 "{book.notes}"
                  </div>
                )}

                {/* Emanet Bilgisi */}
                {book.is_lent_out === 1 && (
                  <div style={{ fontSize: '11px', color: 'var(--amber)', background: 'var(--amber-bg)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--amber)' }}>
                    🤝 <strong>{book.lent_to_name}</strong> adlı kişiye verildi ({book.lent_date})
                  </div>
                )}

                {/* İlerleme Çubuğu */}
                {book.status !== 'wishlist' && (
                  <div className="budget-bar-track" style={{ height: '6px' }}>
                    <div className="budget-bar-fill" style={{ width: `${percent}%`, backgroundColor: percent === 100 ? '#10B981' : '#3B82F6' }} />
                  </div>
                )}

                {/* Hızlı Sayfa Güncelleme / Eylemler */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }} onClick={e => e.stopPropagation()}>
                  <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {book.current_page} / {book.total_pages} sayfa
                  </span>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {book.status === 'reading' && !book.is_lent_out && (
                      <button 
                        className="btn-subtle" 
                        style={{ fontSize: '11px', padding: '3px 9px', background: 'var(--indigo-bg)', color: 'var(--indigo)', border: '1px solid var(--indigo)', borderRadius: '4px', fontWeight: 700 }}
                        onClick={() => onOpenSessionForBook && onOpenSessionForBook(book.id)}
                      >
                        ⏱️ Seans Kaydet
                      </button>
                    )}

                    <button
                      className="btn-subtle"
                      style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: 700 }}
                      onClick={() => setSelectedBookDetail(book)}
                    >
                      ⚙️ Detay & Notlar
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Kitap Detay Modalı */}
      {selectedBookDetail && (
        <BookDetailModal
          isOpen={Boolean(selectedBookDetail)}
          book={selectedBookDetail}
          onClose={() => setSelectedBookDetail(null)}
          onSuccess={(msg) => {
            setSelectedBookDetail(null);
            window.dispatchEvent(new CustomEvent('singularity-refresh'));
            if (onUpdate) onUpdate(msg);
          }}
        />
      )}
    </div>
  );
}
