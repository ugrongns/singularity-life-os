'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AVATAR_LIST = ['👑', '👤', '🚀', '🦁', '🦉', '⚡', '🌟', '🧘‍♂️', '💻', '🏎️', '💎', '🛡️'];

export default function SecuritySettingsCard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'pin'>('profile');

  // Profil State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👑');

  // Parola Değiştirme State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // PIN Değiştirme State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMasterAuth, setPinMasterAuth] = useState('');

  // Hesabı Kalıcı Olarak Silme State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const json = await res.json();
      if (json.success && json.data?.user) {
        const u = json.data.user;
        setCurrentUser(u);
        setFullName(u.full_name || '');
        setEmail(u.email || '');
        setAvatarEmoji(u.avatar_emoji || '👑');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setStatusMsg({ text: 'Ad Soyad alanı boş bırakılamaz.', type: 'error' });
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/auth/update-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          full_name: fullName,
          email,
          avatar_emoji: avatarEmoji
        })
      });
      const json = await res.json();
      if (json.success) {
        setStatusMsg({ text: '✅ ' + json.message, type: 'success' });
        fetchSession();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
      } else {
        setStatusMsg({ text: '❌ ' + json.error, type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: '❌ Bağlantı hatası.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setStatusMsg({ text: 'Mevcut ve yeni parola zorunludur.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setStatusMsg({ text: 'Yeni parola en az 6 karakter olmalıdır.', type: 'error' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setStatusMsg({ text: 'Yeni parolalar birbiriyle eşleşmiyor.', type: 'error' });
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/auth/update-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const json = await res.json();
      if (json.success) {
        setStatusMsg({ text: '✅ ' + json.message, type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setStatusMsg({ text: '❌ ' + json.error, type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: '❌ Bağlantı hatası.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setStatusMsg({ text: 'Yeni PIN tam olarak 6 haneli rakamlardan oluşmalıdır.', type: 'error' });
      return;
    }
    if (pinMasterAuth && newPin.trim() === pinMasterAuth.trim()) {
      setStatusMsg({ text: 'Yeni 6 Haneli PIN, Master Parolanızla aynı olamaz!', type: 'error' });
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/auth/update-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_pin',
          current_pin: currentPin || undefined,
          master_password: pinMasterAuth || undefined,
          new_pin: newPin
        })
      });
      const json = await res.json();
      if (json.success) {
        setStatusMsg({ text: '✅ ' + json.message, type: 'success' });
        setCurrentPin('');
        setPinMasterAuth('');
        setNewPin('');
      } else {
        setStatusMsg({ text: '❌ ' + json.error, type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: '❌ Bağlantı hatası.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Oturumunuz kapatılacak ve ana tanıtım sayfasına yönlendirileceksiniz. Onaylıyor musunuz?')) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      } catch (err) {
        window.location.href = '/';
      }
    }
  };

  const handleLock = async () => {
    window.location.href = '/';
  };

  const handleResetData = async () => {
    const isAdmin = currentUser?.role === 'admin';
    let scope = 'personal';

    if (isAdmin) {
      const choice = confirm(
        '⚠️ SIFIRLAMA SEÇENEĞİ:\n\n[TAMAM] -> Ailenize ait TÜM ORTAK verileri (Araçlar, Faturalar, Ortak Cüzdanlar) ve kendi kişisel verilerinizi sıfırlar.\n[İPTAL] -> Yalnızca kendi KİŞİSEL verilerinizi (Sağlık, Kütüphane) sıfırlamak için İptal butonuna basın.'
      );
      scope = choice ? 'family' : 'personal';
    }

    const confirmMsg = scope === 'family'
      ? '🚨 SON ONAY: Ailenizin tüm ortak verileri ve sizin kişisel kayıtlarınız sıfırlanacaktır. Devam edilsin mi?'
      : '🚨 SON ONAY: Sadece size ait kişisel kayıtlar (Sağlık, Kütüphane, Bireysel Notlar) sıfırlanacaktır. Aile ortak havuzuna dokunulmayacaktır. Onaylıyor musunuz?';

    if (confirm(confirmMsg)) {
      try {
        setSaving(true);
        const res = await fetch('/api/auth/reset-user-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope })
        });
        const json = await res.json();
        if (json.success) {
          const currentTheme = localStorage.getItem('singularity_theme');
          localStorage.clear();
          sessionStorage.clear();
          if (currentTheme) {
            localStorage.setItem('singularity_theme', currentTheme);
          }
          alert(json.message);
          window.location.href = '/';
        } else {
          alert('❌ Hata: ' + (json.error || 'Sıfırlama başarısız.'));
        }
      } catch (err) {
        alert('❌ Bağlantı hatası.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleLoadSampleData = async () => {
    if (confirm('Hesabınıza test ve görünüm amaçlı örnek demo veriler (Cüzdan, Harcama, Kitap, Alıntı, Mülk) yüklensin mi?')) {
      try {
        setSaving(true);
        const res = await fetch('/api/auth/load-sample-data', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          alert(json.message);
          window.location.reload();
        } else {
          alert('❌ Hata: ' + (json.error || 'Örnek veri yükleme başarısız.'));
        }
      } catch (err) {
        alert('❌ Bağlantı hatası.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      alert('Lütfen hesabınızı silmek için master parolanızı girin.');
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      });
      const json = await res.json();
      if (json.success) {
        localStorage.clear();
        sessionStorage.clear();
        alert(json.message);
        window.location.href = '/';
      } else {
        alert('❌ ' + (json.error || 'Hesap silinemedi.'));
      }
    } catch (err) {
      alert('❌ Bağlantı hatası.');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '20px', textAlign: 'center' }}>Güvenlik ayarları yükleniyor...</div>;
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">
          <span>🔐</span>
          <span>Kullanıcı Güvenliği & Profil</span>
        </div>
      </div>

      {currentUser && (
        <div className="card-action-bar">
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--emerald-bg)', color: 'var(--emerald)' }}>
            ● {currentUser.role === 'admin' ? 'Master Yönetici' : 'Kullanıcı'}
          </span>
        </div>
      )}

      {/* Kullanıcı Rozeti */}
      {currentUser && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '14px',
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px'
        }}>
          {/* Üst Kısım: Kullanıcı Bilgisi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '14px', fontSize: '24px',
              background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
            }}>
              {currentUser.avatar_emoji || '👑'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                {currentUser.full_name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                @{currentUser.username} • {currentUser.email || 'E-posta eklenmedi'}
              </div>
            </div>
          </div>

          {/* Alt Kısım: Yatay Düzende Aksiyon Butonları */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
            <button
              type="button"
              onClick={handleLoadSampleData}
              title="Hesabınıza görünüm amaçlı örnek veriler ekler"
              style={{
                flex: '1 1 auto', padding: '8px 12px', fontSize: '11px', fontWeight: 800,
                background: 'var(--blue-bg)', border: '1px solid var(--border)', color: 'var(--blue)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'center'
              }}
            >
              🚀 Örnek Verileri Yükle
            </button>
            <button
              type="button"
              onClick={handleResetData}
              title="Hesabınızdaki tüm cüzdan, harcama ve kişisel verileri sıfırlar"
              style={{
                flex: '1 1 auto', padding: '8px 12px', fontSize: '11px', fontWeight: 800,
                background: 'var(--amber-bg)', border: '1px solid var(--border)', color: 'var(--amber)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'center'
              }}
            >
              🔄 Verilerimi Sıfırla
            </button>
            <button
              type="button"
              onClick={handleLock}
              className="btn-subtle"
              style={{ flex: '1 1 auto', padding: '8px 12px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--border)', textAlign: 'center' }}
            >
              🔒 Kilitle
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                flex: '1 1 auto', padding: '8px 12px', fontSize: '11px', fontWeight: 800,
                background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'center'
              }}
            >
              🚪 Çıkış Yap
            </button>
            <button
              type="button"
              onClick={() => { setDeletePassword(''); setShowDeleteModal(true); }}
              title="Hesabınızı ve tüm verilerinizi kalıcı olarak siler"
              style={{
                flex: '1 1 auto', padding: '8px 12px', fontSize: '11px', fontWeight: 800,
                background: 'var(--rose-bg)', border: '1px solid var(--border)', color: 'var(--rose)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'center'
              }}
            >
              🚨 Hesabımı Sil
            </button>
          </div>
        </div>
      )}

      {/* Alt Sekmeler */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => { setActiveTab('profile'); setStatusMsg(null); }}
          style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-md)', border: 'none',
            background: activeTab === 'profile' ? 'var(--text-main)' : 'transparent',
            color: activeTab === 'profile' ? 'white' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          👤 Profil Bilgileri
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('password'); setStatusMsg(null); }}
          style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-md)', border: 'none',
            background: activeTab === 'password' ? 'var(--text-main)' : 'transparent',
            color: activeTab === 'password' ? 'white' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          🔑 Master Parola Değiştir
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('pin'); setStatusMsg(null); }}
          style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-md)', border: 'none',
            background: activeTab === 'pin' ? 'var(--text-main)' : 'transparent',
            color: activeTab === 'pin' ? 'white' : 'var(--text-muted)', cursor: 'pointer'
          }}
        >
          🔢 6 Haneli PIN Değiştir
        </button>
      </div>

      {statusMsg && (
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, marginBottom: '14px',
          background: statusMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${statusMsg.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: statusMsg.type === 'success' ? '#065F46' : '#991B1B'
        }}>
          {statusMsg.text}
        </div>
      )}

      {/* TAB 1: PROFİL BİLGİLERİ */}
      {activeTab === 'profile' && (
        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>AD SOYAD</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>E-POSTA ADRESİ</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>AVATAR EMOJİSİ</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {AVATAR_LIST.map(emo => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => setAvatarEmoji(emo)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px', fontSize: '18px',
                    border: avatarEmoji === emo ? '2px solid var(--emerald)' : '1px solid var(--border)',
                    background: avatarEmoji === emo ? 'var(--emerald-bg)' : 'white',
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
            disabled={saving}
            className="btn-primary"
            style={{ marginTop: '8px', padding: '10px', fontSize: '13px', fontWeight: 700 }}
          >
            {saving ? 'Kaydediliyor...' : '💾 Profil Bilgilerini Kaydet'}
          </button>
        </form>
      )}

      {/* TAB 2: MASTER PAROLA DEĞİŞTİRME */}
      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>MEVCUT MASTER PAROLA *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>YENİ MASTER PAROLA *</label>
            <input
              type="password"
              required
              placeholder="En az 6 karakter"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>YENİ MASTER PAROLA TEKRAR *</label>
            <input
              type="password"
              required
              placeholder="Yeni parolayı tekrar girin"
              value={confirmNewPassword}
              onChange={e => setConfirmNewPassword(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{ marginTop: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, background: 'var(--emerald)' }}
          >
            {saving ? 'Güncelleniyor...' : '🔑 Master Parolayı Güncelle'}
          </button>
        </form>
      )}

      {/* TAB 3: 6 HANELİ PIN DEĞİŞTİRME */}
      {activeTab === 'pin' && (
        <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>MEVCUT 6 HANELİ PIN (VEYA MASTER PAROLA) *</label>
            <input
              type="password"
              placeholder="Mevcut PIN kodunuz veya Master Parolanız"
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)' }}
            />
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#0F172A' }}>🔢 YENİ 6 HANELİ HIZLI PIN *</label>
            <input
              type="password"
              maxLength={6}
              required
              placeholder="••••••"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
              style={{
                width: '100%', padding: '10px', fontSize: '20px', letterSpacing: '8px',
                textAlign: 'center', fontWeight: 800, border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', marginTop: '6px', background: 'white'
              }}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ekran kilitlendiğinde 1 saniyede açmak için bu yeni PIN kullanılacaktır.
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{ marginTop: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, background: 'var(--emerald)' }}
          >
            {saving ? 'Güncelleniyor...' : '🔢 6 Haneli PIN Kodunu Güncelle'}
          </button>
        </form>
      )}

      {/* HESAP KALICI SİLME ONAY MODALI */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--rose)',
            borderRadius: 'var(--radius-lg)', maxWidth: '440px', width: '100%',
            padding: '24px', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--rose)', marginBottom: '12px' }}>
              <span style={{ fontSize: '28px' }}>🚨</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Hesabı Kalıcı Olarak Sil</h3>
            </div>

            <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '12px', color: 'var(--rose)', lineHeight: '1.5', marginBottom: '16px' }}>
              <strong>⚠️ DİKKAT: Bu işlem kesinlikle geri alınamaz!</strong>
              <div style={{ marginTop: '4px' }}>
                Hesabınız, cüzdanlarınız, işlemleriniz, araçlarınız, sağlık verileriniz ve kütüphaneniz veritabanından kalıcı olarak silinecektir.
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>
                  ONAYLAMAK İÇİN MASTER PAROLANIZI GİRİN:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mevcut Master Parolanız"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '14px',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    marginTop: '6px', background: 'var(--surface-subtle)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 700 }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || !deletePassword}
                  style={{
                    flex: 1.5, padding: '10px', fontSize: '12px', fontWeight: 800,
                    background: 'var(--rose)', color: 'white', border: 'none',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer'
                  }}
                >
                  {deletingAccount ? 'Siliniyor...' : '🚨 Hesabımı Tamamen Sil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
