'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const AVATARS = ['👑', '👤', '🚀', '🦁', '🦉', '⚡', '🌟', '🧘‍♂️', '💻', '🏎️', '💎', '🛡️'];

const MODULES_SHOWCASE = [
  {
    icon: '💰',
    title: 'Finans & Bütçe Yönetimi',
    badge: 'Blok 1',
    color: '#10B981',
    features: ['Çoklu Cüzdan & Kredi Kartı', 'Canlı Kameralı Fiş OCR', 'Otomatik Taksit Defteri', 'Kategorik Bütçe Limiti']
  },
  {
    icon: '📈',
    title: 'Yatırımlar & Portföy',
    badge: 'Blok 1',
    color: '#6366F1',
    features: ['Hisse, Kripto, Altın, Eurobond', 'BES %30 Devlet Katkısı', 'TÜFE Enflasyon Kira Motoru', 'Temettü & Pasif Gelir Motoru']
  },
  {
    icon: '🚗',
    title: 'Araç & Garaj Operasyonu',
    badge: 'Blok 1',
    color: '#F59E0B',
    features: ['Akaryakıt & KM Defteri', 'Periyodik Bakım Hatırlatıcı', 'Kasko & Sigorta Takibi', 'Ev Bakım & Filtre Servisleri']
  },
  {
    icon: '📚',
    title: 'Kütüphane & İkinci Beyin',
    badge: 'Blok 2',
    color: '#8B5CF6',
    features: ['ISBN Barkod Okuyucu', 'WPM Okuma Hızı Kalibrasyonu', 'Alıntı & Not Defteri', 'Yıllık Okuma Hedefi']
  },
  {
    icon: '🧬',
    title: 'Sağlık & Beslenme',
    badge: 'Blok 2',
    color: '#EC4899',
    features: ['16:8 Aralıklı Oruç Sayacı', 'Gıda E-Kodu Zarar Karnesi', 'Makro Besin Hedefleri', 'Diyetisyen Menü Aktarımı']
  },
  {
    icon: '🗂️',
    title: 'Dijital Kasa & Belgeler',
    badge: 'Blok 2',
    color: '#14B8A6',
    features: ['AES-256 Şifreli Kasa', 'Kimlik & Pasaport Fotokopileri', 'Önemli Günler Geri Sayımı', 'Evcil Hayvan Aşı Karnesi']
  },
  {
    icon: '💊',
    title: 'Wellness & Rutinler',
    badge: 'Blok 3',
    color: '#3B82F6',
    features: ['Sabah/Akşam Takviye Streak', 'Uyku Kalitesi & REM Takibi', 'Günlük Mood Tracker', 'Su Tüketim Hedefi']
  },
  {
    icon: '🛒',
    title: 'Akıllı Market Listesi',
    badge: 'Blok 3',
    color: '#10B981',
    features: ['Kategorik Sepet Gruplama', 'Tahmini Toplam Sepet Tutarı', 'Sağlık Menüsünden Aktarım', 'PWA Offline İlerleme']
  },
  {
    icon: '📊',
    title: 'Bütünsel Yaşam Skoru',
    badge: 'Blok 4',
    color: '#F43F5E',
    features: ['0-100 Bütünsel Yaşam Puanı', 'FIRE %4 Kuralı Hedef Takibi', 'Kişisel Enflasyon Hesabı', 'Dinamik İyileştirme Tavsiyesi']
  },
  {
    icon: '🔐',
    title: 'Askeri Düzey Güvenlik',
    badge: 'Blok 4',
    color: '#64748B',
    features: ['%100 Yerel SQLite Veritabanı', 'PBKDF2-SHA256 Şifreleme', '6 Haneli Hızlı PIN Kilit Ekranı', 'Şifreli Otomatik Yedekleme']
  }
];

const FAQS = [
  {
    q: 'Verilerim nereye kaydediliyor?',
    a: 'Tüm verileriniz %100 yerel cihazınızda SQLite veritabanında (singularity.db) saklanır. Hiçbir veriniz üçüncü taraf sunuculara veya buluta aktarılmaz.'
  },
  {
    q: 'İnternetim kesilirse uygulamayı kullanabilir miyim?',
    a: 'Evet! Singularity tam Offline-First PWA (Progressive Web App) mimarisiyle inşa edilmiştir. Uçak modunda bile tüm modülleri kullanabilirsiniz.'
  },
  {
    q: 'Mobil cihazıma uygulama olarak yükleyebilir miyim?',
    a: 'Evet, Safari veya Chrome menüsünden "Ana Ekrana Ekle" diyerek bağımsız nativ görünümlü bir mobil uygulama olarak kullanabilirsiniz.'
  },
  {
    q: 'Verilerimi nasıl yedekleyebilirim?',
    a: 'Ayarlar sayfasından tek tıkla AES-256-GCM ile şifrelenmiş yedeğinizi indirebilir ve istediğiniz cihazda anında geri yükleyebilirsiniz.'
  }
];

export default function LandingPage() {
  const [showSignup, setShowSignup] = useState(false);

  // Kayıt Formu State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [quickPin, setQuickPin] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👑');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setErrorMsg('Lütfen adınızı, kullanıcı adınızı ve e-posta adresinizi girin.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setErrorMsg('Lütfen geçerli bir e-posta adresi girin (örn: ahmet@ornek.com).');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Master parola en az 6 karakter olmalıdır.');
      return;
    }
    if (quickPin.length !== 6 || !/^\d{6}$/.test(quickPin)) {
      setErrorMsg('Hızlı PIN 6 haneli rakamlardan oluşmalıdır.');
      return;
    }
    if (password.trim() === quickPin.trim()) {
      setErrorMsg('Master Parola ve 6 Haneli Hızlı PIN aynı olamaz! Lütfen farklı bir parola veya PIN belirleyin.');
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
          password,
          quick_pin: quickPin,
          invite_code: inviteCode.trim() ? inviteCode.trim() : undefined,
          avatar_emoji: avatarEmoji
        })
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = '/';
      } else {
        setErrorMsg(json.error || 'Kayıt hatası.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 0%, #1E293B 0%, #0F172A 100%)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflowX: 'hidden'
    }}>

      {/* NAV HEADER */}
      <nav style={{
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '22px', boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
          }}>
            S
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>Singularity Life OS</div>
            <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 700 }}>VERSIYON 2026 • Yerel & Şifreli</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/auth/login"
            style={{
              padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
              color: 'white', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              textDecoration: 'none'
            }}
          >
            🔑 Giriş Yap
          </Link>

          <button
            onClick={() => setShowSignup(!showSignup)}
            style={{
              padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 800,
              color: 'white', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none',
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            🚀 {showSignup ? 'Kapat' : 'Hemen Üye Ol'}
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px 40px', textAlign: 'center' }}>
        
        {/* Rozet */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '30px', background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', fontSize: '12px',
          fontWeight: 700, marginBottom: '24px'
        }}>
          <span>✨ 2026 Nesil Bütünsel Yaşam İşletim Sistemi</span>
        </div>

        <h1 style={{
          fontSize: '48px', fontWeight: 900, lineHeight: 1.15, margin: '0 0 20px',
          letterSpacing: '-1.5px',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #94A3B8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>
          Kişisel & Aile Yaşamınızı <br />
          <span style={{ background: 'linear-gradient(135deg, #34D399, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            %100 Yerel ve Şifreli
          </span> Yönetin
        </h1>

        <p style={{
          fontSize: '17px', color: '#94A3B8', maxWidth: '720px', margin: '0 auto 36px',
          lineHeight: 1.6
        }}>
          Finans, portföy, araç operasyonları, kütüphane, oruç, takviyeler, market listesi ve dijital kasanız. Hiçbir veri buluta gitmez, tamamen cihazınızda saklanır.
        </p>

        {/* ======================================================== */}
        {/* HIZLI ÜYELİK FORMU (LANDING İÇİNDE ANINDA KAYIT) */}
        {/* ======================================================== */}
        {showSignup && (
          <div style={{
            maxWidth: '500px', margin: '0 auto 40px', padding: '28px',
            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '24px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '17px' }}>✨ 1 Dakikada Ücretsiz Kayıt Olun</div>
              <span style={{ fontSize: '11px', color: '#34D399', fontWeight: 700 }}>🔒 %100 Cihazınızda</span>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', padding: '10px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
                {errorMsg}
              </div>
            )}

            {/* Canlı Eşitlik Uyarısı */}
            {password && quickPin && password.trim() === quickPin.trim() && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #EF4444',
                color: '#FCA5A5', padding: '10px 12px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 700, marginBottom: '14px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span>⚠️</span>
                <span>Master Parola ve 6 Haneli Hızlı PIN aynı olamaz!</span>
              </div>
            )}

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>AD SOYAD *</label>
                <input
                  type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>E-POSTA ADRESİ *</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="ahmet@ornek.com"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#818CF8' }}>💌 AİLE DAVET KODU (VARSA)</label>
                <input
                  type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Örn: FAM-849201"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px', borderRadius: '10px', border: '1px solid #818CF8', background: 'rgba(99, 102, 241, 0.1)', color: '#818CF8', fontWeight: 800, letterSpacing: '1px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>KULLANICI ADI *</label>
                  <input
                    type="text" required value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="kullanici"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'white' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: (password && quickPin && password.trim() === quickPin.trim()) ? '#F87171' : '#94A3B8' }}>6 HANELİ PIN *</label>
                  <input
                    type="password" maxLength={6} required value={quickPin} onChange={e => setQuickPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px',
                      borderRadius: '10px',
                      border: (password && quickPin && password.trim() === quickPin.trim()) ? '2px solid #EF4444' : '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)',
                      color: (password && quickPin && password.trim() === quickPin.trim()) ? '#EF4444' : '#34D399',
                      fontWeight: 800, textAlign: 'center', letterSpacing: '4px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: (password && quickPin && password.trim() === quickPin.trim()) ? '#F87171' : '#94A3B8' }}>MASTER PAROLA *</label>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '13px', marginTop: '4px',
                    borderRadius: '10px',
                    border: (password && quickPin && password.trim() === quickPin.trim()) ? '2px solid #EF4444' : '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'white'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>AVATAR EMOJİSİ</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {AVATARS.map(emo => (
                    <button
                      key={emo} type="button" onClick={() => setAvatarEmoji(emo)}
                      style={{
                        width: '34px', height: '34px', borderRadius: '8px', fontSize: '16px',
                        border: avatarEmoji === emo ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                        background: avatarEmoji === emo ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer'
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || Boolean(password && quickPin && password.trim() === quickPin.trim())}
                style={{
                  marginTop: '8px', padding: '12px', borderRadius: '12px', border: 'none',
                  background: (password && quickPin && password.trim() === quickPin.trim()) ? '#EF4444' : 'linear-gradient(135deg, #10B981, #059669)',
                  color: 'white',
                  fontSize: '14px', fontWeight: 900,
                  cursor: (password && quickPin && password.trim() === quickPin.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (password && quickPin && password.trim() === quickPin.trim()) ? 0.75 : 1,
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
                }}
              >
                {loading ? 'Hesap Oluşturuluyor...' : (password && quickPin && password.trim() === quickPin.trim()) ? '⚠️ PIN ve Parola Farklı Olmalı' : '🚀 Hesabı Oluştur & Başla'}
              </button>
            </form>
          </div>
        )}

        {/* INTERACTIVE CANLI DEMO KARTLARI */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px', maxWidth: '1000px', margin: '0 auto 60px'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '16px', textAlign: 'left' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>💰 NET VARLIK</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#34D399', margin: '4px 0' }}>28.925.807 ₺</div>
            <div style={{ fontSize: '10px', color: '#10B981' }}>▲ %12.4 bu ay büyüme</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '16px', textAlign: 'left' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>📈 PORTFÖY GETİRİSİ</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#818CF8', margin: '4px 0' }}>+%34.2 Enflasyon Üstü</div>
            <div style={{ fontSize: '10px', color: '#A5B4FC' }}>Hisse, Altın, Kripto, Eurobond</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '16px', textAlign: 'left' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>⏱️ 16:8 ARALIKLI ORUÇ</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#F43F5E', margin: '4px 0' }}>16/16 Saat</div>
            <div style={{ fontSize: '10px', color: '#FDA4AF' }}>✅ Ketozis Evresi Tamamlandı</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '16px', textAlign: 'left' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>📊 YAŞAM SKORU</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#F59E0B', margin: '4px 0' }}>88 / 100</div>
            <div style={{ fontSize: '10px', color: '#FCD34D' }}>Mükemmel Denge • FIRE %4</div>
          </div>
        </div>

      </section>

      {/* MODÜLLER GRID */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 900, margin: '0 0 8px' }}>
            10 Bütünsel Yaşam Modülü
          </h2>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
            Hayatınızın her alanını tek bir yerde disipline edin
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px'
        }}>
          {MODULES_SHOWCASE.map((m, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '24px',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '28px' }}>{m.icon}</span>
                  <div style={{ fontWeight: 800, fontSize: '17px' }}>{m.title}</div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '20px', background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44` }}>
                  {m.badge}
                </span>
              </div>

              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#94A3B8', lineHeight: 1.7 }}>
                {m.features.map((f, fi) => (
                  <li key={fi}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* TEKNOLOJİ VE GÜVENLİK */}
      <section style={{
        background: 'rgba(15, 23, 42, 0.8)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '60px 24px'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '32px' }}>
            Neden Singularity Life OS?
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🛡️</div>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>%100 Yerel Veri</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                Verileriniz sadece sizin cihazınızda SQLite veritabanında saklanır. Bulut bağımlılığı yoktur.
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔐</div>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>Askeri Düzey Şifreleme</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                PBKDF2-SHA256 (100.000 iterasyon) ve AES-256-GCM ile parola ve yedekleriniz koruma altındadır.
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎙️</div>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>Yapay Zekâ NLP</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                Ses kaydı atın veya tek cümle yazın; sistem harcama, su ve okuma verilerinizi otomatik ayırsın.
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📱</div>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>PWA & Offline</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                Telefonunuza uygulama olarak kurun. İnternetiniz olmasa bile tüm cihazlarda kesintisiz çalışır.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SSS SECTION */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 900, textAlign: 'center', marginBottom: '36px' }}>
          Sıkça Sorulan Sorular
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', padding: '20px'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#34D399', marginBottom: '8px' }}>
                ❓ {faq.q}
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.08)', padding: '32px 24px',
        textAlign: 'center', fontSize: '12px', color: '#64748B'
      }}>
        <div style={{ fontWeight: 800, color: 'white', marginBottom: '6px' }}>Singularity Life OS 2026</div>
        <div>%100 Yerel • Özgür • Askeri Güvenlikli Yaşam Yönetimi</div>
      </footer>

    </div>
  );
}
