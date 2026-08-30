'use client';
import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationHub from './NotificationHub';
import ReceiptScanModal from '@/components/modals/ReceiptScanModal';
import BarcodeScanModal from '@/components/modals/BarcodeScanModal';
import PlateScanModal from '@/components/modals/PlateScanModal';
import ManualExpenseModal from '@/components/modals/ManualExpenseModal';
import VoiceCommandModal from '@/components/modals/VoiceCommandModal';
import FeatureShowcaseModal from '@/components/modals/FeatureShowcaseModal';
import PwaManager from './PwaManager';
import OnboardingModal from '@/components/auth/OnboardingModal';
import LockScreenModal from '@/components/auth/LockScreenModal';
import LandingPage from '@/components/landing/LandingPage';

interface SharedLayoutProps {
  children: ReactNode;
  notifications?: { notifications: any[]; critical: number; warning: number };
}

export default function SharedLayout({ children, notifications }: SharedLayoutProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'receipt' | 'barcode' | 'plate' | 'manual' | 'voice' | 'showcase' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Auth & Lock State
  const [authSession, setAuthSession] = useState<{
    isInitialized: boolean;
    isAuthenticated: boolean;
    user: any;
    loading: boolean;
  }>({
    isInitialized: true,
    isAuthenticated: true,
    user: null,
    loading: true
  });

  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Hızlı işlem modalları için hesap + kategori verisi (lazy yüklenir)
  const [quickData, setQuickData] = useState<{ accounts: any[]; categories: any[] }>({ accounts: [], categories: [] });
  const [quickDataLoaded, setQuickDataLoaded] = useState(false);

  const loadQuickData = async () => {
    if (quickDataLoaded) return;
    try {
      // Composite API zaten bütçe bilgisini içeriyor; sadece accounts ve categories için budget endpoint'ini çağır
      const res = await fetch('/api/budget');
      const json = await res.json();
      if (json.success && json.data) {
        setQuickData({
          accounts: json.data.accounts || [],
          categories: json.data.categories || [],
        });
        setQuickDataLoaded(true);
      }
    } catch {
      // sessizce geç — modal boş gösterecek
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const json = await res.json();
      if (json.success && json.data) {
        setAuthSession({
          isInitialized: json.data.is_initialized,
          isAuthenticated: json.data.is_authenticated,
          user: json.data.user,
          loading: false
        });
      }
    } catch (e) {
      setAuthSession(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    setMounted(true);
    checkSession();
    // Tema tercihini yükle
    const savedTheme = (localStorage.getItem('singularity_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('singularity_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleLock = () => {
    setIsScreenLocked(true);
    showToast('🔒 Ekran kilitlendi. Açmak için PIN kodunuzu girin.');
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const sidebarPages = [
    { href: '/',          icon: '🏠', label: 'Ana Sayfa' },
    { href: '/budget',    icon: '💰', label: 'Finans & Bütçe' },
    { href: '/vehicles',  icon: '🚗', label: 'Araç & Ev' },
    { href: '/library',   icon: '📚', label: 'Kütüphane' },
    { href: '/health',    icon: '🧬', label: 'Sağlık & Beslenme' },
    { href: '/wellness',  icon: '💊', label: 'Wellness & Rutin' },
    { href: '/shopping',  icon: '🛒', label: 'Market Listesi' },
    { href: '/vault',     icon: '🗂️', label: 'Dijital Kasa' },
    { href: '/analytics', icon: '📊', label: 'Yaşam Skoru' },
  ];

  const navItems = [
    { href: '/',        icon: '🏠', label: 'Ana' },
    { href: '/budget',  icon: '💰', label: 'Finans' },
  ];

  const rightItems = [
    { href: '/health',   icon: '🧬', label: 'Sağlık' },
    { href: '/settings', icon: '⚙️', label: 'Ayarlar' },
  ];

  if (!mounted || authSession.loading) {
    return null;
  }

  // Oturum açılmamışsa veya ilk kurulumsa Tanıtım, Giriş Yap & Kaydol Sayfası (LandingPage) gösterilir
  if (!authSession.isAuthenticated || !authSession.isInitialized) {
    return <LandingPage />;
  }

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="sidebar-nav">
        <div className="sidebar-brand" onClick={() => setActiveModal('showcase')} title="Singularity Özellik Vitrini">
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)', border: '1px solid var(--border)', flexShrink: 0 }}>
            <img src="/icon.svg" alt="Singularity" style={{ width: '28px', height: '28px' }} />
          </div>
          <div>
            <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Singularity OS</span>
              <span style={{ fontSize: '10px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                v2.1
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Life Management</div>
          </div>
        </div>

        {/* Hızlı Ekle / Tara Butonu */}
        <button
          className="sidebar-quick-btn"
          onClick={() => {
            loadQuickData();
            setIsQuickMenuOpen(!isQuickMenuOpen);
          }}
        >
          <span>＋</span>
          <span>Hızlı İşlem / Tara</span>
        </button>

        {/* Modül Linkleri */}
        <div className="sidebar-menu-list">
          {sidebarPages.map(page => {
            const isActive = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
              >
                <span style={{ fontSize: '18px' }}>{page.icon}</span>
                <span>{page.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Sidebar Alt Butonlar */}
        <div className="sidebar-footer">
          <Link
            href="/settings"
            className={`sidebar-item ${pathname === '/settings' ? 'active' : ''}`}
          >
            <span style={{ fontSize: '18px' }}>⚙️</span>
            <span>Ayarlar & Yedekleme</span>
          </Link>
          <button
            className="sidebar-item"
            onClick={handleLock}
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '18px' }}>🔒</span>
            <span>Ekranı Kilitle</span>
          </button>
        </div>
      </aside>

      <div className="app-container">
        {/* Toast Notification */}
        {toastMsg && (
          <div className="toast-glass">
            {toastMsg}
          </div>
        )}

        {/* Header */}
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileDrawerOpen(true)}
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                color: 'var(--text-main)'
              }}
              title="Tüm Menüyü Aç"
            >
              ☰
            </button>
            <div
              className="brand-badge"
              onClick={() => setActiveModal('showcase')}
              style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
              title="Singularity Özellik Vitrini"
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)', border: '1px solid var(--border)', flexShrink: 0 }}>
                <img src="/icon.svg" alt="Singularity" style={{ width: '28px', height: '28px' }} />
              </div>
              <div>
                <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Singularity Life OS</span>
                  <span style={{ fontSize: '10px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                    v2.1
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kişisel & Aile Yönetim Merkezi</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 🌙 / ☀️ Dark/Light Tema Butonu */}
            <button
              onClick={toggleTheme}
              style={{
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: '50%', width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '16px', transition: 'all 0.15s'
              }}
              title={theme === 'dark' ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Hızlı Sesli Komut Butonu */}
            <button
              onClick={() => setActiveModal('voice')}
              style={{
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: '50%', width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '17px', transition: 'all 0.15s'
              }}
              title="Sesli Çoklu Komut"
            >
              🎙️
            </button>
            {notifications && (
              <NotificationHub
                notifications={notifications.notifications}
                critical={notifications.critical}
                warning={notifications.warning}
              />
            )}
            {/* Kilit Butonu */}
            <button
              onClick={handleLock}
              style={{
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: '50%', width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '15px'
              }}
              title="Ekranı Kilitle"
            >
              🔒
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, paddingBottom: '40px' }}>
          {children}
        </main>

        {/* Quick Action Drawer / Menu */}
        {isQuickMenuOpen && (
          <div
            onClick={() => setIsQuickMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              paddingBottom: '80px', backdropFilter: 'blur(4px)'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '16px', width: '90%', maxWidth: '380px',
                boxShadow: 'var(--shadow-xl)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'
              }}
            >
              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('voice'); }}
                className="btn-subtle"
                style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, gridColumn: 'span 2', background: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' }}
              >
                <span style={{ fontSize: '26px' }}>🎙️</span>
                <span>Sesli Çoklu Komut Girişi</span>
              </button>
              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('receipt'); }}
                className="btn-subtle"
                style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                <span style={{ fontSize: '24px' }}>🧾</span>
                <span>Fiş / Fatura Tara</span>
              </button>
              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('manual'); }}
                className="btn-subtle"
                style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                <span style={{ fontSize: '24px' }}>💳</span>
                <span>Hızlı Harcama</span>
              </button>
              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('plate'); }}
                className="btn-subtle"
                style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                <span style={{ fontSize: '24px' }}>📸</span>
                <span>Tabak Tara</span>
              </button>
              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('barcode'); }}
                className="btn-subtle"
                style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                <span style={{ fontSize: '24px' }}>📊</span>
                <span>Barkod Tara</span>
              </button>
            </div>
          </div>
        )}

        {/* Mobile Bottom Dock Navigation */}
        <nav className="bottom-dock">
          {/* Sol 2 Sekme: Ana, Finans */}
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '2px',
                textDecoration: 'none', transition: 'opacity 0.15s',
                opacity: isActive ? 1 : 0.55
              }}>
                <span style={{ fontSize: '22px' }}>{item.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 400, color: isActive ? 'var(--emerald)' : 'var(--text-muted)' }}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Ortadaki Hızlı Ekle / Tara Butonu */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              id="quick-scan-btn"
              onClick={() => {
                loadQuickData();
                setIsQuickMenuOpen(!isQuickMenuOpen);
              }}
              style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: isQuickMenuOpen ? 'var(--text-main)' : 'linear-gradient(135deg, #10B981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(16,185,129,0.45)',
                cursor: 'pointer', fontSize: '22px', color: 'white',
                border: '3px solid var(--surface)',
                transition: 'transform 0.2s',
                transform: isQuickMenuOpen ? 'rotate(45deg)' : 'none'
              }}
            >
              ＋
            </button>
          </div>

          {/* Sağ 2 Sekme: Sağlık, Menü */}
          <Link href="/health" style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '2px',
            textDecoration: 'none', transition: 'opacity 0.15s',
            opacity: pathname === '/health' ? 1 : 0.55
          }}>
            <span style={{ fontSize: '22px' }}>🧬</span>
            <span style={{ fontSize: '10px', fontWeight: pathname === '/health' ? 700 : 400, color: pathname === '/health' ? 'var(--emerald)' : 'var(--text-muted)' }}>
              Sağlık
            </span>
          </Link>

          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '2px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              opacity: isMobileDrawerOpen ? 1 : 0.55
            }}
          >
            <span style={{ fontSize: '22px' }}>☰</span>
            <span style={{ fontSize: '10px', fontWeight: isMobileDrawerOpen ? 700 : 400, color: isMobileDrawerOpen ? 'var(--emerald)' : 'var(--text-muted)' }}>
              Menü
            </span>
          </button>
        </nav>
      </div>

      {/* Mobil Yan Çekmece Menüsü (Full Mobile Navigation Drawer) */}
      {isMobileDrawerOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsMobileDrawerOpen(false)}
          style={{ zIndex: 999 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '290px',
              maxWidth: '85vw',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 16px',
              overflowY: 'auto',
              borderRight: '1px solid var(--border)'
            }}
          >
            {/* Drawer Başlık & Kapatma */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="brand-icon" style={{ width: '34px', height: '34px', fontSize: '15px' }}>S</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>Singularity Life OS</div>
                  <div style={{ fontSize: '10px', color: 'var(--emerald)', fontWeight: 700 }}>Tüm Modüller & Menü</div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Modül Linkleri Listesi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {sidebarPages.map(page => {
                const isActive = pathname === page.href;
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '11px 14px',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--emerald)' : 'var(--text-main)',
                      background: isActive ? 'var(--emerald-bg)' : 'transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{page.icon}</span>
                    <span style={{ fontSize: '13px' }}>{page.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Drawer Alt İşlemler (Ayarlar & Kilit) */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Link
                href="/settings"
                onClick={() => setIsMobileDrawerOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  textDecoration: 'none', color: 'var(--text-main)',
                  fontSize: '13px', fontWeight: 600,
                  background: pathname === '/settings' ? 'var(--surface-subtle)' : 'transparent'
                }}
              >
                <span style={{ fontSize: '18px' }}>⚙️</span>
                <span>Ayarlar & Yedekleme</span>
              </Link>
              <button
                onClick={() => { setIsMobileDrawerOpen(false); handleLock(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'transparent',
                  color: 'var(--text-main)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', textAlign: 'left', width: '100%'
                }}
              >
                <span style={{ fontSize: '18px' }}>🔒</span>
                <span>Ekranı Kilitle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <VoiceCommandModal
        isOpen={activeModal === 'voice'}
        onClose={() => setActiveModal(null)}
        onSuccess={(msg) => {
          showToast(msg || '✅ Sesli işlem kaydedildi!');
          window.dispatchEvent(new CustomEvent('singularity-refresh'));
        }}
      />
      <FeatureShowcaseModal
        isOpen={activeModal === 'showcase'}
        onClose={() => setActiveModal(null)}
      />
      <ReceiptScanModal
        isOpen={activeModal === 'receipt'}
        onClose={() => setActiveModal(null)}
        accounts={quickData.accounts}
        onSuccess={(msg) => {
          showToast(msg || '✅ Fiş kaydedildi!');
          window.dispatchEvent(new CustomEvent('singularity-refresh'));
        }}
      />
      <ManualExpenseModal
        isOpen={activeModal === 'manual'}
        onClose={() => setActiveModal(null)}
        accounts={quickData.accounts}
        categories={quickData.categories}
        onSuccess={(msg) => {
          showToast(msg || '✅ Harcama kaydedildi!');
          window.dispatchEvent(new CustomEvent('singularity-refresh'));
        }}
      />
      <PlateScanModal
        isOpen={activeModal === 'plate'}
        onClose={() => setActiveModal(null)}
        onSuccess={(msg) => {
          showToast(msg || '✅ Plaka kaydedildi!');
          window.dispatchEvent(new CustomEvent('singularity-refresh'));
        }}
      />
      <BarcodeScanModal
        isOpen={activeModal === 'barcode'}
        onClose={() => setActiveModal(null)}
        onSuccess={(msg) => {
          showToast(msg || '✅ Barkod kaydedildi!');
          window.dispatchEvent(new CustomEvent('singularity-refresh'));
        }}
      />
      <PwaManager />

      {/* Kimlik Doğrulama & Onboarding Modalleri */}
      <OnboardingModal
        isOpen={!authSession.loading && !authSession.isInitialized}
        onSuccess={(newUser) => {
          setAuthSession({ isInitialized: true, isAuthenticated: true, user: newUser, loading: false });
          showToast(`🎉 Hoş geldiniz, ${newUser.full_name}!`);
        }}
      />
      <LockScreenModal
        isOpen={isScreenLocked && authSession.isAuthenticated}
        user={authSession.user}
        onSuccess={(user) => {
          setIsScreenLocked(false);
          if (user) {
            setAuthSession(prev => ({ ...prev, isAuthenticated: true, user }));
          }
          showToast(`✅ Kilit açıldı! Hoş geldin, ${user?.full_name || 'Kullanıcı'}.`);
        }}
      />
    </>
  );
}
