'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, X, Search, Sparkles, BookOpen, Quote as QuoteIcon } from 'lucide-react';

interface Quote {
  id: string;
  book_title: string;
  author: string;
  page_number?: number;
  quote_text: string;
  reflection_note?: string;
  created_at: string;
}

interface QuotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  books: Array<{ id: string; title: string }>;
  onQuoteAdded: () => void;
}

export default function QuotesDrawer({ isOpen, onClose, books, onQuoteAdded }: QuotesDrawerProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedBookId, setSelectedBookId] = useState(books[0]?.id || '');
  const [pageNumber, setPageNumber] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [reflectionNote, setReflectionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/library/quotes');
      const json = await res.json();
      if (json.success) setQuotes(json.data);
    } catch (err) {
      console.error('Alıntıları çekme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuotes();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/library/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: selectedBookId || books[0]?.id,
          page_number: parseInt(pageNumber, 10) || null,
          quote_text: quoteText.trim(),
          reflection_note: reflectionNote.trim() || undefined
        })
      });
      const json = await res.json();
      if (json.success) {
        setQuoteText('');
        setReflectionNote('');
        setPageNumber('');
        setShowAddForm(false);
        fetchQuotes();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onQuoteAdded();
      }
    } catch (err) {
      console.error('Alıntı kaydetme hatası:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuotes = quotes.filter(q => {
    if (!searchQuery.trim()) return true;
    const qTerm = searchQuery.toLowerCase();
    return (
      q.quote_text.toLowerCase().includes(qTerm) ||
      (q.reflection_note && q.reflection_note.toLowerCase().includes(qTerm)) ||
      q.book_title.toLowerCase().includes(qTerm) ||
      q.author.toLowerCase().includes(qTerm)
    );
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (min-width: 768px) {
          .side-drawer-responsive {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 480px !important;
            max-width: 92vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            border-left: 1px solid var(--border) !important;
            box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3) !important;
            animation: slideInFromRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
        }
      `}</style>

      <div
        className="bottom-sheet side-drawer-responsive"
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          background: 'var(--surface)',
          padding: '20px',
          overflowY: 'auto'
        }}
      >
        <div className="sheet-handle sm:hidden" />

        {/* 1. Başlık & Kapat / Yeni Alıntı Butonları */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Bookmark size={16} color="#6366F1" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Alıntı & İkinci Beyin
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Readwise Kalitesinde Dijital Çıkarımlar ({quotes.length})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                height: '30px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: showAddForm ? 'var(--surface-subtle)' : '#6366F1',
                color: showAddForm ? 'var(--text-main)' : '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              {showAddForm ? <X size={12} /> : <Plus size={12} />}
              <span>{showAddForm ? 'Vazgeç' : 'Yeni Alıntı'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '30px',
                height: '30px',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
              title="Kapat"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 2. Yeni Alıntı Ekleme Formu */}
        {showAddForm && (
          <form
            onSubmit={handleAddQuote}
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.04) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Kitap Seçin:</label>
                <select
                  value={selectedBookId}
                  onChange={e => setSelectedBookId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    marginTop: '2px',
                    background: 'var(--surface)',
                    color: 'var(--text-main)',
                    fontWeight: 600
                  }}
                >
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Sayfa No:</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Örn: 74"
                  value={pageNumber}
                  onChange={e => setPageNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    marginTop: '2px',
                    background: 'var(--surface)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Alıntı Metni: *</label>
              <textarea
                rows={3}
                placeholder="Kitaptan altını çizdiğiniz veya aklınıza kazınan cümle..."
                required
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  marginTop: '2px',
                  background: 'var(--surface)',
                  color: 'var(--text-main)',
                  fontStyle: 'italic',
                  lineHeight: '1.4'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Kişisel Çıkarım / Aksiyon Notu:</label>
              <input
                type="text"
                placeholder="Bu fikri projelerime veya hayatıma nasıl uyarlarım?"
                value={reflectionNote}
                onChange={e => setReflectionNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  marginTop: '2px',
                  background: 'var(--surface)',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{
                height: '36px',
                padding: '8px',
                fontSize: '12px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                borderRadius: '6px',
                border: 'none',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              {isSubmitting ? 'Kaydediliyor...' : '✓ Alıntıyı Deftere Ekle'}
            </button>
          </form>
        )}

        {/* 3. Canlı Arama Çubuğu */}
        {quotes.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: '8px'
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Alıntılarda, kitaplarda veya notlarda ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '12px',
                color: 'var(--text-main)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* 4. Alıntılar Listesi (Readwise Kartları) */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Alıntılar yükleniyor...
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              backgroundColor: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border)'
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>📝</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
              {searchQuery ? 'Aramanızla eşleşen alıntı bulunamadı.' : 'Henüz Alıntı Eklenmedi'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Okuduğunuz kitaplardan ilham veren cümleleri ve çıkarımlarınızı kaydedin.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {filteredQuotes.map(q => (
              <div
                key={q.id}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderLeft: '4px solid #6366F1',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'background 0.15s ease'
                }}
              >
                {/* Alıntı Metni (İtalik & Tırnak Vurgusu) */}
                <div style={{ position: 'relative', paddingLeft: '12px' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '-6px',
                      fontSize: '24px',
                      color: 'rgba(99, 102, 241, 0.4)',
                      fontFamily: 'serif',
                      lineHeight: '1'
                    }}
                  >
                    “
                  </span>
                  <p
                    style={{
                      fontSize: '13px',
                      fontStyle: 'italic',
                      lineHeight: '1.5',
                      color: 'var(--text-main)',
                      margin: 0
                    }}
                  >
                    {q.quote_text}
                  </p>
                </div>

                {/* Kişisel Çıkarım / Aksiyon Rozeti */}
                {q.reflection_note && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#4F46E5',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.15)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '5px'
                    }}
                  >
                    <Sparkles size={13} color="#6366F1" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ lineHeight: '1.4' }}>
                      <strong>Çıkarım:</strong> {q.reflection_note}
                    </span>
                  </div>
                )}

                {/* Kitap & Sayfa Alt Künyesi */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    paddingTop: '6px',
                    borderTop: '1px dashed var(--border)',
                    flexWrap: 'wrap',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    📖 {q.book_title} {q.page_number ? `(sf. ${q.page_number})` : ''}
                  </span>
                  <span>✍️ {q.author}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
