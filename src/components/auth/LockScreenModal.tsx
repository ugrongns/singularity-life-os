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

export default function LockScreenModal({ isOpen, user, onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usePasswordMode, setUsePasswordMode] = useState(false);
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

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
        setErrorMsg('❌ Hatalı PIN kodu.');
        setPin('');
      }
    } catch (err: any) {
      setErrorMsg('Bağlantı hatası.');
      setPin('');
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
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.98))',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '28px',
        padding: '32px 28px',
        maxWidth: '380px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        color: 'white'
      }}>
        
        {/* Kullanıcı Avatarı & Başlık */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #10B981, #059669)',
          margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '34px', boxShadow: '0 0 24px rgba(16, 185, 129, 0.35)'
        }}>
          {user?.avatar_emoji || '👤'}
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
          {user?.full_name || 'Singularity Life OS'}
        </h2>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '20px' }}>
          🔒 Kilitli • 6 Haneli PIN Girin
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#FCA5A5', padding: '8px 12px', borderRadius: '10px', fontSize: '12px',
            fontWeight: 700, marginBottom: '16px'
          }}>
            {errorMsg}
          </div>
        )}

        {!usePasswordMode ? (
          <div>
            {/* PIN Noktaları (6 Hane) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
              {[0, 1, 2, 3, 4, 5].map(idx => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: filled ? '#10B981' : 'rgba(255,255,255,0.15)',
                      border: filled ? '2px solid #34D399' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: filled ? '0 0 12px rgba(16, 185, 129, 0.8)' : 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                );
              })}
            </div>

            {/* Tuş Takımı (3x4 Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxWidth: '270px', margin: '0 auto 20px' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => {
                    if (btn === '⌫') handleBackspace();
                    else if (btn === 'C') handleClear();
                    else handleDigit(btn);
                  }}
                  disabled={loading}
                  style={{
                    height: '56px', borderRadius: '16px', fontSize: '20px', fontWeight: 700,
                    background: btn === 'C' || btn === '⌫' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease', userSelect: 'none'
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {btn}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setUsePasswordMode(true)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
            >
              🔑 Master Parola ile Aç
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Master Parolanız"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', fontSize: '14px',
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)', color: 'white'
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ padding: '12px', fontSize: '13px', fontWeight: 800, background: '#10B981' }}
            >
              {loading ? 'Doğrulanıyor...' : 'Kilidi Aç'}
            </button>
            <button
              type="button"
              onClick={() => setUsePasswordMode(false)}
              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}
            >
              ← PIN Ekranına Dön
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
