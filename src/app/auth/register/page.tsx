'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();

  // Adımlar: 1 = Profil, 2 = Güvenlik (PIN & Master Parola), 3 = Başlangıç Tercihleri
  const [step, setStep] = useState(1);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [quickPin, setQuickPin] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👑');
  const [dailyWater, setDailyWater] = useState(2500);
  const [yearlyBooks, setYearlyBooks] = useState(12);
  const [currency, setCurrency] = useState('TRY');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 25;
    if (password.length >= 10) score += 25;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 25;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  };

  const strength = getPasswordStrength();

  // PIN ve Master Parola aynı mı?
  const isPinSameAsPassword = Boolean(
    password && quickPin && password.trim().length > 0 && quickPin.trim().length > 0 && password.trim() === quickPin.trim()
  );

  const validateStep = (stepNum: number): boolean => {
    if (stepNum === 1) {
      if (!fullName.trim() || !username.trim() || !email.trim()) {
        setErrorMsg('Lütfen adınızı, kullanıcı adınızı ve e-posta adresinizi girin.');
        return false;
      }
      if (!email.includes('@') || !email.includes('.')) {
        setErrorMsg('Lütfen geçerli bir e-posta adresi girin (örn: ahmet@ornek.com).');
        return false;
      }
    }
    if (stepNum === 2) {
      if (!quickPin || quickPin.length !== 6 || !/^\d{6}$/.test(quickPin)) {
        setErrorMsg('Hızlı PIN tam olarak 6 haneli rakamlardan oluşmalıdır.');
        return false;
      }
      if (!password || password.length < 6) {
        setErrorMsg('Master parola en az 6 karakter olmalıdır.');
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Girdiğiniz master parolalar birbiriyle eşleşmiyor.');
        return false;
      }
      if (password.trim() === quickPin.trim()) {
        setErrorMsg('Master Parola ve 6 Haneli Hızlı PIN aynı olamaz! Güvenliğiniz için lütfen farklı bir parola ve PIN belirleyin.');
        return false;
      }
    }
    setErrorMsg(null);
    return true;
  };

  const goToStep = (targetStep: number) => {
    if (targetStep < step) {
      setErrorMsg(null);
      setStep(targetStep);
      return;
    }
    if (step === 1 && targetStep >= 2) {
      if (!validateStep(1)) return;
    }
    if (step === 2 && targetStep === 3) {
      if (!validateStep(2)) return;
    }
    if (targetStep === 3) {
      if (!validateStep(1) || !validateStep(2)) return;
    }
    setErrorMsg(null);
    setStep(targetStep);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2)) {
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
          email: email.trim() || undefined,
          password,
          quick_pin: quickPin,
          avatar_emoji: avatarEmoji,
          daily_water_target_ml: dailyWater,
          currency
        })
      });

      const json = await res.json();
      if (json.success) {
        router.push('/');
        setTimeout(() => window.location.href = '/', 300);
      } else {
        setErrorMsg(json.error || 'Kayıt sırasında bir hata oluştu.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1E293B 0%, #0F172A 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '36px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Logo & Başlık */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '26px', boxShadow: '0 0 30px rgba(16,185,129,0.35)',
            marginBottom: '12px'
          }}>
            S
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Yeni Hesap Oluşturun
          </h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
            Singularity Life OS • %100 Yerel Cihazınızda Güvenli
          </p>
        </div>

        {/* Adım Göstergesi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
          {[
            { num: 1, label: 'Profil' },
            { num: 2, label: 'Güvenlik' },
            { num: 3, label: 'Hedefler' }
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => goToStep(s.num)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
                background: step === s.num ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                border: step === s.num ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                fontSize: '11px', fontWeight: 700,
                color: step === s.num ? '#34D399' : '#94A3B8'
              }}
            >
              <span>{s.num}.</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#FCA5A5', padding: '12px 14px', borderRadius: '12px', fontSize: '12px',
            fontWeight: 700, marginBottom: '20px', textAlign: 'center', lineHeight: '1.4'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister}>
          {/* ======================================================== */}
          {/* ADIM 1: PROFİL */}
          {/* ======================================================== */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                  AD SOYAD *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'white'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                  KULLANICI ADI *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: kullanici"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'white'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                  E-POSTA ADRESİ *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ahmet@ornek.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'white'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                  PROFİL EMOJİSİ
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {['👑', '⚡', '🚀', '🦁', '🦉', '💎', '🔥', '🛡️', '🧠', '🌟'].map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setAvatarEmoji(emo)}
                      style={{
                        width: '38px', height: '38px', borderRadius: '10px', fontSize: '20px',
                        border: avatarEmoji === emo ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                        background: avatarEmoji === emo ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer'
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => goToStep(2)}
                style={{
                  marginTop: '10px', padding: '14px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white',
                  fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.4)'
                }}
              >
                İleri: Güvenlik & PIN ➔
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* ADIM 2: GÜVENLİK & PIN */}
          {/* ======================================================== */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Canlı Eşitlik Uyarısı */}
              {isPinSameAsPassword && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #EF4444',
                  color: '#FCA5A5', padding: '12px 14px', borderRadius: '12px',
                  fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <span>Master Parola ve 6 Haneli Hızlı PIN aynı olamaz! Güvenliğiniz için lütfen farklı bir parola ve PIN belirleyin.</span>
                </div>
              )}

              <div style={{
                background: isPinSameAsPassword ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: isPinSameAsPassword ? '1px solid #EF4444' : '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '16px', padding: '14px', textAlign: 'center', transition: 'all 0.3s ease'
              }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: isPinSameAsPassword ? '#F87171' : '#34D399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🔢 6 HANELİ HIZLI GİRİŞ PIN'İ *
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  value={quickPin}
                  onChange={e => {
                    setQuickPin(e.target.value.replace(/\D/g, ''));
                    setErrorMsg(null);
                  }}
                  placeholder="••••••"
                  style={{
                    width: '100%', padding: '12px', fontSize: '24px', letterSpacing: '10px',
                    textAlign: 'center', fontWeight: 900, marginTop: '8px',
                    borderRadius: '12px',
                    border: isPinSameAsPassword ? '2px solid #EF4444' : '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    color: isPinSameAsPassword ? '#EF4444' : '#10B981'
                  }}
                />
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                  Günlük kilit açılışlarında sadece bu PIN kullanılacaktır.
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: isPinSameAsPassword ? '#F87171' : '#94A3B8', textTransform: 'uppercase' }}>
                    MASTER PAROLA *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: '#34D399', fontSize: '11px', cursor: 'pointer' }}
                  >
                    {showPassword ? 'Gizle' : 'Göster'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="En az 6 karakter"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                    borderRadius: '12px',
                    border: isPinSameAsPassword ? '2px solid #EF4444' : '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'white'
                  }}
                />

                {/* Güvenlik Çubuğu */}
                {password && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${strength}%`,
                        background: strength > 66 ? '#10B981' : strength > 33 ? '#F59E0B' : '#EF4444',
                        transition: 'all 0.3s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                      {strength > 66 ? 'Güçlü Parola' : strength > 33 ? 'Orta Düzey Parola' : 'Zayıf Parola'}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                  MASTER PAROLA TEKRAR *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Parolanızı tekrar girin"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'white'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  ← Geri
                </button>
                <button
                  type="button"
                  disabled={isPinSameAsPassword}
                  onClick={() => goToStep(3)}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                    background: isPinSameAsPassword ? '#EF4444' : 'linear-gradient(135deg, #10B981, #059669)',
                    color: 'white',
                    fontSize: '13px', fontWeight: 800,
                    cursor: isPinSameAsPassword ? 'not-allowed' : 'pointer',
                    opacity: isPinSameAsPassword ? 0.75 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isPinSameAsPassword ? '⚠️ Parola ve PIN Farklı Olmalı' : 'İleri: Başlangıç Tercihleri ➔'}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ADIM 3: TERCİHLER & KAYIT */}
          {/* ======================================================== */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                  ANA PARA BİRİMİ
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                    background: '#1E293B', color: 'white'
                  }}
                >
                  <option value="TRY">₺ Türk Lirası (TRY)</option>
                  <option value="USD">$ Amerikan Doları (USD)</option>
                  <option value="EUR">€ Euro (EUR)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                    GÜNLÜK SU HEDEFİ
                  </label>
                  <input
                    type="number"
                    step={250}
                    value={dailyWater}
                    onChange={e => setDailyWater(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)', color: 'white'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                    YILLIK KİTAP HEDEFİ
                  </label>
                  <input
                    type="number"
                    value={yearlyBooks}
                    onChange={e => setYearlyBooks(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '12px 14px', fontSize: '14px', marginTop: '6px',
                      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.06)', color: 'white'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '14px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  ← Geri
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '14px', border: 'none',
                    background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white',
                    fontSize: '14px', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(16,185,129,0.5)'
                  }}
                >
                  {loading ? 'Hesap Oluşturuluyor...' : '🚀 Hesabı Oluştur & Başla'}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Giriş Yap Linki */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Zaten bir hesabınız var mı? </span>
          <Link
            href="/auth/login"
            style={{ fontSize: '12px', color: '#34D399', fontWeight: 700, textDecoration: 'none' }}
          >
            Giriş Yap ➔
          </Link>
        </div>

      </div>
    </div>
  );
}
