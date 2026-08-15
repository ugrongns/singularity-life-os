'use client';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onSuccess: (user: any) => void;
}

const AVATAR_OPTIONS = ['👤', '👑', '🚀', '🦁', '🦉', '⚡', '🌟', '🧘‍♂️', '💻', '🏎️'];

export default function OnboardingModal({ isOpen, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('Ahmet Yılmaz');
  const [username, setUsername] = useState('kullanici');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👑');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [quickPin, setQuickPin] = useState('');

  const [currency, setCurrency] = useState('TRY');
  const [dailyWater, setDailyWater] = useState(2500);
  const [yearlyBooks, setYearlyBooks] = useState(24);

  if (!isOpen) return null;

  const validateStep = (currentStep: number) => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!fullName.trim() || !username.trim() || !email.trim()) {
        setErrorMsg('Lütfen adınızı, kullanıcı adınızı ve e-posta adresinizi girin.');
        return false;
      }
      if (!email.includes('@') || !email.includes('.')) {
        setErrorMsg('Lütfen geçerli bir e-posta adresi girin (örn: ahmet@ornek.com).');
        return false;
      }
    } else if (currentStep === 2) {
      if (!password || password.length < 6) {
        setErrorMsg('Master Parola en az 6 karakter olmalıdır.');
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Girdiğiniz parolalar birbiriyle eşleşmiyor.');
        return false;
      }
      if (quickPin.length !== 6 || !/^\d{6}$/.test(quickPin)) {
        setErrorMsg('Hızlı PIN tam olarak 6 haneli rakamlardan oluşmalıdır.');
        return false;
      }
      if (password.trim() === quickPin.trim()) {
        setErrorMsg('Master Parola ve 6 Haneli Hızlı PIN aynı olamaz!');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          username,
          email,
          password,
          quick_pin: quickPin,
          invite_code: inviteCode.trim() ? inviteCode.trim() : undefined,
          avatar_emoji: avatarEmoji,
          daily_water_target_ml: dailyWater,
          currency
        })
      });

      const json = await res.json();
      if (json.success) {
        onSuccess(json.data.user);
      } else {
        setErrorMsg(json.error || 'Kayıt sırasında bir hata oluştu.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sunucu bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000, backdropFilter: 'blur(12px)', background: 'rgba(15, 23, 42, 0.75)' }}>
      <div className="bottom-sheet" style={{ maxWidth: '520px', borderRadius: '24px', padding: '28px' }}>
        
        {/* Header & İlerleme */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#111827', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '17px' }}>
              S
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>Singularity Life OS Kurulumu</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Adım {step} / 3</div>
            </div>
          </div>

          {/* İlerleme Noktaları */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3].map(s => (
              <div
                key={s}
                style={{
                  width: step === s ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: step >= s ? 'var(--emerald)' : 'var(--border)',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
            {errorMsg}
          </div>
        )}

        {/* ======================================================== */}
        {/* ADIM 1: PROFİL BİLGİLERİ */}
        {/* ======================================================== */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>👋 Hoş Geldiniz! Profilinizi Oluşturun</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Tüm verileriniz %100 yerel cihazınızda saklanacaktır. Master hesabınızın profil bilgilerini girin.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>AD SOYAD *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>KULLANICI ADI *</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="kullanici"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>E-POSTA ADRESİ *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ahmet@ornek.com"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#4F46E5' }}>💌 AİLE DAVET KODU (OPSİYONEL)</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Örn: FAM-849201"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #C7D2FE', borderRadius: 'var(--radius-md)', marginTop: '4px', background: '#EEF2FF', fontWeight: 700, letterSpacing: '1px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>AVATAR SEÇİN</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {AVATAR_OPTIONS.map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setAvatarEmoji(emo)}
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px', fontSize: '18px',
                        border: avatarEmoji === emo ? '2px solid var(--emerald)' : '1px solid var(--border)',
                        background: avatarEmoji === emo ? 'var(--emerald-bg)' : 'var(--surface)',
                        cursor: 'pointer'
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ADIM 2: GÜVENLİK & PIN */}
        {/* ======================================================== */}
        {step === 2 && (() => {
          const isPinSame = Boolean(password && quickPin && password.trim() === quickPin.trim());
          return (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>🔑 Güvenlik & Hızlı Giriş</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  Günlük kullanımda ekranı 6 haneli PIN ile 1 saniyede açacaksınız. Kritik ayarlar için Master Parolanız kullanılacaktır.
                </p>
              </div>

              {isPinSame && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #EF4444', color: '#991B1B',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px',
                  fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span>⚠️</span>
                  <span>Master Parola ve 6 Haneli Hızlı PIN aynı olamaz! Güvenliğiniz için lütfen farklı bir parola ve PIN belirleyin.</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  background: isPinSame ? '#FEF2F2' : '#F8FAFC',
                  border: isPinSame ? '1px solid #EF4444' : '1px solid #E2E8F0',
                  borderRadius: 'var(--radius-md)', padding: '14px', transition: 'all 0.3s ease'
                }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: isPinSame ? '#991B1B' : '#0F172A' }}>
                    🔢 6 HANELİ HIZLI GİRİŞ PIN'İ *
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={quickPin}
                    onChange={e => setQuickPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    style={{
                      width: '100%', padding: '12px', fontSize: '22px', letterSpacing: '8px',
                      textAlign: 'center', fontWeight: 800,
                      border: isPinSame ? '2px solid #EF4444' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', marginTop: '6px',
                      background: 'white', color: isPinSame ? '#EF4444' : 'inherit'
                    }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                    Her uygulama açılışında bu 6 haneli PIN sorulacaktır.
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: isPinSame ? '#991B1B' : 'var(--text-muted)' }}>
                    MASTER PAROLA *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: '13px',
                      border: isPinSame ? '2px solid #EF4444' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>MASTER PAROLA TEKRAR *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Parolayı tekrar girin"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* ======================================================== */}
        {/* ADIM 3: YAŞAM TERCİHLERİ */}
        {/* ======================================================== */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>🎯 Yaşam OS Başlangıç Tercihleri</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Finans ve sağlık modüllerinizin başlangıç hedeflerini yapılandırın.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>ANA PARA BİRİMİ</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
                >
                  <option value="TRY">₺ Türk Lirası (TRY)</option>
                  <option value="USD">$ Amerikan Doları (USD)</option>
                  <option value="EUR">€ Euro (EUR)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>GÜNLÜK SU HEDEFİ (ML)</label>
                  <input
                    type="number"
                    step={250}
                    value={dailyWater}
                    onChange={e => setDailyWater(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>YILLIK KİTAP HEDEFİ</label>
                  <input
                    type="number"
                    value={yearlyBooks}
                    onChange={e => setYearlyBooks(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alt Aksiyon Butonları */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', gap: '10px' }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(prev => prev - 1)}
              className="btn-subtle"
              style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 600, border: '1px solid var(--border)' }}
            >
              ← Geri
            </button>
          ) : <div />}

          {step < 3 ? (() => {
            const isPinSame = step === 2 && Boolean(password && quickPin && password.trim() === quickPin.trim());
            return (
              <button
                type="button"
                disabled={isPinSame}
                onClick={handleNext}
                className="btn-primary"
                style={{
                  padding: '10px 22px', fontSize: '13px', fontWeight: 700,
                  background: isPinSame ? '#EF4444' : undefined,
                  cursor: isPinSame ? 'not-allowed' : 'pointer',
                  opacity: isPinSame ? 0.75 : 1
                }}
              >
                {isPinSame ? '⚠️ PIN ve Parola Farklı Olmalı' : 'İleri ➔'}
              </button>
            );
          })() : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
              style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 800, background: 'var(--emerald)' }}
            >
              {loading ? 'Kuruluyor...' : '🚀 Kurulumu Tamamla & Başla'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
