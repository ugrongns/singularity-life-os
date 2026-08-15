'use client';
import { useState, useEffect } from 'react';
import SharedLayout from '@/components/layout/SharedLayout';
import LibraryHeroCard from '@/components/library/LibraryHeroCard';
import BookShelfList from '@/components/library/BookShelfList';
import QuotesDrawer from '@/components/library/QuotesDrawer';
import ReadingSessionModal from '@/components/modals/ReadingSessionModal';
import AddBookModal from '@/components/modals/AddBookModal';

import BookDetailModal from '@/components/modals/BookDetailModal';

export default function LibraryPage() {
  const [data, setData] = useState<any>(null);
  const [notifData, setNotifData] = useState<any>({ notifications: [], critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [sessionBookId, setSessionBookId] = useState<string | undefined>(undefined);
  const [isQuotesOpen, setIsQuotesOpen] = useState(false);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [selectedBookDetail, setSelectedBookDetail] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  const fetchData = async () => {
    const [libRes, notifRes] = await Promise.all([fetch('/api/library'), fetch('/api/notifications')]);
    const [libJ, notifJ] = await Promise.all([libRes.json(), notifRes.json()]);
    if (libJ.success) setData(libJ.data);
    if (notifJ.success) setNotifData(notifJ.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  const handleUpdate = (msg?: string) => { fetchData(); if (msg) showToast(msg); };

  const handleQuickPageUpdate = async (bookId: string, newPage: number) => {
    const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book_id: bookId, current_page: newPage }) });
    const j = await res.json();
    if (j.success) handleUpdate(j.message);
  };

  const handleOpenSessionForBook = (bId?: string) => {
    setSessionBookId(bId);
    setIsSessionOpen(true);
  };

  if (loading) return <SharedLayout notifications={notifData}><div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Yükleniyor...</div></SharedLayout>;

  return (
    <SharedLayout notifications={notifData}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', zIndex: 999 }}>
          {toastMsg}
        </div>
      )}

      <div style={{ padding: '0 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📚 Kütüphane</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Kitaplık, okuma hızı, alıntı ve ikinci beyin</p>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {data && (
            <LibraryHeroCard
              profile={data.profile}
              activeBook={data.activeReadingBook}
              onOpenSession={() => handleOpenSessionForBook(data.activeReadingBook?.id)}
              onOpenQuotes={() => setIsQuotesOpen(true)}
              onOpenBookDetail={(b) => setSelectedBookDetail(b)}
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {data && (
            <BookShelfList
              books={data.books}
              onQuickPageUpdate={handleQuickPageUpdate}
              onOpenAddBookModal={() => setIsAddBookOpen(true)}
              onOpenSessionForBook={(bId) => handleOpenSessionForBook(bId)}
              onUpdate={handleUpdate}
            />
          )}
        </div>
      </div>

      <AddBookModal isOpen={isAddBookOpen} onClose={() => setIsAddBookOpen(false)} onSuccess={(msg) => handleUpdate(msg)} />
      <ReadingSessionModal
        isOpen={isSessionOpen}
        onClose={() => {
          setIsSessionOpen(false);
          setSessionBookId(undefined);
        }}
        books={data?.books || []}
        preselectedBookId={sessionBookId}
        onSuccess={(msg) => handleUpdate(msg)}
      />
      <QuotesDrawer isOpen={isQuotesOpen} onClose={() => setIsQuotesOpen(false)} books={data?.books || []} onQuoteAdded={() => handleUpdate('📖 Alıntı eklendi!')} />
      
      {selectedBookDetail && (
        <BookDetailModal
          isOpen={Boolean(selectedBookDetail)}
          book={selectedBookDetail}
          onClose={() => setSelectedBookDetail(null)}
          onOpenSession={(bId) => handleOpenSessionForBook(bId)}
          onSuccess={(msg) => {
            setSelectedBookDetail(null);
            handleUpdate(msg);
          }}
        />
      )}
    </SharedLayout>
  );
}
