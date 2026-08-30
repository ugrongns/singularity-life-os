'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg('Lütfen e-posta adresinizi (veya kullanıcı adınızı) ve master parolanızı girin.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password
        })
      });

      const json = await res.json();
      if (json.success) {
        router.push('/');
        setTimeout(() => window.location.href = '/', 300);
      } else {
        setErrorMsg('❌ ' + (json.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.'));
      }
    } catch (err: any) {
      setErrorMsg('Bağlantı hatası.');
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
        maxWidth: '440px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '40px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '34px', boxShadow: '0 0 30px rgba(16,185,129,0.35)',
            marginBottom: '16px'
          }}>
            ∞
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Singularity Life OS'a Giriş Yap
          </h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
            E-posta adresiniz ve Master Parolanız ile oturum açın
          </p>
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

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              E-POSTA ADRESİ VEYA KULLANICI ADI *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="kullanici@ornek.com veya kullanici"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              style={{
                width: '100%', padding: '13px 14px', fontSize: '14px', marginTop: '6px',
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)', color: 'white'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                MASTER PAROLA *
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', color: '#34D399', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                {showPassword ? 'Gizle' : 'Göster'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '13px 14px', fontSize: '14px', marginTop: '6px',
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)', color: 'white'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px', padding: '14px', borderRadius: '14px', border: 'none',
              background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white',
              fontSize: '14px', fontWeight: 900, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(16,185,129,0.4)', transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Giriş Yapılıyor...' : '🚀 Giriş Yap ➔'}
          </button>
        </form>

        {/* Kayıt Ol Linki */}
        <div style={{ textAlign: 'center', marginTop: '28px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Hesabınız yok mu? </span>
          <Link
            href="/auth/register"
            style={{ fontSize: '12px', color: '#34D399', fontWeight: 800, textDecoration: 'none' }}
          >
            Yeni Hesap Oluşturun ➔
          </Link>
        </div>

      </div>
    </div>
  );
}
