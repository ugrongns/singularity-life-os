'use client';
import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Wallet,
  Car,
  BookOpen,
  Activity,
  Sparkles,
  ShoppingCart,
  FolderLock,
  BarChart3,
  Settings,
  Lock,
  Sun,
  Moon,
  Mic,
  Menu,
  X,
  Plus,
  ReceiptText,
  CreditCard,
  Camera,
  ScanLine
} from 'lucide-react';
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

// Sayfa geçişlerinde (route navigation) tekrar tekrar beyaz ekran ve oturum sorgusu oluşmasını önleyen istemci önbelleği
let _clientSessionCache: { isInitialized: boolean; isAuthenticated: boolean; user: any } | null = null;

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
  }>(() => ({
    isInitialized: _clientSessionCache ? _clientSessionCache.isInitialized : true,
    isAuthenticated: _clientSessionCache ? _clientSessionCache.isAuthenticated : true,
    user: _clientSessionCache ? _clientSessionCache.user : null,
    loading: !_clientSessionCache
  }));

  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Hızlı işlem modalları için hesap + kategori verisi (lazy yüklenir)
  const [quickData, setQuickData] = useState<{ accounts: any[]; categories: any[] }>({ accounts: [], categories: [] });
  const [quickDataLoaded, setQuickDataLoaded] = useState(false);

  const loadQuickData = async () => {
    if (quickDataLoaded) return;
    try {
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
        const nextState = {
          isInitialized: json.data.is_initialized,
          isAuthenticated: json.data.is_authenticated,
          user: json.data.user
        };
        _clientSessionCache = nextState;
        setAuthSession({ ...nextState, loading: false });
      } else {
        setAuthSession(prev => ({ ...prev, loading: false }));
      }
    } catch {
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

  // Modaller veya Drawer açıkken arkadaki sayfanın kaymasını engelle
  useEffect(() => {
    if (activeModal || isQuickMenuOpen || isMobileDrawerOpen || isScreenLocked) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeModal, isQuickMenuOpen, isMobileDrawerOpen, isScreenLocked]);

  // Klavye Ergonomisi: ESC tuşuna basıldığında açık modal, quick menu ve drawer'ı kapat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeModal) {
          setActiveModal(null);
        } else if (isQuickMenuOpen) {
          setIsQuickMenuOpen(false);
        } else if (isMobileDrawerOpen) {
          setIsMobileDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, isQuickMenuOpen, isMobileDrawerOpen]);

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
    { href: '/',          icon: Home,         color: 'blue',    label: 'Ana Sayfa' },
    { href: '/budget',    icon: Wallet,       color: 'emerald', label: 'Finans & Bütçe' },
    { href: '/vehicles',  icon: Car,          color: 'cyan',    label: 'Araç & Ev' },
    { href: '/library',   icon: BookOpen,     color: 'amber',   label: 'Kütüphane' },
    { href: '/health',    icon: Activity,     color: 'rose',    label: 'Sağlık & Beslenme' },
    { href: '/wellness',  icon: Sparkles,     color: 'purple',  label: 'Wellness & Rutin' },
    { href: '/shopping',  icon: ShoppingCart, color: 'amber',   label: 'Market Listesi' },
    { href: '/vault',     icon: FolderLock,   color: 'indigo',  label: 'Dijital Kasa' },
    { href: '/analytics', icon: BarChart3,    color: 'purple',  label: 'Yaşam Skoru' },
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
      {/* Desktop Sidebar Navigation (260px Sabit Sol Menü) */}
      <aside className="sidebar-nav" aria-label="Masaüstü Navigasyon">
        <div className="sidebar-brand" onClick={() => setActiveModal('showcase')} title="Singularity Özellik Vitrini">
          <div className="icon-badge" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
            <img src="/icon.svg" alt="Singularity" style={{ width: '22px', height: '22px' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Singularity OS</span>
              <span style={{ fontSize: '10px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
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
          aria-label="Hızlı İşlem / Tara Menüsü"
        >
          <Plus size={16} strokeWidth={2.4} />
          <span>Hızlı İşlem / Tara</span>
        </button>

        {/* Modül Linkleri */}
        <div className="sidebar-menu-list">
          {sidebarPages.map(page => {
            const isActive = pathname === page.href || (page.href !== '/' && pathname.startsWith(page.href));
            const IconComponent = page.icon;
            return (
              <Link
                key={page.href}
                href={page.href}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={`icon-badge icon-badge-${page.color}`}>
                  <IconComponent size={18} strokeWidth={1.75} />
                </div>
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
            aria-current={pathname === '/settings' ? 'page' : undefined}
          >
            <div className="icon-badge icon-badge-slate">
              <Settings size={18} strokeWidth={1.75} />
            </div>
            <span>Ayarlar & Yedekleme</span>
          </Link>
          <button
            className="sidebar-item"
            onClick={handleLock}
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            aria-label="Ekranı Kilitle"
          >
            <div className="icon-badge icon-badge-rose">
              <Lock size={18} strokeWidth={1.75} />
            </div>
            <span>Ekranı Kilitle</span>
          </button>
        </div>
      </aside>

      {/* Main Layout Content Canvas */}
      <div className="layout-content-wrapper">
        <div className="app-container">
          {/* Toast Notification */}
          {toastMsg && (
            <div className="toast-glass" role="status" aria-live="polite">
              {toastMsg}
            </div>
          )}

          {/* Header */}
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexShrink: 1 }}>
              <button
                className="mobile-hamburger-btn"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="Tüm Menüyü Aç"
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  flexShrink: 0
                }}
              >
                <Menu size={20} strokeWidth={1.75} />
              </button>

              <div
                className="brand-badge"
                onClick={() => setActiveModal('showcase')}
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}
                title="Singularity Özellik Vitrini"
              >
                <div className="icon-badge" style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }}>
                  <img src="/icon.svg" alt="Singularity" style={{ width: '22px', height: '22px' }} />
                </div>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div className="brand-title header-brand-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <span>Singularity Life OS</span>
                    <span style={{ fontSize: '10px', background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                      v2.1
                    </span>
                  </div>
                  <div className="header-subtitle" style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    Kişisel & Aile Yönetim Merkezi
                  </div>
                </div>
              </div>
            </div>

            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* 🌙 / ☀️ Dark/Light Tema Butonu */}
              <button
                className="header-action-btn"
                onClick={toggleTheme}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  transition: 'all 0.15s'
                }}
                title={theme === 'dark' ? 'Aydınlık Moda Geç' : 'Karanlık Moda Geç'}
                aria-label="Tema Değiştir"
              >
                {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
              </button>

              {/* Hızlı Sesli Komut Butonu */}
              <button
                className="header-action-btn"
                onClick={() => setActiveModal('voice')}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  transition: 'all 0.15s'
                }}
                title="Sesli Çoklu Komut"
                aria-label="Sesli Çoklu Komut"
              >
                <Mic size={18} strokeWidth={1.75} />
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
                className="header-action-btn"
                onClick={handleLock}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main)'
                }}
                title="Ekranı Kilitle"
                aria-label="Ekranı Kilitle"
              >
                <Lock size={18} strokeWidth={1.75} />
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main style={{ flex: 1, paddingBottom: '40px', minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>

      {/* Quick Action Drawer / Menu (FAB Menüsü) */}
      {isQuickMenuOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsQuickMenuOpen(false)}
          style={{ zIndex: 998 }}
        >
          <div
            className="bottom-sheet quick-action-sheet"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div className="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--emerald)' }}>⚡</span> Hızlı İşlem & Akıllı Tarama
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Anında sesle kaydet veya yapay zeka ile tara</div>
              </div>
              <button
                onClick={() => setIsQuickMenuOpen(false)}
                className="modal-close-btn"
                aria-label="Kapat"
                style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Sesli Komut Hero Banner */}
            <button
              onClick={() => { setIsQuickMenuOpen(false); setActiveModal('voice'); }}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--emerald-bg)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: 'var(--emerald)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.12)',
                transition: 'all 0.15s ease'
              }}
            >
              <div className="icon-badge icon-badge-emerald" style={{ width: '42px', height: '42px', minWidth: '42px', minHeight: '42px' }}>
                <Mic size={22} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Sesli Çoklu Komut Girişi</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Doğal dille harcama, fiş veya not aktar</div>
              </div>
            </button>

            {/* 4'lü Hızlı Eylem Grid'i */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('receipt'); }}
                className="btn-subtle"
                style={{
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: 'var(--radius-md)',
                  minHeight: '84px',
                  minWidth: '44px'
                }}
              >
                <div className="icon-badge icon-badge-blue">
                  <ReceiptText size={20} strokeWidth={1.75} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Fiş / Fatura Tara</span>
              </button>

              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('manual'); }}
                className="btn-subtle"
                style={{
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: 'var(--radius-md)',
                  minHeight: '84px',
                  minWidth: '44px'
                }}
              >
                <div className="icon-badge icon-badge-indigo">
                  <CreditCard size={20} strokeWidth={1.75} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Hızlı Harcama</span>
              </button>

              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('plate'); }}
                className="btn-subtle"
                style={{
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: 'var(--radius-md)',
                  minHeight: '84px',
                  minWidth: '44px'
                }}
              >
                <div className="icon-badge icon-badge-amber">
                  <Camera size={20} strokeWidth={1.75} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Tabak Tara</span>
              </button>

              <button
                onClick={() => { setIsQuickMenuOpen(false); setActiveModal('barcode'); }}
                className="btn-subtle"
                style={{
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: 'var(--radius-md)',
                  minHeight: '84px',
                  minWidth: '44px'
                }}
              >
                <div className="icon-badge icon-badge-cyan">
                  <ScanLine size={20} strokeWidth={1.75} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Barkod Tara</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Dock Navigation (5 Eşit Sütunlu Grid - Kusursuz Merkezde +) */}
      <nav className="bottom-dock" aria-label="Alt Navigasyon">
        {/* 1. Ana Sayfa */}
        {(() => {
          const isActive = pathname === '/';
          return (
            <Link
              href="/"
              className="dock-nav-item"
              style={{ color: isActive ? 'var(--emerald)' : 'var(--text-muted)' }}
              aria-current={isActive ? 'page' : undefined}
            >
              <Home size={20} strokeWidth={1.75} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500 }}>Ana</span>
              {isActive && <div className="dock-active-pill" />}
            </Link>
          );
        })()}

        {/* 2. Finans & Bütçe */}
        {(() => {
          const isActive = pathname.startsWith('/budget');
          return (
            <Link
              href="/budget"
              className="dock-nav-item"
              style={{ color: isActive ? 'var(--emerald)' : 'var(--text-muted)' }}
              aria-current={isActive ? 'page' : undefined}
            >
              <Wallet size={20} strokeWidth={1.75} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500 }}>Finans</span>
              {isActive && <div className="dock-active-pill" />}
            </Link>
          );
        })()}

        {/* 3. Ortadaki Hızlı Ekle / Tara Butonu (FAB) */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            id="quick-scan-btn"
            onClick={() => {
              loadQuickData();
              setIsQuickMenuOpen(!isQuickMenuOpen);
            }}
            aria-label="Hızlı İşlem / Ekle"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: isQuickMenuOpen ? 'var(--text-main)' : 'linear-gradient(135deg, #10B981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16,185,129,0.45)',
              cursor: 'pointer',
              color: 'white',
              border: '3px solid var(--surface)',
              transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s',
              transform: isQuickMenuOpen ? 'rotate(45deg)' : 'none',
              padding: 0,
              margin: 0
            }}
          >
            <Plus size={22} strokeWidth={2.4} />
          </button>
        </div>

        {/* 4. Sağlık & Beslenme */}
        {(() => {
          const isActive = pathname.startsWith('/health') || pathname === '/wellness';
          return (
            <Link
              href="/health"
              className="dock-nav-item"
              style={{ color: isActive ? 'var(--emerald)' : 'var(--text-muted)' }}
              aria-current={isActive ? 'page' : undefined}
            >
              <Activity size={20} strokeWidth={1.75} />
              <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500 }}>Sağlık</span>
              {isActive && <div className="dock-active-pill" />}
            </Link>
          );
        })()}

        {/* 5. Menü (Drawer) */}
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="dock-nav-item"
          style={{ color: isMobileDrawerOpen ? 'var(--emerald)' : 'var(--text-muted)' }}
          aria-label="Tüm Menüyü Aç"
        >
          <Menu size={20} strokeWidth={1.75} />
          <span style={{ fontSize: '10px', fontWeight: isMobileDrawerOpen ? 700 : 500 }}>Menü</span>
          {isMobileDrawerOpen && <div className="dock-active-pill" />}
        </button>
      </nav>

      {/* Mobil Yan Çekmece Menüsü (Full Mobile Navigation Drawer) */}
      {isMobileDrawerOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsMobileDrawerOpen(false)}
          style={{ zIndex: 999 }}
        >
          <div
            className="drawer-content"
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
              borderRight: '1px solid var(--border)',
              animation: 'drawerSlideRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            {/* Drawer Başlık & Kapatma */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="icon-badge" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                  <img src="/icon.svg" alt="Singularity" style={{ width: '22px', height: '22px' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>Singularity Life OS</div>
                  <div style={{ fontSize: '10px', color: 'var(--emerald)', fontWeight: 700 }}>Tüm Modüller & Menü</div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="modal-close-btn"
                aria-label="Kapat"
                style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Modül Linkleri Listesi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {sidebarPages.map(page => {
                const isActive = pathname === page.href || (page.href !== '/' && pathname.startsWith(page.href));
                const IconComponent = page.icon;
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--emerald)' : 'var(--text-main)',
                      background: isActive ? 'var(--emerald-bg)' : 'transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div className={`icon-badge icon-badge-${page.color}`}>
                      <IconComponent size={18} strokeWidth={1.75} />
                    </div>
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
                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  textDecoration: 'none', color: 'var(--text-main)',
                  fontSize: '13px', fontWeight: 600,
                  background: pathname === '/settings' ? 'var(--surface-subtle)' : 'transparent'
                }}
              >
                <div className="icon-badge icon-badge-slate">
                  <Settings size={18} strokeWidth={1.75} />
                </div>
                <span>Ayarlar & Yedekleme</span>
              </Link>
              <button
                onClick={() => { setIsMobileDrawerOpen(false); handleLock(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'transparent',
                  color: 'var(--text-main)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', textAlign: 'left', width: '100%'
                }}
              >
                <div className="icon-badge icon-badge-rose">
                  <Lock size={18} strokeWidth={1.75} />
                </div>
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
