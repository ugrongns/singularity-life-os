'use client';

import React, { useState, useEffect } from 'react';
import PageCalibrationModal from '@/components/modals/PageCalibrationModal';
import { Clock, BookOpen, Camera, Zap, Check, X } from 'lucide-react';

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
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [overrideWordsPerPage, setOverrideWordsPerPage] = useState<Record<string, number>>({});

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
  const wordsPerPage = overrideWordsPerPage[selectedBookId || activeBook?.id || ''] || activeBook?.words_per_page || 250;
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
    } catch {
      alert('İşlem başarısız.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="bottom-sheet" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
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
                justifyContent: 'center'
              }}
            >
              <Clock size={16} color="#6366F1" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Okuma Seansı Kaydet
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Okunan sayfayı güncelleyin ve WPM hızınızı kalibre edin
              </div>
            </div>
          </div>

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
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Kitap Seçici */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>KİTAP SEÇİN *</label>
            <select 
              value={selectedBookId}
              onChange={e => handleBookChange(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 700,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginTop: '4px',
                background: 'var(--surface-subtle)',
                color: 'var(--text-main)'
              }}
            >
              {books.map(b => (
                <option key={b.id} value={b.id}>
                  {b.title} (Sayfa {b.current_page}/{b.total_pages})
                </option>
              ))}
            </select>
          </div>

          {/* Giriş Modu Seçimi: Okunan Sayfa Sayısı vs Sayfa Aralığı */}
          <div style={{ background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '4px', border: '1px solid var(--border)' }}>
            <button
              type="button"
              className={`choice-pill ${inputMode === 'count' ? 'selected' : ''}`}
              onClick={() => setInputMode('count')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: inputMode === 'count' ? 'var(--surface)' : 'transparent',
                color: inputMode === 'count' ? '#6366F1' : 'var(--text-muted)',
                boxShadow: inputMode === 'count' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📄 Kaç Sayfa Okudum?
            </button>
            <button
              type="button"
              className={`choice-pill ${inputMode === 'range' ? 'selected' : ''}`}
              onClick={() => setInputMode('range')}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: inputMode === 'range' ? 'var(--surface)' : 'transparent',
                color: inputMode === 'range' ? '#6366F1' : 'var(--text-muted)',
                boxShadow: inputMode === 'range' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}
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
                  inputMode="numeric"
                  min="1"
                  placeholder="Ör. 18"
                  value={pagesReadInput}
                  onChange={e => handlePagesReadInput(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    fontSize: '18px',
                    fontWeight: 900,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    background: 'var(--surface-subtle)',
                    color: '#6366F1'
                  }}
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
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: pagesReadInput === String(p) ? '1px solid #6366F1' : '1px solid var(--border)',
                      background: pagesReadInput === String(p) ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-subtle)',
                      color: pagesReadInput === String(p) ? '#6366F1' : 'var(--text-main)',
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
                  inputMode="numeric"
                  value={startPage}
                  onChange={e => handleStartPageInput(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>BİTİŞ SAYFASI *</label>
                <input 
                  type="number"
                  inputMode="numeric"
                  value={endPage}
                  onChange={e => handleEndPageInput(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    fontSize: '15px',
                    fontWeight: 800,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    background: 'var(--surface-subtle)',
                    color: '#6366F1'
                  }}
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
                inputMode="decimal"
                step="0.5"
                min="0.5"
                placeholder="Ör. 25"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  fontSize: '16px',
                  fontWeight: 800,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: '4px',
                  background: 'var(--surface-subtle)',
                  color: 'var(--text-main)'
                }}
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
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: durationMinutes === String(m) ? '1px solid #6366F1' : '1px solid var(--border)',
                    background: durationMinutes === String(m) ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-subtle)',
                    color: durationMinutes === String(m) ? '#6366F1' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  ⏱️ {m} Dk
                </button>
              ))}
            </div>
          </div>

          {/* Anlık Seans Hızı & Süre İstatistiği Önizlemesi */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '10px', color: '#6366F1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                BU SEANS HESAPLANAN PERFORMANS
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                📖 {pagesRead} Sayfa • ⏱️ {durMin} Dk
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 900, color: '#6366F1' }}>
                ⚡ ~{estimatedWpm} WPM
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                ({minutesPerPage} dk / sayfa)
              </div>
            </div>
          </div>

          {/* Sayfa Yoğunluğu & Kalibre Et Butonu */}
          <div
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px'
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Sayfa Yoğunluğu: <strong style={{ color: 'var(--text-main)' }}>{wordsPerPage} kelime/sayfa</strong>
            </div>
            <button
              type="button"
              onClick={() => setIsCalibrationOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6366F1',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 4px'
              }}
            >
              <Camera size={13} color="#6366F1" />
              <span>Sayfayı Tara & Kalibre Et</span>
            </button>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
            style={{
              height: '42px',
              padding: '10px',
              fontSize: '13px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              border: 'none',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            {isSubmitting ? 'Seans Kaydediliyor...' : '✓ Seansı Kaydet & Sayfayı İlerlet'}
          </button>
        </form>
      </div>

      {isCalibrationOpen && activeBook && (
        <PageCalibrationModal
          isOpen={isCalibrationOpen}
          onClose={() => setIsCalibrationOpen(false)}
          bookId={selectedBookId || activeBook.id}
          bookTitle={activeBook.title}
          currentWordsPerPage={wordsPerPage}
          onCalibrated={(newCount) => {
            const bId = selectedBookId || activeBook.id;
            setOverrideWordsPerPage(prev => ({ ...prev, [bId]: newCount }));
            if (activeBook) activeBook.words_per_page = newCount;
          }}
          onSuccess={(msg) => {
            onSuccess(msg);
          }}
        />
      )}
    </div>
  );
}
