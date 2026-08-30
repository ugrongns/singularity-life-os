'use client';
import { useState, useEffect } from 'react';

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  relationship_type?: string;
  avatar: string;
  is_active: number;
  user_id?: string | null;
  has_registered?: boolean;
  is_current_user?: boolean;
  invite_code?: string | null;
  invite_expires_at?: string | null;
  transaction_count?: number;
  total_spent?: number;
}

const EMOJI_OPTIONS = ['💍', '👩', '👨', '👦', '👧', '👶', '👵', '👴', '👑', '🤝', '🐶', '🐱', '👤'];

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: '👑 Aile Lideri', color: '#B45309', bg: '#FEF3C7' },
  leader: { label: '👑 Aile Lideri', color: '#B45309', bg: '#FEF3C7' },
  spouse: { label: '💍 Eş', color: '#BE185D', bg: '#FCE7F3' },
  child: { label: '👶 Çocuk', color: '#1D4ED8', bg: '#DBEAFE' },
  roommate: { label: '🏠 Ev Arkadaşı', color: '#6D28D9', bg: '#EDE9FE' },
  friend: { label: '🤝 Arkadaş', color: '#0369A1', bg: '#E0F2FE' },
  mother: { label: '👩 Anne', color: '#BE185D', bg: '#FCE7F3' },
  father: { label: '👨 Baba', color: '#047857', bg: '#D1FAE5' },
  parent: { label: '👴 Ebeveyn', color: '#047857', bg: '#D1FAE5' },
  sibling: { label: '👫 Kardeş', color: '#C2410C', bg: '#FFEDD5' },
  member: { label: '👤 Üye', color: '#4B5563', bg: '#F3F4F6' },
  other: { label: '👤 Diğer', color: '#4B5563', bg: '#F3F4F6' }
};

export default function FamilyMembersCard() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState('spouse');
  const [avatar, setAvatar] = useState('💍');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{ code: string; name: string; role: string; expires_at: string } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/family-members');
      const json = await res.json();
      if (json.success && json.data) {
        setMembers(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();

    const handleRefresh = () => {
      fetchMembers();
    };
    window.addEventListener('singularity-refresh', handleRefresh);
    return () => window.removeEventListener('singularity-refresh', handleRefresh);
  }, []);

  const handleOpenNewModal = () => {
    setEditingId(null);
    setName('');
    setRole('spouse');
    setAvatar('💍');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (m: FamilyMember) => {
    setEditingId(m.id);
    setName(m.name);
    setRole(m.role || 'spouse');
    setAvatar(m.avatar || '👤');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('⚠️ Lütfen aile üyesinin Adı Soyadını girin.');
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = Boolean(editingId);
      const url = '/api/family-members';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit
        ? { id: editingId, name: cleanName, role, relationship_type: role, avatar }
        : { name: cleanName, role, relationship_type: role, avatar };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        fetchMembers();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));

        if (!isEdit && json.data?.invite_code) {
          setGeneratedInvite({
            code: json.data.invite_code,
            name: cleanName,
            role: role,
            expires_at: json.data.expires_at
          });
          showToast(`🎉 ${cleanName} eklendi ve Davet Kodu (${json.data.invite_code}) üretildi!`);
        } else {
          showToast(json.message || '✅ Üye güncellendi!');
        }
      } else {
        alert(json.error || 'İşlem başarısız.');
      }
    } catch (err) {
      alert('Sunucu hatası.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, memberName: string) => {
    if (!confirm(`${memberName} isimli aile bireyini silmek/deaktif etmek istediğinizden emin misiniz?`)) return;

    try {
      const res = await fetch(`/api/family-members?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchMembers();
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        showToast('✅ Aile üyesi silindi.');
      }
    } catch (err) {
      alert('Silme işlemi başarısız.');
    }
  };

  const copyCode = (code: string, memberName?: string) => {
    navigator.clipboard.writeText(code);
    showToast(`📋 ${memberName ? `${memberName} için d` : 'D'}avet kodu (${code}) panoya kopyalandı!`);
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Aile üyeleri yükleniyor...
      </div>
    );
  }

  return (
    <div className="card">
      {toast && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'var(--bg)', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 700, boxShadow: 'var(--shadow-lg)', zIndex: 9999, border: '1px solid var(--border)' }}>
          {toast}
        </div>
      )}

      {/* Kart Başlığı */}
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">
          <span>👨‍👩‍👧‍👦</span>
          <span>Aile Üyeleri & Üyelik Yönetimi</span>
        </div>
        <div>
          <button
            className="btn-primary"
            onClick={handleOpenNewModal}
            style={{ padding: '7px 16px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>＋</span>
            <span>Yeni Aile Üyesi Ekle</span>
          </button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 14px', lineHeight: '1.5' }}>
        Aile bireylerinizi ad-soyad ve rolüyle ekleyin. Sistem otomatik olarak kişiye özel <strong>Aile Davet Kodu</strong> üretir ve üyeyi hesaba bağlar.
      </p>

      {/* Yeni Üretilen Davet Kodu Kutusu (Varsa) */}
      {generatedInvite && (
        <div style={{ background: 'var(--indigo-bg)', border: '1px solid var(--indigo)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--indigo)' }}>
              💌 {generatedInvite.name.toUpperCase()} İÇİN AİLE DAVET KODU ({ROLE_LABELS[generatedInvite.role]?.label || '👤 Üye'}):
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '3px', marginTop: '2px' }}>
              {generatedInvite.code}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {generatedInvite.name} kayıt ekranında bu kodu girerek doğrudan <strong>{ROLE_LABELS[generatedInvite.role]?.label}</strong> olarak ailenize dahil olur (7 Gün Geçerli).
            </div>
          </div>
          <button
            onClick={() => copyCode(generatedInvite.code, generatedInvite.name)}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '12px', background: 'var(--indigo)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 800 }}
          >
            📋 Kodu Kopyala
          </button>
        </div>
      )}

      {/* Üye Listesi Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {members.map(m => {
          const roleBadge = ROLE_LABELS[m.role] || ROLE_LABELS.member;
          return (
            <div
              key={m.id}
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '30px', background: 'var(--surface)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    {m.avatar || '👤'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                      {m.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: roleBadge.color,
                          background: roleBadge.bg,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}
                      >
                        {roleBadge.label}
                      </span>
                      {m.has_registered ? (
                        <span style={{ fontSize: '9px', fontWeight: 700, background: 'var(--emerald-bg)', color: 'var(--emerald)', padding: '2px 6px', borderRadius: '4px' }}>
                          ● Aktif Hesap
                        </span>
                      ) : (
                        <span style={{ fontSize: '9px', fontWeight: 700, background: 'var(--amber-bg)', color: 'var(--amber)', padding: '2px 6px', borderRadius: '4px' }}>
                          ⏳ Kayıt Bekleniyor
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Düzenle / Sil Butonları */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleOpenEditModal(m)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                    title="Düzenle"
                  >
                    ✏️
                  </button>
                  {m.role !== 'admin' && !m.is_current_user && (
                    <button
                      onClick={() => handleDelete(m.id, m.name)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px', color: 'var(--rose)' }}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* Bekleyen Davet Kodu Varsa Doğrudan Kart Üzerinde Göster */}
              {!m.has_registered && m.invite_code && (
                <div style={{ background: 'var(--surface)', border: '1px dashed var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--indigo)' }}>💌 Aile Davet Kodu:</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '1px' }}>{m.invite_code}</div>
                  </div>
                  <button
                    onClick={() => copyCode(m.invite_code!, m.name)}
                    className="btn-subtle"
                    style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700 }}
                  >
                    📋 Kopyala
                  </button>
                </div>
              )}

              {/* İstatistik */}
              {(m.transaction_count || 0) > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                  💰 Toplam Harcama: <strong>{m.total_spent?.toLocaleString('tr-TR')} ₺</strong> ({m.transaction_count} işlem)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tekil Ekleme / Düzenleme Modalı */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%' }}>
            <div className="sheet-handle"></div>

            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>
              {editingId ? '✏️ Aile Üyesini Düzenle' : '➕ Yeni Aile Üyesi Ekle & Davet Et'}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
              {editingId 
                ? 'Aile bireyinin adı, avatarı ve rolünü güncelleyin.' 
                : 'Üyenin adını ve rolünü girin. Otomatik olarak kişiye özel Aile Davet Kodu oluşturulacaktır.'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Avatar Emoji Seçimi */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Profil Resmi / Emoji *</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {EMOJI_OPTIONS.map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setAvatar(emo)}
                      style={{
                        fontSize: '20px',
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        border: avatar === emo ? '2px solid var(--emerald)' : '1px solid var(--border)',
                        background: avatar === emo ? 'var(--emerald-bg)' : 'var(--surface-subtle)',
                        cursor: 'pointer'
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* İsim */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Adı Soyadı / Unvanı *</label>
                <input
                  type="text"
                  placeholder="Örn: Hatice İlknur Onganlar, Can (Oğlum)"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>

              {/* Rol Seçimi */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Aile Rolü / Yakınlık *</label>
                <select
                  value={role}
                  onChange={e => {
                    setRole(e.target.value);
                    if (e.target.value === 'spouse' && avatar === '👤') setAvatar('💍');
                    if (e.target.value === 'child' && avatar === '👤') setAvatar('👶');
                    if (e.target.value === 'parent' && avatar === '👤') setAvatar('👵');
                  }}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="spouse">💍 Eş</option>
                  <option value="child">👶 Çocuk</option>
                  <option value="parent">👵 Ebeveyn / Aile Büyüğü</option>
                  <option value="sibling">👫 Kardeş</option>
                  <option value="roommate">🏠 Ev Arkadaşı</option>
                  <option value="friend">🤝 Arkadaş</option>
                  <option value="member">👤 Diğer Aile Bireyi</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '12px', fontWeight: 600 }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', fontWeight: 800 }}
                >
                  {submitting ? 'Kaydediliyor...' : editingId ? 'Güncelle' : '🎉 Üyeyi Ekle & Davet Kodu Üret'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
