'use client';
import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  user: {
    id: string;
    full_name: string;
    avatar_emoji?: string;
  } | null;
  onSuccess: (user: any) => void;
}

const NUMPAD_BUTTONS = [
  { num: '1', letters: '' },
  { num: '2', letters: 'A B C' },
  { num: '3', letters: 'D E F' },
  { num: '4', letters: 'G H I' },
  { num: '5', letters: 'J K L' },
  { num: '6', letters: 'M N O' },
  { num: '7', letters: 'P Q R S' },
  { num: '8', letters: 'T U V' },
  { num: '9', letters: 'W X Y Z' },
  { num: 'C', letters: 'SİL' },
  { num: '0', letters: '+' },
  { num: '⌫', letters: 'GERİ' }
];

export default function LockScreenModal({ isOpen, user, onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [usePasswordMode, setUsePasswordMode] = useState(false);
  const [password, setPassword] = useState('');

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setErrorMsg(null);
      if (newPin.length === 6) {
        verifyPinDirect(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg(null);
  };

  // Masaüstü Fiziksel Klavye Dinleyicisi
  useEffect(() => {
    if (!isOpen || usePasswordMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Form inputları odaklıysa klavye dinleyicisini ezme
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, usePasswordMode, pin]);

  if (!isOpen) return null;

  const verifyPinDirect = async (pinToTest: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', pin: pinToTest, user_id: user?.id })
      });
      const json = await res.json();
      if (json.success) {
        onSuccess(json.data.user);
      } else {
        setIsShaking(true);
        setErrorMsg('❌ Hatalı PIN kodu.');
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 550);
      }
    } catch (err: any) {
      setIsShaking(true);
      setErrorMsg('Bağlantı hatası.');
      setTimeout(() => {
        setIsShaking(false);
        setPin('');
      }, 550);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: user?.id || 'admin', password })
      });
      const json = await res.json();
      if (json.success) {
        onSuccess(json.data.user);
      } else {
        setErrorMsg('❌ Hatalı Master Parola.');
      }
    } catch (err: any) {
      setErrorMsg('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      zIndex: 10000,
      background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.90) 0%, rgba(2, 6, 23, 0.96) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div
        className={isShaking ? 'pin-shake' : ''}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '32px',
          padding: '36px 28px',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.65)',
          textAlign: 'center',
          color: 'white',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        {/* Kullanıcı Avatarı & Başlık */}
        <div style={{
          width: '76px', height: '76px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #10B981, #059669)',
          margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '36px', boxShadow: '0 0 28px rgba(16, 185, 129, 0.45)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}>
          {user?.avatar_emoji || '👤'}
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
          {user?.full_name || 'Singularity Life OS'}
        </h2>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span>🔒</span>
          <span>Güvenli Kilit • 6 Haneli PIN Girin</span>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.45)',
            color: '#FCA5A5', padding: '9px 12px', borderRadius: '12px', fontSize: '12px',
            fontWeight: 800, marginBottom: '18px'
          }}>
            {errorMsg}
          </div>
        )}

        {!usePasswordMode ? (
          <div>
            {/* PIN Noktaları (6 Hane) */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '26px'
            }}>
              {[0, 1, 2, 3, 4, 5].map(idx => {
                const filled = pin.length > idx;
                const dotColor = isShaking ? '#EF4444' : '#10B981';
                const borderColor = isShaking ? '#F87171' : '#34D399';
                return (
                  <div
                    key={idx}
                    style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: filled ? dotColor : 'rgba(255,255,255,0.12)',
                      border: filled ? `2px solid ${borderColor}` : '1.5px solid rgba(255,255,255,0.22)',
                      boxShadow: filled ? `0 0 14px ${dotColor}90` : 'none',
                      transform: filled ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                );
              })}
            </div>

            {/* iOS Tarzı Yuvarlak Numpad Tuş Takımı (3x4 Grid) */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '14px', maxWidth: '270px', margin: '0 auto 22px',
              justifyItems: 'center'
            }}>
              {NUMPAD_BUTTONS.map(btn => (
                <button
                  key={btn.num}
                  type="button"
                  className="ios-numpad-btn"
                  onClick={() => {
                    if (btn.num === '⌫') handleBackspace();
                    else if (btn.num === 'C') handleClear();
                    else handleDigit(btn.num);
                  }}
                  disabled={loading}
                >
                  <span style={{ lineHeight: 1 }}>{btn.num}</span>
                  {btn.letters && (
                    <span style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginTop: '2px', letterSpacing: '0.8px' }}>
                      {btn.letters}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '280px', margin: '0 auto' }}>
              <button
                type="button"
                onClick={() => setUsePasswordMode(true)}
                style={{
                  background: 'none', border: 'none', color: '#94A3B8', fontSize: '12px',
                  textDecoration: 'underline', cursor: 'pointer', padding: '6px'
                }}
              >
                🔑 Master Parola ile Aç
              </button>

              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                Fiziksel Klavye: 0-9
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              placeholder="Master Parolanız"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '14px', fontSize: '15px',
                borderRadius: '14px', border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.08)', color: 'white', outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                padding: '14px', fontSize: '14px', fontWeight: 800,
                background: 'linear-gradient(135deg, #10B981, #059669)',
                border: 'none', borderRadius: '14px', color: 'white', cursor: 'pointer'
              }}
            >
              {loading ? 'Doğrulanıyor...' : 'Kilidi Aç'}
            </button>
            <button
              type="button"
              onClick={() => setUsePasswordMode(false)}
              style={{
                background: 'none', border: 'none', color: '#94A3B8', fontSize: '12px',
                cursor: 'pointer', marginTop: '6px', textDecoration: 'underline'
              }}
            >
              ← PIN Ekranına Dön
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
