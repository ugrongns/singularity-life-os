'use client';
import { useState, useEffect, useRef } from 'react';

interface VaultItem {
  id: string;
  title: string;
  type: string;
  owner: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  document_number?: string;
  document_image_url?: string;
  notes?: string;
  days_left: number | null;
  alert_level: 'ok' | 'warning' | 'critical';
  visa_warning?: boolean;
}

interface ImportantDate {
  id: string;
  title: string;
  person_name: string;
  event_type: string;
  event_date: string;
  remind_days_before?: number;
  gift_ideas?: string;
  notes?: string;
  days_left: number;
  next_date: string;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  birth_date?: string;
  chip_no?: string;
  vaccinations?: string;
  vet_name?: string;
  vet_phone?: string;
  vet_next_date?: string;
  notes?: string;
}

interface Props {
  vaultItems: VaultItem[];
  importantDates: ImportantDate[];
  pets: Pet[];
  onOpenAddVault: (item?: VaultItem) => void;
  onOpenAddDate: (item?: ImportantDate) => void;
  onOpenAddPet: (item?: Pet) => void;
  onRefresh: () => void;
  onToast?: (msg: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  passport: '🛂',
  id_card: '🪪',
  license: '📋',
  warranty: '🛡️',
  contract: '📄',
  title_deed: '🏠',
  health: '🩺',
  insurance: '🏥',
  invoice: '🧾',
  other: '📁'
};

const TYPE_LABELS: Record<string, string> = {
  passport: 'Pasaport',
  id_card: 'Kimlik Kartı',
  license: 'Ehliyet / Ruhsat',
  warranty: 'Garanti Belgesi',
  contract: 'Sözleşme / Kontrat',
  title_deed: 'Tapu',
  health: 'Sağlık Raporu',
  insurance: 'Sigorta Poliçesi',
  invoice: 'Fatura / Makbuz',
  other: 'Diğer Belge'
};

const EVENT_ICONS: Record<string, string> = {
  birthday: '🎂',
  anniversary: '💍',
  nameday: '🌹',
  custom: '📅'
};

export default function DigitalVaultCard({
  vaultItems,
  importantDates,
  pets,
  onOpenAddVault,
  onOpenAddDate,
  onOpenAddPet,
  onRefresh,
  onToast
}: Props) {
  const [tab, setTab] = useState<'vault' | 'dates' | 'pets'>('vault');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Lightbox State
  const [activeLightboxItem, setActiveLightboxItem] = useState<VaultItem | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const touchStartDistRef = useRef<number | null>(null);

  // Klavye Escape ile Lightbox Kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeLightboxItem) {
        setActiveLightboxItem(null);
        setZoomScale(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxItem]);

  // Touch Pinch-to-zoom Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDistRef.current;
      setZoomScale(prev => Math.min(Math.max(prev * (factor > 1 ? 1.03 : 0.97), 0.5), 3.5));
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  // Kopyalama Yardımcısı
  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (onToast) onToast(`${label} panoya kopyalandı!`);
  };

  // Paylaşma Yardımcısı (Web Share API)
  const handleShareDocument = async (item: VaultItem) => {
    const textToShare = `${item.title} (${item.owner}) - Belge No: ${item.document_number || 'Belirtilmemiş'}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: textToShare,
          url: window.location.href
        });
      } catch {
        // Kullanıcı iptal etti veya desteklenmiyor
      }
    } else {
      copyToClipboard(textToShare, 'Belge bilgileri');
    }
  };

  // İndirme Yardımcısı
  const handleDownload = (item: VaultItem) => {
    if (!item.document_image_url) return;
    const isPdf = item.document_image_url.startsWith('data:application/pdf') || item.document_image_url.endsWith('.pdf');
    const isPng = item.document_image_url.startsWith('data:image/png');
    const ext = isPdf ? 'pdf' : isPng ? 'png' : 'jpg';
    const cleanTitle = (item.title || 'kasa-belge').toLowerCase().replace(/[^a-z0-9]/gi, '-');

    const link = document.createElement('a');
    link.href = item.document_image_url;
    link.download = `${cleanTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (onToast) onToast('Belge indirilmeye başlandı.');
  };

  // Silme Fonksiyonu
  const handleDelete = async (id: string, section: 'vault' | 'date' | 'pet') => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/digital-vault?id=${id}&section=${section}`, { method: 'DELETE' });
      const j = await res.json();
      if (j.success) {
        window.dispatchEvent(new CustomEvent('singularity-refresh'));
        if (onRefresh) onRefresh();
        if (onToast) onToast('Kayıt başarıyla silindi.');
      }
    } catch {
      //
    }
  };

  // Süresi Yaklaşan / Dolan Sayacı
  const expiringCount = vaultItems.filter(item =>
    item.alert_level === 'warning' || item.alert_level === 'critical' || item.visa_warning || (item.days_left !== null && item.days_left <= 30)
  ).length;

  // 1Password / Apple Wallet Kategori Filtreleme
  const filteredVault = vaultItems.filter(item => {
    const matchesSearch = (item.title + ' ' + (item.owner || '') + ' ' + (item.document_number || '') + ' ' + (item.issuer || '') + ' ' + (item.notes || ''))
      .toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === 'expiring_soon') {
      return item.alert_level === 'warning' || item.alert_level === 'critical' || Boolean(item.visa_warning) || (item.days_left !== null && item.days_left <= 30);
    }
    if (categoryFilter === 'passport_id') {
      return item.type === 'passport' || item.type === 'id_card' || item.type === 'license';
    }
    if (categoryFilter === 'warranty') {
      return item.type === 'warranty';
    }
    if (categoryFilter === 'deed_contract') {
      return item.type === 'contract' || item.type === 'title_deed';
    }
    if (categoryFilter === 'health') {
      return item.type === 'health' || item.type === 'insurance';
    }
    if (categoryFilter === 'invoice') {
      return item.type === 'invoice' || item.type === 'other';
    }
    return true;
  });

  const filteredDates = importantDates.filter(d =>
    (d.title + ' ' + d.person_name + ' ' + (d.gift_ideas || '') + ' ' + (d.notes || ''))
      .toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPets = pets.filter(p =>
    (p.name + ' ' + p.species + ' ' + (p.breed || '') + ' ' + (p.chip_no || '') + ' ' + (p.vet_name || ''))
      .toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="card" style={{ padding: '20px' }}>
      {/* Üst Kart Başlık ve Aksiyon Barı */}
      <div className="card-title-row" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🗂️</span>
          <div>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>Dijital Kasa & Evrak Yönetimi</span>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
              1Password & Apple Wallet güvenliğinde resmi belgeler, garantiler ve sözleşmeler
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {tab === 'vault' && (
            <button
              className="btn-subtle"
              onClick={() => onOpenAddVault()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(59, 130, 246, 0.1))',
                color: '#4F46E5',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              <span>📸</span>
              <span>Fotoğraf Tara (AI)</span>
            </button>
          )}

          {tab === 'vault' && (
            <button
              onClick={() => onOpenAddVault()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 800,
                background: 'var(--text-main)',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              <span>+</span>
              <span>Yeni Belge Ekle</span>
            </button>
          )}

          {tab === 'dates' && (
            <button
              onClick={() => onOpenAddDate()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 800,
                background: 'var(--text-main)',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              <span>+</span>
              <span>Yeni Gün Ekle</span>
            </button>
          )}

          {tab === 'pets' && (
            <button
              onClick={() => onOpenAddPet()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 800,
                background: 'var(--text-main)',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
            >
              <span>+</span>
              <span>Yeni Karne Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* Ana Sekme Seçici */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
        <button
          className={`choice-pill ${tab === 'vault' ? 'selected' : ''}`}
          onClick={() => setTab('vault')}
          style={{ flex: 1, padding: '10px 8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
        >
          📁 Dijital Kasa ({vaultItems.length})
        </button>
        <button
          className={`choice-pill ${tab === 'dates' ? 'selected' : ''}`}
          onClick={() => setTab('dates')}
          style={{ flex: 1, padding: '10px 8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
        >
          🎂 Önemli Günler ({importantDates.length})
        </button>
        <button
          className={`choice-pill ${tab === 'pets' ? 'selected' : ''}`}
          onClick={() => setTab('pets')}
          style={{ flex: 1, padding: '10px 8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
        >
          🐾 Evcil Hayvan Karnesi ({pets.length})
        </button>
      </div>

      {/* Arama & Kategori Filtreleme Çubuğu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
        <input
          type="text"
          placeholder={tab === 'vault' ? '🔍 Belge, kişi, seri no veya kurum ara...' : tab === 'dates' ? '🔍 Kişi, doğum günü veya hediye ara...' : '🔍 Evcil hayvan, çip no veya veteriner ara...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', fontSize: '13px', background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
        />

        {tab === 'vault' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setCategoryFilter('all')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)',
                border: categoryFilter === 'all' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: categoryFilter === 'all' ? 'var(--blue)' : 'var(--surface)',
                color: categoryFilter === 'all' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Tümü ({vaultItems.length})
            </button>

            {expiringCount > 0 && (
              <button
                onClick={() => setCategoryFilter('expiring_soon')}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)',
                  border: categoryFilter === 'expiring_soon' ? '1px solid var(--crimson)' : '1px solid #FECDD3',
                  background: categoryFilter === 'expiring_soon' ? 'var(--crimson)' : '#FFF1F2',
                  color: categoryFilter === 'expiring_soon' ? '#FFFFFF' : 'var(--crimson)', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                ⚠️ Süresi Dolan / Yaklaşan ({expiringCount})
              </button>
            )}

            <button
              onClick={() => setCategoryFilter('passport_id')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)',
                border: categoryFilter === 'passport_id' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: categoryFilter === 'passport_id' ? 'var(--blue)' : 'var(--surface)',
                color: categoryFilter === 'passport_id' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              🪪 Kimlik & Pasaport
            </button>

            <button
              onClick={() => setCategoryFilter('warranty')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)',
                border: categoryFilter === 'warranty' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: categoryFilter === 'warranty' ? 'var(--blue)' : 'var(--surface)',
                color: categoryFilter === 'warranty' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              🛡️ Garanti Belgesi
            </button>

            <button
              onClick={() => setCategoryFilter('deed_contract')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)',
                border: categoryFilter === 'deed_contract' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: categoryFilter === 'deed_contract' ? 'var(--blue)' : 'var(--surface)',
                color: categoryFilter === 'deed_contract' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              📄 Sözleşme & Tapu
            </button>

            <button
              onClick={() => setCategoryFilter('health')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)',
                border: categoryFilter === 'health' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: categoryFilter === 'health' ? 'var(--blue)' : 'var(--surface)',
                color: categoryFilter === 'health' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              🩺 Sağlık Raporu
            </button>

            <button
              onClick={() => setCategoryFilter('invoice')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--radius-full)',
                border: categoryFilter === 'invoice' ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: categoryFilter === 'invoice' ? 'var(--blue)' : 'var(--surface)',
                color: categoryFilter === 'invoice' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              🧾 Fatura & Makbuz
            </button>
          </div>
        )}
      </div>

      {/* 1. DİJİTAL KASA LİSTESİ (1024px+ 3 Sütunlu Grid / Mobilde Tek Sütun) */}
      {tab === 'vault' && (
        <div className="vault-grid">
          {filteredVault.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)', fontSize: '14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Kayıtlı Belge Bulunmuyor</div>
              <div style={{ fontSize: '12px' }}>Filtrenizi değiştirebilir veya "Fotoğraf Tara" butonuyla yeni bir belge ekleyebilirsiniz.</div>
            </div>
          ) : (
            filteredVault.map(item => {
              const icon = TYPE_ICONS[item.type] || '📁';
              const label = TYPE_LABELS[item.type] || 'Belge';

              // Geri Sayım Rozet Stili (Emerald > 30, Amber <= 30, Rose <= 0)
              let statusText = 'Süresiz';
              let statusBg = 'var(--surface-subtle)';
              let statusColor = 'var(--text-muted)';
              let statusBorder = 'var(--border)';

              if (item.days_left !== null) {
                if (item.days_left <= 0) {
                  statusText = `🔴 Süresi Doldu (${Math.abs(item.days_left)}g önce)`;
                  statusBg = '#FEE2E2';
                  statusColor = '#991B1B';
                  statusBorder = '#FCA5A5';
                } else if (item.days_left <= 30) {
                  statusText = `🟡 ${item.days_left} Gün Kaldı`;
                  statusBg = '#FEF3C7';
                  statusColor = '#92400E';
                  statusBorder = '#FDE68A';
                } else {
                  statusText = `🟢 ${item.days_left} Gün Kaldı`;
                  statusBg = '#D1FAE5';
                  statusColor = '#065F46';
                  statusBorder = '#A7F3D0';
                }
              }

              const hasImage = Boolean(item.document_image_url);
              const isPdf = item.document_image_url?.startsWith('data:application/pdf') || item.document_image_url?.endsWith('.pdf');

              return (
                <div key={item.id} className="vault-item-card">
                  {/* Pasaport Vize Uyarısı Banner */}
                  {item.visa_warning && (
                    <div style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '11px', fontWeight: 800, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️</span>
                      <span>VİZE UYARISI: Son 6 aydan az kaldı! Seyahat kısıtlanabilir.</span>
                    </div>
                  )}

                  {/* Belge Önizleme Kapağı (Varsa Görsel/PDF, Yoksa Şık 1Password Deseni) */}
                  <div
                    className="vault-preview-banner"
                    onClick={() => hasImage && setActiveLightboxItem(item)}
                    style={{ cursor: hasImage ? 'pointer' : 'default' }}
                  >
                    {hasImage ? (
                      isPdf ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '38px' }}>📄</span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', background: 'var(--surface)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            PDF Belgesi (Büyütmek için tıkla)
                          </span>
                        </div>
                      ) : (
                        <>
                          <img src={item.document_image_url} alt={item.title} />
                          <div style={{
                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.2s ease', color: 'white', fontWeight: 800, fontSize: '12px', gap: '6px'
                          }}
                          className="banner-hover-overlay"
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                          >
                            <span>🔍 Tam Ekran İncele</span>
                          </div>
                        </>
                      )
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: 0.65 }}>
                        <span style={{ fontSize: '32px' }}>{icon}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Belge Görseli Eklenmedi</span>
                      </div>
                    )}

                    {/* Sağ Üst Süre Rozeti */}
                    <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2 }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--radius-full)',
                        background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                      }}>
                        {statusText}
                      </span>
                    </div>
                  </div>

                  {/* Kart İçerik Gövdesi */}
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    {/* Üst Kategori & Sahip Etiketleri */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 800, color: '#4F46E5', background: 'rgba(99, 102, 241, 0.1)',
                        padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <span>{icon}</span>
                        <span>{label}</span>
                      </span>

                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        👤 {item.owner}
                      </span>
                    </div>

                    {/* Belge Başlığı */}
                    <div>
                      <div
                        style={{
                          fontSize: '15px', fontWeight: 800, color: 'var(--text-main)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </div>

                      {/* Seri No ve Kopyalama */}
                      {item.document_number && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No:</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                            {item.document_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.document_number || '', 'Seri numarası')}
                            title="Numarayı Panoya Kopyala"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                              fontSize: '11px', color: 'var(--blue)', borderRadius: '4px'
                            }}
                          >
                            📋
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Meta Detaylar: Veren Kurum & Tarihler */}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px', background: 'var(--surface-subtle)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      {item.issuer && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Kurum:</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.issuer}</span>
                        </div>
                      )}
                      {item.issue_date && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Veriliş:</span>
                          <span style={{ fontWeight: 600 }}>{item.issue_date}</span>
                        </div>
                      )}
                      {item.expiry_date && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Geçerlilik:</span>
                          <span style={{ fontWeight: 700, color: item.days_left !== null && item.days_left <= 0 ? '#DC2626' : 'var(--text-main)' }}>
                            {item.expiry_date}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Notlar */}
                    {item.notes && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                        📝 {item.notes}
                      </div>
                    )}
                  </div>

                  {/* Kart Alt Aksiyonları */}
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {hasImage ? (
                        <button
                          type="button"
                          onClick={() => setActiveLightboxItem(item)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: 'var(--surface)', color: 'var(--blue)', border: '1px solid var(--border)',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
                          }}
                        >
                          <span>🔍</span>
                          <span>Önizle</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Belge yok</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => onOpenAddVault(item)}
                        style={{
                          fontSize: '11px', padding: '4px 10px', background: 'var(--surface)',
                          border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 700, cursor: 'pointer',
                          color: 'var(--text-main)'
                        }}
                      >
                        ✏️ Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, 'vault')}
                        style={{
                          fontSize: '11px', padding: '4px 10px', background: 'var(--rose-bg)',
                          color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '6px',
                          fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. ÖNEMLİ GÜNLER LİSTESİ */}
      {tab === 'dates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredDates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Kayıtlı önemli gün bulunmuyor.
            </div>
          ) : (
            filteredDates.map(item => {
              const icon = EVENT_ICONS[item.event_type] || '📅';

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '14px',
                    background: item.days_left <= 7 ? 'var(--amber-bg)' : 'var(--surface-subtle)',
                    border: item.days_left <= 7 ? '1px solid var(--amber)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '26px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {item.title} ({item.person_name})
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                          Tarih: {item.event_date} (Gelecek: {item.next_date})
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: 'var(--radius-full)',
                      background: item.days_left <= 7 ? 'var(--amber)' : '#4F46E5',
                      color: '#FFFFFF'
                    }}>
                      {item.days_left === 0 ? '🎉 Bugün!' : `${item.days_left} Gün Kaldı`}
                    </span>
                  </div>

                  {item.gift_ideas && (
                    <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', color: 'var(--amber)' }}>
                      🎁 <strong>Hediye Fikirleri:</strong> {item.gift_ideas}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => onOpenAddDate(item)}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✏️ Düzenle / Hediye Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, 'date')}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🗑️ Sil
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. EVCİL HAYVAN KARNESİ */}
      {tab === 'pets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredPets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Kayıtlı evcil hayvan karnesi bulunmuyor.
            </div>
          ) : (
            filteredPets.map(pet => {
              const icon = pet.species === 'Kedi' ? '🐱' : pet.species === 'Köpek' ? '🐶' : pet.species === 'Kuş' ? '🦜' : '🐾';

              return (
                <div
                  key={pet.id}
                  style={{
                    padding: '14px',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '28px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {pet.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px', fontWeight: 600 }}>
                          <span>Tür: {pet.species}</span>
                          {pet.breed && <span>• Cins: {pet.breed}</span>}
                          {pet.chip_no && <span>• Çip No: {pet.chip_no}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {pet.vet_next_date && (
                    <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald)', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', color: 'var(--emerald)', fontWeight: 700 }}>
                      🩺 Gelecek Veteriner / Aşı Randevusu: {pet.vet_next_date} {pet.vet_name ? `(${pet.vet_name})` : ''}
                    </div>
                  )}

                  {pet.vaccinations && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      💉 <strong>Aşılar & Notlar:</strong> {pet.vaccinations}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => onOpenAddPet(pet)}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✏️ Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(pet.id, 'pet')}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid var(--rose)', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🗑️ Sil
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. APPLE-GRADE TAM EKRAN DOKUNMATİK LIGHTBOX */}
      {activeLightboxItem && activeLightboxItem.document_image_url && (
        <div
          className="vault-lightbox-overlay"
          onClick={() => { setActiveLightboxItem(null); setZoomScale(1); }}
        >
          {/* Üst Kontrol Barı */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(8px)',
              padding: '10px 16px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            <div style={{ color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>{TYPE_ICONS[activeLightboxItem.type] || '📁'}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>{activeLightboxItem.title}</div>
                <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{activeLightboxItem.owner} • {activeLightboxItem.document_number || 'Seri No Yok'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Zoom Kontrolleri */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 0, 0, 0.4)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.max(prev - 0.25, 0.5))}
                  style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: '16px', cursor: 'pointer', padding: '2px 6px' }}
                  title="Küçült"
                >
                  −
                </button>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#E5E7EB', minWidth: '40px', textAlign: 'center' }}>
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(prev + 0.25, 3.5))}
                  style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: '16px', cursor: 'pointer', padding: '2px 6px' }}
                  title="Büyüt"
                >
                  +
                </button>
                {zoomScale !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomScale(1)}
                    style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: '10px', fontWeight: 700, cursor: 'pointer', marginLeft: '4px' }}
                  >
                    Sıfırla
                  </button>
                )}
              </div>

              {/* Kapat Butonu */}
              <button
                type="button"
                onClick={() => { setActiveLightboxItem(null); setZoomScale(1); }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Orta Belge Görüntüleme Alanı (Pinch-to-zoom & Drag) */}
          <div
            onClick={e => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              padding: '16px 0'
            }}
          >
            {activeLightboxItem.document_image_url.startsWith('data:application/pdf') || activeLightboxItem.document_image_url.endsWith('.pdf') ? (
              <iframe
                src={activeLightboxItem.document_image_url}
                title="PDF Belge Önizleme"
                style={{ width: '92vw', maxWidth: '840px', height: '70vh', border: 'none', borderRadius: '12px' }}
              />
            ) : (
              <img
                src={activeLightboxItem.document_image_url}
                alt={activeLightboxItem.title}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  transform: `scale(${zoomScale})`,
                  transition: touchStartDistRef.current ? 'none' : 'transform 0.15s ease-out',
                  userSelect: 'none',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
                }}
                draggable={false}
              />
            )}
          </div>

          {/* Alt Aksiyon Dokı (İndirme & Paylaşma) */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', justifyContent: 'center', gap: '12px',
              padding: '12px 16px', background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(8px)', borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              maxWidth: '460px', margin: '0 auto', width: '100%'
            }}
          >
            <button
              type="button"
              onClick={() => handleDownload(activeLightboxItem)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: '#FFFFFF',
                color: '#111827',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              <span>⬇️</span>
              <span>Cihaza İndir</span>
            </button>

            <button
              type="button"
              onClick={() => handleShareDocument(activeLightboxItem)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 'var(--radius-full)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <span>🔗</span>
              <span>Paylaş</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
