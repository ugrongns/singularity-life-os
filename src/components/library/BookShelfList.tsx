'use client';

import React, { useState } from 'react';
import {
  LayoutGrid,
  List,
  Plus,
  Clock,
  Settings,
  Star,
  CheckCircle2,
  Bookmark,
  BookOpen
} from 'lucide-react';
import BookDetailModal from '@/components/modals/BookDetailModal';

export interface Book {
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
    hasSessionData?: boolean;
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

export default function BookShelfList({
  books,
  onQuickPageUpdate,
  onOpenAddBookModal,
  onOpenSessionForBook,
  onToggleLent,
  onUpdate
}: BookShelfProps) {
  const [activeTab, setActiveTab] = useState<'reading' | 'all' | 'completed' | 'wishlist' | 'lent'>('reading');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedBookDetail, setSelectedBookDetail] = useState<Book | null>(null);
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);

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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. ÜST BAŞLIK, GÖRÜNÜM SEÇİCİ & KİTAP EKLE BUTONU */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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
            <BookOpen size={18} color="#6366F1" />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Kitaplığım & Okuma Rafları
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Toplam {books.length} Eser • {completedBooks.length} Tamamlandı
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Görünüm Değiştirici: Izgara (⊞) vs Liste (☰) */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '2px'
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--surface)' : 'transparent',
                border: 'none',
                color: viewMode === 'grid' ? '#6366F1' : 'var(--text-muted)',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: viewMode === 'grid' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Kapak Izgarası (Vitrin)"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Izgara</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--surface)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? '#6366F1' : 'var(--text-muted)',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: viewMode === 'list' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Detaylı Liste"
            >
              <List size={14} />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>

          {/* Yeni Kitap Ekle Butonu */}
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenAddBookModal}
            style={{
              height: '34px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={14} />
            <span>Kitap Ekle / Tara</span>
          </button>
        </div>
      </div>

      {/* 2. RAF FİLTRE SEKME BARİ (YATAY KAYDIRILABİLİR TOUCH-FRIENDLY HAPLAR) */}
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          padding: '4px',
          backgroundColor: 'var(--surface-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {[
          { id: 'reading', label: '📖 Okunuyor', count: readingBooks.length, color: '#6366F1' },
          { id: 'all', label: '📚 Tümü', count: books.length, color: 'var(--text-main)' },
          { id: 'completed', label: '🏆 Tamamlandı', count: completedBooks.length, color: '#10B981' },
          { id: 'wishlist', label: '📌 Okunacak', count: wishlistBooks.length, color: '#F59E0B' },
          { id: 'lent', label: '🤝 Emanet', count: lentBooks.length, color: '#EC4899' }
        ].map(tab => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: '1 0 auto',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: isSelected ? 800 : 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backgroundColor: isSelected ? 'var(--surface)' : 'transparent',
                color: isSelected ? tab.color : 'var(--text-muted)',
                boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface)',
                  color: isSelected ? tab.color : 'var(--text-muted)'
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. KİTAP LİSTESİ VEYA IZGARA GÖRÜNÜMÜ */}
      {(!Array.isArray(currentList) || currentList.length === 0) ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border)'
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📚</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
            Bu Rafta Henüz Kitap Bulunmuyor
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '16px', maxWidth: '360px', margin: '4px auto 16px' }}>
            ISBN barkodunu okutarak veya başlık aramasıyla kütüphanenize yeni eserler ekleyebilirsiniz.
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenAddBookModal}
            style={{
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px'
            }}
          >
            <Plus size={14} />
            <span>Kitap Ekle / Tara</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ------------------ A. IZGARA GÖRÜNÜMÜ (LITERAL.CLUB & APPLE BOOKS VİTRİNİ) ------------------ */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '14px',
            alignItems: 'start'
          }}
        >
          {currentList.map(book => {
            const percent = book.total_pages > 0
              ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
              : 0;
            const isHovered = hoveredBookId === book.id;

            return (
              <div
                key={book.id}
                onMouseEnter={() => setHoveredBookId(book.id)}
                onMouseLeave={() => setHoveredBookId(null)}
                onClick={() => setSelectedBookDetail(book)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'transform 0.2s ease',
                  transform: isHovered ? 'translateY(-3px)' : 'none'
                }}
              >
                {/* Kitap Kapağı Konteyneri (Aspect Ratio 2/3) */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '2/3',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    boxShadow: isHovered
                      ? '0 10px 24px rgba(0, 0, 0, 0.22), 0 3px 8px rgba(0, 0, 0, 0.12)'
                      : '0 4px 10px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease',
                        transform: isHovered ? 'scale(1.04)' : 'none'
                      }}
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    /* Kapaksız Kitaplar için Zarif Tipografik Gradyan */
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 50%, #8B5CF6 100%)',
                        color: '#ffffff',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ fontSize: '20px' }}>📖</div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, lineHeight: '1.25' }}>
                          {book.title}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', marginTop: '4px' }}>
                          {book.author}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* İlerleme Çubuğu (Kapağın en alt kenarında) */}
                  {book.status !== 'wishlist' && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        zIndex: 2
                      }}
                    >
                      <div
                        style={{
                          width: `${percent}%`,
                          height: '100%',
                          backgroundColor: percent === 100 ? '#10B981' : '#6366F1'
                        }}
                      />
                    </div>
                  )}

                  {/* Rozetler (Emanet / Tamamlandı / Format) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      zIndex: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    {book.is_lent_out === 1 ? (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          backgroundColor: 'rgba(245, 158, 11, 0.9)',
                          color: '#000000',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        🤝 Emanet
                      </span>
                    ) : book.status === 'completed' ? (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          backgroundColor: 'rgba(16, 185, 129, 0.9)',
                          color: '#ffffff',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        ✓ Bitti
                      </span>
                    ) : null}
                  </div>

                  {/* Masaüstü Hover Overlay Aksiyonları */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(3px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      opacity: isHovered ? 1 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                      transition: 'opacity 0.2s ease',
                      zIndex: 4
                    }}
                  >
                    {book.status === 'reading' && !book.is_lent_out && (
                      <button
                        type="button"
                        onClick={() => onOpenSessionForBook && onOpenSessionForBook(book.id)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: '#6366F1',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
                        }}
                      >
                        <Clock size={12} />
                        <span>Seans Ekle</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedBookDetail(book)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        color: '#111827',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                      }}
                    >
                      <Settings size={12} />
                      <span>Detay & Not</span>
                    </button>
                  </div>
                </div>

                {/* Kapak Altı Bilgiler */}
                <div>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      margin: 0,
                      color: 'var(--text-main)',
                      lineHeight: '1.25',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                    title={book.title}
                  >
                    {book.title}
                  </h4>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {book.author}
                  </div>

                  {/* İlerleme Yüzdesi ve Sayfa */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginTop: '4px'
                    }}
                  >
                    {book.status === 'wishlist' ? (
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>📌 İstek Listesi</span>
                    ) : (
                      <>
                        <span className="tabular-nums">
                          {book.current_page}/{book.total_pages} sa
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 800, color: percent === 100 ? '#10B981' : '#6366F1' }}>
                          %{percent}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ------------------ B. DETAYLI LİSTE GÖRÜNÜMÜ ------------------ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentList.map(book => {
            const percent = book.total_pages > 0
              ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
              : 0;
            const formatLabel = book.format === 'ebook' ? 'Kindle' : book.format === 'audiobook' ? 'Sesli' : 'Fiziki';

            return (
              <div
                key={book.id}
                onClick={() => setSelectedBookDetail(book)}
                style={{
                  padding: '12px 14px',
                  backgroundColor: book.is_lent_out ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: book.is_lent_out ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        style={{ width: '36px', height: '52px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '52px',
                          borderRadius: '4px',
                          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          flexShrink: 0
                        }}
                      >
                        📖
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.25' }}>
                        {book.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span>{book.author}</span>
                        <span>•</span>
                        <span style={{ backgroundColor: 'var(--surface)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          {formatLabel}
                        </span>
                        {book.shelf_location && (
                          <span style={{ color: 'var(--text-muted)' }}>📍 {book.shelf_location}</span>
                        )}
                        {book.rating && (
                          <span style={{ color: '#F59E0B', fontWeight: 800 }}>★ {book.rating}/5</span>
                        )}
                        {book.stats?.wpm ? (
                          <span style={{ color: '#6366F1', fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                            ⚡ {book.stats.wpm} WPM
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {book.is_lent_out ? (
                      <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                        🤝 Emanet
                      </span>
                    ) : book.status === 'completed' ? (
                      <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                        ✓ Bitti
                      </span>
                    ) : book.status === 'wishlist' ? (
                      <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                        📌 Okunacak
                      </span>
                    ) : (
                      <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 800, color: '#10B981' }}>
                        %{percent}
                      </span>
                    )}
                  </div>
                </div>

                {/* İlerleme Çubuğu */}
                {book.status !== 'wishlist' && (
                  <div style={{ height: '5px', backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: percent === 100 ? '#10B981' : '#6366F1',
                        borderRadius: '999px'
                      }}
                    />
                  </div>
                )}

                {/* Aksiyon Satırı */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }} onClick={e => e.stopPropagation()}>
                  <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {book.current_page} / {book.total_pages} sayfa
                  </span>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {book.status === 'reading' && !book.is_lent_out && (
                      <button
                        type="button"
                        onClick={() => onOpenSessionForBook && onOpenSessionForBook(book.id)}
                        style={{
                          height: '28px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          color: '#6366F1',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Clock size={11} />
                        <span>Seans Ekle</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedBookDetail(book)}
                      style={{
                        height: '28px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Settings size={11} />
                      <span>Detay</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kitap Detay Modalı */}
      {selectedBookDetail && (
        <BookDetailModal
          isOpen={Boolean(selectedBookDetail)}
          book={selectedBookDetail}
          onClose={() => setSelectedBookDetail(null)}
          onOpenSession={(bId) => onOpenSessionForBook && onOpenSessionForBook(bId)}
          onSuccess={(msg) => {
            window.dispatchEvent(new CustomEvent('singularity-refresh'));
            if (onUpdate) onUpdate(msg);
          }}
        />
      )}
    </div>
  );
}
