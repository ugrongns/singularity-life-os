'use client';
import { useState, useEffect } from 'react';

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  useEffect(() => {
    // 1. Service Worker Kaydı
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA] Service Worker registered with scope:', reg.scope))
        .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
    } else if ('serviceWorker' in navigator) {
      // Geliştirme ortamında da test amaçlı kayıt
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA Dev] Service Worker registered:', reg.scope))
        .catch((err) => console.warn('[PWA Dev] SW registration note:', err));
    }

    // 2. Install Prompt Olayı
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Kullanıcı daha önce kapatmadıysa göster
      const dismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 3. Online / Offline Dinleyicileri
    const handleOnline = () => {
      setIsOffline(false);
      setShowOnlineToast(true);
      setTimeout(() => setShowOnlineToast(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User response to install:', outcome);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <>
      {/* Çevrimdışı Durum Çubuğu */}
      {isOffline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: '#EF4444', color: 'white',
          padding: '6px 12px', fontSize: '11px', fontWeight: 700,
          textAlign: 'center', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <span>⚡</span>
          <span>Çevrimdışı Mod — İnternet bağlantısı yok, veriler yerel SQLite ve önbellekten yükleniyor.</span>
        </div>
      )}

      {/* Yeniden Çevrimiçi Oldu Bildirimi */}
      {showOnlineToast && (
        <div style={{
          position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
          background: '#10B981', color: 'white',
          padding: '8px 18px', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 700,
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 4px 16px rgba(16,185,129,0.35)'
        }}>
          <span>✅</span>
          <span>Tekrar çevrimiçi oldunuz!</span>
        </div>
      )}

      {/* PWA Ana Ekrana Ekleme Promosyon Bannerı */}
      {showInstallBanner && (
        <div style={{
          position: 'fixed', bottom: '74px', left: '16px', right: '16px', maxWidth: '480px', margin: '0 auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.18)', zIndex: 90,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--text-main)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px', flexShrink: 0 }}>
              S
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>Singularity Uygulamasını Yükleyin</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ana ekrandan tek tıkla internetsiz ve tam ekran açın</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleInstallClick}
              className="btn-primary"
              style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              📲 Yükle
            </button>
            <button
              onClick={handleDismissBanner}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
