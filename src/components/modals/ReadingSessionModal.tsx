'use client';
import { useState, useEffect } from 'react';

interface Book {
  id: string;
  title: string;
  current_page: number;
  total_pages: number;
  words_per_page?: number;
}

interface ReadingSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  preselectedBookId?: string;
  onSuccess: (msg: string) => void;
}

export default function ReadingSessionModal({
  isOpen,
  onClose,
  books,
  preselectedBookId,
  onSuccess
}: ReadingSessionModalProps) {
  const [selectedBookId, setSelectedBookId] = useState(preselectedBookId || books[0]?.id || '');
  const activeBook = books.find(b => b.id === selectedBookId) || books[0];

  const [inputMode, setInputMode] = useState<'count' | 'range'>('count');
  const [pagesReadInput, setPagesReadInput] = useState('15');
  const [startPage, setStartPage] = useState(String(activeBook?.current_page || 0));
  const [endPage, setEndPage] = useState(String((activeBook?.current_page || 0) + 15));
  const [durationMinutes, setDurationMinutes] = useState('25');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (preselectedBookId) {
      setSelectedBookId(preselectedBookId);
    }
  }, [preselectedBookId]);

  useEffect(() => {
    if (activeBook) {
      setStartPage(String(activeBook.current_page));
      const pCount = parseInt(pagesReadInput) || 15;
      setEndPage(String(Math.min(activeBook.total_pages, activeBook.current_page + pCount)));
    }
  }, [selectedBookId]);

  if (!isOpen) return null;

  const handleBookChange = (bId: string) => {
    setSelectedBookId(bId);
    const b = books.find(item => item.id === bId);
    if (b) {
      setStartPage(String(b.current_page));
      const pCount = parseInt(pagesReadInput) || 15;
      setEndPage(String(Math.min(b.total_pages, b.current_page + pCount)));
    }
  };

  const handlePagesReadInput = (val: string) => {
    setPagesReadInput(val);
    const count = parseInt(val) || 0;
    const sPage = parseInt(startPage) || 0;
    const maxP = activeBook?.total_pages || 9999;
    setEndPage(String(Math.min(maxP, sPage + count)));
  };

  const handleStartPageInput = (val: string) => {
    setStartPage(val);
    const sPage = parseInt(val) || 0;
    if (inputMode === 'count') {
      const count = parseInt(pagesReadInput) || 0;
      const maxP = activeBook?.total_pages || 9999;
      setEndPage(String(Math.min(maxP, sPage + count)));
    }
  };

  const handleEndPageInput = (val: string) => {
    setEndPage(val);
    const ePage = parseInt(val) || 0;
    const sPage = parseInt(startPage) || 0;
    if (ePage >= sPage) {
      setPagesReadInput(String(ePage - sPage));
    }
  };

  const pagesRead = inputMode === 'count'
    ? Math.max(1, parseInt(pagesReadInput) || 1)
    : Math.max(1, (parseInt(endPage) || 0) - (parseInt(startPage) || 0));

  const durMin = Math.max(0.1, parseFloat(durationMinutes) || 1);
  const wordsPerPage = activeBook?.words_per_page || 250;
  const estimatedWpm = Math.round((pagesRead * wordsPerPage) / durMin);
  const minutesPerPage = (durMin / pagesRead).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const computedStart = parseInt(startPage, 10) || 0;
      const computedEnd = inputMode === 'count'
        ? computedStart + pagesRead
        : parseInt(endPage, 10) || (computedStart + pagesRead);

      const res = await fetch('/api/library/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: selectedBookId || activeBook?.id,
          start_page: computedStart,
          end_page: computedEnd,
          duration_minutes: durMin
        })
      });
      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        onSuccess(json.message);
        onClose();
      } else {
        alert(json.error || 'Seans kaydedilemedi.');
      }
    } catch (err) {
      alert('İşlem başarısız.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle"></div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            ⏱️ Okuma Seansı Kaydet
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Kitap Seçici */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KİTAP SEÇİN *</label>
            <select 
              value={selectedBookId}
              onChange={e => handleBookChange(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '13px', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
            >
              {books.map(b => (
                <option key={b.id} value={b.id}>
                  {b.title} (Sayfa {b.current_page}/{b.total_pages})
                </option>
              ))}
            </select>
          </div>

          {/* Giriş Modu Seçimi: Okunan Sayfa Sayısı vs Sayfa Aralığı */}
          <div style={{ background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`choice-pill ${inputMode === 'count' ? 'selected' : ''}`}
              onClick={() => setInputMode('count')}
              style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700 }}
            >
              📄 Kaç Sayfa Okudum?
            </button>
            <button
              type="button"
              className={`choice-pill ${inputMode === 'range' ? 'selected' : ''}`}
              onClick={() => setInputMode('range')}
              style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700 }}
            >
              📑 Sayfa Numaraları (Aralık)
            </button>
          </div>

          {/* Mod A: Doğrudan Sayfa Sayısı Girişi */}
          {inputMode === 'count' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>OKUNAN SAYFA SAYISI *</label>
                <input 
                  type="number"
                  min="1"
                  placeholder="Ör. 18"
                  value={pagesReadInput}
                  onChange={e => handlePagesReadInput(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '16px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>

              {/* Hızlı Sayfa Paketleri */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[5, 10, 15, 20, 30, 45, 60].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePagesReadInput(String(p))}
                    style={{
                      padding: '5px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px',
                      border: pagesReadInput === String(p) ? '1px solid var(--indigo)' : '1px solid var(--border)',
                      background: pagesReadInput === String(p) ? 'var(--indigo-bg)' : 'var(--surface-subtle)',
                      color: pagesReadInput === String(p) ? 'var(--indigo)' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    +{p} Sayfa
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                📍 Kaldığınız sayfa ({startPage}) üzerine <strong>+{pagesRead} sayfa</strong> eklenerek sayfanız <strong>{parseInt(startPage) + pagesRead}</strong> yapılacaktır.
              </div>
            </div>
          ) : (
            /* Mod B: Sayfa Aralığı Girişi (Başlangıç -> Bitiş) */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BAŞLANGIÇ SAYFASI *</label>
                <input 
                  type="number"
                  value={startPage}
                  onChange={e => handleStartPageInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BİTİŞ SAYFASI *</label>
                <input 
                  type="number"
                  value={endPage}
                  onChange={e => handleEndPageInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '14px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
                />
              </div>
            </div>
          )}

          {/* Harcanan Süre (Dakika) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>HARCANAN SÜRE (DAKİKA) *</label>
              <input 
                type="number"
                step="0.5"
                min="0.5"
                placeholder="Ör. 25"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '16px', fontWeight: 800, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)' }}
              />
            </div>

            {/* Hızlı Dakika Paketleri */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[10, 15, 20, 25, 30, 45, 60].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMinutes(String(m))}
                  style={{
                    padding: '5px 10px', fontSize: '11px', fontWeight: 800, borderRadius: '6px',
                    border: durationMinutes === String(m) ? '1px solid var(--indigo)' : '1px solid var(--border)',
                    background: durationMinutes === String(m) ? 'var(--indigo-bg)' : 'var(--surface-subtle)',
                    color: durationMinutes === String(m) ? 'var(--indigo)' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  ⏱️ {m} Dk
                </button>
              ))}
            </div>
          </div>

          {/* Anlık Seans Hızı & Süre İstatistiği Önizlemesi */}
          <div style={{ background: 'var(--indigo-bg)', border: '1px solid var(--indigo)', padding: '12px 14px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--indigo)', fontWeight: 800 }}>BU SEANS HESAPLANAN PERFORMANS</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                📖 {pagesRead} Sayfa • ⏱️ {durMin} Dk
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--indigo)' }}>⚡ ~{estimatedWpm} WPM</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>({minutesPerPage} dk / sayfa)</div>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ padding: '12px', fontSize: '14px', fontWeight: 800 }}>
            {isSubmitting ? 'Seans Kaydediliyor...' : '✅ Seansı Kaydet & Sayfayı İlerlet'}
          </button>
        </form>
      </div>
    </div>
  );
}
