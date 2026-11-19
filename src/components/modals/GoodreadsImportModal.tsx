'use client';

import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { normalizeTurkishSearch } from '@/lib/date-utils';

interface ExistingBook {
  id: string;
  title: string;
  isbn?: string | null;
}

interface ParsedGoodreadsBook {
  title: string;
  author: string;
  isbn: string;
  total_pages: number;
  status: 'reading' | 'completed' | 'wishlist';
  rating: number;
  isDuplicate: boolean;
  selected: boolean;
}

interface GoodreadsImportModalProps {
  isOpen: boolean;
  existingBooks: ExistingBook[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanGoodreadsIsbn(raw: string): string {
  return raw.replace(/^="?/, '').replace(/"?$/, '').replace(/[^0-9X]/gi, '').trim();
}

export default function GoodreadsImportModal({
  isOpen,
  existingBooks,
  onClose,
  onSuccess
}: GoodreadsImportModalProps) {
  const [parsedBooks, setParsedBooks] = useState<ParsedGoodreadsBook[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const existingTitleSet = new Set(existingBooks.map(b => normalizeTurkishSearch(b.title)));
  const existingIsbnSet = new Set(
    existingBooks
      .map(b => (b.isbn || '').replace(/[^0-9X]/gi, '').trim())
      .filter(s => s.length >= 9)
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setErrorMsg('CSV dosyası boş veya geçersiz.');
        return;
      }

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const titleIdx = headers.indexOf('title');
      const authorIdx = headers.indexOf('author');
      const isbn13Idx = headers.indexOf('isbn13');
      const isbnIdx = headers.indexOf('isbn');
      const pagesIdx = headers.indexOf('number of pages');
      const shelfIdx = headers.indexOf('exclusive shelf');
      const ratingIdx = headers.indexOf('my rating');

      if (titleIdx === -1) {
        setErrorMsg('Goodreads CSV formatı tanınamadı ("Title" sütunu bulunamadı).');
        return;
      }

      const list: ParsedGoodreadsBook[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const title = (cols[titleIdx] || '').trim();
        if (!title) continue;

        const author = (authorIdx >= 0 ? cols[authorIdx] : '') || 'Bilinmeyen Yazar';
        const rawIsbn = (isbn13Idx >= 0 ? cols[isbn13Idx] : '') || (isbnIdx >= 0 ? cols[isbnIdx] : '');
        const isbn = cleanGoodreadsIsbn(rawIsbn);
        const pages = Math.max(50, parseInt(pagesIdx >= 0 ? cols[pagesIdx] : '200', 10) || 200);
        const shelf = (shelfIdx >= 0 ? cols[shelfIdx] : 'to-read').toLowerCase();
        const status: 'reading' | 'completed' | 'wishlist' =
          shelf === 'read' ? 'completed' : shelf === 'currently-reading' ? 'reading' : 'wishlist';
        const ratingRaw = parseInt(ratingIdx >= 0 ? cols[ratingIdx] : '5', 10);
        const rating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : 5;

        const isDuplicate =
          existingTitleSet.has(normalizeTurkishSearch(title)) ||
          (isbn.length >= 9 && existingIsbnSet.has(isbn));

        list.push({
          title,
          author,
          isbn,
          total_pages: pages,
          status,
          rating,
          isDuplicate,
          selected: !isDuplicate
        });
      }

      if (list.length === 0) {
        setErrorMsg('CSV içinde aktarılacak kitap satırı bulunamadı.');
        return;
      }
      setParsedBooks(list);
    } catch {
      setErrorMsg('CSV dosyası okunurken bir hata oluştu.');
    }
  };

  const selectedCount = parsedBooks.filter(b => b.selected).length;

  const handleImport = async () => {
    const toImport = parsedBooks.filter(b => b.selected);
    if (toImport.length === 0 || importing) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_goodreads_batch',
          books: toImport.map(b => ({
            title: b.title,
            author: b.author,
            isbn: b.isbn || null,
            total_pages: b.total_pages,
            status: b.status,
            rating: b.rating
          }))
        })
      });
      const json = await res.json();
      if (json.success) {
        setParsedBooks([]);
        onSuccess(json.message);
        onClose();
      } else {
        setErrorMsg(json.error || 'İçe aktarma başarısız.');
      }
    } catch {
      setErrorMsg('Sunucuyla iletişim kurulurken hata oluştu.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '86dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>📥 Goodreads CSV İçe Aktarma</h3>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              goodreads_library_export.csv dosyanızı seçin; mükerrer kitaplar otomatik filtrelenir
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '12px',
              padding: '18px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--surface-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Upload size={22} style={{ color: '#6366F1' }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
              Goodreads CSV Dosyası Seçin
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Doğrudan veritabanına yazılmaz; önce önizleme ve onay tablosu açılır
            </span>
            <input type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>

          {errorMsg && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', color: 'var(--rose)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedBooks.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700 }}>
                <span>Toplam {parsedBooks.length} kitap ayrıştırıldı ({selectedCount} seçili)</span>
                <button
                  type="button"
                  onClick={() => setParsedBooks(prev => prev.map(b => ({ ...b, selected: !b.isDuplicate })))}
                  style={{ background: 'none', border: 'none', color: '#6366F1', fontWeight: 800, cursor: 'pointer', fontSize: '11px' }}
                >
                  Yalnızca Yenileri Seç
                </button>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Seç</th>
                      <th style={{ padding: '8px' }}>Kitap & Yazar</th>
                      <th style={{ padding: '8px' }}>Durum</th>
                      <th style={{ padding: '8px' }}>Kontrol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBooks.map((b, idx) => (
                      <tr key={`${b.title}-${idx}`} style={{ borderTop: '1px solid var(--border)', opacity: b.isDuplicate ? 0.65 : 1 }}>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="checkbox"
                            checked={b.selected}
                            onChange={() =>
                              setParsedBooks(prev => prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item)))
                            }
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 700 }}>{b.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.author} • {b.total_pages} sf</div>
                        </td>
                        <td style={{ padding: '8px', fontSize: '11px', fontWeight: 700 }}>
                          {b.status === 'completed' ? '✅ Okundu' : b.status === 'reading' ? '📖 Okunuyor' : '🔖 İstek'}
                        </td>
                        <td style={{ padding: '8px', fontSize: '11px', fontWeight: 700 }}>
                          {b.isDuplicate ? (
                            <span style={{ color: '#F59E0B' }}>Zaten Var</span>
                          ) : (
                            <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={12} /> Yeni
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} className="btn-subtle" style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}>
            İptal
          </button>
          <button
            type="button"
            disabled={selectedCount === 0 || importing}
            onClick={handleImport}
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: '12px', fontWeight: 800 }}
          >
            {importing ? 'Aktarılıyor...' : `${selectedCount} Kitabı Kütüphaneye Aktar`}
          </button>
        </div>
      </div>
    </div>
  );
}
