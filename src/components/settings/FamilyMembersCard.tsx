'use client';
import { useState, useEffect } from 'react';

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  is_active: number;
  transaction_count?: number;
  total_spent?: number;
}

const EMOJI_OPTIONS = ['👑', '👨', '👩', '💍', '👦', '👧', '👵', '👴', '👶', '🐶', '🐱', '👤'];
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
  const [avatar, setAvatar] = useState('👩');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
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
    setAvatar('👩');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (m: FamilyMember) => {
    setEditingId(m.id);
    setName(m.name);
    setRole(m.role || 'member');
    setAvatar(m.avatar || '👤');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const isEdit = Boolean(editingId);
      const url = '/api/family-members';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit
        ? { id: editingId, name, role, avatar }
        : { name, role, avatar };

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
        showToast(json.message || (isEdit ? '✅ Üye güncellendi!' : '🎉 Üye eklendi!'));
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
        showToast('✅ Aile üyesi deaktif edildi.');
      }
    } catch (err) {
      alert('Silme işlemi başarısız.');
    }
  };

  const [generatedInvite, setGeneratedInvite] = useState<{ code: string; expires_at: string; family_role: string; target_name?: string } | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Invite Form State
  const [inviteRelationship, setInviteRelationship] = useState('spouse');
  const [inviteTargetName, setInviteTargetName] = useState('');

  const handleOpenInviteModal = () => {
    setInviteRelationship('spouse');
    setInviteTargetName('');
    setIsInviteModalOpen(true);
  };

  const handleGenerateInvite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGeneratingInvite(true);
    try {
      const res = await fetch('/api/family-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family_role: 'member',
          relationship_type: inviteRelationship,
          target_name: inviteTargetName
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setGeneratedInvite({
          code: json.data.invite_code,
          expires_at: json.data.expires_at,
          family_role: json.data.family_role,
          target_name: json.data.target_name
        });
        setIsInviteModalOpen(false);
        showToast(`🎉 Aile Davet Kodu Üretildi: ${json.data.invite_code}`);
      } else {
        alert(json.error || 'Davet kodu üretilemedi.');
      }
    } catch (e) {
      alert('Sunucu hatası.');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteToClipboard = () => {
    if (generatedInvite) {
      navigator.clipboard.writeText(generatedInvite.code);
      showToast('📋 Davet kodu panoya kopyalandı!');
    }
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
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--text-main)', color: 'white', padding: '10px 20px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600, boxShadow: 'var(--shadow-lg)', zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Kart Başlığı */}
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">
          <span>👨‍👩‍👧‍👦</span>
          <span>Aile Üyeleri & Üyelik Yönetimi</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-subtle"
            onClick={handleOpenInviteModal}
            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)', background: '#EEF2FF', color: '#4F46E5', borderColor: '#C7D2FE' }}
          >
            💌 Aileye Davet Kodu Üret
          </button>
          <button
            className="btn-primary"
            onClick={handleOpenNewModal}
            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)' }}
          >
            ＋ Yeni Üye Ekle
          </button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 14px' }}>
        Aile bireylerinizi tanımlayın. Sisteme yapılan harcamalar ve veriler o an oturum açan aile üyesine otomatik atanır.
      </p>

      {/* Üretilen Davet Kodu Kutusu */}
      {generatedInvite && (
        <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#4F46E5' }}>
              💌 YENİ AİLE DAVET KODU ({ROLE_LABELS[generatedInvite.family_role]?.label || '👤 Üye'} {generatedInvite.target_name ? `— ${generatedInvite.target_name}` : ''}):
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#312E81', letterSpacing: '2px', marginTop: '2px' }}>
              {generatedInvite.code}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Davet ettiğiniz aile üyesi kayıt ekranında bu kodu girerek belirtilen rol ile ailenize dahil olur (7 Gün Geçerli).
            </div>
          </div>
          <button
            onClick={copyInviteToClipboard}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '12px', background: '#4F46E5', color: 'white', border: 'none' }}
          >
            📋 Kodu Kopyala
          </button>
        </div>
      )}

      {/* Üye Listesi Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
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
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '32px', background: 'var(--surface)', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  {m.avatar || '👤'}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                    {m.name}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: roleBadge.color,
                      background: roleBadge.bg,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginTop: '3px',
                      display: 'inline-block'
                    }}
                  >
                    {roleBadge.label}
                  </span>
                  {(m.transaction_count || 0) > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {m.transaction_count} harcama ({m.total_spent?.toLocaleString('tr-TR')} ₺)
                    </div>
                  )}
                </div>
              </div>

              {/* Aksiyon Butonları */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  onClick={() => handleOpenEditModal(m)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                  title="Düzenle"
                >
                  ✏️
                </button>
                {m.role !== 'admin' && (
                  <button
                    onClick={() => handleDelete(m.id, m.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#EF4444' }}
                    title="Sil"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ekleme / Düzenleme Modalı */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%' }}>
            <div className="sheet-handle"></div>

            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px' }}>
              {editingId ? '✏️ Aile Üyesini Düzenle' : '➕ Yeni Aile Üyesi Ekle'}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Avatar Emoji Seçimi */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Profil Resmi / Emoji *</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {EMOJI_OPTIONS.map(emo => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setAvatar(emo)}
                      style={{
                        fontSize: '22px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: avatar === emo ? '2px solid var(--emerald)' : '1px solid var(--border)',
                        background: avatar === emo ? 'var(--emerald-bg)' : 'var(--surface)',
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
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Adı Soyadı / Unvanı *</label>
                <input
                  type="text"
                  placeholder="Örn: Ayşe Yılmaz, Efe (Oğlum)"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>

              {/* Rol Seçimi */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Aile Rolü *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="admin">👑 Aile Lideri / Yönetici</option>
                  <option value="spouse">💍 Eş</option>
                  <option value="child">👦 Çocuk</option>
                  <option value="parent">👴 Ebeveyn / Aile Büyüğü</option>
                  <option value="member">👤 Diğer Aile Bireyi</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '12px' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', fontWeight: 800 }}
                >
                  {submitting ? 'Kaydediliyor...' : editingId ? 'Güncelle' : '🎉 Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Davet Kodu Üretme Modalı */}
      {isInviteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsInviteModalOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%' }}>
            <div className="sheet-handle"></div>

            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>
              💌 Aile Davet Kodu Üret
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
              Davet edilecek aile bireyinin sistemdeki rolünü seçin. Üretilen davet kodu ile kayıt olan üye bu role sahip olacaktır.
            </p>

            <form onSubmit={handleGenerateInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* İlişki / Tanım Seçimi */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Davet Edilen Bireyin İlişki Tipi / Rolü *</label>
                <select
                  value={inviteRelationship}
                  onChange={e => setInviteRelationship(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)', outline: 'none' }}
                >
                  <option value="spouse">💍 Eş</option>
                  <option value="child">👶 Çocuk</option>
                  <option value="roommate">🏠 Ev Arkadaşı</option>
                  <option value="friend">🤝 Arkadaş</option>
                  <option value="mother">👩 Anne</option>
                  <option value="father">👨 Baba</option>
                  <option value="sibling">👫 Kardeş</option>
                  <option value="member">👤 Diğer Aile Üyesi</option>
                </select>
              </div>

              {/* İsim / Not (Opsiyonel) */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Davet Edilen Üyenin İsmi / Unvanı (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: Selin Yılmaz (Eşim), Can (Oğlum)"
                  value={inviteTargetName}
                  onChange={e => setInviteTargetName(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginTop: '4px', background: 'var(--surface-subtle)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="btn-subtle"
                  style={{ flex: 1, padding: '12px' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={generatingInvite}
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', fontWeight: 800, background: '#4F46E5', color: 'white', border: 'none' }}
                >
                  {generatingInvite ? 'Üretiliyor...' : '🎉 Davet Kodu Üret'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
