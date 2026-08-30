'use client';
import { useState, useEffect } from 'react';

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

  const [selectedBookId, setSelectedBookId] = useState(books[0]?.id || '');
  const [pageNumber, setPageNumber] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [reflectionNote, setReflectionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/library/quotes');
      const json = await res.json();
      if (json.success) setQuotes(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuotes();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/library/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: selectedBookId || books[0]?.id,
          page_number: parseInt(pageNumber, 10) || null,
          quote_text: quoteText,
          reflection_note: reflectionNote
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="sheet-handle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>📖 Dijital Alıntı & Çıkarım Defteri</div>
          <button className="btn-subtle" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Vazgeç' : '+ Yeni Alıntı'}
          </button>
        </div>

        {/* Yeni Alıntı Formu */}
        {showAddForm && (
          <form onSubmit={handleAddQuote} style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Kitap:</label>
                <select 
                  value={selectedBookId}
                  onChange={e => setSelectedBookId(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                >
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Sayfa No:</label>
                <input 
                  type="number"
                  placeholder="Örn: 74"
                  value={pageNumber}
                  onChange={e => setPageNumber(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Alıntı Metni:</label>
              <textarea 
                rows={2}
                placeholder="Kitaptan altını çizdiğiniz cümle..."
                required
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Kişisel Çıkarım / Aksiyon Notu:</label>
              <input 
                type="text"
                placeholder="Bu fikri hayatıma nasıl uygularım?"
                value={reflectionNote}
                onChange={e => setReflectionNote(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', marginTop: '2px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ padding: '10px', fontSize: '13px' }}>
              {isSubmitting ? 'Kaydediliyor...' : 'Alıntıyı Deftere Ekle'}
            </button>
          </form>
        )}

        {/* Alıntılar Listesi */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>Yükleniyor...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
            {quotes.map(q => (
              <div 
                key={q.id} 
                style={{ 
                  background: 'var(--surface-subtle)', 
                  borderLeft: '4px solid #6366F1', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: 1.5, color: 'var(--text-main)' }}>
                  "{q.quote_text}"
                </div>

                {q.reflection_note && (
                  <div style={{ fontSize: '12px', color: '#4F46E5', background: '#EEF2FF', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    💡 <strong>Çıkarım:</strong> {q.reflection_note}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '6px', borderTop: '1px dashed var(--border)' }}>
                  <span>📘 {q.book_title} {q.page_number ? `(sf. ${q.page_number})` : ''}</span>
                  <span>✍️ {q.author}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="btn-secondary" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  );
}
