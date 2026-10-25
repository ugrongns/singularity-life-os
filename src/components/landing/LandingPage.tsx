'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const AVATARS = ['👑', '👤', '🚀', '🦁', '🦉', '⚡', '🌟', '🧘‍♂️', '💻', '🏎️', '💎', '🛡️'];

const CORE_9_MODULES = [
  {
    icon: '💰',
    title: 'Finans & Bütçe Yönetimi',
    badge: 'Executive Bento',
    color: '#10B981',
    features: ['Çoklu Cüzdan & Kredi Kartı', 'Canlı Kameralı Fiş AI OCR', 'Otomatik Taksit Defteri', 'Kategorik Bütçe Limiti']
  },
  {
    icon: '🚗',
    title: 'Araç & Garaj Operasyonu',
    badge: 'Tesla App Telemetri',
    color: '#F59E0B',
    features: ['Akaryakıt & KM Defteri', 'Periyodik Bakım Hatırlatıcı', 'Kasko & Sigorta Takibi', 'Ev Bakım & Filtre Servisleri']
  },
  {
    icon: '🧬',
    title: 'Sağlık & Beslenme',
    badge: 'Apple Health Grade',
    color: '#EC4899',
    features: ['16:8 Aralıklı Oruç Sayacı', 'Gıda E-Kodu Zarar Karnesi', 'Makro Besin Hedefleri', 'Tabak Tarama AI Vizörü']
  },
  {
    icon: '🧘',
    title: 'Wellness & Rutinler',
    badge: 'Whoop / Strava Entegre',
    color: '#3B82F6',
    features: ['Sabah/Akşam Takviye Rutini', 'Uyku Kalitesi & Ruh Hali', 'Strava Çoklu Spor Telemetrisi', 'Akıllı Tartı Biyometri']
  },
  {
    icon: '📚',
    title: 'Kütüphane & İkinci Beyin',
    badge: 'Literal / Readwise',
    color: '#8B5CF6',
    features: ['ISBN Barkod Okuyucu', 'WPM Okuma Hızı Kalibrasyonu', 'Alıntı & Not Drawer\'ı', 'Yıllık Okuma Hedefi']
  },
  {
    icon: '🗂️',
    title: 'Dijital Kasa & Belgeler',
    badge: '1Password Estetiği',
    color: '#14B8A6',
    features: ['Kimlik, Pasaport, Tapu & Garanti', '3 Kademeli Süre Rozetleri', 'Pinch-to-Zoom Touch Lightbox', 'Kamera AI Belge Tarama']
  },
  {
    icon: '🛒',
    title: 'Akıllı Market Listesi',
    badge: 'Markette Tek El Modu',
    color: '#10B981',
    features: ['Reyon Bazlı Gruplandırma', 'Hızlı Seri Ürün Girişi', 'Canlı Sepet Bütçesi', 'Tek Tıkla Kasada Öde']
  },
  {
    icon: '📊',
    title: 'Yaşam Skoru & FIRE Analitiği',
    badge: 'Trinity %4 Modeli',
    color: '#F43F5E',
    features: ['0-100 Radial Gauge Yaşam Skoru', '4 Eksenli Yaşam Dengesi Matrisi', 'En Yüksek Etkili 3 Aksiyon', 'Lean / Regular / Fat FIRE']
  },
  {
    icon: '🔐',
    title: 'Askeri Düzey Güvenlik',
    badge: 'Supabase Cloud RLS',
    color: '#6366F1',
    features: ['PBKDF2-SHA256 Şifreleme', '6 Haneli Hızlı PIN Kilit Ekranı', 'AES-256-GCM Şifreli Yedekleme', 'Telegram Bot Asistanı']
  }
];

const FAQS = [
  {
    q: 'Verilerim nerede saklanıyor?',
    a: 'Verileriniz Supabase Cloud altyapısı üzerinde çalışan şifreli bir PostgreSQL veritabanında saklanır. Row-Level Security (RLS) kural setleri sayesinde her kullanıcı ve aile yalnızca kendi verilerine erişebilir.'
  },
  {
    q: 'Hesap güvenliğim nasıl sağlanıyor?',
    a: 'Master parolanız PBKDF2-SHA256 (100.000 iterasyon) ile, PIN kodunuz ise bağımsız tuzlama (salt) yöntemiyle şifrelenir. Düz metin parola asla sunucuya kaydedilmez.'
  },
  {
    q: 'Mobil cihazımda uygulama olarak çalışır mı?',
    a: 'Evet, Safari veya Chrome menüsünden "Ana Ekrana Ekle" (PWA) diyerek bağımsız bir iOS / Android uygulaması gibi tam ekran, çevrimdışı önbellekleme ve dokunmatik jestlerle kullanabilirsiniz.'
  },
  {
    q: 'Yedeklerimi dışa aktarabilir miyim?',
    a: 'Ayarlar sayfasından tek tıkla tüm sisteminizi standart JSON veya AES-256-GCM ile şifrelenmiş dosya formatında indirebilir ve istediğiniz zaman tek tıkla geri yükleyebilirsiniz.'
  }
];

export default function LandingPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Giriş Formu State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Kayıt Formu State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [quickPin, setQuickPin] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👑');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [faqOpenIdx, setFaqOpenIdx] = useState<number | null>(null);

  // 1. Giriş Yap
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMsg('Lütfen kullanıcı adı / e-posta ve parolanızı girin.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword
        })
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = '/';
      } else {
        setErrorMsg('❌ ' + (json.error || 'Giriş başarısız. Bilgilerinizi kontrol edin.'));
      }
    } catch (err: any) {
      setErrorMsg('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Yeni Kayıt Ol
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setErrorMsg('Lütfen adınızı, kullanıcı adınızı ve e-posta adresinizi girin.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setErrorMsg('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }
    if (!registerPassword || registerPassword.length < 8) {
      setErrorMsg('Master parola en az 8 karakter olmalıdır.');
      return;
    }
    if (quickPin.length !== 6 || !/^\d{6}$/.test(quickPin)) {
      setErrorMsg('Hızlı PIN 6 haneli rakamlardan oluşmalıdır.');
      return;
    }
    if (registerPassword.trim() === quickPin.trim()) {
      setErrorMsg('Master Parola ve 6 Haneli Hızlı PIN aynı olamaz!');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          password: registerPassword,
          quick_pin: quickPin,
          avatar_emoji: avatarEmoji
        })
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = '/';
      } else {
        setErrorMsg('❌ ' + (json.error || 'Kayıt sırasında bir hata oluştu.'));
      }
    } catch (err: any) {
      setErrorMsg('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Demo / Örnek Verilerle Hızlı Giriş
  const handleDemoLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'admin',
          password: 'Password123!'
        })
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = '/';
      } else {
        // Eğer admin kullanıcısı yoksa doğrudan login sayfasına yönlendir
        setLoginIdentifier('admin');
        setLoginPassword('Password123!');
        setAuthMode('login');
      }
    } catch (e) {
      setErrorMsg('Demo girişi sırasında bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% -10%, #1E293B 0%, #0B0F19 100%)',
      color: '#FFFFFF',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflowX: 'hidden'
    }}>
      {/* 1. ÜST NAVİGASYON ÇUBUĞU */}
      <header style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(11, 15, 25, 0.85)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '24px', boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
          }}>
            ∞
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '17px', letterSpacing: '-0.4px' }}>Singularity Life OS</div>
            <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 800 }}>V2.4 • SaaS & Cloud Edition</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setAuthMode('login')}
            style={{
              padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
              color: authMode === 'login' ? '#FFFFFF' : '#94A3B8',
              background: authMode === 'login' ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: authMode === 'login' ? '1px solid rgba(255,255,255,0.2)' : 'none',
              cursor: 'pointer'
            }}
          >
            Giriş Yap
          </button>
          <button
            onClick={() => setAuthMode('register')}
            style={{
              padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 800,
              color: 'white', background: 'linear-gradient(135deg, #10B981, #059669)',
              border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(16,185,129,0.35)'
            }}
          >
            Kayıt Ol
          </button>
        </div>
      </header>

      {/* 2. SPLIT-SCREEN HERO & BENTO VİTRİN DÜZENİ */}
      <main className="landing-split-layout">
        {/* SOL PANEL: ÜRÜN VİZYONU & 9 MODÜLLÜ BENTO VİTRİNİ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', minWidth: 0 }}>
          {/* Hero Tanıtım Metni */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '30px', background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', fontSize: '12px',
              fontWeight: 800, marginBottom: '20px'
            }}>
              <span>✨ 2026 Nesil Bütünsel Yaşam & Finans İşletim Sistemi</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(32px, 5.5vw, 48px)', fontWeight: 900, lineHeight: 1.15,
              margin: '0 0 16px', letterSpacing: '-1.5px'
            }}>
              Kişisel & Aile Yaşamınızı <br />
              <span style={{
                background: 'linear-gradient(135deg, #34D399, #10B981, #38BDF8)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>
                Tek Bir Kumanda Merkezinde
              </span> Birleştirin
            </h1>

            <p style={{
              fontSize: '15px', color: '#94A3B8', lineHeight: 1.6, margin: 0,
              maxWidth: '680px'
            }}>
              Finans, portföy, araç filosu, sağlık, oruç, takviyeler, market sepeti, kütüphane ve 1Password kalitesinde dijital kasa. Hayatınızın tüm parçaları parmaklarınızın ucunda.
            </p>
          </div>

          {/* 9 MODÜLÜN İNTERAKTİF BENTO GRID VİTRİNİ */}
          <div>
            <div style={{
              fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span>⚡</span>
              <span>Singularity Life OS — 9 Temel Yaşam Modülü</span>
            </div>

            <div className="landing-bento-grid">
              {CORE_9_MODULES.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.25s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${m.color}60`;
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = `0 12px 30px ${m.color}15`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: `${m.color}20`, color: m.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px', border: `1px solid ${m.color}40`
                    }}>
                      {m.icon}
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                      background: 'rgba(255,255,255,0.06)', color: m.color, border: `1px solid ${m.color}30`
                    }}>
                      {m.badge}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 4px', color: '#FFFFFF' }}>
                      {m.title}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                    {m.features.map((f, fIdx) => (
                      <div key={fIdx} style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: m.color, fontWeight: 900, fontSize: '10px' }}>✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SIKÇA SORULAN SORULAR (FAQ) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>❓</span>
              <span>Sıkça Sorulan Sorular</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {FAQS.map((faq, idx) => {
                const isOpen = faqOpenIdx === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '14px',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setFaqOpenIdx(isOpen ? null : idx)}
                      style={{
                        width: '100%', padding: '14px 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'none', border: 'none', color: '#FFFFFF',
                        fontSize: '13px', fontWeight: 700, textAlign: 'left', cursor: 'pointer'
                      }}
                    >
                      <span>{faq.q}</span>
                      <span style={{ color: '#10B981', fontSize: '16px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        ▼
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 16px 14px', fontSize: '12px', color: '#94A3B8', lineHeight: 1.6 }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SAĞ PANEL: SABİT (STICKY) CAM EFEKTLİ GİRİŞ / KAYIT KARTI */}
        <div className="landing-sticky-auth">
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '28px',
            padding: '28px 24px',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Sekmeli Mod Seçici (Giriş Yap vs Kayıt Ol) */}
            <div style={{
              display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.06)',
              padding: '4px', borderRadius: '14px', marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setErrorMsg(null); }}
                style={{
                  flex: 1, padding: '10px 8px', fontSize: '13px', fontWeight: 800,
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: authMode === 'login' ? 'linear-gradient(135deg, #10B981, #059669)' : 'transparent',
                  color: '#FFFFFF', transition: 'all 0.15s ease'
                }}
              >
                🔑 Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setErrorMsg(null); }}
                style={{
                  flex: 1, padding: '10px 8px', fontSize: '13px', fontWeight: 800,
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: authMode === 'register' ? 'linear-gradient(135deg, #10B981, #059669)' : 'transparent',
                  color: '#FFFFFF', transition: 'all 0.15s ease'
                }}
              >
                🚀 Yeni Hesap
              </button>
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#FCA5A5', padding: '10px 12px', borderRadius: '12px', fontSize: '12px',
                fontWeight: 700, marginBottom: '16px', lineHeight: 1.4
              }}>
                {errorMsg}
              </div>
            )}

            {/* A. GİRİŞ YAP FORMU */}
            {authMode === 'login' && (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>E-POSTA VEYA KULLANICI ADI</label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    placeholder="john@example.com veya johndoe"
                    style={{
                      width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>MASTER PAROLA</label>
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      style={{ background: 'none', border: 'none', color: '#10B981', fontSize: '11px', cursor: 'pointer' }}
                    >
                      {showLoginPassword ? 'Gizle' : 'Göster'}
                    </button>
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Master parolanız"
                    style={{
                      width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '14px', fontSize: '14px', fontWeight: 800,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.35)', marginTop: '4px'
                  }}
                >
                  {loading ? 'Oturum Açılıyor...' : 'Oturum Aç'}
                </button>

                {/* Hızlı Demo Giriş Butonu */}
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  style={{
                    padding: '12px', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px', color: '#38BDF8', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <span>⚡</span>
                  <span>Örnek Demo Verilerle Keşfet (Admin)</span>
                </button>
              </form>
            )}

            {/* B. YENİ KAYIT OL FORMU */}
            {authMode === 'register' && (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>AD SOYAD *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Örn: John Doe"
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px',
                      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>KULLANICI ADI *</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase())}
                      placeholder="johndoe"
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px',
                        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>E-POSTA *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px',
                        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>MASTER PAROLA (En az 8 Krk) *</label>
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      style={{ background: 'none', border: 'none', color: '#10B981', fontSize: '11px', cursor: 'pointer' }}
                    >
                      {showRegisterPassword ? 'Gizle' : 'Göster'}
                    </button>
                  </div>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    value={registerPassword}
                    onChange={e => setRegisterPassword(e.target.value)}
                    placeholder="Güçlü master parola"
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px',
                      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>6 HANELİ HIZLI PIN *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={quickPin}
                    onChange={e => setQuickPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: '16px', marginTop: '4px',
                      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none',
                      letterSpacing: '4px', textAlign: 'center', fontWeight: 900
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>AVATAR EMOJİSİ</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {AVATARS.slice(0, 8).map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setAvatarEmoji(em)}
                        style={{
                          width: '32px', height: '32px', borderRadius: '8px', fontSize: '16px',
                          border: avatarEmoji === em ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                          background: avatarEmoji === em ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                          cursor: 'pointer'
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '13px', fontSize: '13px', fontWeight: 800,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.35)', marginTop: '4px'
                  }}
                >
                  {loading ? 'Hesap Oluşturuluyor...' : 'Ücretsiz Hesabımı Başlat'}
                </button>
              </form>
            )}

            <div style={{
              fontSize: '11px', color: '#64748B', textAlign: 'center', marginTop: '16px',
              lineHeight: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}>
              <span>🛡️</span>
              <span>Supabase RLS & PBKDF2-SHA256 Güvencesi</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
